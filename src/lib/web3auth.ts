import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { APP_CONFIG } from "../config";

const clientId = APP_CONFIG.WEB3AUTH_CLIENT_ID;

// Helper to get a safe origin for URL construction
const getSafeOrigin = () => {
  try {
    const origin = window.location.origin;
    if (origin && origin !== 'null') return origin;
    return window.location.protocol + '//' + window.location.host;
  } catch (e) {
    return 'http://localhost:3000'; // Fallback
  }
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
    try {
      if (config[field]) new URL(config[field]);
    } catch (e) {
      console.warn(`Invalid URL in chainConfig.${field}: ${config[field]}`);
      // If it's a relative URL or malformed, try to fix it or set a default
      if (config[field] && !config[field].startsWith('http')) {
        config[field] = getSafeOrigin() + (config[field].startsWith('/') ? '' : '/') + config[field];
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
  web3AuthNetwork: (import.meta.env.VITE_WEB3AUTH_NETWORK as any) || WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
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

    const network = (import.meta.env.VITE_WEB3AUTH_NETWORK as any) || WEB3AUTH_NETWORK.SAPPHIRE_MAINNET;
    // Log a masked version of the client ID and network for debugging
    console.log(`Initializing Web3Auth on ${network} with Client ID: ${clientId.slice(0, 5)}...${clientId.slice(-5)}`);

    // For v9+, initModal is the correct method
    // Add a timeout to prevent hanging on invalid client IDs or network issues
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Web3Auth init timeout")), 15000)
    );
    
    // Check if initModal exists, if not try init
    const initMethod = (web3auth as any).initModal || (web3auth as any).init;
    if (!initMethod) {
      throw new Error("Web3Auth init method not found");
    }
    
    await Promise.race([
      initMethod.call(web3auth),
      timeoutPromise
    ]);
    console.log("Web3Auth initialized successfully");
  } catch (error: any) {
    console.error("Error initializing Web3Auth:", error);
    if (error?.message?.includes("failed to fetch project configurations")) {
      console.warn("Web3Auth failed to fetch configurations. This usually means the Client ID is invalid or the domain is not allowlisted in the Web3Auth dashboard.");
      console.warn(`Current domain: ${window.location.origin}`);
    }
    throw error; // Re-throw to be caught by the UI
  }
};
