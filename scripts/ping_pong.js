const { ethers } = require("hardhat");
const pre = require('./pre_listen.js');
const { CONTRACT_ADDRESS, CONTRACT_ABI, RETRY_OPTIONS, PING_PONG_STATUS } = require('./config/constants');
const dynamoDBService = require('./services/dynamodb.service');
const PingPongService = require('./services/ping-pong.service');


/**
 * PingPongListener class.
 * Listens for and processes "Ping" events emitted by the contract.
 */
class PingPongListener {
  /**
   * Creates a new PingPongListener instance.
   * 
   * @param {Object} contract - The smart contract instance.
   * @param {Object} signer - The signer for interacting with the contract.
   */
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
    this.pingPongService = new PingPongService(contract, signer);
    this.isShuttingDown = false;
  }

  /**
   * Cleans up resources by removing all contract event listeners.
   * 
   * @returns {Promise<void>} Resolves when cleanup is complete.
   */
  async cleanup() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('Removing event listeners...');
    // Remove all listeners from the contract
    this.contract.removeAllListeners();
  }

  /**
   * Handles a "Ping" event emitted by the contract.
   * 
   * @param {Object} event - The event object containing details of the "Ping" event.
   * @returns {Promise<void>} Resolves when the event is processed or logs an error on failure.
   */
  async handlePingEvent(event) {
    try {
      await this.pingPongService.processPingEvent(event);
    } catch (error) {
      console.error("Error handling ping event:", error.message, {
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    }
  }


  /**
   * Starts listening for "Ping" events emitted by the contract.
   * 
   * @returns {Promise<never>} A promise that never resolves to keep the listener active.
   */
  async startListening() {
    console.log("Listening for Ping events...👂");
    this.contract.on("Ping", async (event) => {
      try {
        await this.handlePingEvent(event);
      } catch (error) {
        console.error("Error handling ping event:", error);
      }
    });

    return new Promise(() => {});
  }
}


/**
 * Gracefully handles application shutdown by removing event listeners and 
 * performing cleanup tasks.
 * 
 * @param {string} signal - The shutdown signal (e.g., 'SIGTERM', 'SIGINT').
 */
async function handleShutdown(signal) {
  console.log(`Received ${signal}. Performing graceful shutdown...`);
  const timeout = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  
  try {
    if (global.listener) {
      await global.listener.cleanup();
    }
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    console.error(`Error during ${signal} shutdown:`, error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));


/**
 * Verifies the health of the blockchain provider by attempting to retrieve the network.
 * 
 * @returns {Promise<boolean>} True if the provider is healthy; otherwise, false.
 */
async function healthCheck(){
  try{
    await ethers.provider.getNetwork()
    return true
  } catch (error){
    console.log(`Provider connection error:`, error.message)
    return false
  }
}


/**
 * Main entry point of the application.
 * Initializes the contract, fetches historical events, and starts listening for new events.
 */
async function main() {
  // Check provider health
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.error("Exiting due to provider health check failure.");
    process.exit(1);
  }

  try {
    // Retrieve the last processed block from the database
    const lastProcessedBlock = await dynamoDBService.getLastProcessedBlock();
    console.log("Last processed block:", lastProcessedBlock);

    // Initialize the contract
    const [signer] = await ethers.getSigners();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Fetch missed events and handle them
    const historicalEvents = await contract.queryFilter(
      "Ping",
      lastProcessedBlock + 1
    );

    // Run pre_listen and listener concurrently
    const listener = new PingPongListener(contract, signer);
    global.listener = listener; // Save listener globally for potential cleanup
    const listenerPromise = listener.startListening();
    const preListenPromise = pre.pre_listen(contract, signer, historicalEvents);


    // Await both promises concurrently
    await Promise.all([preListenPromise, listenerPromise]);

    console.log("Both pre_listen and listener completed successfully.");
  } catch (error) {
    console.error("An error occurred during execution:", error);
    process.exit(1);
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


