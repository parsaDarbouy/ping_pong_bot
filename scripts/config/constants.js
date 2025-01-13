const CONTRACT_ADDRESS = "0xf108Bc7795bc897C4EC158845eDD2B1BafD06f47";
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

const AWS_CONFIG = {
  region: "us-east-1",
  tableName: "ping-pong"
};

// const PROVIDERS = [ remember module export
//   `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
//   `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
//   // process.env.QUICKNODE_URL
// ];

const RETRY_OPTIONS = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 10000
};

const WAIT_TIME_OUT = 120000

const PING_PONG_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  FAILED: "failed"
};

module.exports = {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  AWS_CONFIG,
  RETRY_OPTIONS,
  PING_PONG_STATUS,
  WAIT_TIME_OUT
}; 
