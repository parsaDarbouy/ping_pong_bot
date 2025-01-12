const dynamoDBService = require('./dynamodb.service');
const { PING_PONG_STATUS, RETRY_OPTIONS } = require('../config/constants');

class PingPongService {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
  }

  async processPingEvent(event, checkPending = true) {
    const blockNumber = event.blockNumber || event.log.blockNumber;
    const txHash = event.transactionHash || event.log.transactionHash || event.pingTxHash;
    
    if (!blockNumber || !txHash) {
      throw new Error('Invalid event data: missing blockNumber or txHash');
    }

    if (checkPending) {
      const pendingEvents = await dynamoDBService.getPendingEvents();
      const existingEvent = pendingEvents.find(e => e.blockNumber === blockNumber);
      if (existingEvent?.status === PING_PONG_STATUS.CONFIRMED) {
        console.log(`Event at block ${blockNumber} already confirmed`);
        return;
      }
    }

    console.log("Processing Ping at block:", blockNumber);
    console.log("Ping transaction hash:", txHash);

    await dynamoDBService.storePingPongEvent(blockNumber, txHash, null, PING_PONG_STATUS.PENDING);
    
    const backoff = (attempt) => {
      const jitter = Math.random() * 1000;
      return Math.min(
        RETRY_OPTIONS.initialDelayMs * Math.pow(2, attempt) + jitter,
        RETRY_OPTIONS.maxDelayMs
      );
    };

    for (let attempt = 0; attempt < RETRY_OPTIONS.maxRetries; attempt++) {
      try {
        const pongtx = await this.contract.pong(txHash);
        console.log("Pong transaction sent:", pongtx.hash);
        await pongtx.wait();
        console.log("Pong confirmed for transaction:", txHash);
        
        await this.verifyPongEvent(pongtx);
        await dynamoDBService.updatePingPongTxHash(blockNumber, pongtx.hash, PING_PONG_STATUS.CONFIRMED);
        return pongtx;
      } catch (error) {
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
