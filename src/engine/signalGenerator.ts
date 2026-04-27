import { EMA, RSI } from 'technicalindicators';
import { Candle, MarketData, Position, TradeSignal } from './types';

// State for risk management
export const EngineState = {
  currentLotSize: 0.05,
  dailyLossPercent: 0,
  consecutiveWins: 0,
  killSwitch: false,
};

export function evaluateMarket(
  marketData: MarketData,
  currentPosition: Position | null,
  walletBalance: number
): TradeSignal | null {

  if (EngineState.killSwitch) return null;
  if (EngineState.dailyLossPercent <= -3.0) {
    EngineState.killSwitch = true;
    console.log("CRITICAL: Daily loss limit hit. Engine halted.");
    return null;
  }

  const { candles, price } = marketData;
  if (!candles || candles.length < 26) return null; // EMA-21 needs 21 + a few buffer

  // Extract closing prices and volumes
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 1); // Default to 1 to avoid all-zero

  // 1. Calculate EMAs (Fast = 9, Slow = 21)
  const emaFast = EMA.calculate({ period: 9, values: closes });
  const emaSlow = EMA.calculate({ period: 21, values: closes });
  
  if (emaFast.length === 0 || emaSlow.length === 0) return null;
  
  const currentEmaFast = emaFast[emaFast.length - 1];
  const currentEmaSlow = emaSlow[emaSlow.length - 1];

  // 2. Calculate RSI (14 periods)
  const rsiValues = RSI.calculate({ period: 14, values: closes });
  if (rsiValues.length === 0) return null;
  const currentRsi = rsiValues[rsiValues.length - 1];

  // 3. Volume Spike Detection
  const recentVolume = volumes.slice(-10);
  const avgVolume = recentVolume.reduce((a,b)=>a+b, 0) / recentVolume.length;
  const currentVolume = volumes[volumes.length - 1];
  const hasVolumeSpike = avgVolume === 0 || currentVolume > (avgVolume * 1.2); // 20% above average

  // 4. Spread / Sideways Check (Simplified: if price barely moved over last 5 candles)
  const recentCloses = closes.slice(-5);
  const maxPrice = Math.max(...recentCloses);
  const minPrice = Math.min(...recentCloses);
  const priceRangePercent = ((maxPrice - minPrice) / minPrice) * 100;
  
  if (priceRangePercent < 0.005) {
    // Market is dead sideways. Do not enter.
    return null;
  }

  // ==== POSITION MANAGEMENT & EARLY EXITS ====
  if (currentPosition) {
    const pnlPercent = currentPosition.type === 'LONG' 
      ? ((price - currentPosition.entryPrice) / currentPosition.entryPrice) * 100
      : ((currentPosition.entryPrice - price) / currentPosition.entryPrice) * 100;

    // Take Profit (0.15% - 0.35%)
    if (pnlPercent >= 0.20) {
      handleWin();
      return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'TP_HIT' };
    }

    // Hard Stop Loss (0.10% - 0.25%)
    if (pnlPercent <= -0.15) {
      handleLoss();
      return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'SL_HIT' };
    }

    // EARLY EXIT: Momentum Reversal (EMA flips or RSI weakens)
    if (currentPosition.type === 'LONG') {
      if (currentEmaFast < currentEmaSlow || currentRsi < 40) {
        handleLoss();
        return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'MOMENTUM_REVERSAL_DOWN' };
      }
    } else { // SHORT
      if (currentEmaFast > currentEmaSlow || currentRsi > 60) {
        handleLoss();
        return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'MOMENTUM_REVERSAL_UP' };
      }
    }
    
    // No exit condition met, hold position.
    return null;
  }

  // ==== ENTRY LOGIC ====
  
  // LONG ENTRY: EMA Fast > Slow, RSI between 50 and 78 (bullish but not overbought), Volume Spike
  if (currentEmaFast > currentEmaSlow && currentRsi > 50 && currentRsi < 78 && hasVolumeSpike) {
    return { action: 'BUY', lotSize: EngineState.currentLotSize, reason: 'BULLISH_BREAKOUT' };
  }

  // SHORT ENTRY: EMA Fast < Slow, RSI between 22 and 50 (bearish but not oversold), Volume Spike
  if (currentEmaFast < currentEmaSlow && currentRsi < 50 && currentRsi > 22 && hasVolumeSpike) {
    return { action: 'SELL', lotSize: EngineState.currentLotSize, reason: 'BEARISH_BREAKDOWN' };
  }

  return null;
}

// Helper to scale lot size on wins
function handleWin() {
  EngineState.consecutiveWins++;
  if (EngineState.consecutiveWins >= 2) {
    // Scale up slightly (max 0.20)
    EngineState.currentLotSize = Math.min(0.20, EngineState.currentLotSize + 0.02);
  }
}

// Helper to reduce lot size on losses
function handleLoss() {
  EngineState.consecutiveWins = 0;
  // Reset to strict baseline
  EngineState.currentLotSize = 0.05;
}
