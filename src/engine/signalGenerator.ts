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
  if (!candles || candles.length < 26) {
    console.log(`[SIGNAL] Not enough candles: ${candles?.length || 0}/26`);
    return null;
  }

  // Extract closing prices and volumes
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 1); // Default to 1 to avoid all-zero

  // 1. Calculate EMAs (Fast = 9, Slow = 21)
  const emaFast = EMA.calculate({ period: 9, values: closes });
  const emaSlow = EMA.calculate({ period: 21, values: closes });
  
  if (emaFast.length === 0 || emaSlow.length === 0) return null;
  
  const currentEmaFast = emaFast[emaFast.length - 1];
  const currentEmaSlow = emaSlow[emaSlow.length - 1];
  const emaTrend = currentEmaFast > currentEmaSlow ? 'BULLISH' : 'BEARISH';

  // 2. Calculate RSI (14 periods)
  const rsiValues = RSI.calculate({ period: 14, values: closes });
  if (rsiValues.length === 0) return null;
  const currentRsi = rsiValues[rsiValues.length - 1];

  // 3. Volume Spike Detection (optional bonus, not required)
  const recentVolume = volumes.slice(-10);
  const avgVolume = recentVolume.reduce((a,b)=>a+b, 0) / recentVolume.length;
  const currentVolume = volumes[volumes.length - 1];
  const hasVolumeSpike = avgVolume === 0 || currentVolume > (avgVolume * 1.15); // 15% above average

  // 4. Spread / Sideways Check
  const recentCloses = closes.slice(-5);
  const maxPrice = Math.max(...recentCloses);
  const minPrice = Math.min(...recentCloses);
  const priceRangePercent = ((maxPrice - minPrice) / minPrice) * 100;
  
  // Log signal evaluation for debugging
  console.log(`[SIGNAL] EMA: ${emaTrend} (fast=${currentEmaFast.toFixed(2)}, slow=${currentEmaSlow.toFixed(2)}) | RSI: ${currentRsi.toFixed(2)} | VolSpike: ${hasVolumeSpike} | Range: ${priceRangePercent.toFixed(4)}%`);

  if (priceRangePercent < 0.001) {
    // Market is completely dead. Do not enter.
    console.log(`[SIGNAL] Market sideways (${priceRangePercent.toFixed(4)}%), skipping`);
    return null;
  }

  // ==== POSITION MANAGEMENT & EARLY EXITS ====
  if (currentPosition) {
    const pnlPercent = currentPosition.type === 'LONG' 
      ? ((price - currentPosition.entryPrice) / currentPosition.entryPrice) * 100
      : ((currentPosition.entryPrice - price) / currentPosition.entryPrice) * 100;

    // Take Profit (0.30% target for 500x leverage = 150% ROI)
    if (pnlPercent >= 0.30) {
      handleWin();
      return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'TP_HIT' };
    }

    // Hard Stop Loss (-0.2% at 500x leverage = -100% ROI - PROTECTS INVESTMENT)
    if (pnlPercent <= -0.2) {
      handleLoss();
      return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'SL_HIT' };
    }

    // EARLY EXIT: Momentum Reversal (EMA flips or RSI weakens)
    if (currentPosition.type === 'LONG') {
      if (currentEmaFast < currentEmaSlow || currentRsi < 35) {
        handleLoss();
        return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'MOMENTUM_REVERSAL_DOWN' };
      }
    } else { // SHORT
      if (currentEmaFast > currentEmaSlow || currentRsi > 65) {
        handleLoss();
        return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'MOMENTUM_REVERSAL_UP' };
      }
    }
    
    // No exit condition met, hold position.
    return null;
  }

  // ==== ENTRY LOGIC ====
  
  // LONG ENTRY: EMA Fast > Slow, RSI between 40 and 80 (bullish)
  if (currentEmaFast > currentEmaSlow && currentRsi > 40 && currentRsi < 80) {
    console.log(`[SIGNAL] ✅ LONG entry triggered! RSI=${currentRsi.toFixed(2)} VolSpike=${hasVolumeSpike}`);
    return { action: 'BUY', lotSize: EngineState.currentLotSize, reason: hasVolumeSpike ? 'BULLISH_BREAKOUT' : 'BULLISH_TREND' };
  }

  // SHORT ENTRY: EMA Fast < Slow, RSI between 20 and 60 (bearish)
  if (currentEmaFast < currentEmaSlow && currentRsi < 60 && currentRsi > 20) {
    console.log(`[SIGNAL] ✅ SHORT entry triggered! RSI=${currentRsi.toFixed(2)} VolSpike=${hasVolumeSpike}`);
    return { action: 'SELL', lotSize: EngineState.currentLotSize, reason: hasVolumeSpike ? 'BEARISH_BREAKDOWN' : 'BEARISH_TREND' };
  }

  console.log(`[SIGNAL] No entry conditions met. EMA trend=${emaTrend}, RSI=${currentRsi.toFixed(2)}`);
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
