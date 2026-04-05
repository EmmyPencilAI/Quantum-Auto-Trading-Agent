export const APP_CONFIG = {
  NAME: "Quantum Finance",
  DESCRIPTION: "Automated Web3 Trading Engine Built for Speed, Strategy, and Scale",
  LOGO: "/logo.png",
  LOADING_GIF: "/loading.gif",
  FIREBASE_ID: "quantum-bnb",
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  
  // WEB3AUTH CLIENT ID: Get this from https://dashboard.web3auth.io/
  WEB3AUTH_CLIENT_ID: import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "BPi54f794u763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p", 
  
  BNB_CHAIN: {
    CHAIN_ID: "0x38", // 56
    RPC_URL: import.meta.env.VITE_RPC_URL || "https://bsc-dataseed.binance.org/",
    DISPLAY_NAME: "BNB Smart Chain Mainnet",
    BLOCK_EXPLORER: "https://bscscan.com",
    TICKER: "BNB",
    TICKER_NAME: "Binance Coin",
  },

  // DEPLOYED CONTRACT: Add your smart contract address here
  CONTRACT_ADDRESS: import.meta.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000", 
  
  // TREASURY: Add your treasury wallet address here
  TREASURY_ADDRESS: import.meta.env.VITE_TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000", 
  
  SUPPORTED_ASSETS: ["BNB", "USDT", "USDC"],
  SUPPORTED_PAIRS: [
    "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "SUI/USDT",
    "XRP/USDT", "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "MATIC/USDT"
  ],
  TRADING_MODES: ["Aggressive", "Momentum", "Scalping", "Conservative"],
};

export const AVATARS = Array.from({ length: 100 }, (_, i) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`);
