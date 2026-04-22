import { ethers } from 'ethers';
import { APP_CONFIG } from '../config';

// TradingVault ABI
export const TRADING_VAULT_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function executeBuyTrade(string memory pair, address tokenOut, uint256 amountIn, uint256 minAmountOut) external',
  'function executeSellTrade(string memory pair, address tokenIn, uint256 amountIn, uint256 minAmountOut) external',
  'function getUserInfo(address user) external view returns (uint256 balance, uint256 profit, uint256 lastTradeTime, uint256 tradeCount)',
  'function getTradeDetails(uint256 tradeId) external view returns (address user, string memory pair, uint256 amountIn, uint256 amountOut, bool isBuy, uint256 timestamp, uint256 feePaid, bool success)',
  'function getUserTrades(address user) external view returns (uint256[] memory)',
  'function getContractBalance() external view returns (uint256)',
  'function getContractTokenBalance(address token) external view returns (uint256)',
  'function updateTreasuryWallet(address newTreasury) external',
  'function updateMaxTradeSize(uint256 newMax) external',
  'function emergencyWithdraw(address token, uint256 amount) external',
  'event Deposited(address indexed user, uint256 amount)',
  'event Withdrawn(address indexed user, uint256 amount)',
  'event TradeExecuted(address indexed user, string pair, uint256 amountIn, uint256 amountOut, bool isBuy, uint256 fee, uint256 timestamp)',
  'event ProfitDistributed(address indexed user, uint256 userShare, uint256 treasuryShare)',
  'event EmergencyWithdraw(address indexed user, uint256 amount)'
] as const;

// Contract address - should be set in environment variables
const CONTRACT_ADDRESS = process.env.VAULT_CONTRACT_ADDRESS || APP_CONFIG.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

// PancakeSwap Router addresses
const ROUTERS: Record<string, string> = {
  '0x38': '0x10ED43C718714eb63d5aA57B78B54704E256024E', // Mainnet
  '0x61': '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3', // Testnet
};

// Token addresses (BSC Mainnet)
export const TOKEN_ADDRESSES = {
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};

/**
 * Get a contract instance connected to the TradingVault
 */
export function getTradingVaultContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(CONTRACT_ADDRESS, TRADING_VAULT_ABI, signerOrProvider);
}

/**
 * Get the appropriate PancakeSwap router address for the current chain
 */
export function getRouterAddress(): string {
  const chainId = APP_CONFIG.BNB_CHAIN.CHAIN_ID;
  return ROUTERS[chainId] || ROUTERS['0x38'];
}

/**
 * Validate wallet address
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Validate trade amount (must be positive and not exceed max trade size)
 */
export function validateTradeAmount(amount: string, maxAmount: string = '10'): boolean {
  try {
    const amountWei = ethers.parseEther(amount);
    const maxWei = ethers.parseEther(maxAmount);
    return amountWei > 0n && amountWei <= maxWei;
  } catch {
    return false;
  }
}

/**
 * Get user's balance from the TradingVault contract
 */
export async function getUserBalance(userAddress: string, provider: ethers.Provider): Promise<string> {
  try {
    const contract = getTradingVaultContract(provider);
    const [balance] = await contract.getUserInfo(userAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error fetching user balance:', error);
    return '0';
  }
}

/**
 * Get user's profit from the TradingVault contract
 */
export async function getUserProfit(userAddress: string, provider: ethers.Provider): Promise<string> {
  try {
    const contract = getTradingVaultContract(provider);
    const [, profit] = await contract.getUserInfo(userAddress);
    return ethers.formatEther(profit);
  } catch (error) {
    console.error('Error fetching user profit:', error);
    return '0';
  }
}

/**
 * Execute a buy trade using the TradingVault contract
 */
export async function executeBuyTrade(
  signer: ethers.Signer,
  pair: string,
  tokenOut: 'USDT' | 'USDC',
  amountIn: string,
  minAmountOut: string
): Promise<ethers.TransactionReceipt> {
  const contract = getTradingVaultContract(signer);
  const tokenAddress = TOKEN_ADDRESSES[tokenOut];
  const amountInWei = ethers.parseEther(amountIn);
  const minAmountOutWei = ethers.parseEther(minAmountOut);

  const tx = await contract.executeBuyTrade(pair, tokenAddress, amountInWei, minAmountOutWei);
  return await tx.wait();
}

/**
 * Execute a sell trade using the TradingVault contract
 */
export async function executeSellTrade(
  signer: ethers.Signer,
  pair: string,
  tokenIn: 'USDT' | 'USDC',
  amountIn: string,
  minAmountOut: string
): Promise<ethers.TransactionReceipt> {
  const contract = getTradingVaultContract(signer);
  const tokenAddress = TOKEN_ADDRESSES[tokenIn];
  const amountInWei = ethers.parseEther(amountIn);
  const minAmountOutWei = ethers.parseEther(minAmountOut);

  const tx = await contract.executeSellTrade(pair, tokenAddress, amountInWei, minAmountOutWei);
  return await tx.wait();
}

/**
 * Deposit funds to TradingVault
 */
export async function depositFunds(signer: ethers.Signer, amount: string): Promise<ethers.TransactionReceipt> {
  const contract = getTradingVaultContract(signer);
  const amountWei = ethers.parseEther(amount);
  const tx = await contract.deposit({ value: amountWei });
  return await tx.wait();
}

/**
 * Withdraw funds from TradingVault
 */
export async function withdrawFunds(signer: ethers.Signer, amount: string): Promise<ethers.TransactionReceipt> {
  const contract = getTradingVaultContract(signer);
  const amountWei = ethers.parseEther(amount);
  const tx = await contract.withdraw(amountWei);
  return await tx.wait();
}

/**
 * Get contract BNB balance
 */
export async function getContractBalance(provider: ethers.Provider): Promise<string> {
  try {
    const contract = getTradingVaultContract(provider);
    const balance = await contract.getContractBalance();
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error fetching contract balance:', error);
    return '0';
  }
}

/**
 * Get contract token balance
 */
export async function getContractTokenBalance(provider: ethers.Provider, token: 'USDT' | 'USDC'): Promise<string> {
  try {
    const contract = getTradingVaultContract(provider);
    const tokenAddress = TOKEN_ADDRESSES[token];
    const balance = await contract.getContractTokenBalance(tokenAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error fetching contract token balance:', error);
    return '0';
  }
}