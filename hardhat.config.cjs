require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

let myPrivateKey = process.env.PRIVATE_KEY || "";
if (myPrivateKey && !myPrivateKey.startsWith("0x")) {
    myPrivateKey = "0x" + myPrivateKey;
}
myPrivateKey = myPrivateKey.trim();

console.log("=========================================");
console.log("🟢 Config Check: Private Key loaded!");
console.log("🟢 Config Check: Connecting to BSC Node 2...");
console.log("=========================================\n");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        bscTestnet: {
            url: "https://data-seed-prebsc-2-s1.binance.org:8545", // Backup Binance Node
            chainId: 97,
            accounts: myPrivateKey.length === 66 ? [myPrivateKey] : [],
            timeout: 120000 // Force it to wait up to 2 minutes for a response
        }
    }
};