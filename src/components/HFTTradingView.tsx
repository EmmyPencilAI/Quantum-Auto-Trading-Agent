import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowUp, ArrowDown, Zap } from 'lucide-react';
import { MarketData, Candle, Position, TradeSignal } from '../engine/types';
import { cn } from '../lib/utils';

interface HFTTradingViewProps {
  marketData: MarketData | null;
  currentPosition: Position | null;
}

export default function HFTTradingView({ marketData, currentPosition }: HFTTradingViewProps) {
  const candles = useMemo(() => marketData?.candles || [], [marketData]);

  if (!marketData) {
    return (
      <div className="h-64 flex items-center justify-center bg-black/40 rounded-3xl border border-white/5 animate-pulse">
        <p className="font-mono text-xs text-white/20 uppercase tracking-[0.2em]">Awaiting Engine Feed...</p>
      </div>
    );
  }

  const maxHigh = Math.max(...candles.map(c => c.high));
  const minLow = Math.min(...candles.map(c => c.low));
  const range = maxHigh - minLow;

  const getY = (price: number) => {
    return ((maxHigh - price) / range) * 100;
  };

  return (
    <div className="relative h-80 w-full bg-black/40 rounded-[2rem] border border-white/5 overflow-hidden p-4 group">
      {/* Price Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-10">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-full h-px bg-white/20 border-t border-dashed" />
        ))}
      </div>

      {/* Main Chart Stage */}
      <div className="relative h-full w-full flex items-end gap-[2px]">
        {candles.map((candle, i) => {
          const isBullish = candle.close >= candle.open;
          const bodyTop = getY(Math.max(candle.open, candle.close));
          const bodyBottom = getY(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(Math.abs(bodyTop - bodyBottom), 1);
          const wickTop = getY(candle.high);
          const wickBottom = getY(candle.low);
          const wickHeight = Math.abs(wickTop - wickBottom);

          return (
            <div key={i} className="flex-1 relative flex flex-col items-center group/candle" style={{ height: '100%' }}>
              {/* Wick */}
              <div 
                className={cn("absolute w-px z-0", isBullish ? "bg-green-500/50" : "bg-red-500/50")}
                style={{ top: `${wickTop}%`, height: `${wickHeight}%` }}
              />
              {/* Body */}
              <motion.div 
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                className={cn("absolute w-full z-10 rounded-sm shadow-sm", isBullish ? "bg-green-500" : "bg-red-500")}
                style={{ top: `${bodyTop}%`, height: `${bodyHeight}%` }}
              />
              
              {/* Markers */}
              {i === candles.length - 1 && currentPosition && (
                <div className="absolute top-0 -translate-y-8 z-20 flex flex-col items-center">
                  {currentPosition.type === 'LONG' ? (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="flex flex-col items-center text-green-500"
                    >
                      <ArrowUp className="w-4 h-4" />
                      <span className="text-[8px] font-black uppercase">BUY</span>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="flex flex-col items-center text-red-500"
                    >
                      <ArrowDown className="w-4 h-4" />
                      <span className="text-[8px] font-black uppercase">SELL</span>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overlays */}
      <div className="absolute top-4 right-4 flex gap-2">
        <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[10px] font-mono font-bold">{marketData.price.toFixed(2)}</span>
        </div>
      </div>

      {/* Technical Labels */}
      <div className="absolute bottom-4 left-4 flex gap-4">
        <div className="text-[10px] font-mono">
          <span className="text-white/30 uppercase mr-2 text-[8px]">RSI:</span>
          <span className={cn(marketData.rsi < 35 ? "text-green-500" : marketData.rsi > 65 ? "text-red-500" : "text-white/60")}>
            {marketData.rsi.toFixed(1)}
          </span>
        </div>
        <div className="text-[10px] font-mono">
          <span className="text-white/30 uppercase mr-2 text-[8px]">Zone:</span>
          <span className="text-white/60">{marketData.liquidityZone}</span>
        </div>
      </div>
    </div>
  );
}
