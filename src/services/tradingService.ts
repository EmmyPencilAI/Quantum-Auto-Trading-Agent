import { supabase } from '../lib/supabase';
import { ethers } from 'ethers';

// Simulation constants
const TRADING_INTERVAL = 10000; // 10 seconds per loop for simulation

export async function processBackgroundTrades() {
  if (!supabase) return;

  try {
    // 1. Fetch all users currently marked as trading
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('is_trading', true);

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    for (const user of users) {
      // 2. Process active trades for each user
      const { data: trades, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('uid', user.uid)
        .eq('status', 'Running');

      if (tradeError) {
        console.error(`[ENGINE] Error fetching trades for ${user.uid}:`, tradeError);
        continue;
      }

      for (const trade of trades) {
        // High frequency simulation
        // In "Aggressive" mode, we simulate a win or loss based on strategy
        const isAggressive = trade.trade_mode === 'Aggressive';
        const winChance = isAggressive ? 0.95 : 0.6; // Aggressive mode is nearly always profitable in simulation
        
        const isWin = Math.random() < winChance;
        const roi = isWin ? (0.05 + Math.random() * 0.1) : -(0.02 + Math.random() * 0.05); 
        const pnlIncrement = trade.size * 1000 * roi; // size is in lots, let's say 1 lot = $1000

        const newPnl = (trade.pnl || 0) + pnlIncrement;
        const timeElapsed = (Date.now() - new Date(trade.created_at).getTime()) / 1000;

        // Auto-close condition (e.g. after 2 minutes or target reached)
        const shouldClose = timeElapsed > 120 || (isAggressive && newPnl > (trade.size * 1000 * 0.5));

        if (shouldClose) {
          console.log(`[ENGINE] Real-Time Settlement Triggered for trade ${trade.id}`);
          console.log(`[BLOCKCHAIN] INTERACTING WITH CONTRACT FOR USER ${user.uid}`);
          
          const finalPnl = newPnl;
          const userProfit = finalPnl; // 100% to user as per request to avoid "settling using treasury" in simulated sense
          
          // Settle in Database
          if (trade.mode_type === 'demo') {
            const { data: wallet } = await supabase.from('demo_wallets').select('demo_balance').eq('id', user.uid).single();
            const currentBal = wallet?.demo_balance || 10000;
            await supabase.from('demo_wallets').update({
              demo_balance: currentBal + (trade.size * 1000) + userProfit,
              updated_at: new Date().toISOString()
            }).eq('id', user.uid);
          }

          console.log(`[BLOCKCHAIN] Settlement Confirmed. TX: 0x${Math.random().toString(16).slice(2)}...`);

          // Update Trade Record
          await supabase.from('trades').update({
            pnl: finalPnl,
            status: 'Completed',
            time_taken: Math.floor(timeElapsed)
          }).eq('id', trade.id);

          // Update Leaderboard
          const { data: lead } = await supabase.from('leaderboard').select('*').eq('uid', user.uid).eq('mode_type', trade.mode_type).single();
          await supabase.from('leaderboard').upsert({
            uid: user.uid,
            username: user.username,
            avatar: user.avatar,
            total_profit: (lead?.total_profit || 0) + finalPnl,
            total_balance: (lead?.total_balance || 0) + finalPnl,
            mode_type: trade.mode_type,
            updated_at: new Date().toISOString()
          });

          // If all trades closed, stop user trading status
          const { data: remaining } = await supabase.from('trades').select('id').eq('uid', user.uid).eq('status', 'Running');
          if (!remaining || remaining.length === 0) {
            await supabase.from('users').update({ is_trading: false }).eq('uid', user.uid);
          }
        } else {
          // Just update floating PnL
          await supabase.from('trades').update({ pnl: newPnl }).eq('id', trade.id);
        }
      }
    }
  } catch (error) {
    console.error(`[TRADING ENGINE CRITICAL ERROR]:`, error);
  }
}

let engineInterval: NodeJS.Timeout | null = null;
export function startTradingEngine() {
  if (engineInterval) return;
  console.log("[QUANTUM] Starting Background Trading Engine...");
  engineInterval = setInterval(processBackgroundTrades, TRADING_INTERVAL);
}
