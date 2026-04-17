export type Action = 'BUY' | 'SELL' | 'CLOSE' | 'REVERSE' | 'HOLD';
export type TradeMode = 'Aggressive' | 'Momentum' | 'Scalping' | 'Conservative';
export type ModeType = 'demo' | 'real';

export interface MarketData {
  price: number;
  rsi: number;
  momentum: number;
  liquidityZone: 'HIGH' | 'LOW' | 'NEUTRAL';
  orderFlow: 'BUY_PRESSURE' | 'SELL_PRESSURE' | 'NEUTRAL' | 'REVERSAL';
  timestamp: number;
  candles: Candle[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TradeSignal {
  action: Action;
  confidence: number;
  lot_size: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  reason: string;
}

export interface Position {
  id: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  size: number;
  startTime: number;
  mode: TradeMode;
  modeType: ModeType;
}
