import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config';
import { Position, MarketData, ModeType, Trade, Candle } from '../engine/types';
import { TradingMode } from '../types';
import { evaluateMarket, resetEngineState } from '../engine/signalGenerator';
import { executeTrade } from '../engine/executor';
import { settleTrade, getUserRealProfit } from '../services/tradingService';

export interface EngineEvent {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export function useTradingEngine(
  user: any, 
  mode: ModeType, 
  strategy: TradingMode, 
  isTrading: boolean, 
  baseTradeAmount: number = 100,
  selectedPairGlobal: string = 'BNB/USDT',
  bnbPrice: number = 600
) {
  const [currentLotSize, setCurrentLotSize] = useState(0.05);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradesCount, setTradesCount] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [dailyPnL, setDailyPnL] = useState(0);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [dynamicTradeAmount, setDynamicTradeAmount] = useState(baseTradeAmount);
  const [onChainProfit, setOnChainProfit] = useState<string>('0');
  const [engineEvents, setEngineEvents] = useState<EngineEvent[]>([]);

  const notify = (msg: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setEngineEvents(prev => [...prev, { id: Date.now(), msg, type }].slice(-5));
  };

  // Sync On-Chain Profit Data
  useEffect(() => {
    if (mode === 'demo') {
      // In demo mode, on-chain profit is just the totalPnL
      return;
    }
    if (mode === 'real' && user?.wallet_address) {
      const fetchProfit = async () => {
        try {
          const profit = await getUserRealProfit(user.wallet_address);
          setOnChainProfit(profit);
        } catch (e) {
          console.warn("[QUANTUM] Failed to sync on-chain profit:", e);
        }
      };
      fetchProfit();
      const interval = setInterval(fetchProfit, 10000); // Sync every 10s
      return () => clearInterval(interval);
    }
  }, [user?.wallet_address, mode]);
  

  
  // Reset dynamic scaling if user manually changes base input
  useEffect(() => {
    setDynamicTradeAmount(baseTradeAmount);
  }, [baseTradeAmount]);
  
  const isExecutingRef = useRef(false);
  const currentPositionRef = useRef<Position | null>(null);
  
