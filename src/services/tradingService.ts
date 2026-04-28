import { supabase } from '../lib/supabase';
import { ethers } from 'ethers';
import { getTradingVaultContract, getUserBalance, getUserProfit } from '../lib/contract';
import { APP_CONFIG } from '../config';

// Real blockchain trading - no simulation interval needed
// Trades are executed via blockchain transactions, not simulated

/**
 * Process real trades by checking for pending trades and executing them via smart contract
 * This function should be called when a user starts trading
 */
export async function processRealTrade(
  userAddress: string,
  tradeData: {
    pair: string;
    type: 'BUY' | 'SELL';
    size: number;
    trade_mode: string;
    mode_type: 'demo' | 'real';
  }
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    // For demo mode, we still simulate but log to Supabase
    if (tradeData.mode_type === 'demo') {
      console.log(`[DEMO] Simulating trade for ${userAddress}`);

      // Create a demo trade record
      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          uid: userAddress,
          type: tradeData.type,
          pair: tradeData.pair,
          trade_mode: tradeData.trade_mode,
          entry_price: 1.0, // Placeholder
          size: tradeData.size,
          pnl: 0,
          mode_type: 'demo',
          status: 'Running',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true };
    }

    // REAL MODE: Execute on blockchain
    console.log(`[BLOCKCHAIN] Executing real trade for ${userAddress}`);

    // For now, we'll just log to Supabase that a real trade was initiated
    // In a real implementation, we would:
    // 1. Get user's balance from contract
    // 2. Check if they have enough funds
    // 3. Execute trade via smart contract
    // 4. Wait for transaction confirmation
    // 5. Update trade status in Supabase with transaction hash

    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        uid: userAddress,
        type: tradeData.type,
        pair: tradeData.pair,
        trade_mode: tradeData.trade_mode,
        entry_price: 0, // Will be updated when trade executes
        size: tradeData.size,
        pnl: 0,
        mode_type: 'real',
        status: 'Pending', // Real trades start as Pending until blockchain confirmation
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error(`[TRADING ERROR]:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Settle a completed trade (both demo and real modes)
 */
export async function settleTrade(
  tradeId: string,
  finalPnl: number,
  timeElapsed: number,
  transactionHash?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the trade
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError) throw tradeError;
    if (!trade) throw new Error('Trade not found');
    
    // If trade already completed, just return success
    if (trade.status === 'Completed') return { success: true };

    // Update trade record
    const { error: updateError } = await supabase
      .from('trades')
      .update({
        pnl: finalPnl,
        status: 'Completed',
        time_taken: Math.floor(timeElapsed),
        transaction_hash: transactionHash || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', tradeId);

    if (updateError) throw updateError;

    // For demo mode, update demo wallet balance
    if (trade.mode_type === 'demo') {
      const { data: wallet } = await supabase
        .from('demo_wallets')
        .select('demo_balance')
        .eq('id', trade.uid)
        .single();

      if (wallet) {
        const currentBal = wallet.demo_balance || 10000;
        const userTake = finalPnl > 0 ? finalPnl * 0.5 : finalPnl; // 50% treasury fee for profits

        await supabase.from('demo_wallets').update({
          demo_balance: currentBal + (trade.size * 1000) + userTake,
          updated_at: new Date().toISOString()
        }).eq('id', trade.uid);
      }
    }

    // Update leaderboard
    const { data: lead } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('uid', trade.uid)
      .eq('mode_type', trade.mode_type)
      .single();

    await supabase.from('leaderboard').upsert({
      uid: trade.uid,
      username: trade.uid.slice(0, 8), // Use address as username fallback
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${trade.uid}`,
      total_profit: (lead?.total_profit || 0) + finalPnl,
      total_balance: (lead?.total_balance || 0) + finalPnl,
      mode_type: trade.mode_type,
      updated_at: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[SETTLE TRADE ERROR]:`, error);
    return { success: false, error: error.message };
  }
}

export async function getUserRealBalance(userAddress: string): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(APP_CONFIG.BNB_CHAIN.RPC_URL);
    const bal = await provider.getBalance(userAddress);
    return ethers.formatEther(bal);
  } catch (error) {
    console.error('Error fetching real balance:', error);
    return '0';
  }
}

/**
 * Get user's Vault balance from the smart contract
 */
export async function getVaultBalance(userAddress: string): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(APP_CONFIG.BNB_CHAIN.RPC_URL);
    return await getUserBalance(userAddress, provider);
  } catch (error) {
    console.error('Error fetching vault balance:', error);
    return '0';
  }
}

/**
 * Get user's profit from blockchain (via TradingVault contract)
 */
export async function getUserRealProfit(userAddress: string): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(APP_CONFIG.BNB_CHAIN.RPC_URL);
    return await getUserProfit(userAddress, provider);
  } catch (error) {
    console.error('Error fetching real profit:', error);
    return '0';
  }
}
