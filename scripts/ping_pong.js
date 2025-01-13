const { ethers } = require("hardhat");
const pre = require('./pre_listen.js');
const { CONTRACT_ADDRESS, CONTRACT_ABI, RETRY_OPTIONS, PING_PONG_STATUS } = require('./config/constants');
const dynamoDBService = require('./services/dynamodb.service');
const PingPongService = require('./services/ping-pong.service');

class PingPongListener {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
    this.pingPongService = new PingPongService(contract, signer);
    this.isShuttingDown = false;
  }

  async cleanup() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('Removing event listeners...');
    // Remove all listeners from the contract
    this.contract.removeAllListeners();
  }

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

async function healthCheck(){
  try{
    await ethers.provider.getNetwork()
    return true
  } catch (error){
    console.log(`Provider connection error:`, error.message)
    return false
  }
}

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
    pre.pre_listen(contract,signer, historicalEvents);

    // Start the listener
    const listener = new PingPongListener(contract, signer);
    global.listener = listener; // Save listener globally for potential cleanup
    await listener.startListening();

    console.log("Listener started successfully.");
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


