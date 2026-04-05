import { ethers } from 'ethers';

/**
 * Executes a blockchain call with retry logic for better reliability in low-latency environments.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Blockchain call failed (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw lastError;
}

/**
 * Formats a wallet address for display (e.g., 0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Gets the current gas price and adds a buffer for faster execution.
 */
export async function getBufferedGasPrice(provider: ethers.Provider): Promise<bigint> {
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || BigInt(0);
  // Add 20% buffer for faster inclusion in low-latency environments
  return (gasPrice * BigInt(120)) / BigInt(100);
}
