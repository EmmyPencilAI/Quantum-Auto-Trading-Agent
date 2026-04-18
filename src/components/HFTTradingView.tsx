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
      <div className="h-80 flex items-center justify-center bg-[#050505] rounded-[2.5rem] border border-white/5 animate-pulse overflow-hidden relative">
        <div className="absolute inset-0 opacity-5">
           <div className="grid grid-cols-12 h-full w-full">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-white" />
              ))}
           </div>
        </div>
        <div className="flex flex-col items-center gap-4">
           <Zap className="w-8 h-8 text-orange-500 animate-bounce" />
           <p className="font-mono text-[10px] text-white/40 uppercase tracking-[0.4em]">Calibrating Quantum Feed...</p>
        </div>
      </div>
    );
  }

  const maxHigh = Math.max(...candles.map(c => c.high));
  const minLow = Math.min(...candles.map(c => c.low));
  const range = (maxHigh - minLow) || 1;

  const getY = (price: number) => {
    return ((maxHigh - price) / range) * 100;
  };

  return (
    <div className="relative h-96 w-full bg-[#050505] rounded-[2.5rem] border border-white/10 overflow-hidden group shadow-2xl">
      {/* MT4 Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
        <h1 className="text-[15vw] font-black uppercase italic tracking-tighter select-none">QUANTUM</h1>
      </div>

      {/* Grid Lines */}
      <div className="absolute inset-0 p-6 pointer-events-none">
        <div className="w-full h-full border border-white/5 grid grid-cols-6 grid-rows-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="border-r border-b border-white/[0.03]" />
          ))}
        </div>
      </div>

      {/* Main Chart Stage */}
      <div className="relative h-full w-full flex items-end gap-[3px] p-8 pb-12">
        {candles.map((candle, i) => {
          const isBullish = candle.close >= candle.open;
          const bodyTop = getY(Math.max(candle.open, candle.close));
          const bodyBottom = getY(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(Math.abs(bodyTop - bodyBottom), 2);
          const wickTop = getY(candle.high);
          const wickBottom = getY(candle.low);
          const wickHeight = Math.abs(wickTop - wickBottom);

          return (
            <div key={i} className="flex-1 relative flex flex-col items-center" style={{ height: '100%' }}>
              {/* Wick */}
              <div 
                className={cn("absolute w-[1.5px] z-0", isBullish ? "bg-[#00ff9d]/30" : "bg-[#ff3b3b]/30")}
                style={{ top: `${wickTop}%`, height: `${wickHeight}%` }}
              />
              {/* Body */}
              <motion.div 
                initial={false}
                animate={{ top: `${bodyTop}%`, height: `${bodyHeight}%` }}
                className={cn(
                  "absolute w-full z-10 rounded-[1px] shadow-[0_0_10px_rgba(0,0,0,0.5)]", 
                  isBullish ? "bg-[#00ff9d]" : "bg-[#ff3b3b]"
                )}
              />
              
              {/* Active Trade Marker */}
              {i === candles.length - 1 && currentPosition && (
                <div className="absolute top-0 -translate-y-12 z-30 flex flex-col items-center min-w-max">
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-2xl border shadow-xl backdrop-blur-xl",
                      currentPosition.type === 'LONG' 
                        ? "bg-green-500/10 border-green-500/30 text-green-500" 
                        : "bg-red-500/10 border-red-500/30 text-red-500"
                    )}
                  >
                    <div className="flex items-center gap-2">
                       {currentPosition.type === 'LONG' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                       <span className="text-[10px] font-black uppercase tracking-widest">{currentPosition.type === 'LONG' ? 'ACTIVE LONG' : 'ACTIVE SHORT'}</span>
                    </div>
                    <div className="flex flex-col items-center border-t border-white/5 pt-1 mt-1 w-full">
                       <span className="text-[9px] font-mono opacity-60">LOT: {currentPosition.size.toFixed(3)}</span>
                       <span className="text-[9px] font-mono opacity-60">ENTRY: {currentPosition.entryPrice.toFixed(2)}</span>
                       <span className="text-[9px] font-mono opacity-60">TIME: {new Date(currentPosition.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </motion.div>
                  {/* Connector Line */}
                  <div className={cn("w-px h-12 dashed-line mt-1 opacity-40", currentPosition.type === 'LONG' ? "bg-green-500" : "bg-red-500")} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overlays */}
      <div className="absolute top-6 left-6 flex flex-col gap-1">
         <h3 className="font-display text-2xl font-black italic tracking-tighter text-white/20 select-none">HFT-ALPHA V2</h3>
         <p className="font-mono text-[8px] text-white/10 uppercase tracking-[0.3em]">Quantum Execution Layer</p>
      </div>

      <div className="absolute top-6 right-6 flex items-center gap-3">
        <div className="px-4 py-2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 flex items-center gap-3 shadow-lg">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Live Price</span>
            <span className="text-sm font-mono font-bold text-white tabular-nums">{marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className={cn(
             "w-2 h-2 rounded-full animate-pulse",
             marketData.orderFlow === 'BUY_PRESSURE' ? "bg-green-500" : "bg-red-500"
          )} />
        </div>
      </div>

      {/* Technical Labels */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
        <div className="flex gap-6">
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1 italic serif">RSI Indicator</span>
            <span className={cn("text-xs font-mono font-bold", marketData.rsi < 35 ? "text-green-500" : marketData.rsi > 65 ? "text-red-500" : "text-white/60")}>
              {marketData.rsi.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1 italic serif">Liquidity Zone</span>
            <span className="text-xs font-mono font-bold text-white/60">{marketData.liquidityZone}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1 italic serif">Order Flow</span>
            <span className={cn(
               "text-xs font-mono font-bold",
               marketData.orderFlow === 'BUY_PRESSURE' ? "text-green-500" : marketData.orderFlow === 'SELL_PRESSURE' ? "text-red-500" : "text-white/40"
            )}>{marketData.orderFlow.replace('_', ' ')}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
           <div className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />
           <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Engine Sync: 12ms</span>
        </div>
      </div>
    </div>
  );
}
