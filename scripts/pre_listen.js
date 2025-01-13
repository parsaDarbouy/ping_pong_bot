const { ethers } = require("hardhat");
const { CONTRACT_ADDRESS, CONTRACT_ABI, PING_PONG_STATUS } = require('./config/constants');
const dynamoDBService = require('./services/dynamodb.service');
const PingPongService = require('./services/ping-pong.service');

class PingPongProcessor {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
    this.pingPongService = new PingPongService(contract, signer);
  }

  async processPingEvent(event) {
    try {
      await this.pingPongService.processPingEvent(event);
    } catch (error) {
      console.error("Failed to process ping event:", error);
      throw error;
    }
  }

  async checkPendingTransactions(pongEvents) {
    try {
      const pendingEvents = await dynamoDBService.getPendingEvents();
      if (pendingEvents.length > 0) {
        console.log(`Found ${pendingEvents.length} pending transactions to verify`);
        
        for (const event of pendingEvents) {
          // Check if Pong exists for this Ping
          const matchedPong = pongEvents.find(pongEvent => 
            (pongEvent.args.txHash === event.pingTxHash) && (pongEvent.address === CONTRACT_ADDRESS)
          );
          

          if (matchedPong) {
            console.log(`Found existing Pong for Ping at block ${event.blockNumber}`);
            console.log(`pong txHash for ${matchedPong.transactionHash}`)
            
            const receipt = await ethers.provider.getTransactionReceipt(matchedPong.transactionHash);
            if (receipt.status) {
              await dynamoDBService.updatePingPongTxHash(event.blockNumber, matchedPong.transactionHash, PING_PONG_STATUS.CONFIRMED);
              console.log(`Pong event is confirmed for ping at block ${event.blockNumber}! 🎉`);
            } else {
              // TODO: cancel the pong transaction and send pong again
              console.log(`Warning: Pong transaction is not confirmed for ping at block ${event.blockNumber}!`);
            }
          } else {
            console.log(`No Pong found for Ping at block ${event.blockNumber}, sending new Pong`);
            await this.processPingEvent(event);
          }
        }
      } else {
        console.log("No pending transactions found");
      }
    } catch (error) {
      console.error("Error checking pending transactions:", error);
      throw error;
    }
  }

  async processHistoricalEvents(events) {
    // Check if Pong exists for this Ping
    const filter = this.contract.filters.Pong();
    const pongEvents = await this.contract.queryFilter(filter);

    // First check pending transactions
    await this.checkPendingTransactions(pongEvents);

    // TODO: GET BLOCK NUMBER FROM env variable, and if its less than last Process Block start from there or anyway start from env variable
    // CHECK how the TASK ask us to d



    if (events.length > 0) {
      console.log("\nFound", events.length, "historical Ping events");


      for (const pingEvent of events) {
        const matchedPong = pongEvents.find(pongEvent => 
          (pongEvent.args.txHash === pingEvent.transactionHash) && (pongEvent.address === CONTRACT_ADDRESS)
        );
        if (matchedPong) {
          console.log("The pong exists for this ping!")
          return;
        } 

        await this.processPingEvent(pingEvent, false);
      }
    } else {
      console.log("No historical Ping events found");
    }
  }
}

async function pre_listen(historical_events) {
  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  
  const processor = new PingPongProcessor(contract, signer);
  await processor.processHistoricalEvents(historical_events);
}

module.exports = {
  pre_listen
};