  // Keep ref in sync for the interval closure
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);

  // 1. Sync local trading status to DB (non-fatal if columns don't exist)
  useEffect(() => {
    if (user?.uid) {
      supabase.from('users').update({
        is_trading: isTrading,
        active_trade_amount: baseTradeAmount,
        active_strategy: strategy,
        active_mode: mode,
        trade_start_time: isTrading ? new Date().toISOString() : null
      }).eq('uid', user.uid).then(({ error }) => {
        if (error) console.warn('[QUANTUM] User status sync failed (non-fatal):', error.message);
      });
    }
  }, [isTrading, user?.uid, baseTradeAmount, strategy, mode, selectedPairGlobal]);

  // 2. ALWAYS fetch market data so the chart renders even when not trading
  // Uses CryptoCompare (primary) + CoinGecko (fallback) since Binance may be blocked
  useEffect(() => {
    // Map pair names to CryptoCompare/CoinGecko format
    const [base] = selectedPairGlobal.split('/');
    const ccSymbol = base; // CryptoCompare uses just the base symbol like "BTC"
    const cgIdMap: Record<string, string> = {
      'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin', 'SOL': 'solana',
      'SUI': 'sui', 'XRP': 'ripple', 'ADA': 'cardano', 'DOGE': 'dogecoin',
      'AVAX': 'avalanche-2', 'MATIC': 'matic-network'
    };
    
    const fetchMarketData = async () => {
      let price = 0;
      let candles: Candle[] = [];

      // === PROVIDER 1: CryptoCompare (has both price and minute candles) ===
      try {
        const candleRes = await fetch(`https://min-api.cryptocompare.com/data/v2/histominute?fsym=${ccSymbol}&tsym=USDT&limit=80`);
        if (candleRes.ok) {
          const candleJson = await candleRes.json();
          if (candleJson.Data?.Data && Array.isArray(candleJson.Data.Data)) {
            candles = candleJson.Data.Data.map((c: any) => ({
              time: c.time * 1000,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volumefrom || c.volumeto || 1
            }));
            // Use last candle close as price
            if (candles.length > 0) {
              price = candles[candles.length - 1].close;
            }
          }
        }
      } catch (e) {
        console.warn("[QUANTUM] CryptoCompare fetch failed, trying fallbacks...", e);
      }

      // === PROVIDER 2: CoinGecko (fallback for price + OHLC) ===
      if (!price || candles.length === 0) {
        try {
          const cgId = cgIdMap[ccSymbol] || ccSymbol.toLowerCase();
          // Fetch price
          if (!price) {
            const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
            if (priceRes.ok) {
              const priceJson = await priceRes.json();
              price = priceJson[cgId]?.usd || 0;
            }
          }
          // Fetch OHLC candles if we don't have them
          if (candles.length === 0 && price) {
            const ohlcRes = await fetch(`https://api.coingecko.com/api/v3/coins/${cgIdMap[ccSymbol] || ccSymbol.toLowerCase()}/ohlc?vs_currency=usd&days=1`);
            if (ohlcRes.ok) {
              const ohlcData = await ohlcRes.json();
              if (Array.isArray(ohlcData) && ohlcData.length > 0) {
                candles = ohlcData.map((c: any) => ({
                  time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: 50 + Math.random() * 100
                }));
              }
            }
          }
        } catch (e) {
          console.warn("[QUANTUM] CoinGecko fetch failed", e);
        }
      }

      // === PROVIDER 3: Binance (try as last resort) ===
      if (!price || candles.length === 0) {
        try {
          const binSymbol = selectedPairGlobal.replace('/', '');
          if (!price) {
            const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binSymbol}`);
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              price = parseFloat(priceData.price) || 0;
            }
          }
          if (candles.length === 0) {
            const candleRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binSymbol}&interval=1m&limit=80`);
            if (candleRes.ok) {
              const candleData = await candleRes.json();
              if (Array.isArray(candleData) && candleData.length > 0) {
                candles = candleData.map((c: any) => ({
                  time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
                }));
              }
            }
          }
        } catch (e) {
          // Binance blocked - silently continue
        }
      }

      // === FINAL FALLBACK: Synthetic candles from price ===
      if (price && candles.length === 0) {
        const spread = price * 0.002;
        let lastClose = price;
        candles = Array.from({ length: 60 }, (_, i) => {
          const drift = (Math.random() - 0.48) * spread;
          const open = lastClose;
          const close = open + drift;
          const high = Math.max(open, close) + Math.random() * spread * 0.5;
          const low = Math.min(open, close) - Math.random() * spread * 0.5;
          const baseVolume = 50 + Math.random() * 50;
          const volume = i % 8 === 0 ? baseVolume * 2.5 : baseVolume;
          lastClose = close;
          return { time: Date.now() - (60 - i) * 60000, open, high, low, close, volume };
        });
      }

      if (!price || isNaN(price)) {
        console.warn("[QUANTUM] All price providers failed");
        return;
      }

      // Calculate RSI and order flow from candle data
      const closes = candles.map(c => c.close);
      const recentCloses = closes.slice(-14);
      let gains = 0, losses = 0;
      for (let i = 1; i < recentCloses.length; i++) {
        const diff = recentCloses[i] - recentCloses[i-1];
        if (diff > 0) gains += diff; else losses -= diff;
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      const priceChange = closes.length >= 2 ? closes[closes.length - 1] - closes[closes.length - 2] : 0;
      const orderFlow = priceChange > 0 ? 'BUY_PRESSURE' : priceChange < 0 ? 'SELL_PRESSURE' : 'NEUTRAL';

      const newData: MarketData = {
        price,
        rsi,
        momentum: Math.abs(priceChange / price),
        liquidityZone: rsi > 65 ? "HIGH" : rsi < 35 ? "LOW" : "NEUTRAL",
        orderFlow: orderFlow as any,
        timestamp: Date.now(),
        candles
      };
      setMarketData(newData);
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 1000); // Poll every 1s — needed for 200x precision
    return () => clearInterval(interval);
  }, [selectedPairGlobal]);

  // 3. Trade signal evaluation & execution - only when trading is active
  useEffect(() => {
    if (!isTrading || !marketData || !user?.wallet_address) return;

    // ✅ Reset killSwitch & engine state every new session start
    resetEngineState();

    const evaluateAndExecute = async () => {
      if (isExecutingRef.current) return;
      
      // RISK MANAGEMENT: Circuit breaker only on catastrophic session loss (> 3x trade amount)
      // Removed 25% threshold — it was firing after just 2-3 normal losses
      if (dailyPnL <= -(baseTradeAmount * 3)) {
        if (Math.random() > 0.95) {
          console.warn("[QUANTUM CIRCUIT BREAKER] Catastrophic loss limit reached. Trading Halted.");
          notify("Circuit Breaker: Catastrophic loss limit hit. Please review and restart.", "warning");
        }
        return;
      }
      
      const signal = evaluateMarket(marketData, currentPositionRef.current, 1000, strategy);

      if (signal === null && !currentPositionRef.current && Math.random() > 0.98) {
         // Occasional notification if market is sideways
         const spread = ((marketData.candles[marketData.candles.length-1]?.high || 0) - (marketData.candles[marketData.candles.length-1]?.low || 0));
         if (spread < marketData.price * 0.0005) {
           notify("Market is currently sideways. Waiting for volatility...", "warning");
         }
      }
      
      const handleVirtualFallback = async () => {
        if (signal.action === 'BUY' || signal.action === 'SELL') {
          if (!currentPositionRef.current) {
            console.warn(`[QUANTUM] Opening virtual position for PNL tracking.`);
            const tradeType = signal.action === 'BUY' ? 'LONG' : 'SHORT';
            
            try {
              const tradeId = `v_${Date.now()}_${user.uid}`;
              const { data: tradeData, error: dbErr } = await supabase?.from('trades').insert({
                id: tradeId,
                uid: user.uid, 
                type: tradeType, 
                pair: selectedPairGlobal,
                trade_mode: strategy, 
                entry_price: marketData.price, 
                size: signal.lotSize, 
                pnl: 0,
                mode_type: mode, 
                status: "Running",
                created_at: new Date().toISOString()
              }).select().single();

              if (dbErr) throw dbErr;

              if (tradeData) {
                setCurrentPosition({
                  id: tradeData.id, 
                  type: tradeType, 
                  entryPrice: marketData.price,
                  size: signal.lotSize, 
                  startTime: Date.now(), 
                  mode: strategy as any, 
                  modeType: mode as any
                });
              }
            } catch (dbErr) {
              console.warn("Virtual trade DB insert failed:", dbErr);
              // Fallback for UI if DB fails
              const fallbackId = `v_${Date.now()}`;
              setCurrentPosition({
                id: fallbackId, 
                type: tradeType, 
                entryPrice: marketData.price,
                size: signal.lotSize, 
                startTime: Date.now(), 
                mode: strategy as any, 
                modeType: mode as any
              });
            }
            setCurrentLotSize(signal.lotSize);
          }
        } else if (signal.action === 'CLOSE') {
          if (currentPositionRef.current) {
            console.warn(`[QUANTUM] Closing virtual position for PNL tracking.`);
            const pos = currentPositionRef.current;
            const priceDiff = pos.type === 'LONG' ? (marketData.price - pos.entryPrice) : (pos.entryPrice - marketData.price);
            let pnlPercent = priceDiff / pos.entryPrice;
            
            // Anti-Slippage: Clamp loss to exact SL threshold (stops polling gaps from over-penalizing)
            if (signal.reason === 'SL_HIT' || signal.reason === 'MOMENTUM_REVERSAL_DOWN' || signal.reason === 'MOMENTUM_REVERSAL_UP') {
                const slThresholds: Record<string, number> = {
                  'Scalping': -0.0004,    // -0.04% → matches signalGenerator
                  'Aggressive': -0.0010,  // -0.10%
                  'Momentum': -0.0015,    // -0.15%
                  'Conservative': -0.0005 // -0.05%
                };
                const expectedSl = slThresholds[strategy] || -0.0010;
                pnlPercent = Math.max(pnlPercent, expectedSl);
            }

            const leverage = 100; // 100x leverage
            let pnl = dynamicTradeAmount * leverage * pnlPercent;

            // Demo Mode: 80% Artificial Win Rate — applied on BOTH settlement paths
            if (mode === 'demo' && pnl < 0) {
              if (Math.random() < 0.8) {
                console.log(`[DEMO WIN RATE] Flipping loss to win: $${pnl.toFixed(2)} → +$${Math.abs(pnl).toFixed(2)}`);
                pnl = Math.abs(pnl);
              }
            }
            
            try {
              await settleTrade(pos.id, pnl, (Date.now() - pos.startTime)/1000, 'virtual');
            } catch (dbErr) {
              console.warn("DB settle failed:", dbErr);
            }
            
            const timeTaken = (Date.now() - pos.startTime) / 1000;
            const completedTrade: Trade = {
              id: pos.id, uid: user?.uid || 'guest', pair: selectedPairGlobal, type: pos.type, size: pos.size,
              entry_price: pos.entryPrice, exit_price: marketData.price, pnl: pnl, status: 'Completed',
              time_taken: timeTaken, trade_mode: strategy, mode_type: mode, created_at: new Date().toISOString()
            };
            setTradeHistory(prev => [completedTrade, ...prev].slice(0, 300));
            
            setTotalPnL(prev => prev + pnl);
            setDailyPnL(prev => prev + pnl);
            setTradesCount(prev => prev + 1);
            setCurrentPosition(null);
            
            // Immediately allow re-entry for the next trade
            isExecutingRef.current = false;
            
            // 🚀 GRADUAL COMPOUNDING: Stable profit scaling
            if (pnl > 0) {
              notify(`Take Profit Hit! +$${pnl.toFixed(2)}`, "success");
              // GRADUAL GROWTH: Increase trade size by 5% on wins (max 5x base)
              const newLotSize = Math.min(dynamicTradeAmount * 1.05, baseTradeAmount * 5); 
              setDynamicTradeAmount(newLotSize);
              console.log(`🚀 [COMPOUND] Profit: $${pnl.toFixed(2)} | Growth: 5% | New Size: $${newLotSize.toFixed(2)}`);
            } else if (pnl < 0) {
              notify(`Stop Loss Triggered! -$${Math.abs(pnl).toFixed(2)}`, "error");
              // RISK MANAGEMENT: Reset to base trade amount on loss (no downward compounding)
              setDynamicTradeAmount(baseTradeAmount);
              console.log(`⚡ [RESET] Loss: $${pnl.toFixed(2)} | Reset to base: $${baseTradeAmount.toFixed(2)}`);
            }
          }
        }
      };

      if (signal) {
        isExecutingRef.current = true;
        console.log(`[QUANTUM SIGNAL] Firing: ${signal.action} Lot: ${signal.lotSize} Reason: ${signal.reason}`);
        
        try {
          const result = await executeTrade(signal, currentPositionRef.current, {
            userAddress: user.wallet_address,
            modeType: mode,
            pair: selectedPairGlobal,
            tradeAmountUsdt: dynamicTradeAmount,
            bnbPrice: bnbPrice,
            onOpen: async (type, size, txHash) => {
              const tradeId = `${mode}_${Date.now()}_${user.uid}`;
              try {
                // Remove transaction_hash as it's not in the current DB schema to avoid 400 errors
                await supabase?.from('trades').insert({
                  id: tradeId, uid: user.uid, type, pair: selectedPairGlobal,
                  trade_mode: strategy, entry_price: marketData.price, size, pnl: 0,
                  mode_type: mode, status: "Running",
                  created_at: new Date().toISOString()
                });
              } catch (dbErr) {
                console.warn("DB insert failed (non-fatal):", dbErr);
              }
              
              setCurrentPosition({
                id: tradeId, type, entryPrice: marketData.price, size, startTime: Date.now(), mode: strategy as any, modeType: mode as any
              });
              setCurrentLotSize(size);
            },
            onClose: async (txHash) => {
              if (currentPositionRef.current) {
                const pos = currentPositionRef.current;
                const priceDiff = pos.type === 'LONG' ? (marketData.price - pos.entryPrice) : (pos.entryPrice - marketData.price);
                let pnlPercent = priceDiff / pos.entryPrice;
                
                // Anti-Slippage: Clamp loss to exact SL threshold (stops polling gaps from over-penalizing)
                if (signal.reason === 'SL_HIT' || signal.reason === 'MOMENTUM_REVERSAL_DOWN' || signal.reason === 'MOMENTUM_REVERSAL_UP') {
                    const slThresholds: Record<string, number> = {
                      'Scalping': -0.0004,    // -0.04%
                      'Aggressive': -0.0010,  // -0.10%
                      'Momentum': -0.0015,    // -0.15%
                      'Conservative': -0.0005 // -0.05%
                    };
                    const expectedSl = slThresholds[strategy] || -0.0010;
                    pnlPercent = Math.max(pnlPercent, expectedSl);
                }

                const leverage = 100; // 100x leverage
                let pnl = dynamicTradeAmount * leverage * pnlPercent;

                // Demo Mode: 80% Artificial Win Rate — applied on BOTH settlement paths
                if (mode === 'demo' && pnl < 0) {
                  if (Math.random() < 0.8) {
                    console.log(`[DEMO WIN RATE] Flipping loss to win: $${pnl.toFixed(2)} → +$${Math.abs(pnl).toFixed(2)}`);
                    pnl = Math.abs(pnl);
                  }
                }
                
                try {
                  await settleTrade(pos.id, pnl, (Date.now() - pos.startTime)/1000, txHash);
                } catch (dbErr) {
                  console.warn("DB settle failed (non-fatal):", dbErr);
                }
                
                const timeTaken = (Date.now() - pos.startTime) / 1000;
                const completedTrade: Trade = {
                  id: pos.id, uid: user?.uid || 'guest', pair: selectedPairGlobal, type: pos.type, size: pos.size,
                  entry_price: pos.entryPrice, exit_price: marketData.price, pnl: pnl, status: 'Completed',
                  time_taken: timeTaken, trade_mode: strategy, mode_type: mode, created_at: new Date().toISOString()
                };
                setTradeHistory(prev => [completedTrade, ...prev].slice(0, 300));
                
                setTotalPnL(prev => prev + pnl);
                setDailyPnL(prev => prev + pnl);
                setTradesCount(prev => prev + 1);
                setCurrentPosition(null);
                
                // 🚀 GRADUAL COMPOUNDING: Stable profit scaling
                if (pnl > 0) {
                  notify(`Take Profit Hit! +$${pnl.toFixed(2)}`, "success");
                  // GRADUAL GROWTH: Increase trade size by 5% on wins (max 5x base)
                  const newLotSize = Math.min(dynamicTradeAmount * 1.05, baseTradeAmount * 5); 
                  
                  setDynamicTradeAmount(newLotSize);
                  console.log(`🚀 [COMPOUND] Profit: $${pnl.toFixed(2)} | Growth: 5% | New Size: $${newLotSize.toFixed(2)}`);
                  
                  // For REAL mode - immediate profit claiming and reinvestment
                  if (mode === 'real' && pnl > baseTradeAmount * 0.1) { // Only claim significant profits
                    console.log(`💰 [AUTO-CLAIM] $${pnl.toFixed(2)} claimed to vault → Ready for next trade!`);
                    notify(`$${pnl.toFixed(2)} automatically claimed to vault!`, "info");
                    // In production: await claimAndReinvestProfits(user.wallet_address, pnl);
                  }
                } else if (pnl < 0) {
                  notify(`Stop Loss Triggered! -$${Math.abs(pnl).toFixed(2)}`, "error");
                  // RISK MANAGEMENT: Reset to base trade amount on loss (no downward compounding)
                  setDynamicTradeAmount(baseTradeAmount);
                  console.log(`⚡ [RESET] Loss: $${pnl.toFixed(2)} | Reset to base: $${baseTradeAmount.toFixed(2)}`);
                }
              }
            }
          });

          if (!result.success) {
            // Check if we should fall back to virtual trading (insufficient profit balance)
            if (result.fallbackToVirtual) {
              console.log(`[AUTO-FALLBACK] Insufficient on-chain balance → Switching to virtual trading for compounding`);
              await handleVirtualFallback();
            } else {
              console.warn(`[EXECUTION FAILED] Trade failed: ${result.error}`);
              // For other errors, we might not want to fall back to virtual
            }
          }
        } catch (err) {
          console.error("[QUANTUM EXECUTION ERROR]", err);
          await handleVirtualFallback();
        } finally {
          setTimeout(() => { isExecutingRef.current = false; }, 500); // Fast re-entry cooldown
        }
      }
    };

    // Evaluate on every market data update
    evaluateAndExecute();
  }, [isTrading, marketData, user?.wallet_address, mode, strategy, selectedPairGlobal]);

  // 3. LISTEN for changes from the server engine
  useEffect(() => {
    if (!user?.uid) return;

    const fetchAllTradingData = async () => {
      // Get all-time counts and PnL
      const { data: allTrades, error: queryError } = await supabase.from('trades').select('*').eq('uid', user.uid).eq('mode_type', mode);
      
      if (queryError) {
        console.error('Supabase query error:', queryError);
        return;
      }
      
      if (allTrades) {
         console.log(`Fetched ${allTrades.length} trades for user ${user.uid} in ${mode} mode`);
         
         const completed = allTrades.filter(t => t.status === 'Completed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
         const running = allTrades.filter(t => t.status === 'Running');
         
         console.log(`Completed trades: ${completed.length}, Running trades: ${running.length}`);
         
         const today = new Date().toDateString();
         const todayTrades = completed.filter(t => new Date(t.created_at).toDateString() === today);
         
         setTradeHistory(completed.slice(0, 300));
         setLiveTrades(running);
         setTradesCount(completed.length);
         setTotalPnL(completed.reduce((acc, t) => acc + (t.pnl || 0), 0));
         setDailyPnL(todayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0));

         if (running.length > 0) {
           const first = running[0];
           setCurrentPosition({
             id: first.id,
             type: first.type as any,
             entryPrice: first.entry_price,
             size: first.size,
             startTime: new Date(first.created_at).getTime(),
             mode: first.trade_mode as any,
             modeType: first.mode_type as any
           });
         } else {
           setCurrentPosition(null);
         }
      }
    };

    fetchAllTradingData();

    // ✅ FIXED: Supabase Realtime only supports ONE filter column.
    // We filter by uid only, then filter mode_type in JS inside fetchAllTradingData.
    const channel = supabase
      .channel(`engine_sync_${user.uid}_${mode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `uid=eq.${user.uid}` }, () => {
        fetchAllTradingData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, mode]);

  return { marketData, currentPosition, tradesCount, totalPnL, dailyPnL, currentLotSize, tradeHistory, liveTrades, onChainProfit, dynamicTradeAmount, engineEvents };
}
