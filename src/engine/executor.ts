import { TradeSignal, Position } from './types';
import { ethers } from 'ethers';
import { executeBuyTrade, executeSellTrade, validateTradeAmount, isValidAddress, getUserProfit } from '../lib/contract';
import { APP_CONFIG } from '../config';
import { web3auth } from '../lib/web3auth';
import { ROUTER_ABI, TOKEN_MAP } from '../lib/dex';
import { getDirectSigner } from '../lib/blockchain';

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

  if (!isValidAddress(callbacks.userAddress)) return { success: false, error: 'Invalid user address' };
  if (!validateTradeAmount(lotSize.toString())) return { success: false, error: 'Invalid trade amount' };

  if (callbacks.modeType === 'demo') {
    // Demo mode bypass
    if (action === "BUY" && !currentPosition) { await callbacks.onOpen("LONG", lotSize); return { success: true }; }
    if (action === "SELL" && !currentPosition) { await callbacks.onOpen("SHORT", lotSize); return { success: true }; }
    if (action === "CLOSE" && currentPosition) { await callbacks.onClose(); return { success: true }; }
    if (action === "REVERSE" && currentPosition) {
      await callbacks.onClose();
      await callbacks.onOpen(currentPosition.type === "LONG" ? "SHORT" : "LONG", lotSize);
      return { success: true };
    }
    return { success: false, error: 'Invalid trade action' };
  }

  // REAL MODE: Execute on blockchain using direct signer (bypasses Web3Auth bundler)
  try {
    if (web3auth.status !== 'connected') {
      return { success: false, error: 'Wallet not connected. Please log in first.' };
    }
    
    // Use direct signer to bypass Web3Auth's paymaster/bundler
    const signer = await getDirectSigner();
    const token = callbacks.pair.includes('/USDT') ? 'USDT' : 'USDC';
    let amountIn = lotSize.toString(); 

    // For CLOSE actions in real mode, we need to determine the actual amount to sell/buy back
    if (action === "CLOSE" && currentPosition) {
      if (currentPosition.type === 'LONG') {
        // Fetch current token profit (USDT/USDC) from contract to sell
        const profitAmount = await getUserProfit(callbacks.userAddress, signer.provider!);
        amountIn = profitAmount;
        if (parseFloat(amountIn) <= 0) {
          console.warn("[EXECUTOR] No profit balance found to close LONG position on-chain.");
          // Fallback to initial amount if profit check fails or is 0
          amountIn = lotSize.toString(); 
        }
      } else {
        // For SHORT, we are buying back tokens with BNB.
        // We'll use the initial BNB amount (lotSize) to buy back.
        amountIn = lotSize.toString();
      }
    }

    // Fetch dynamic slippage from chain
    const isBuySwap = action === "BUY" || (action === "CLOSE" && currentPosition?.type === "SHORT");
    const slippageData = await getSlippageEstimate(callbacks.pair, amountIn, isBuySwap, signer.provider!);
    const minAmountOut = slippageData.minOutWithSlippage;

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
      const receipt = currentPosition.type === 'LONG'
        ? await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut)
        : await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);
      await callbacks.onClose(receipt.hash);
      return { success: true, transactionHash: receipt.hash };
    }

    if (action === "REVERSE" && currentPosition) {
      const closeReceipt = currentPosition.type === 'LONG'
        ? await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut)
        : await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);
      await callbacks.onClose(closeReceipt.hash);

      const oppositeType = currentPosition.type === "LONG" ? "SHORT" : "LONG";
      const openReceipt = oppositeType === 'SHORT'
        ? await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut)
        : await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);
      await callbacks.onOpen(oppositeType, lotSize, openReceipt.hash);
      return { success: true, transactionHash: openReceipt.hash };
    }

    return { success: false, error: 'Invalid trade action' };
  } catch (error: any) {
    console.error('Trade execution failed:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function getSlippageEstimate(
  pair: string,
  amountIn: string,
  isBuy: boolean,
  provider: ethers.Provider
): Promise<{ expectedOut: string; minOutWithSlippage: string; slippagePercent: number }> {
  try {
    const chainId = APP_CONFIG.BNB_CHAIN.CHAIN_ID;
    const routerAddress = chainId === '0x38' ? '0x10ED43C718714eb63d5aA57B78B54704E256024E' : '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3';
    const tokens = TOKEN_MAP[chainId] || TOKEN_MAP['0x38'];
    
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, provider);
    const tokenAddr = pair.includes('/USDT') ? tokens.USDT : tokens.USDC;
    
    const path = isBuy ? [tokens.WBNB, tokenAddr] : [tokenAddr, tokens.WBNB];
    const amountInWei = ethers.parseEther(amountIn);

    const amountsOut = await router.getAmountsOut(amountInWei, path);
    const expectedOutWei = amountsOut[1];
    
    // 1% slippage calculation
    const minOutWei = (expectedOutWei * 99n) / 100n;

    return {
      expectedOut: ethers.formatEther(expectedOutWei),
      minOutWithSlippage: ethers.formatEther(minOutWei),
      slippagePercent: 1.0
    };
  } catch (error) {
    console.error('Slippage calculation failed, returning strict defaults:', error);
    return {
      expectedOut: amountIn,
      minOutWithSlippage: (parseFloat(amountIn) * 0.95).toString(),
      slippagePercent: 5.0
    };
  }
}