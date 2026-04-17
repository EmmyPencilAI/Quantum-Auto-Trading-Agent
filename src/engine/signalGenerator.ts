import { MarketData, TradeSignal, Action } from './types';

/**
 * Signal Generation Engine (BRAIN)
 * Objective: High-frequency trading with strict confirmation logic
 */
export function generateSignal(data: MarketData, currentLotSize: number = 0.05): TradeSignal {
  const { rsi, liquidityZone, orderFlow, price } = data;

  const bullish =
    rsi < 35 &&
    liquidityZone === "LOW" &&
    orderFlow === "BUY_PRESSURE";

  const bearish =
    rsi > 65 &&
    liquidityZone === "HIGH" &&
    orderFlow === "SELL_PRESSURE";

  const reversal = orderFlow === "REVERSAL";

  let action: Action = "HOLD";
  let confidence = 0.5;
  let reason = "Maintaining market observation";

  if (bullish) {
    action = "BUY";
    confidence = 0.9;
    reason = "RSI recovery from oversold + liquidity low + buy pressure";
  } else if (bearish) {
    action = "SELL";
    confidence = 0.9;
    reason = "RSI rejection from overbought + liquidity high + sell pressure";
  } else if (reversal) {
    action = "REVERSE";
    confidence = 0.85;
    reason = "Order flow reversal detected";
  }

  // Calculate SL/TP based on scalping parameters (tight)
  const pipValue = price * 0.001; // Scalping range
  const stop_loss = action === "BUY" ? price - (pipValue * 2) : price + (pipValue * 2);
  const take_profit = action === "BUY" ? price + (pipValue * 3) : price - (pipValue * 3);

  return {
    action,
    confidence,
    lot_size: currentLotSize,
    entry_price: price,
    stop_loss,
    take_profit,
    reason
  };
}
