const { ethers } = require("hardhat");
const { CONTRACT_ADDRESS, CONTRACT_ABI, PING_PONG_STATUS } = require("./config/constants");
const dynamoDBService = require("./services/dynamodb.service");
const PingPongService = require("./services/ping-pong.service");

class PingPongProcessor {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
    this.pingPongService = new PingPongService(contract, signer);
  }

  /**
   * Processes a single Ping event by delegating to PingPongService.
   * @param {Object} event - The Ping event to process.
   */
  async processPingEvent(event) {
    try {
      await this.pingPongService.processPingEvent(event);
    } catch (error) {
      console.error("Failed to process Ping event:", error);
      throw error;
    }
  }

  /**
   * Verifies and processes pending transactions stored in the database.
   * @param {Array} pongEvents - Array of Pong events from the contract.
   */
  async checkPendingTransactions(pongEvents) {
    try {
      const pendingEvents = await dynamoDBService.getPendingEvents();

      if (pendingEvents.length === 0) {
        console.log("No pending transactions found.");
        return;
      }

      console.log(`Found ${pendingEvents.length} pending transactions to verify.`);

      for (const event of pendingEvents) {
        const matchedPong = pongEvents.find(
          (pongEvent) =>
            pongEvent.args.txHash === event.pingTxHash &&
            pongEvent.address === CONTRACT_ADDRESS
        );

        if (matchedPong) {
          console.log(`Found existing Pong for Ping at block ${event.blockNumber}`);
          const receipt = await ethers.provider.getTransactionReceipt(matchedPong.transactionHash);

          if (receipt.status) {
            await dynamoDBService.updatePingPongTxHash(
              event.blockNumber,
              matchedPong.transactionHash,
              PING_PONG_STATUS.CONFIRMED
            );
            console.log(`Pong event confirmed for Ping at block ${event.blockNumber}! 🎉`);
          } else {
            console.warn(`Pong transaction is not confirmed for Ping at block ${event.blockNumber}. Retrying.`);
            await this.processPingEvent(event);
          }
        } else {
          console.log(`No Pong found for Ping at block ${event.blockNumber}. Sending new Pong.`);
          await this.processPingEvent(event);
        }
      }
    } catch (error) {
      console.error("Error checking pending transactions:", error);
      throw error;
    }
  }

  /**
   * Processes historical Ping events and sends Pong transactions if necessary.
   * @param {Array} events - Array of historical Ping events.
   */
  async processHistoricalEvents(events) {
    try {
      const pongFilter = this.contract.filters.Pong();
      const pongEvents = await this.contract.queryFilter(pongFilter);

      // Verify and process pending transactions
      await this.checkPendingTransactions(pongEvents);

      if (events.length === 0) {
        console.log("No historical Ping events found.");
        return;
      }

      console.log(`\nFound ${events.length} historical Ping events.`);

      for (const pingEvent of events) {
        const matchedPong = pongEvents.find(
          (pongEvent) =>
            pongEvent.args.txHash === pingEvent.transactionHash &&
            pongEvent.address === CONTRACT_ADDRESS
        );

        if (matchedPong) {
          console.log(`Pong already exists for Ping event with transaction hash: ${pingEvent.transactionHash}`);
          continue;
        }

        await this.processPingEvent(pingEvent);
      }
    } catch (error) {
      console.error("Error processing historical events:", error);
      throw error;
    }
  }
}

/**
 * Prepares and processes historical events for a given contract.
 * @param {Object} contract - The smart contract instance.
 * @param {Object} signer - The signer instance for sending transactions.
 * @param {Array} historicalEvents - Array of historical Ping events to process.
 */
async function pre_listen(contract, signer, historicalEvents) {
  const processor = new PingPongProcessor(contract, signer);
  await processor.processHistoricalEvents(historicalEvents);
}

module.exports = {
  pre_listen,
};