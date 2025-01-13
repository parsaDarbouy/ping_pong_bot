const dynamoDBService = require('./dynamodb.service');
const { PING_PONG_STATUS, RETRY_OPTIONS, WAIT_TIME_OUT } = require('../config/constants');

class PingPongService {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
  }

async processPingEvent(event) {
  const blockNumber = event.blockNumber || event.log?.blockNumber;
  const txHash =
    event?.transactionHash ||
    event?.log?.transactionHash ||
    event?.pingTxHash;

  if (!blockNumber || !txHash) {
    throw new Error("Invalid event data: missing blockNumber or txHash");
  }

  console.log("Processing Ping at block:", blockNumber);
  console.log("Ping transaction hash:", txHash);

  await dynamoDBService.storePingPongEvent(
    blockNumber,
    txHash,
    null,
    null,
    null,
    PING_PONG_STATUS.PENDING
  );

  const calculateBackoff = (attempt) => {
    const jitter = Math.random() * 1000;
    return Math.min(
      RETRY_OPTIONS.initialDelayMs * 2 ** attempt + jitter,
      RETRY_OPTIONS.maxDelayMs
    );
  };

  let nonce = null;
  let gasPrice = null;

  for (let attempt = 0; attempt < RETRY_OPTIONS.maxRetries; attempt++) {
    try {
      let pongTx;

      if (nonce === null || gasPrice === null) {
        pongTx = await this.contract.pong(txHash);
        nonce = pongTx.nonce;
        gasPrice = pongTx.gasPrice;

        await dynamoDBService.updatePong(blockNumber, nonce, gasPrice);
      } else {
        const updatedGasPrice = gasPrice.mul(115).div(100); // 15% increase in gas price
        pongTx = await this.contract.pong(txHash, {
          nonce,
          gasPrice: updatedGasPrice,
        });

        await dynamoDBService.updatePong(blockNumber, nonce, updatedGasPrice);
      }

      console.log("Pong transaction sent:", pongTx.hash);
      await pongTx.wait(1, WAIT_TIME_OUT);
      console.log("Pong confirmed for transaction:", txHash);

      await this.verifyPongEvent(pongTx);
      await dynamoDBService.updatePingPongTxHash(
        blockNumber,
        pongTx.hash,
        PING_PONG_STATUS.CONFIRMED
      );

      return pongTx; // Successfully processed the event
    } catch (error) {
      if (error.code === "TIMEOUT") {
        console.warn(
          "Transaction timeout - considering replacement due to spiking gas prices."
        );
      } else {
        nonce = null;
        gasPrice = null;
        const delay = calculateBackoff(attempt);
        console.error(
          `Attempt ${attempt + 1} failed. Retrying in ${delay}ms:`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to process Ping event after ${RETRY_OPTIONS.maxRetries} attempts`
  );
}

  async verifyPongEvent(tx) {
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    if (receipt.status) {
      console.log("Pong event successfully emitted! 🎉");
    } else {
      throw new Error("Warning: Pong transaction confirmed but no Pong event found");
    }
  }
}

module.exports = PingPongService; 
