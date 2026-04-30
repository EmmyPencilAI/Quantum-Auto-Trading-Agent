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
  walletBalance: number,
  strategy: string = 'Aggressive'
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

  // 3. Volume Spike Detection (strict requirement)
  const recentVolume = volumes.slice(-10, -1); // Exclude the current incomplete candle
  const avgVolume = recentVolume.reduce((a,b)=>a+b, 0) / (recentVolume.length || 1);
  const lastCompletedVolume = volumes[volumes.length - 2] || volumes[0];
  // More forgiving: 10% above average on the last completed candle, or just high momentum
  const hasVolumeSpike = avgVolume === 0 || lastCompletedVolume > (avgVolume * 1.10); 

  // 4. Spread / Sideways & Breakout Check
  const recentCloses = closes.slice(-8); // 8 periods for breakout detection
  const maxPrice = Math.max(...recentCloses);
  const minPrice = Math.min(...recentCloses);
  const priceRangePercent = ((maxPrice - minPrice) / minPrice) * 100;
  
  // Breakout structure: current price is testing or breaking recent highs/lows
  // Loosened slightly to 0.9990 so it triggers right before or right at the breakout
  const isBullishBreakout = price >= maxPrice * 0.9990; 
  const isBearishBreakout = price <= minPrice * 1.0010; 

  // Log signal evaluation for debugging
  console.log(`[SIGNAL] EMA: ${emaTrend} | RSI: ${currentRsi.toFixed(2)} | VolSpike: ${hasVolumeSpike} | Range: ${priceRangePercent.toFixed(4)}% | BullBrk: ${isBullishBreakout} | BearBrk: ${isBearishBreakout}`);

  // STOP TRADING: Sideways market or high spread (flat range)
  if (priceRangePercent < 0.02) { // Lowered to 0.02% to allow more action
    console.log(`[SIGNAL] Market sideways (${priceRangePercent.toFixed(4)}% range), skipping`);
    return null;
  }

  // ==== POSITION MANAGEMENT & EARLY EXITS ====
  if (currentPosition) {
    const pnlPercent = currentPosition.type === 'LONG' 
      ? ((price - currentPosition.entryPrice) / currentPosition.entryPrice) * 100
      : ((currentPosition.entryPrice - price) / currentPosition.entryPrice) * 100;

    // Take Profit logic (0.15% - 0.35%)
    let tpThreshold = 0.25;
    let slThreshold = -0.15;
    
    switch (strategy) {
      case 'Scalping': tpThreshold = 0.15; slThreshold = -0.10; break;
      case 'Aggressive': tpThreshold = 0.35; slThreshold = -0.25; break;
      case 'Momentum': tpThreshold = 0.30; slThreshold = -0.20; break;
      case 'Conservative': tpThreshold = 0.20; slThreshold = -0.10; break;
    }
    
    if (pnlPercent >= tpThreshold) {
      handleWin();
      return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'TP_HIT' };
    }

    // Hard Stop Loss (0.10% - 0.25%)
    if (pnlPercent <= slThreshold) {
      handleLoss();
      return { action: 'CLOSE', lotSize: currentPosition.size, reason: 'SL_HIT' };
    }

    // EARLY EXIT: Momentum Reversal (EMA flips or RSI weakens)
    // Don't wait for full stop loss if momentum completely shifts
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
  
  // STRICT LONG ENTRY: EMA Aligns + RSI Confirms + Volume Spike + Breakout Structure
  if (currentEmaFast > currentEmaSlow && currentRsi > 50 && currentRsi < 75 && hasVolumeSpike && isBullishBreakout) {
    console.log(`[SIGNAL] ✅ STRICT LONG entry triggered! RSI=${currentRsi.toFixed(2)} Vol=${hasVolumeSpike}`);
    return { action: 'BUY', lotSize: EngineState.currentLotSize, reason: 'BULLISH_BREAKOUT' };
  }

  // STRICT SHORT ENTRY: EMA Aligns + RSI Confirms + Volume Spike + Breakout Structure
  if (currentEmaFast < currentEmaSlow && currentRsi < 50 && currentRsi > 25 && hasVolumeSpike && isBearishBreakout) {
    console.log(`[SIGNAL] ✅ STRICT SHORT entry triggered! RSI=${currentRsi.toFixed(2)} Vol=${hasVolumeSpike}`);
    return { action: 'SELL', lotSize: EngineState.currentLotSize, reason: 'BEARISH_BREAKDOWN' };
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
