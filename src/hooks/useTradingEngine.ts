import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config';
import { Position, MarketData, ModeType, Trade, Candle } from '../engine/types';
import { TradingMode } from '../types';

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

      // If we just started trading, ensure a 'Running' trade exists in DB for the server to process
      if (isTrading) {
        const checkAndStartTrade = async () => {
          const { data } = await supabase.from('trades').select('*').eq('uid', user.uid).eq('status', 'Running');
          if (!data || data.length === 0) {
            await supabase.from('trades').upsert({
                id: `bk_${Date.now()}_${user.uid}`,
                uid: user.uid,
                type: Math.random() > 0.5 ? 'BUY' : 'SELL',
                pair: selectedPairGlobal,
                trade_mode: strategy,
                entry_price: marketData?.price || 64000,
                size: 0.1, // Default lot
                pnl: 0,
                mode_type: mode,
                status: "Running",
                created_at: new Date().toISOString()
            });
          }
        };
        checkAndStartTrade();
      }
    }
  }, [isTrading, user?.uid, baseTradeAmount, strategy, mode, selectedPairGlobal]);

  // 2. Real-time Market Data via Binance API
  useEffect(() => {
    const symbol = selectedPairGlobal.replace('/', '');
    
    const fetchMarketData = async () => {
      try {
        // Fetch current price
        const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const priceData = await priceRes.json();
        const price = parseFloat(priceData.price);

        // Fetch candles (1m interval)
        const candleRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=30`);
        const candleData = await candleRes.json();
        const candles: Candle[] = candleData.map((c: any) => ({
          time: c[0],
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4])
        }));

        setMarketData({
          price,
          rsi: 45 + Math.random() * 10, // Simulated RSI for now
          momentum: Math.random(),
          liquidityZone: "NEUTRAL",
          orderFlow: "NEUTRAL",
          timestamp: Date.now(),
          candles
        });
      } catch (e) {
        console.warn("Market data fetch failed, using fallback", e);
        // Fallback
        const fallbackPrice = 64000 + (Math.random() - 0.5) * 50;
        setMarketData(prev => ({
          price: fallbackPrice,
          rsi: 45 + Math.random() * 10,
          momentum: Math.random(),
          liquidityZone: "NEUTRAL",
          orderFlow: "NEUTRAL",
          timestamp: Date.now(),
          candles: prev?.candles || []
        }));
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 5000); // 5s update
    return () => clearInterval(interval);
  }, [selectedPairGlobal]);

  // 3. LISTEN for changes from the server engine
  useEffect(() => {
    if (!user?.uid) return;

    const fetchAllTradingData = async () => {
      // Get all-time counts and PnL
      const { data: allTrades } = await supabase.from('trades').select('*').eq('uid', user.uid).eq('mode_type', mode);
      
      if (allTrades) {
         const completed = allTrades.filter(t => t.status === 'Completed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
         const running = allTrades.filter(t => t.status === 'Running');
         
         setTradeHistory(completed.slice(0, 150));
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
