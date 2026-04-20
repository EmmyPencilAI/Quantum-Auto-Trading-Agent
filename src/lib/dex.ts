import { ethers } from 'ethers';
import { APP_CONFIG } from '../config';

// PancakeSwap V2 Router Addresses
const ROUTERS: Record<string, string> = {
  '0x38': '0x10ED43C718714eb63d5aA57B78B54704E256024E', // Mainnet
  '0x61': '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3', // Testnet
};

// Token Addresses (Dynamic based on Chain ID)
export const TOKEN_MAP: Record<string, Record<string, string>> = {
  // Mainnet
  '0x38': {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    BTC: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    SOL: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF',
    XRP: '0x1D2F0DA4364115C9c7352D45b3E2138f126BCEE1',
    SUI: '0x18Bbf2202611e967A6679D6D3A13661139E99039'
  },
  // Testnet
  '0x61': {
    WBNB: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    USDC: '0x64544969ed7EB0Cc09976691157399e1adC1a3cC',
    ETH: '0xd66c6B4F0be8ce5b39D52E0Fd1344c389929B378',
    BTC: '0x6ce8dA28E2f864420840cF74474eFf5fD2221BE0',
    SOL: '0x18Bbf2202611e967A6679D6D3A13661139E99039', // Placeholder/Common on Testnet
    XRP: '0x1D2F0DA4364115C9c7352D45b3E2138f126BCEE1', // Placeholder
    SUI: '0x18Bbf2202611e967A6679D6D3A13661139E99039'  // Placeholder
  }
};

export const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
];

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

export async function executeRealSwap(
  provider: ethers.BrowserProvider,
  fromSymbol: string,
  toSymbol: string,
  amount: string,
  userAddress: string
) {
  console.log(`[DEX] Executing swap: ${fromSymbol} -> ${toSymbol} (${amount})`);
  const chainId = APP_CONFIG.BNB_CHAIN.CHAIN_ID;
  const routerAddress = ROUTERS[chainId] || ROUTERS['0x38'];
  const tokens = TOKEN_MAP[chainId] || TOKEN_MAP['0x38'];
  
  console.log(`[DEX] Network: ${chainId === '0x38' ? 'Mainnet' : 'Testnet'}`);
  console.log(`[DEX] Router: ${routerAddress}`);

  const signer = await provider.getSigner();
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; 
  
  const fromAddress = fromSymbol === 'BNB' ? tokens.WBNB : tokens[fromSymbol];
  const toAddress = toSymbol === 'BNB' ? tokens.WBNB : tokens[toSymbol];
  
  if (!fromAddress || !toAddress) {
    throw new Error(`Token mapping missing for ${fromSymbol} -> ${toSymbol} on network ${chainId}`);
  }

  const path = [fromAddress, toAddress];
  const amountIn = ethers.parseUnits(amount, 18); // Default to 18 for BSC tokens
  
  try {
    if (fromSymbol === 'BNB') {
      console.log(`[DEX] Swapping BNB...`);
      return await router.swapExactETHForTokens(
        0,
        path,
        userAddress,
        deadline,
        { value: amountIn }
      );
    } else {
      console.log(`[DEX] Swapping Token ${fromSymbol}...`);
      const tokenContract = new ethers.Contract(fromAddress, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(userAddress, routerAddress);
      
      if (allowance < amountIn) {
        console.log(`[DEX] Approving token...`);
        const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      if (toSymbol === 'BNB') {
        return await router.swapExactTokensForETH(
          amountIn,
          0,
          path,
          userAddress,
          deadline
        );
      } else {
        return await router.swapExactTokensForTokens(
          amountIn,
          0,
          path,
          userAddress,
          deadline
        );
      }
    }
  } catch (err: any) {
    console.error(`[DEX] Swap error:`, err);
    if (err.code === 'ACTION_REJECTED') throw new Error("Transaction rejected by user.");
    if (err.message?.includes("INSUFFICIENT_OUTPUT_AMOUNT")) throw new Error("Price slippage too high. Try a smaller amount.");
    if (err.message?.includes("transfer amount exceeds balance")) throw new Error("Insufficient balance in your wallet.");
    throw err;
  }
}
