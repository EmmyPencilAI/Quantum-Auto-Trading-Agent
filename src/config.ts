export const APP_CONFIG = {
  NAME: "Quantum Finance",
  DESCRIPTION: "Automated Web3 Trading Engine Built for Speed, Strategy, and Scale",
  LOGO: "/logo.png",
  LOADING_GIF: "/loading.gif",
  FIREBASE_ID: "quantum-bnb",
  GOOGLE_CLIENT_ID: "108274715417-uip11cu908662t5v4kqn2v48gvi42a95.apps.googleusercontent.com",
  WEB3AUTH_CLIENT_ID: "BPi54f794u763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p763p", // Placeholder, will be replaced if provided
  BNB_CHAIN: {
    CHAIN_ID: "0x38", // 56
    RPC_URL: "https://bsc-dataseed.binance.org/",
    DISPLAY_NAME: "BNB Smart Chain Mainnet",
    BLOCK_EXPLORER: "https://bscscan.com",
    TICKER: "BNB",
    TICKER_NAME: "Binance Coin",
  },
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000", // Placeholder
  TREASURY_ADDRESS: "0x0000000000000000000000000000000000000000", // Placeholder
  SUPPORTED_ASSETS: ["BNB", "USDT", "USDC"],
  SUPPORTED_PAIRS: [
    "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "SUI/USDT",
    "XRP/USDT", "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "MATIC/USDT"
  ],
  TRADING_MODES: ["Aggressive", "Momentum", "Scalping", "Conservative"],
};

export const AVATARS = Array.from({ length: 100 }, (_, i) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`);
