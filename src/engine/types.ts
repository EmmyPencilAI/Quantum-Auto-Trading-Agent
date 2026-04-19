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
  lotSize: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
}

export interface Position {
  id: string;
  type: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  entryPrice: number;
  size: number;
  startTime: number;
  mode: TradeMode;
  modeType: ModeType;
}

export interface Trade extends Position {
  pnl: number;
  status: 'Running' | 'Completed';
  pair: string;
  time_taken?: number;
  created_at: string;
}
