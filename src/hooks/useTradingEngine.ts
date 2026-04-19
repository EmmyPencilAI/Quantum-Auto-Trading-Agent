import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config';
import { Position, MarketData, Candle, ModeType, TradeMode, Trade } from '../engine/types';

export function useTradingEngine(user: any, mode: ModeType, strategy: TradeMode, isTrading: boolean, baseTradeAmount: number = 100) {
  const [currentLotSize, setCurrentLotSize] = useState(0.05);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradesCount, setTradesCount] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);

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
        supabase.from('trades').select('*').eq('uid', user.uid).eq('status', 'Running').then(({ data }) => {
           if (!data || data.length === 0) {
             supabase.from('trades').upsert({
                id: `bk_${Date.now()}_${user.uid}`,
                uid: user.uid,
                type: Math.random() > 0.5 ? 'BUY' : 'SELL',
                pair: 'BTC/USDT',
                trade_mode: strategy,
                entry_price: marketData?.price || 64000,
                size: 0.1, // Default lot
                pnl: 0,
                mode_type: mode,
                status: "Running",
                created_at: new Date().toISOString()
             }).then();
           }
        });
      }
    }
  }, [isTrading, user?.uid, baseTradeAmount, strategy, mode]);

  // 2. Real-time Market Data Simulation (kept for UI feel)
  useEffect(() => {
    const interval = setInterval(() => {
      const price = 64000 + (Math.random() - 0.5) * 50;
      setMarketData({
        price,
        rsi: 45 + Math.random() * 10,
        momentum: Math.random(),
        liquidityZone: "NEUTRAL",
        orderFlow: "NEUTRAL",
        timestamp: Date.now(),
        candles: []
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // 3. LISTEN for changes from the server engine
  useEffect(() => {
    if (!user?.uid) return;

    const fetchCurrentState = async () => {
      // Get all-time counts and PnL
      const { data: allTrades } = await supabase.from('trades').select('pnl').eq('uid', user.uid).eq('status', 'Completed');
      if (allTrades) {
         setTradesCount(allTrades.length);
         setTotalPnL(allTrades.reduce((acc, t) => acc + (t.pnl || 0), 0));
      }

      // Get current running trade
      const { data: running } = await supabase.from('trades').select('*').eq('uid', user.uid).eq('status', 'Running').single();
      if (running) {
        setCurrentPosition({
          id: running.id,
          type: running.type as any,
          entryPrice: running.entry_price,
          size: running.size,
          startTime: new Date(running.created_at).getTime(),
          mode: running.trade_mode as any,
          modeType: running.mode_type as any
        });
      } else {
        setCurrentPosition(null);
      }
    };

    fetchCurrentState();

    const channel = supabase
      .channel('engine_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `uid=eq.${user.uid}` }, () => {
        fetchCurrentState();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid]);

  return { marketData, currentPosition, tradesCount, totalPnL, currentLotSize };
}
