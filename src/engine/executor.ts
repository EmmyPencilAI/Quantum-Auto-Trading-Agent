import { TradeSignal, Position } from './types';
import { ethers } from 'ethers';
import { executeBuyTrade, executeSellTrade, validateTradeAmount, isValidAddress, getUserProfit, getUserBalance } from '../lib/contract';
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
    tradeAmountUsdt?: number;
    bnbPrice?: number;
  }
): Promise<{ success: boolean; transactionHash?: string; error?: string; fallbackToVirtual?: boolean }> {
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

    const isBuyAction = action === "BUY" || (action === "CLOSE" && currentPosition?.type === "SHORT") || (action === "REVERSE" && currentPosition?.type === "SHORT");
    const isSellAction = action === "SELL" || (action === "CLOSE" && currentPosition?.type === "LONG") || (action === "REVERSE" && currentPosition?.type === "LONG");

    const tradeAmountUsdt = callbacks.tradeAmountUsdt || (lotSize * (callbacks.bnbPrice || 600));
    const bnbPrice = callbacks.bnbPrice || 600;

    let amountIn = isBuyAction ? (tradeAmountUsdt / bnbPrice).toFixed(6) : tradeAmountUsdt.toString();

    if (isBuyAction) {
      // These actions use BNB balance from the vault
      const userBalance = await getUserBalance(callbacks.userAddress, signer.provider!);
      if (parseFloat(userBalance) < parseFloat(amountIn)) {
        console.error(`[EXECUTOR] Insufficient BNB balance: ${userBalance} < ${amountIn}`);
        return { success: false, error: `Insufficient BNB balance in vault (${userBalance} BNB)` };
      }
    }

    if (isSellAction) {
      // These actions use Token profit balance (USDT/USDC) from the vault
      const profitAmount = await getUserProfit(callbacks.userAddress, signer.provider!);
      
      // For CLOSE or REVERSE (LONG->SHORT), we use the entire profit balance
      if (action === "CLOSE" || action === "REVERSE") {
        amountIn = profitAmount;
      }

      // Check if we have sufficient profit balance for the trade
      const requiredAmount = action === "CLOSE" ? 0.000001 : parseFloat(amountIn);
      if (parseFloat(profitAmount) < requiredAmount) {
        console.warn(`[EXECUTOR] Insufficient profit balance: ${profitAmount} < ${requiredAmount} - Falling back to virtual execution`);
        
        // For ultra-fast compounding, we need to handle this gracefully
        // Return a special flag to indicate virtual fallback should be used
        return { 
          success: false, 
          error: `Insufficient profit balance on-chain (${profitAmount} ${token})`,
          fallbackToVirtual: true
        };
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
      // In this vault model, REVERSE is a single swap that flips the state.
      // LONG -> SHORT: executeSellTrade (Swaps all tokens to BNB)
      // SHORT -> LONG: executeBuyTrade (Swaps BNB to tokens)
      const receipt = currentPosition.type === 'LONG'
        ? await executeSellTrade(signer, callbacks.pair, token, amountIn, minAmountOut)
        : await executeBuyTrade(signer, callbacks.pair, token, amountIn, minAmountOut);
      
      await callbacks.onClose(receipt.hash);
      const oppositeType = currentPosition.type === "LONG" ? "SHORT" : "LONG";
      await callbacks.onOpen(oppositeType, parseFloat(amountIn), receipt.hash);
      
      return { success: true, transactionHash: receipt.hash };
    }

    return { success: false, error: 'Invalid trade action' };
  } catch (error: any) {
    console.error('Trade execution failed:', error);
    
    // Automatically fallback to virtual execution if the testnet router reverts
    // due to insufficient liquidity, slippage, or empty pools.
    if (
      error.message?.includes('execution reverted') || 
      error.message?.includes('CALL_EXCEPTION') || 
      error.code === 'CALL_EXCEPTION' || 
      error.message?.includes('INSUFFICIENT_OUTPUT_AMOUNT')
    ) {
      console.warn('[EXECUTOR] On-chain execution reverted (likely testnet liquidity issue). Falling back to virtual execution.');
      return { success: false, error: error.message || 'Transaction reverted', fallbackToVirtual: true };
    }
    
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