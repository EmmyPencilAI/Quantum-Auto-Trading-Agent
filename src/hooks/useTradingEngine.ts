import { useState, useEffect, useRef } from 'react';
import { analyzeMarket } from '../engine/strategy';
import { generateSignal } from '../engine/signalGenerator';
import { executeTrade } from '../engine/executor';
import { calculatePnL, settleTrade } from '../engine/settlement';
import { MarketData, TradeSignal, Position, Candle, TradeMode, ModeType } from '../engine/types';
import { supabase } from '../lib/supabase';

export function useTradingEngine(user: any, mode: ModeType, strategy: TradeMode, isTrading: boolean, baseTradeAmount: number = 100) {
  const [currentLotSize, setCurrentLotSize] = useState(0.05);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradesCount, setTradesCount] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [isCatchingUp, setIsCatchingUp] = useState(false);
  const engineLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Sync background state to DB
  useEffect(() => {
    if (user?.uid) {
      supabase.from('users').update({
        is_trading: isTrading,
        active_trade_amount: baseTradeAmount,
        active_strategy: strategy,
        active_mode: mode,
        trade_start_time: isTrading ? new Date().toISOString() : null
      }).eq('uid', user.uid).then();
    }
  }, [isTrading, user?.uid, baseTradeAmount, strategy, mode]);

  // Catch-up logic for background trading
  useEffect(() => {
    const handleCatchUp = async () => {
      if (user?.is_trading && user?.trade_start_time && !isCatchingUp && isTrading) {
        setIsCatchingUp(true);
        const startTime = new Date(user.trade_start_time).getTime();
        const now = Date.now();
        const diffSeconds = (now - startTime) / 1000;
        
        // Strategy intervals: Aggressive (0.5s), others (2s)
        const interval = user.active_strategy === 'Aggressive' ? 0.5 : 2;
        const missedTradeCycles = Math.min(Math.floor(diffSeconds / interval), 100); // Caps at 100 cycles for safety

        if (missedTradeCycles > 5) {
          console.log(`[QUANTUM] Catching up on ${missedTradeCycles} background cycles...`);
          
          let simulatedPnL = 0;
          for (let i = 0; i < missedTradeCycles; i++) {
            // Aggressive mode is 100% win rate
            if (user.active_strategy === 'Aggressive') {
              const roi = (0.01 + Math.random() * 0.05); // 1-5% per cycle
              simulatedPnL += (user.active_trade_amount || 100) * roi;
            } else {
              simulatedPnL += (user.active_trade_amount || 100) * (Math.random() - 0.45) * 0.05;
            }
          }

          // Split profit 50/50 and credit user
          const userProfit = simulatedPnL * 0.5;
          const treasuryProfit = simulatedPnL * 0.5;

          if (user.active_mode === 'demo') {
            const { data: wallet } = await supabase.from('demo_wallets').select('demo_balance').eq('id', user.uid).single();
            const currentBal = wallet?.demo_balance || 10000;
            await supabase.from('demo_wallets').update({
              demo_balance: currentBal + userProfit,
              updated_at: new Date().toISOString()
            }).eq('id', user.uid);
          }

          // Update Leaderboard
          const { data: lead } = await supabase.from('leaderboard').select('*').eq('uid', user.uid).eq('mode_type', user.active_mode).single();
          await supabase.from('leaderboard').upsert({
            uid: user.uid,
            username: user.username,
            avatar: user.avatar,
            total_profit: (lead?.total_profit || 0) + simulatedPnL,
            total_balance: (lead?.total_balance || 0) + simulatedPnL,
            mode_type: user.active_mode,
            updated_at: new Date().toISOString()
          });

          setTotalPnL(prev => prev + simulatedPnL);
          setTradesCount(prev => prev + Math.floor(missedTradeCycles / 5));
        }
      }
    };
    handleCatchUp();
  }, [user, isTrading]);

  // High Frequency Simulation Loop (roughly every 5 seconds for simulation, but can be scaled)
  useEffect(() => {
    if (isTrading && user) {
      engineLoopRef.current = setInterval(async () => {
        // 1. Simulate Market Data Ingestion
        const newPrice = 60000 + (Math.random() - 0.5) * 100;
        const newRsi = 30 + Math.random() * 40;
        const dummyCandles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
          time: Date.now() - (i * 1000),
          open: newPrice - (Math.random() * 5),
          high: newPrice + (Math.random() * 10),
          low: newPrice - (Math.random() * 10),
          close: newPrice + (Math.random() * 5),
        }));

        const data: MarketData = {
          price: newPrice,
          rsi: newRsi,
          momentum: Math.random(),
          liquidityZone: newRsi < 35 ? "LOW" : newRsi > 65 ? "HIGH" : "NEUTRAL",
          orderFlow: Math.random() > 0.8 ? "REVERSAL" : (newRsi < 40 ? "BUY_PRESSURE" : "SELL_PRESSURE"),
          timestamp: Date.now(),
          candles: dummyCandles
        };

        setMarketData(data);

        // 2. Strategy Analysis & Signal Generation
        // USER REQUEST: Aggressive 100% win rate simulation logic
        let signal = generateSignal(data, currentLotSize);
        
        // Forced "Win" Logic for simulation (overwrite signal to ensure profit if user requested aggressive)
        if (strategy === 'Aggressive' && currentPosition) {
           const pnl = calculatePnL(currentPosition.entryPrice, data.price, currentPosition.size, currentPosition.type);
           // Aim for 200-400% ROI.
           const currentROI = (pnl / (baseTradeAmount || 100)) * 100;
           
           // Auto reversal or target peak
           const peakReached = currentROI >= 380;
           const shouldReverse = Math.random() > 0.95; // Auto reversal simulation
           
           if (peakReached || shouldReverse) {
              signal = { 
                action: shouldReverse ? 'REVERSE' : 'CLOSE', 
                confidence: 1, 
                lotSize: currentLotSize, 
                reason: shouldReverse ? 'Quantum Pivot Detected (Auto-Reversal)' : 'Alpha Target Upper Bound Reached (400% ROI)' 
              };
           } else {
              signal = { action: 'HOLD', confidence: 1, lotSize: currentLotSize, reason: `Momentum Building (${currentROI.toFixed(1)}% ROI)` };
           }
        } else if (strategy === 'Aggressive' && !currentPosition) {
           // Open trade immediately if aggressive
           signal = { action: Math.random() > 0.5 ? 'BUY' : 'SELL', confidence: 1, lotSize: currentLotSize, reason: 'Quantum Momentum Triggered (Aggressive Entry)' };
        }

        const startTime = Date.now();

        // 3. Execution HAND
        try {
          await executeTrade(signal, currentPosition, {
            onOpen: async (type, size) => {
              const pos: Position = {
                id: `pos_${Date.now()}`,
                type,
                entryPrice: data.price,
                size,
                startTime: Date.now(),
                mode: strategy,
                modeType: mode
              };
              setCurrentPosition(pos);
              setTradesCount(prev => prev + 1);
              
              // Sync to Supabase
              await supabase.from('trades').upsert({
                id: pos.id,
                uid: user.uid,
                type: pos.type,
                pair: 'BTC/USDT',
                trade_mode: strategy,
                entry_price: data.price,
                size: pos.size,
                pnl: 0,
                mode_type: mode,
                status: "Running",
                created_at: new Date().toISOString()
              });
            },
            onClose: async () => {
              if (currentPosition) {
                let pnl = calculatePnL(currentPosition.entryPrice, data.price, currentPosition.size, currentPosition.type);
                
                // Force Win for Aggressive Strategy (200-400% ROI Simulation)
                if (strategy === 'Aggressive') {
                  const targetROI = 2.0 + (Math.random() * 2.0); // 200% to 400%
                  pnl = baseTradeAmount * targetROI;
                }

                // 4. Settlement (ACCOUNTING)
                const totalProfit = pnl;
                const userProfit = totalProfit * 0.5; // 50% split
                const treasuryProfit = totalProfit * 0.5; // 50% split
                const initialFunds = baseTradeAmount; 

                await settleTrade(user, totalProfit, currentPosition.size, {
                  creditUser: async (uid, amount) => {
                     const totalReturn = initialFunds + userProfit;
                     if (mode === 'demo') {
                       const { data: demoDoc } = await supabase.from('demo_wallets').select('demo_balance').eq('id', uid).single();
                       const currentBal = demoDoc ? demoDoc.demo_balance : 10000;
                       await supabase.from('demo_wallets').update({ 
                         demo_balance: currentBal + totalReturn,
                         updated_at: new Date().toISOString()
                       }).eq('id', uid);
                     }
                  },
                  creditTreasury: async (amount) => {
                    console.log(`Treasury credited with ${treasuryProfit}`);
                  },
                  callSmartContract: async (params) => {
                    console.log("Simulating Blockchain settlement for Profit Split...");
                    console.log(`On-chain: User Return ${initialFunds + userProfit}, Treasury ${treasuryProfit}`);
                  }
                });

                // Finalize trade history
                await supabase.from('trades').upsert({
                  id: currentPosition.id,
                  uid: user.uid,
                  type: currentPosition.type,
                  pair: 'BTC/USDT',
                  trade_mode: strategy,
                  entry_price: currentPosition.entryPrice,
                  size: currentPosition.size,
                  pnl,
                  mode_type: mode,
                  status: "Completed",
                  time_taken: Math.floor((Date.now() - currentPosition.startTime) / 1000),
                  created_at: new Date().toISOString()
                });

                // Update Leaderboard & Trade Volume
                const { data: userData } = await supabase.from('users').select('trade_volume').eq('uid', user.uid).single();
                const currentVolume = userData?.trade_volume || 0;
                const tradeVolume = currentPosition.size * 100000; // Formula for volume calculation

                await supabase.from('users').update({
                  trade_volume: currentVolume + tradeVolume
                }).eq('uid', user.uid);

                // Update Leaderboard per mode
                const { data: leaderData } = await supabase
                  .from('leaderboard')
                  .select('*')
                  .eq('uid', user.uid)
                  .eq('mode_type', mode)
                  .single();
                  
                const currentProfit = leaderData ? leaderData.total_profit : 0;
                const currentBalance = leaderData ? leaderData.total_balance : 0;
                
                await supabase.from('leaderboard').upsert({
                  uid: user.uid,
                  username: user.username,
                  avatar: user.avatar,
                  total_profit: currentProfit + pnl,
                  total_balance: currentBalance + pnl,
                  mode_type: mode,
                  updated_at: new Date().toISOString()
                });

                // Clean up any live/running record if it was in the same table
                // Since we used 'Running' status in the same 'trades' table now, we don't strictly need to delete unless we want to keep it clean.
                // But upsert handles it if we finalize.
                
                setTotalPnL(prev => prev + pnl);
                
                // Lot scaling logic
                if (pnl > 0) {
                  setCurrentLotSize(prev => Math.min(prev * 1.05, 1.0));
                } else {
                  setCurrentLotSize(0.05);
                }

                setCurrentPosition(null);
              }
            }
          });

          // Check for execution latency
          if (Date.now() - startTime > 10000) {
            console.error("HFT LATENCY ERROR: Real-time execution missed threshold.");
          }
        } catch (error) {
          console.error("EXECUTION ENGINE ERROR:", error);
        }

      }, strategy === 'Aggressive' ? 500 : 2000); 
    } else {
      if (engineLoopRef.current) clearInterval(engineLoopRef.current);
    }

    return () => {
      if (engineLoopRef.current) clearInterval(engineLoopRef.current);
    };
  }, [isTrading, user, mode, strategy, currentPosition, currentLotSize]);

  return { marketData, currentPosition, tradesCount, totalPnL, currentLotSize };
}
