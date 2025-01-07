const { ethers } = require("hardhat");
const fs = require('node:fs').promises;
const path = require('path');


async function pre_listen() {
  // Ping contract address on Sepolia
  const CONTRACT_ADDRESS = "0xA7F42ff7433cB268dD7D59be62b00c30dEd28d3D";

  
  // Contract ABI
  const CONTRACT_ABI = [
    {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
    {"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"pinger","type":"address"}],"name":"NewPinger","type":"event"},
    {"anonymous":false,"inputs":[],"name":"Ping","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"txHash","type":"bytes32"}],"name":"Pong","type":"event"},
    {"inputs":[{"internalType":"address","name":"_pinger","type":"address"}],"name":"changePinger","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"ping","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"pinger","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"_txHash","type":"bytes32"}],"name":"pong","outputs":[],"stateMutability":"nonpayable","type":"function"}
  ];

  const filePath = path.join(__dirname, '../data.txt'); 
  const Contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethers.provider);

  // Get the last block number that we have pong
  let block_number = 0
  try {
    block_number = await fs.readFile(filePath, { encoding: 'utf8' });
    block_number = Number(block_number)
    console.log(block_number);
  } catch (err) {
    console.log(err);
  }

  const events = await Contract.queryFilter("Ping()",block_number+1);
  
  if (events.length > 0) {
    console.log("\nFound", events.length, "Ping events:");
    
    const [signer] = await ethers.getSigners();
    const contractWithSigner = Contract.connect(signer);
    
    for (const event of events) {
      console.log("Ping at block:", event.blockNumber);
      console.log("Ping at hash:", event.blockHash);
      console.log("Ping at txHash:", event.transactionHash);
      
      try {
        const tx = await contractWithSigner.pong(event.transactionHash);
        console.log("Pong sent for ping:", event.blockNumber);
        await tx.wait();
        console.log("Pong confirmed!");

        // Saving the block of the last ping
        try {
          fs.writeFile(filePath, event.blockNumber.toString());
          console.log("Saved the block")
        } catch (err) {
          console.error(err);
        }


      } catch (error) {
        console.error("Failed to pong for tx:", event.blockNumber, error.message);
      }
    }
    
    
  } else {
    console.log("No Ping events found.");
  }
}


module.exports = {
  pre_listen,
};