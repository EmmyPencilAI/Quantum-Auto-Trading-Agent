import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { APP_CONFIG } from "../config";

const clientId = APP_CONFIG.WEB3AUTH_CLIENT_ID;

// Helper to get a safe origin for URL construction
const getSafeOrigin = () => {
  try {
    // Try to get origin from window.location
    // Use a very defensive approach to avoid "Blocked a frame" errors
    const loc = window.location;
    if (loc) {
      try {
        if (loc.origin && loc.origin !== 'null') return loc.origin;
      } catch (e) { /* ignore */ }
      
      try {
        if (loc.protocol && loc.host && loc.protocol !== 'null' && loc.host !== 'null') {
          return `${loc.protocol}//${loc.host}`;
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    // Ignore all location access errors
  }
  
  // Fallback to environment variable or localhost
  return (import.meta.env.VITE_APP_URL as string) || 'http://localhost:3000';
};

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: APP_CONFIG.BNB_CHAIN.CHAIN_ID,
  rpcTarget: APP_CONFIG.BNB_CHAIN.RPC_URL,
  displayName: APP_CONFIG.BNB_CHAIN.DISPLAY_NAME,
  blockExplorerUrl: APP_CONFIG.BNB_CHAIN.BLOCK_EXPLORER,
  ticker: APP_CONFIG.BNB_CHAIN.TICKER,
  tickerName: APP_CONFIG.BNB_CHAIN.TICKER_NAME,
};

// Validate URLs in chainConfig to prevent "Invalid URL" errors
const validateChainConfig = (config: any) => {
  const urlFields = ['rpcTarget', 'blockExplorerUrl'];
  for (const field of urlFields) {
    const value = config[field];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      console.warn(`Empty or missing URL in chainConfig.${field}`);
      continue;
    }
    
    try {
      new URL(value);
    } catch (e) {
      console.warn(`Invalid URL in chainConfig.${field}: ${value}`);
      // If it's a relative URL, try to fix it
      if (value.startsWith('/')) {
        config[field] = getSafeOrigin() + value;
      } else if (!value.startsWith('http')) {
        config[field] = getSafeOrigin() + '/' + value;
      }
    }
  }
};

validateChainConfig(chainConfig);

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
}) as any;

export const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: APP_CONFIG.WEB3AUTH_NETWORK as any,
  privateKeyProvider,
  sessionTime: 86400,
  uiConfig: {
    appName: APP_CONFIG.NAME,
    logoLight: getSafeOrigin() + APP_CONFIG.LOGO,
    logoDark: getSafeOrigin() + APP_CONFIG.LOGO,
    theme: {
      primary: "#f97316", // Orange
    },
    mode: "dark",
    loginMethodsOrder: ["google", "apple", "facebook", "email_passwordless"],
    defaultLanguage: "en",
    uxMode: "popup", // Force popup mode
  },
});

export const initWeb3Auth = async () => {
  if (web3auth.status === "ready") {
    console.log("Web3Auth already initialized");
    return;
  }
  
  try {
    // Check if clientId is a placeholder
    if (clientId.includes("p763p763p763p763p")) {
      throw new Error("Web3Auth Client ID is a placeholder. Please configure VITE_WEB3AUTH_CLIENT_ID in the Secrets panel.");
    }

    if (clientId.length < 20) {
      throw new Error("Web3Auth Client ID seems too short. Please verify your Client ID in the Secrets panel.");
    }

    const network = APP_CONFIG.WEB3AUTH_NETWORK;
    let safeOrigin = "unknown domain";
    try {
      safeOrigin = getSafeOrigin();
    } catch (e) { /* ignore */ }
    
    // Log a masked version of the client ID and network for debugging
    console.log(`Initializing Web3Auth on ${network} with Client ID: ${clientId.slice(0, 5)}...${clientId.slice(-5)}`);
    console.log(`Current safe origin: ${safeOrigin}`);
    console.log(`Chain Config: ${APP_CONFIG.BNB_CHAIN.DISPLAY_NAME} (${APP_CONFIG.BNB_CHAIN.CHAIN_ID})`);
    console.log(`RPC Target: ${APP_CONFIG.BNB_CHAIN.RPC_URL}`);

    // For v9+, initModal is the correct method
    // Add a timeout to prevent hanging on invalid client IDs or network issues
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Web3Auth init timeout (60s exceeded). Status: ${web3auth.status}`)), 60000)
    );
    
    // Monitor status changes
    const statusInterval = setInterval(() => {
      console.log(`Web3Auth initialization in progress... Status: ${web3auth.status}`);
    }, 5000);
    
    // Check if initModal exists, if not try init
    const initMethod = (web3auth as any).initModal || (web3auth as any).init;
    if (!initMethod) {
      clearInterval(statusInterval);
      throw new Error("Web3Auth init method not found");
    }
    
    try {
      await Promise.race([
        initMethod.call(web3auth),
        timeoutPromise
      ]);
      console.log("Web3Auth initialized successfully");
    } finally {
      clearInterval(statusInterval);
    }
  } catch (error: any) {
    console.error("Error initializing Web3Auth:", error);
    
    let safeOrigin = "unknown domain";
    try {
      safeOrigin = getSafeOrigin();
    } catch (e) { /* ignore */ }

    if (error?.message?.includes("failed to fetch project configurations")) {
      console.warn("Web3Auth failed to fetch configurations. This usually means the Client ID is invalid or the domain is not allowlisted in the Web3Auth dashboard.");
      console.warn(`Current domain: ${safeOrigin}`);
      console.warn(`Current network: ${APP_CONFIG.WEB3AUTH_NETWORK}`);
      
      const helpMsg = `WEB3AUTH CONFIG ERROR: 
1. Ensure your Client ID is correct for the "${APP_CONFIG.WEB3AUTH_NETWORK}" network.
2. Ensure "${safeOrigin}" is allowlisted in your Web3Auth Dashboard (https://dashboard.web3auth.io/).
3. If you just created the project, wait 5-10 minutes for the configuration to propagate.`;
      
      throw new Error(helpMsg);
    }
    throw error; // Re-throw to be caught by the UI
  }
};
