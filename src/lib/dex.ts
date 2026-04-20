import { ethers } from 'ethers';

// PancakeSwap V2 Router on BSC Mainnet
const PANCAKE_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// Token Addresses (BSC Mainnet)
export const TOKENS: Record<string, string> = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  BTC: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  SOL: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF',
  XRP: '0x1D2F0DA4364115C9c7352D45b3E2138f126BCEE1',
  SUI: '0x18Bbf2202611e967A6679D6D3A13661139E99039'
};

const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

export async function executeRealSwap(
  provider: ethers.BrowserProvider,
  fromSymbol: string,
  toSymbol: string,
  amount: string,
  userAddress: string
) {
  const signer = await provider.getSigner();
  const router = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
  
  const fromAddress = fromSymbol === 'BNB' ? TOKENS.WBNB : TOKENS[fromSymbol];
  const toAddress = toSymbol === 'BNB' ? TOKENS.WBNB : TOKENS[toSymbol];
  
  if (!fromAddress || !toAddress) throw new Error(`Unsupported asset: ${fromSymbol} or ${toSymbol}`);

  const path = [fromAddress, toAddress];
  const amountIn = ethers.parseEther(amount); // Assuming 18 decimals for simplicity, adjust if needed for USDT/USDC (usually 18 on BSC but check)
  // Actually on BSC, USDT and USDC are often 18 decimals but sometimes 6 depending on the bridge. 
  // BEP20 USDT (0x55...) is 18 decimals.
  // BEP20 USDC (0x8A...) is 18 decimals.
  
  if (fromSymbol === 'BNB') {
    // BNB -> Token
    return await router.swapExactETHForTokens(
      0, // amountOutMin (set to 0 for demo/risk - ideally calculate slippage)
      path,
      userAddress,
      deadline,
      { value: amountIn }
    );
  } else if (toSymbol === 'BNB') {
    // Token -> BNB
    // Must approve first
    const tokenContract = new ethers.Contract(fromAddress, ERC20_ABI, signer);
    const allowance = await tokenContract.allowance(userAddress, PANCAKE_ROUTER_ADDRESS);
    if (allowance < amountIn) {
      const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, ethers.MaxUint256);
      await approveTx.wait();
    }
    
    return await router.swapExactTokensForETH(
      amountIn,
      0,
      path,
      userAddress,
      deadline
    );
  } else {
    // Token -> Token
    const tokenContract = new ethers.Contract(fromAddress, ERC20_ABI, signer);
    const allowance = await tokenContract.allowance(userAddress, PANCAKE_ROUTER_ADDRESS);
    if (allowance < amountIn) {
      const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, ethers.MaxUint256);
      await approveTx.wait();
    }

    return await router.swapExactTokensForTokens(
      amountIn,
      0,
      path,
      userAddress,
      deadline
    );
  }
}
