import { Position } from './types';

/**
 * Settlement Engine (ACCOUNTING CORE)
 * Handles profit calculation and blockchain synchronization
 */
export function calculatePnL(entry: number, exit: number, size: number, type: 'LONG' | 'SHORT') {
  const diff = type === 'LONG' ? exit - entry : entry - exit;
  return diff * (size * 100); // Scaled for lot size impact
}

export async function settleTrade(
  user: any, 
  profit: number, 
  lotSize: number,
  callbacks: {
    creditUser: (uid: string, amount: number) => Promise<void>;
    creditTreasury: (amount: number) => Promise<void>;
    callSmartContract: (params: any) => Promise<void>;
  }
) {
  // 50/50 Profit split
  const userShare = profit * 0.5;
  const treasuryShare = profit * 0.5;

  // 1. Ledger update FIRST (Source of Truth)
  if (user?.uid) {
    await callbacks.creditUser(user.uid, userShare);
    await callbacks.creditTreasury(treasuryShare);
  }

  // 2. Blockchain sync (Async, non-blocking)
  // Note: We don't await this to keep the engine fast for HFT
  callbacks.callSmartContract({
    userAddress: user?.walletAddress,
    amount: profit,
    lotSize: lotSize,
    timestamp: Date.now()
  }).catch(err => console.error("Blockchain Sync Failed:", err));

  return { userShare, treasuryShare };
}
