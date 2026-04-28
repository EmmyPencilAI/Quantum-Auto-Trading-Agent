const { ethers } = require("hardhat");

async function main() {
  console.log("🟢 Starting deployment script...");

  // PancakeSwap Router address for BSC Testnet
  const PANCAKE_ROUTER = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"; 
  
  // Get provider and signer manually to avoid configuration issues
  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-2-s1.binance.org:8545");
  
  // Load private key from environment
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === "your_private_key_here") {
    throw new Error("❌ PRIVATE_KEY not found in .env file. Please add your private key.");
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("🟢 Deploying with account:", wallet.address);

  console.log("🟢 Deploying TradingVault contract...");
  const TradingVault = await ethers.getContractFactory("TradingVault", wallet);
  
  console.log("⏳ Deploying contract (this may take 30-60 seconds)...");
  const vault = await TradingVault.deploy(PANCAKE_ROUTER, wallet.address);
  
  console.log("⏳ Waiting for deployment confirmation...");
  await vault.waitForDeployment();
  
  const address = await vault.getAddress();
  console.log("\n=========================================");
  console.log("🚀 SUCCESS! TradingVault deployed to:", address);
  console.log("=========================================\n");
  
  // Save the address to a file for easy reference
  const fs = require('fs');
  fs.writeFileSync('.deployed-contract', address);
  console.log("📝 Contract address saved to .deployed-contract file");
  
  return address;
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:");
  console.error(error.message);
  process.exitCode = 1;
});