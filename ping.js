const { ethers } = require("hardhat");

async function main() {
  // Ping contract address on Sepolia
  const CONTRACT_ADDRESS = "0xf108Bc7795bc897C4EC158845eDD2B1BafD06f47";

  
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

  const Contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethers.provider);


const [signer] = await ethers.getSigners();
const contractWithSigner = Contract.connect(signer);

try {
    const result = await contractWithSigner.ping();
    console.log(result)
    console.log("Ping:");
    await result.wait();
    console.log("Confirmed!");
    } catch (error) {
    console.error("Failed to ping.");
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
