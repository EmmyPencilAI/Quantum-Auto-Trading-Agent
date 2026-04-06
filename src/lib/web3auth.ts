import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { APP_CONFIG } from "../config";

const clientId = APP_CONFIG.WEB3AUTH_CLIENT_ID;

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: APP_CONFIG.BNB_CHAIN.CHAIN_ID,
  rpcTarget: APP_CONFIG.BNB_CHAIN.RPC_URL,
  displayName: APP_CONFIG.BNB_CHAIN.DISPLAY_NAME,
  blockExplorerUrl: APP_CONFIG.BNB_CHAIN.BLOCK_EXPLORER,
  ticker: APP_CONFIG.BNB_CHAIN.TICKER,
  tickerName: APP_CONFIG.BNB_CHAIN.TICKER_NAME,
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
}) as any;

export const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  privateKeyProvider,
  sessionTime: 86400,
  uiConfig: {
    appName: APP_CONFIG.NAME,
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
  try {
    // Check if clientId is a placeholder
    if (clientId.includes("p763p763p763p763p")) {
      console.warn("Web3Auth Client ID is a placeholder. Please configure VITE_WEB3AUTH_CLIENT_ID in the Secrets panel.");
      return;
    }

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
  } catch (error: any) {
    console.error("Error initializing Web3Auth:", error);
    if (error?.message?.includes("failed to fetch project configurations")) {
      console.warn("Web3Auth failed to fetch configurations. This usually means the Client ID is invalid or the domain is not allowlisted.");
    }
  }
};
