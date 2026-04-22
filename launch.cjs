// 1. Force the network before Hardhat even boots up
process.env.HARDHAT_NETWORK = "bscTestnet";

require("dotenv").config();
const hre = require("hardhat");

async function main() {
    console.log("\n🚀 1. Bypassing CLI and booting direct deployment...");

    // Testnet PancakeSwap Router
    const PANCAKE_ROUTER = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";

    const signers = await hre.ethers.getSigners();
    if (signers.length === 0) {
        throw new Error("No wallet found! Private key is missing or invalid.");
    }

    const deployer = signers[0];
    console.log("🟢 2. Wallet connected! Deploying from:", deployer.address);

    const TradingVault = await hre.ethers.getContractFactory("TradingVault");

    console.log("⏳ 3. Beaming contract to Binance Testnet (this takes 10-30 seconds)...");
    const vault = await TradingVault.deploy(PANCAKE_ROUTER, deployer.address);

    // Failsafe for Ethers v5 vs v6
    if (vault.waitForDeployment) {
        await vault.waitForDeployment();
        console.log("\n🎉 =============================================");
        console.log("✅ SUCCESS! Contract Address:", await vault.getAddress());
        console.log("🎉 =============================================\n");
    } else {
        await vault.deployed();
        console.log("\n🎉 =============================================");
        console.log("✅ SUCCESS! Contract Address:", vault.address);
        console.log("🎉 =============================================\n");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error.message || error);
        process.exit(1);
    });