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

  async processPingEvent(event, checkPending = true) {
    try {
      await this.pingPongService.processPingEvent(event, checkPending);
    } catch (error) {
      console.error("Failed to process ping event:", error);
      throw error;
    }
  }

  async checkPendingTransactions() {
    try {
      const pendingEvents = await dynamoDBService.getPendingEvents();
      if (pendingEvents.length > 0) {
        console.log(`Found ${pendingEvents.length} pending transactions to verify`);
        
        for (const event of pendingEvents) {
          // Check if Pong exists for this Ping
          const filter = this.contract.filters.Pong();
          const pongEvents = await this.contract.queryFilter(filter);
          
          const hasPong = pongEvents.some(pongEvent => 
            pongEvent.args.txHash === event.pingTxHash
          );

          if (hasPong) {
            console.log(`Found existing Pong for Ping at block ${event.blockNumber}`);

            
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
            if (receipt.status) {
              await dynamoDBService.updatePingPongStatus(
                event.blockNumber, 
                PING_PONG_STATUS.CONFIRMED
              );
              console.log(`Pong event is confirmed for ping at block ${event.blockNumber}! 🎉`);
            } else {
              // TODO: cancel the pong transaction and send pong again
              console.log(`Warning: Pong transaction is not confirmed for ping at block ${event.blockNumber}!`);
            }



          } else {
            console.log(`No Pong found for Ping at block ${event.blockNumber}, sending new Pong`);
            await this.processPingEvent(event, false);
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
    // First check pending transactions
    await this.checkPendingTransactions();

    // TODO: GET BLOCK NUMBER FROM env variable, and if its less than last Process Block start from there or anyway start from env variable
    // CHECK how the TASK ask us to d

    // Now the last processed block come from the main, to make sure it doesn't change while we are listenting.
    // const lastProcessedBlock = await dynamoDBService.getLastProcessedBlock();
    // console.log("Last processed block:", lastProcessedBlock);

    // const events = await this.contract.queryFilter("Ping", lastProcessedBlock + 1);
    
    if (events.length > 0) {
      console.log("\nFound", events.length, "historical Ping events");
      
      for (const event of events) {
        await this.processPingEvent(event, false);
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
