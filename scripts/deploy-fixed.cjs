const { ethers } = require("hardhat");

async function main() {
  console.log("🟢 Starting deployment script...");

  // PancakeSwap Router address for BSC Testnet
  const PANCAKE_ROUTER = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"; 
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("🟢 Deploying with account:", deployer.address);

  console.log("🟢 Deploying TradingVault contract...");
  const TradingVault = await ethers.getContractFactory("TradingVault");
  
  console.log("⏳ Deploying contract (this may take 30-60 seconds)...");
  const vault = await TradingVault.deploy(PANCAKE_ROUTER, deployer.address);
  
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
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});