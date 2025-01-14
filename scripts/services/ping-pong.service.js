const dynamoDBService = require('./dynamodb.service');
const { PING_PONG_STATUS, RETRY_OPTIONS, WAIT_TIME_OUT } = require('../config/constants');

/**
 * PingPongService handles ping-pong interactions with a smart contract,
 * ensuring pings are processed and pongs are sent and confirmed correctly.
 *
 * @param {Object} contract - The smart contract instance for ping-pong operations.
 * @param {Object} signer - The signer object to authorize transactions.
 */
class PingPongService {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
  }


/**
 * Processes a ping event by sending a pong transaction and updating the status in the database.
 * Handles retries with exponential backoff and increases gas prices if necessary.
 *
 * @param {Object} event - The event object containing ping details.
 *   - `blockNumber` {number} (optional): The block number of the ping event.
 *   - `transactionHash` {string} (optional): The transaction hash of the ping event.
 *   - `log` {Object} (optional): The log object containing `blockNumber` or `transactionHash`.
 * @returns {Promise<Object>} - Returns the pong transaction object if successful.
 * @throws {Error} - Throws an error if processing fails after the maximum retries.
 */
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

  let { nonce, gasPrice } = await dynamoDBService.getNoncePrice(blockNumber)


  if (nonce === null || gasPrice === null) {
    await dynamoDBService.storePingPongEvent(
      blockNumber,
      txHash,
      null,
      null,
      null,
      PING_PONG_STATUS.PENDING
    );
  }

  const calculateBackoff = (attempt) => {
    const jitter = Math.random() * 1000;
    return Math.min(
      RETRY_OPTIONS.initialDelayMs * 2 ** attempt + jitter,
      RETRY_OPTIONS.maxDelayMs
    );
  };

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

  /**
   * Verifies that a pong event has been successfully emitted by the smart contract.
   * Checks the transaction receipt to confirm its status.
   *
   * @param {Object} tx - The pong transaction object.
   *   - `hash` {string}: The hash of the pong transaction.
   * @returns {Promise<void>} - Resolves if the pong event is successfully verified.
   * @throws {Error} - Throws an error if the transaction is confirmed but no Pong event is found.
   */
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
