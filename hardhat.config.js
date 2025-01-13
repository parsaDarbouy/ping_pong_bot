require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/CExtymkWcmF1tMHS4AIQXJXXOcOASsXN"
      ,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
};

// `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`