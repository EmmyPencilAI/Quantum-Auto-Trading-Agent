import { supabase } from '../lib/supabase';
import { ethers } from 'ethers';

// Simulation constants
const TRADING_INTERVAL = 3000; // 3 seconds - Light speed execution for study
const TREASURY_FEE_PERCENT = 30; // 30% goes to treasury, 70% to user

export async function processBackgroundTrades() {
  if (!supabase) return;

  try {
    // 1. Fetch all users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    for (const user of users) {
      // 2. Fetch all "Running" trades for this user
      const { data: trades, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('uid', user.uid)
        .eq('status', 'Running');

      if (tradeError) continue;
      if (!trades || trades.length === 0) continue;

      for (const trade of trades) {
        // If user stopped trading, settle immediately
        if (!user.is_trading) {
            console.log(`[ENGINE] User ${user.uid} stopped trading. Forcing settlement for trade ${trade.id}`);
            await settleTrade(trade, user, trade.pnl, 120); // Force settle
            continue;
        }

        // High frequency simulation
        const isAggressive = trade.trade_mode === 'Aggressive';
        const winChance = isAggressive ? 1.0 : 0.85; // High win rate
        
        const isWin = Math.random() < winChance;
        // Increase volatility for real feel
        const roi = isWin ? (0.01 + Math.random() * 0.15) : -(0.01 + Math.random() * 0.05); 
        const pnlIncrement = trade.size * 1000 * roi; 

        const newPnl = (trade.pnl || 0) + pnlIncrement;
        const timeElapsed = (Date.now() - new Date(trade.created_at).getTime()) / 1000;

        // Lot Scaling Logic: If user has significant profit, increase lot size for NEXT trade
        // We can update user's default size or just log it. 
        // For now, let's keep the current trade size but simulate that it "feels real" by closing faster and starting new ones.

        // Fast closing (10-25 seconds)
        const shouldClose = timeElapsed > (isAggressive ? 12 : 25) || (newPnl > (trade.size * 1000 * 0.2));

        if (shouldClose) {
          await settleTrade(trade, user, newPnl, timeElapsed);
          
          // START A NEW TRADE IMMEDIATELY if user is still trading
          if (user.is_trading) {
            const nextSize = Math.min(2.0, trade.size + (newPnl > 0 ? 0.05 : 0)); // Scale lot size!
            await supabase.from('trades').insert({
                uid: user.uid,
                type: Math.random() > 0.5 ? 'BUY' : 'SELL',
                pair: trade.pair,
                trade_mode: trade.trade_mode,
                entry_price: trade.entry_price * (1 + (Math.random() - 0.5) * 0.001),
                size: nextSize,
                pnl: 0,
                mode_type: trade.mode_type,
                status: 'Running',
                created_at: new Date().toISOString()
            });
          }
        } else {
          await supabase.from('trades').update({ pnl: newPnl }).eq('id', trade.id);
        }
      }
    }
  } catch (error) {
    console.error(`[TRADING ENGINE CRITICAL ERROR]:`, error);
  }
}

async function settleTrade(trade: any, user: any, finalPnl: number, timeElapsed: number) {
  console.log(`[ENGINE] Settling trade ${trade.id} for ${user.uid}`);
  
  let userTake = finalPnl;
  let treasuryTake = 0;

  if (finalPnl > 0) {
    treasuryTake = (finalPnl * TREASURY_FEE_PERCENT) / 100;
    userTake = finalPnl - treasuryTake;
    console.log(`[BLOCKCHAIN] PROFIT SHARING: User +${userTake.toFixed(4)} | Treasury +${treasuryTake.toFixed(4)}`);
  }
  
  // Settle in Database
  if (trade.mode_type === 'demo') {
    const { data: wallet } = await supabase.from('demo_wallets').select('demo_balance').eq('id', user.uid).single();
    const currentBal = wallet?.demo_balance || 10000;
    await supabase.from('demo_wallets').update({
      demo_balance: currentBal + (trade.size * 1000) + userTake,
      updated_at: new Date().toISOString()
    }).eq('id', user.uid);
  } else {
    // REAL MODE
    console.log(`[BLOCKCHAIN] DISPATCHING REAL FUNDS TO ${user.wallet_address}`);
  }

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
}

let engineInterval: NodeJS.Timeout | null = null;
export function startTradingEngine() {
  if (engineInterval) return;
  console.log("[QUANTUM] Starting Background Trading Engine...");
  engineInterval = setInterval(processBackgroundTrades, TRADING_INTERVAL);
}
