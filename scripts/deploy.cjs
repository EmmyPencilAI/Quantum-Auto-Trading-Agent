const { ethers } = require("hardhat");

async function main() {
  console.log("🟢 1. Starting deployment script...");

  const PANCAKE_ROUTER = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"; 
  
  console.log("🟢 2. Getting wallet connection...");
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log("🟢 3. Deploying with wallet account:", deployer.address);

  console.log("🟢 4. Fetching TradingVault contract factory...");
  const TradingVault = await ethers.getContractFactory("TradingVault");

  console.log("⏳ 5. Sending contract to the blockchain (This might take 10-30 seconds)...");
  const vault = await TradingVault.deploy(PANCAKE_ROUTER, deployer.address);

  console.log("⏳ 6. Transaction sent! Waiting for network confirmation...");
  
  // Failsafe: Handle both Ethers v5 and Ethers v6 syntax
  let address;
  if (vault.waitForDeployment) {
      await vault.waitForDeployment(); // Ethers v6
      address = await vault.getAddress();
  } else {
      await vault.deployed(); // Ethers v5
      address = vault.address;
  }
  
  console.log("\n=========================================");
  console.log("🚀 SUCCESS! TradingVault deployed to:", address);
  console.log("=========================================\n");
}

main().catch((error) => {
  console.error("\n❌ CRITICAL ERROR DURING DEPLOYMENT:");
  console.error(error);
  process.exitCode = 1;
});