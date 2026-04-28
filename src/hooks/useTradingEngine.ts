import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config';
import { Position, MarketData, ModeType, Trade, Candle } from '../engine/types';
import { TradingMode } from '../types';
import { evaluateMarket } from '../engine/signalGenerator';
import { executeTrade } from '../engine/executor';
import { settleTrade, getUserRealProfit } from '../services/tradingService';

export function useTradingEngine(
  user: any, 
  mode: ModeType, 
  strategy: TradingMode, 
  isTrading: boolean, 
  baseTradeAmount: number = 100,
  selectedPairGlobal: string = 'BNB/USDT'
) {
  const [currentLotSize, setCurrentLotSize] = useState(0.05);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradesCount, setTradesCount] = useState(0);
  const [totalPnL, setTotalPnL] = useState(() => {
    const saved = localStorage.getItem(`quantum_pnl_${user?.uid || 'default'}`);
    // Reset any unrealistically high default values
    const parsed = saved ? parseFloat(saved) : 0;
    return parsed > 1000 ? 0 : parsed; // Reset if over $1000
  });
  const [dailyPnL, setDailyPnL] = useState(() => {
    const saved = localStorage.getItem(`quantum_daily_pnl_${user?.uid || 'default'}_${new Date().toDateString()}`);
    return saved ? parseFloat(saved) : 0;
  });
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [dynamicTradeAmount, setDynamicTradeAmount] = useState(baseTradeAmount);
  const [onChainProfit, setOnChainProfit] = useState<string>('0');

  // Sync On-Chain Profit Data
  useEffect(() => {
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
  
  // Persist PnL to LocalStorage for fallback session persistence
  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`quantum_pnl_${user.uid}`, totalPnL.toString());
      localStorage.setItem(`quantum_daily_pnl_${user.uid}_${new Date().toDateString()}`, dailyPnL.toString());
    }
  }, [totalPnL, dailyPnL, user?.uid]);
  
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
    const interval = setInterval(fetchMarketData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [selectedPairGlobal]);

  // 3. Trade signal evaluation & execution - only when trading is active
  useEffect(() => {
    if (!isTrading || !marketData || !user?.wallet_address) return;

    const evaluateAndExecute = async () => {
      if (isExecutingRef.current) return;
      
      // RISK MANAGEMENT: Daily Loss Limit Circuit Breaker (30% of active trade amount)
      if (dailyPnL <= -(baseTradeAmount * 0.30)) {
        if (Math.random() > 0.95) console.warn("[QUANTUM CIRCUIT BREAKER] Daily Loss Limit Reached. Trading Halted.");
        return; 
      }
      
      const signal = evaluateMarket(marketData, currentPositionRef.current, 1000);
      
      const handleVirtualFallback = async () => {
        if (signal.action === 'BUY' || signal.action === 'SELL') {
          if (!currentPositionRef.current) {
            console.warn(`[QUANTUM] Opening virtual position for PNL tracking.`);
            const tradeId = `virtual_${Date.now()}_${user.uid}`;
            const tradeType = signal.action === 'BUY' ? 'LONG' : 'SHORT';
            
            try {
              await supabase?.from('trades').insert({
                id: tradeId, uid: user.uid, type: tradeType, pair: selectedPairGlobal,
                trade_mode: strategy, entry_price: marketData.price, size: signal.lotSize, pnl: 0,
                mode_type: mode, status: "Running", transaction_hash: 'virtual',
                created_at: new Date().toISOString()
              });
            } catch (dbErr) {
              console.warn("DB insert failed:", dbErr);
            }
            
            setCurrentPosition({
              id: tradeId, type: tradeType, entryPrice: marketData.price,
              size: signal.lotSize, startTime: Date.now(), mode: strategy as any, modeType: mode as any
            });
            setCurrentLotSize(signal.lotSize);
          }
        } else if (signal.action === 'CLOSE') {
          if (currentPositionRef.current) {
            console.warn(`[QUANTUM] Closing virtual position for PNL tracking.`);
            const pos = currentPositionRef.current;
            const priceDiff = pos.type === 'LONG' ? (marketData.price - pos.entryPrice) : (pos.entryPrice - marketData.price);
            const pnlPercent = priceDiff / pos.entryPrice;
            const leverage = 500;
            const pnl = dynamicTradeAmount * leverage * pnlPercent;
            
            try {
              await settleTrade(pos.id, pnl, (Date.now() - pos.startTime)/1000, 'virtual');
            } catch (dbErr) {
              console.warn("DB settle failed:", dbErr);
            }
            setTotalPnL(prev => prev + pnl);
            setDailyPnL(prev => prev + pnl);
            setTradesCount(prev => prev + 1);
            setCurrentPosition(null);
            
            // RISK MANAGEMENT: Lot Scaling (Anti-Martingale)
            if (pnl > 0) {
              setDynamicTradeAmount(prev => prev * 1.1);
            } else if (pnl < 0) {
              setDynamicTradeAmount(prev => Math.max(prev * 0.9, baseTradeAmount * 0.1));
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
            onOpen: async (type, size, txHash) => {
              const tradeId = `${mode}_${Date.now()}_${user.uid}`;
              try {
                await supabase?.from('trades').insert({
                  id: tradeId, uid: user.uid, type, pair: selectedPairGlobal,
                  trade_mode: strategy, entry_price: marketData.price, size, pnl: 0,
                  mode_type: mode, status: "Running", transaction_hash: txHash,
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
                const pnlPercent = priceDiff / pos.entryPrice;
                const leverage = 500; // Standardize to 500x leverage
                const pnl = dynamicTradeAmount * leverage * pnlPercent;
                
                try {
                  await settleTrade(pos.id, pnl, (Date.now() - pos.startTime)/1000, txHash);
                } catch (dbErr) {
                  console.warn("DB settle failed (non-fatal):", dbErr);
                }
                setTotalPnL(prev => prev + pnl);
                setDailyPnL(prev => prev + pnl);
                setTradesCount(prev => prev + 1);
                setCurrentPosition(null);
                
                // RISK MANAGEMENT: Lot Scaling (Anti-Martingale)
                if (pnl > 0) {
                  setDynamicTradeAmount(prev => prev * 1.1);
                } else if (pnl < 0) {
                  setDynamicTradeAmount(prev => Math.max(prev * 0.9, baseTradeAmount * 0.1));
                }
              }
            }
          });

          if (!result.success) {
            await handleVirtualFallback();
          }
        } catch (err) {
          console.error("[QUANTUM EXECUTION ERROR]", err);
          await handleVirtualFallback();
        } finally {
          setTimeout(() => { isExecutingRef.current = false; }, 3000); // Cool-down
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
      const { data: allTrades } = await supabase.from('trades').select('*').eq('uid', user.uid).eq('mode_type', mode);
      
      if (allTrades) {
         const completed = allTrades.filter(t => t.status === 'Completed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
         const running = allTrades.filter(t => t.status === 'Running');
         
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

    const channel = supabase
      .channel(`engine_sync_${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `uid=eq.${user.uid}` }, () => {
        fetchAllTradingData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, mode]);

  return { marketData, currentPosition, tradesCount, totalPnL, currentLotSize, tradeHistory, liveTrades, onChainProfit };
}
