import { TradeSignal, Position } from './types';

/**
 * Execution Engine (HAND)
 * Handles the lifecycle of trades in the market
 */
export async function executeTrade(
  signal: TradeSignal, 
  currentPosition: Position | null,
  callbacks: {
    onOpen: (type: 'LONG' | 'SHORT', size: number) => Promise<void>;
    onClose: () => Promise<void>;
  }
) {
  const { action, lotSize } = signal;

  if (action === "BUY" && !currentPosition) {
    await callbacks.onOpen("LONG", lotSize);
  }

  if (action === "SELL" && !currentPosition) {
    await callbacks.onOpen("SHORT", lotSize);
  }

  if (action === "REVERSE" && currentPosition) {
    await callbacks.onClose();
    const oppositeType = currentPosition.type === "LONG" ? "SHORT" : "LONG";
    await callbacks.onOpen(oppositeType, lotSize);
  }

  if (action === "CLOSE" && currentPosition) {
    await callbacks.onClose();
  }
}
