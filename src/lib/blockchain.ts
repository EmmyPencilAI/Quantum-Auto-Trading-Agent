import { ethers } from 'ethers';
import { APP_CONFIG } from '../config';

export interface GasStrategy {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasPrice?: bigint;
}

export async function getSmartGasPrice(provider: ethers.Provider): Promise<GasStrategy> {
  try {
    const feeData = await provider.getFeeData();
    
    // For EIP-1559 chains (like modern BSC, Ethereum)
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // "Fastest" route strategy: add 20% to base and priority fees
      const multiplier = BigInt(120); // 1.2x
      const divisor = BigInt(100);
      
      return {
        maxFeePerGas: (feeData.maxFeePerGas * multiplier) / divisor,
        maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * multiplier) / divisor,
      };
    }
    
    // Legacy fallback
    const gasPrice = feeData.gasPrice;
    if (!gasPrice) {
      // Manual fallback if feeData.gasPrice is null
      return {
        maxFeePerGas: ethers.parseUnits('5', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
        gasPrice: ethers.parseUnits('5', 'gwei')
      };
    }
    
    return {
      maxFeePerGas: (gasPrice * BigInt(120)) / BigInt(100),
      maxPriorityFeePerGas: (gasPrice * BigInt(20)) / BigInt(100),
      gasPrice: (gasPrice * BigInt(120)) / BigInt(100)
    };
  } catch (error) {
    console.warn("Failed to fetch gas data, using defaults", error);
    const defaultPrice = ethers.parseUnits('5', 'gwei'); // Default gas for BSC
    return {
      maxFeePerGas: defaultPrice,
      maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
      gasPrice: defaultPrice
    };
  }
}

export async function sendQuantumTransaction(
  signer: ethers.Signer,
  to: string,
  amount: string,
  data?: string
) {
  const provider = signer.provider;
  if (!provider) throw new Error("No provider found on signer");

  const gasStrategy = await getSmartGasPrice(provider);
  
  const txRequest: ethers.TransactionRequest = {
    to,
    value: ethers.parseEther(amount),
    data: data || '0x',
    ...gasStrategy
  };

  // Estimate gas for safety
  try {
    const gasLimit = await signer.estimateGas(txRequest);
    txRequest.gasLimit = (gasLimit * BigInt(110)) / BigInt(100); // 10% buffer
  } catch (e) {
    console.warn("Gas estimation failed, using default limit", e);
    txRequest.gasLimit = BigInt(210000); 
  }

  const tx = await signer.sendTransaction(txRequest);
  return tx;
}

export const TRADING_CONTRACT_ABI = [
  "function fund() public payable",
  "function startTrade(string pair, string strategy) public",
  "function stopTrade(string pair) public",
  "function settle(address user, uint256 pnl, bool isWin) public",
  "event TradeSettled(address indexed user, uint256 pnl, bool isWin)"
];
