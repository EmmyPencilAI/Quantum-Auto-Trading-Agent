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

  // 2. Real-time Market Data via Binance API & Real Trade Execution
  useEffect(() => {
    const symbol = selectedPairGlobal.replace('/', '');
    
    const fetchMarketData = async () => {
      try {
        const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const priceData = await priceRes.json();
        const price = parseFloat(priceData.price);

        const candleRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1s&limit=80`);
        const candleData = await candleRes.json();
        const candles: Candle[] = candleData.map((c: any) => ({
          time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
        }));

        const newData: MarketData = {
          price,
          rsi: 50, // Evaluated properly inside signalGenerator
          momentum: Math.random(),
          liquidityZone: "NEUTRAL",
          orderFlow: "NEUTRAL",
          timestamp: Date.now(),
          candles
        };
        setMarketData(newData);

        // 🧠 QUANTUM HFT ENGINE: Evaluate & Execute
        if (isTrading && !isExecutingRef.current && user?.wallet_address) {
          const signal = evaluateMarket(newData, currentPositionRef.current, 1000); // 1000 is mock balance for sizing
          
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
                  await supabase.from('trades').insert({
                    id: tradeId, uid: user.uid, type, pair: selectedPairGlobal,
                    trade_mode: strategy, entry_price: price, size, pnl: 0,
                    mode_type: mode, status: "Running", transaction_hash: txHash,
                    created_at: new Date().toISOString()
                  });
                },
                onClose: async (txHash) => {
                  if (currentPositionRef.current) {
                    const pos = currentPositionRef.current;
                    const pnl = pos.type === 'LONG' ? (price - pos.entryPrice) * pos.size * 10 : (pos.entryPrice - price) * pos.size * 10;
                    await settleTrade(pos.id, pnl, (Date.now() - pos.startTime)/1000, txHash);
                  }
                }
              });
            } catch (err) {
              console.error("[QUANTUM EXECUTION ERROR]", err);
            } finally {
              setTimeout(() => { isExecutingRef.current = false; }, 3000); // Cool-down
            }
          }
        }
      } catch (e) {
        console.warn("Market fetch failed", e);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 2000); // Poll every 2 seconds for HFT
    return () => clearInterval(interval);
  }, [selectedPairGlobal, isTrading, user?.wallet_address, mode, strategy]);

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
