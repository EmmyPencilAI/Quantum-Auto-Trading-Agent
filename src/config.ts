export const APP_CONFIG = {
  NAME: "Quantum Finance",
  DESCRIPTION: "Automated Web3 Trading Engine Built for Speed, Strategy, and Scale",
  LOGO: "/logo.png",
  LOADING_GIF: "/logo.png",
  FIREBASE_ID: "quantum-bnb",
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  
  // WEB3AUTH CONFIG
  WEB3AUTH_CLIENT_ID: (() => {
    const id = (import.meta.env.VITE_WEB3AUTH_CLIENT_ID || import.meta.env.VITE_WEB3AUTH_ID || "").trim();
    const network = (import.meta.env.VITE_WEB3AUTH_NETWORK || "").trim();
    
    // Auto-correct: If network looks like a Client ID and ID is empty or placeholder
    if (network.length > 40 && /^[a-f0-9]+$/i.test(network) && (!id || id.includes("p763p763p763p763p"))) {
      return network;
    }
    
    return id || "BPi54f794u763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p";
  })(),
  
  // WEB3AUTH NETWORK: sapphire_mainnet or sapphire_devnet
  WEB3AUTH_NETWORK: (() => {
    const network = (import.meta.env.VITE_WEB3AUTH_NETWORK || "").trim();
    
    // If network looks like a Client ID, it's likely misconfigured
    if (network.length > 40 && /^[a-f0-9]+$/i.test(network)) {
      return "sapphire_devnet"; // Default to devnet if misconfigured
    }
    
    return network || "sapphire_devnet";
  })(),
  
  BNB_CHAIN: {
    CHAIN_ID: "0x61", // 97
    RPC_URL: import.meta.env.VITE_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
    DISPLAY_NAME: "BNB Smart Chain Testnet",
    BLOCK_EXPLORER: "https://testnet.bscscan.com",
    TICKER: "BNB",
    TICKER_NAME: "Binance Coin",
  },

  // DEPLOYED CONTRACT: Load from environment variables
   CONTRACT_ADDRESS: import.meta.env.VITE_TRADING_VAULT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS,
   
   // TREASURY: Load from environment variables
   TREASURY_ADDRESS: import.meta.env.VITE_TREASURY_ADDRESS, 
  
  SUPPORTED_ASSETS: ["BNB", "USDT", "USDC"],
  SUPPORTED_PAIRS: [
    "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "SUI/USDT",
    "XRP/USDT", "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "MATIC/USDT",
    "BTC/USDC", "ETH/USDC", "BNB/USDC"
  ],
  TRADING_MODES: ["Aggressive", "Momentum", "Scalping", "Conservative"],
};

export const AVATARS = Array.from({ length: 100 }, (_, i) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`);
