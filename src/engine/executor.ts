import { TradeSignal, Position } from './types';
import { ethers } from 'ethers';
import { executeBuyTrade, executeSellTrade, validateTradeAmount, isValidAddress } from '../lib/contract';
import { APP_CONFIG } from '../config';
import { web3auth } from '../lib/web3auth';

/**
 * Execution Engine (HAND)
 * Handles real blockchain trade execution via TradingVault contract
 */
export async function executeTrade(
  signal: TradeSignal,
  currentPosition: Position | null,
  callbacks: {
    onOpen: (type: 'LONG' | 'SHORT', size: number, transactionHash?: string) => Promise<void>;
    onClose: (transactionHash?: string) => Promise<void>;
    userAddress: string;
    modeType: 'demo' | 'real';
    pair: string;
  }
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  const { action, lotSize } = signal;

  // Validate inputs
  if (!isValidAddress(callbacks.userAddress)) {
    return { success: false, error: 'Invalid user address' };
  }

  if (!validateTradeAmount(lotSize.toString())) {
    return { success: false, error: 'Invalid trade amount' };
  }

  // For demo mode, just simulate with callbacks
  if (callbacks.modeType === 'demo') {
    if (action === "BUY" && !currentPosition) {
      await callbacks.onOpen("LONG", lotSize);
      return { success: true };
    }

    if (action === "SELL" && !currentPosition) {
      await callbacks.onOpen("SHORT", lotSize);
      return { success: true };
    }

    if (action === "REVERSE" && currentPosition) {
      await callbacks.onClose();
      const oppositeType = currentPosition.type === "LONG" ? "SHORT" : "LONG";
      await callbacks.onOpen(oppositeType, lotSize);
      return { success: true };
    }

    if (action === "CLOSE" && currentPosition) {
      await callbacks.onClose();
      return { success: true };
    }

    return { success: false, error: 'Invalid trade action' };
  }

  // REAL MODE: Execute on blockchain
  try {
    // Get signer from window.ethereum or web3auth
    let provider;
    if ((window as any).ethereum) {
      provider = new ethers.BrowserProvider((window as any).ethereum);
    } else if (web3auth.provider) {
      provider = new ethers.BrowserProvider(web3auth.provider);
    } else {
      return { success: false, error: 'No wallet provider available' };
    }
    const signer = await provider.getSigner();

    // Determine token based on pair (assuming USDT/USDC pairs)
    const token = callbacks.pair.includes('/USDT') ? 'USDT' : 'USDC';
    const amountIn = lotSize.toString(); // Convert to string for ethers parsing

    // Calculate minAmountOut with slippage (1% slippage tolerance)
    // In production, we should fetch price from oracle or DEX router
    const minAmountOut = '0'; // TODO: Calculate proper slippage protection

    if (action === "BUY" && !currentPosition) {
      const receipt = await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);
      await callbacks.onOpen("LONG", lotSize, receipt.hash);
      return { success: true, transactionHash: receipt.hash };
    }

    if (action === "SELL" && !currentPosition) {
      const receipt = await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut);
      await callbacks.onOpen("SHORT", lotSize, receipt.hash);
      return { success: true, transactionHash: receipt.hash };
    }

    if (action === "CLOSE" && currentPosition) {
      // For closing, we need to execute opposite trade
      // In a real implementation, we'd track position token amounts
      const receipt = currentPosition.type === 'LONG'
        ? await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut)
        : await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);

      await callbacks.onClose(receipt.hash);
      return { success: true, transactionHash: receipt.hash };
    }

    if (action === "REVERSE" && currentPosition) {
      // Close current position
      const closeReceipt = currentPosition.type === 'LONG'
        ? await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut)
        : await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);

      await callbacks.onClose(closeReceipt.hash);

      // Open opposite position
      const oppositeType = currentPosition.type === "LONG" ? "SHORT" : "LONG";
      const openReceipt = oppositeType === 'SHORT'
        ? await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut)
        : await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);

      await callbacks.onOpen(oppositeType, lotSize, openReceipt.hash);
      return { success: true, transactionHash: openReceipt.hash };
    }

    return { success: false, error: 'Invalid trade action or state' };
  } catch (error: any) {
    console.error('Trade execution failed:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Get estimated slippage for a trade
 */
export async function getSlippageEstimate(
  pair: string,
  amountIn: string,
  isBuy: boolean
): Promise<{ expectedOut: string; minOutWithSlippage: string; slippagePercent: number }> {
  try {
    // TODO: Implement using PancakeSwap router getAmountsOut
    // For now, return default values
    return {
      expectedOut: amountIn,
      minOutWithSlippage: (parseFloat(amountIn) * 0.99).toString(), // 1% slippage
      slippagePercent: 1.0
    };
  } catch (error) {
    console.error('Slippage estimation failed:', error);
    return {
      expectedOut: amountIn,
      minOutWithSlippage: (parseFloat(amountIn) * 0.95).toString(), // 5% max slippage
      slippagePercent: 5.0
    };
  }
}
