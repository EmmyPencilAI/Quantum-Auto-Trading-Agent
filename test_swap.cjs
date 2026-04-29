const { ethers } = require('ethers');

// RPC from env or public
const rpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Testnet Router: 0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3
const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
];
const routerAddress = '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3';

// BSC Testnet Tokens
const WBNB = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';
const USDT = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd';

async function test() {
  try {
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, provider);
    
    // Amount in: 0.032 BNB
    const amountInWei = ethers.parseEther('0.032');
    const path = [WBNB, USDT];
    
    console.log('Fetching amounts out from PancakeSwap...');
    const amountsOut = await router.getAmountsOut(amountInWei, path);
    console.log('Amounts out:', amountsOut.map(a => ethers.formatEther(a)));
    
  } catch (error) {
    console.error('Error fetching amounts out:', error.message || error);
  }
}

test();
