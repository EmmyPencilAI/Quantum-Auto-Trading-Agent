import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config';
import { Position, MarketData, ModeType, Trade, Candle } from '../engine/types';
import { TradingMode } from '../types';
import { evaluateMarket } from '../engine/signalGenerator';
import { executeTrade } from '../engine/executor';
import { settleTrade } from '../services/tradingService';

export function useTradingEngine(
  user: any, 
  mode: ModeType, 
  strategy: TradingMode, 
  isTrading: boolean, 
  baseTradeAmount: number = 100,
  selectedPairGlobal: string = 'BTC/USDT'
) {
  const [currentLotSize, setCurrentLotSize] = useState(0.05);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradesCount, setTradesCount] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  
  const isExecutingRef = useRef(false);
  const currentPositionRef = useRef<Position | null>(null);
  
  // Keep ref in sync for the interval closure
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);

  // 1. Sync local trading status to DB so server can pick it up
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
  }, [isTrading, user?.uid, baseTradeAmount, strategy, mode, selectedPairGlobal]);

  // 2. ALWAYS fetch market data so the chart renders even when not trading
  useEffect(() => {
    const symbol = selectedPairGlobal.replace('/', '');
    
    const fetchMarketData = async () => {
      try {
        // Fetch current price
        const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const priceData = await priceRes.json();
        const price = parseFloat(priceData.price);
        
        if (!price || isNaN(price)) {
          console.warn("Invalid price returned from Binance");
          return;
        }

        // Fetch candles - try 1m (most reliable), fallback to synthetic
        let candles: Candle[] = [];
        try {
          const candleRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=80`);
          if (candleRes.ok) {
            const candleData = await candleRes.json();
            if (Array.isArray(candleData) && candleData.length > 0) {
              candles = candleData.map((c: any) => ({
                time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
              }));
            }
          }
        } catch (e) {
          console.warn("1m klines fetch failed");
        }

        // Fallback: generate synthetic candles with realistic volume patterns
        if (candles.length === 0) {
          const spread = price * 0.002; // 0.2% spread for more variance
          let lastClose = price;
          candles = Array.from({ length: 60 }, (_, i) => {
            const drift = (Math.random() - 0.48) * spread; // slight upward bias
            const open = lastClose;
            const close = open + drift;
            const high = Math.max(open, close) + Math.random() * spread * 0.5;
            const low = Math.min(open, close) - Math.random() * spread * 0.5;
            // Create volume spikes on some candles (every ~8th candle)
            const baseVolume = 50 + Math.random() * 50;
            const volume = i % 8 === 0 ? baseVolume * 2.5 : baseVolume;
            lastClose = close;
            return { time: Date.now() - (60 - i) * 60000, open, high, low, close, volume };
          });
        }

        // Calculate proper RSI and order flow from candle data
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
      } catch (e) {
        console.warn("Market fetch failed", e);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [selectedPairGlobal]);

  // 3. Trade signal evaluation & execution - only when trading is active
  useEffect(() => {
    if (!isTrading || !marketData || !user?.wallet_address) return;

    const evaluateAndExecute = async () => {
      if (isExecutingRef.current) return;
      
      const signal = evaluateMarket(marketData, currentPositionRef.current, 1000);
      
      if (signal) {
        isExecutingRef.current = true;
        console.log(`[QUANTUM SIGNAL] Firing: ${signal.action} Lot: ${signal.lotSize} Reason: ${signal.reason}`);
        
        try {
          await executeTrade(signal, currentPositionRef.current, {
            userAddress: user.wallet_address,
            modeType: mode,
            pair: selectedPairGlobal,
            onOpen: async (type, size, txHash) => {
              const tradeId = `real_${Date.now()}_${user.uid}`;
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
                id: tradeId,
                type,
                entryPrice: marketData.price,
                size,
                startTime: Date.now(),
                mode: strategy as any,
                modeType: mode as any
              });
              setCurrentLotSize(size);
            },
            onClose: async (txHash) => {
              if (currentPositionRef.current) {
                const pos = currentPositionRef.current;
                const pnl = pos.type === 'LONG' ? (marketData.price - pos.entryPrice) * pos.size * 10 : (pos.entryPrice - marketData.price) * pos.size * 10;
                try {
                  await settleTrade(pos.id, pnl, (Date.now() - pos.startTime)/1000, txHash);
                } catch (dbErr) {
                  console.warn("DB settle failed (non-fatal):", dbErr);
                }
                setTotalPnL(prev => prev + pnl);
                setTradesCount(prev => prev + 1);
                setCurrentPosition(null);
              }
            }
          });
        } catch (err) {
          console.error("[QUANTUM EXECUTION ERROR]", err);
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
         
         setTradeHistory(completed.slice(0, 300));
         setLiveTrades(running);
         setTradesCount(completed.length);
         setTotalPnL(completed.reduce((acc, t) => acc + (t.pnl || 0), 0));

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

  return { marketData, currentPosition, tradesCount, totalPnL, currentLotSize, tradeHistory, liveTrades };
}
