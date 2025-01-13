const dynamoDBService = require('./dynamodb.service');
const { PING_PONG_STATUS, RETRY_OPTIONS } = require('../config/constants');

class PingPongService {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
  }

  async processPingEvent(event) {
    const blockNumber = event.blockNumber || event.log.blockNumber;
    const txHash = 
    event?.transactionHash || 
    event?.log?.transactionHash || 
    event?.pingTxHash;

    if (!blockNumber || !txHash) {
      throw new Error('Invalid event data: missing blockNumber or txHash');
    }    

    console.log("Processing Ping at block:", blockNumber);
    console.log("Ping transaction hash:", txHash);

    await dynamoDBService.storePingPongEvent(blockNumber, txHash, null, null, 0, PING_PONG_STATUS.PENDING);
    
    const backoff = (attempt) => {
      const jitter = Math.random() * 1000;
      return Math.min(
        RETRY_OPTIONS.initialDelayMs * Math.pow(2, attempt) + jitter,
        RETRY_OPTIONS.maxDelayMs
      );
    };

    for (let attempt = 0; attempt < RETRY_OPTIONS.maxRetries; attempt++) {
      try {
        const pongtx = await this.contract.pong(txHash, {
          // nonce: 185
          // gasPrice: 1
        });

        console.log(pongtx)

        // store nonce.
        await dynamoDBService.updatePong(blockNumber, pongtx.nonce, pongtx.gasPrice)
        
        console.log("Pong transaction sent:", pongtx.hash);
        await pongtx.wait(1,60000); // 1 min timout
        console.log("Pong confirmed for transaction:", txHash);
        
        await this.verifyPongEvent(pongtx);
        await dynamoDBService.updatePingPongTxHash(blockNumber, pongtx.hash, PING_PONG_STATUS.CONFIRMED);
        return pongtx;
      } catch (error) {
        if (error.code === 'TIMEOUT'){
          // call with higher gas
          console.log("timeout")
        }
        // ProviderError: replacement transaction underpriced
        const delay = backoff(attempt);
        console.error(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error(`Failed to process ping event after ${RETRY_OPTIONS.maxRetries} attempts`);
  }

  async verifyPongEvent(tx) {
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    if (receipt.status) {
      console.log("Pong event successfully emitted! 🎉");
    } else {
      // TODO: cancel the pong transaction and send pong again
      console.log("Warning: Pong transaction confirmed but no Pong event found");
    }
  }
}

module.exports = PingPongService; 
