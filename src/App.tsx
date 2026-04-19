import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  BarChart3, 
  Zap, 
  Trophy, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  Shield,
  TrendingUp,
  Globe,
  Clock,
  ArrowRight,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { web3auth, initWeb3Auth } from './lib/web3auth';
import { supabase } from './lib/supabase';
import { ethers } from 'ethers';
import { APP_CONFIG } from './config';
import { cn } from './lib/utils';
import { User, ModeType, TradingMode } from './types';

// Components
import LandingPage from './components/LandingPage';
import WalletTab from './components/tabs/WalletTab';
import MarketsTab from './components/tabs/MarketsTab';
import TradingTab from './components/tabs/TradingTab';
import LeaderboardTab from './components/tabs/LeaderboardTab';
import CommunityTab from './components/tabs/CommunityTab';
import SettingsTab from './components/tabs/SettingsTab';

import QuantumAgentOverlay from './components/QuantumAgentOverlay';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('wallet');
  const [mode, setMode] = useState<ModeType>('demo');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("INITIALIZING QUANTUM ENGINE...");
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [realBalance, setRealBalance] = useState<string>("0.0000");

  // Global Trading State persistence
  const [isTradingGlobal, setIsTradingGlobal] = useState<boolean>(false);
  const [selectedPairGlobal, setSelectedPairGlobal] = useState<string>(APP_CONFIG.SUPPORTED_PAIRS[0]);
  const [selectedStrategyGlobal, setSelectedStrategyGlobal] = useState<TradingMode>("Aggressive");
  const [tradeAmountGlobal, setTradeAmountGlobal] = useState<number>(100);

  // Poll for real balance
  useEffect(() => {
    if (!user?.wallet_address || !isLoggedIn) return;

    const fetchBal = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(APP_CONFIG.BNB_CHAIN.RPC_URL);
        const bal = await provider.getBalance(user.wallet_address);
        setRealBalance(ethers.formatEther(bal));
      } catch (e) {
        console.warn("Failed to fetch BNB balance", e);
      }
    };

    fetchBal();
    const interval = setInterval(fetchBal, 15000); // 15s poll
    return () => clearInterval(interval);
  }, [user?.wallet_address, isLoggedIn]);

  useEffect(() => {
    // Apply theme to body
    document.body.className = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const init = async () => {
      if (!supabase) {
        console.error("Supabase client is not initialized. Please check your environment variables.");
        setConfigError("MODIFIER: Supabase configuration is missing or invalid. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the Secrets panel and restart the application.");
        setLoading(false);
        return;
      }
      try {
        setLoadingMessage("CONNECTING TO QUANTUM AUTOBOT...");
        await initWeb3Auth();

        if (web3auth.status === 'connected') {
          handleLogin();
        }
      } catch (error) {
        console.error("Failed to initialize Web3Auth:", error);
      } finally {
        setLoading(false);
      }
    };
    init();

    // With Supabase, we rely more on the Web3Auth connection status and then syncing to Supabase
    // But we can check if we have a "session" or if we can fetch the user by wallet address
  }, []);

  const handleLogin = async () => {
    try {
      console.log("Starting login flow...");
      setLoading(true);
      setLoginError(null);
      
      // Ensure Web3Auth is initialized - wait for it if it's already initializing
      if (web3auth.status === 'not_ready') {
        setLoadingMessage("BOOTING QUANTUM PROTOCOL...");
        await initWeb3Auth();
      }

      // Check status again
      if (web3auth.status === 'not_ready') {
        throw new Error("Web3Auth failed to initialize. Please ensure your Client ID is valid and the domain is allowlisted in the Web3Auth Dashboard.");
      }

      setLoadingMessage("OPENING SECURE TERMINAL...");
      console.log("Calling web3auth.connect()...");
      const web3authProvider = await web3auth.connect();
      
      if (!web3authProvider) {
        console.warn("No provider returned from connect()");
        throw new Error("No provider returned. Did you close the modal?");
      }

      setLoadingMessage("SYNCING WITH BLOCKCHAIN...");
      console.log("Wallet connected, initializing ethers provider...");
      const ethersProvider = new ethers.BrowserProvider(web3authProvider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      
      if (!address) {
        throw new Error("Failed to retrieve wallet address from Web3Auth.");
      }
      
      console.log("Connected address:", address);

      // Get user info from Web3Auth
      const userInfo = await web3auth.getUserInfo();
      console.log("User info retrieved:", userInfo.email || "No email");

        setLoadingMessage("DETECTING GEOLOCATION...");
        let location = null;
        try {
          const geoResponse = await fetch('https://ipapi.co/json/');
          const geoData = await geoResponse.json();
          location = {
            country: geoData.country_name || 'Unknown',
            region: geoData.region || 'Unknown',
            city: geoData.city || 'Unknown',
            ip: geoData.ip || 'Unknown'
          };
        } catch (e) {
          console.warn("Geolocation fetch failed", e);
        }

        setLoadingMessage("AUTHENTICATING WITH QUANTUM...");
        console.log("Authenticating with Supabase...");
        
        // Use verifierId if it's a social login, otherwise use address
        const safeAddress = address || '0x0000000000000000000000000000000000000000';
        // Web3Auth userInfo often has 'email' or 'verifierId' for unique identity
        const uniqueId = (userInfo.verifierId || userInfo.email || safeAddress.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '_');

        console.log("Login user info:", userInfo);

        const { data: userDoc, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('uid', uniqueId)
          .single();

        if (fetchError && fetchError.code === 'PGRST116') {
          setLoadingMessage("CREATING QUANTUM IDENTITY...");
          // User doesn't exist, create new
          const newUser: User = {
            uid: uniqueId,
            wallet_address: safeAddress,
            // PRIORITIZE GMAIL NAME AND PHOTO
            username: userInfo.name || `Quantum_${safeAddress.slice(2, 8)}`,
            avatar: userInfo.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${safeAddress}`,
            created_at: new Date().toISOString(),
            trade_volume: 0,
            followers: [],
            following: [],
            location: location,
            is_verified: true // Mark as verified since Web3Auth handled MFA
          } as any;

          const { error: insertError } = await supabase
            .from('users')
            .upsert(newUser);

          if (insertError) {
            console.error("Insert error:", insertError);
            throw new Error(`Failed to create account: ${insertError.message}`);
          }
          
          // Initialize demo wallet
          setLoadingMessage("PROVISIONING DIGITAL VAULT...");
          await supabase.from('demo_wallets').upsert({
            id: uniqueId,
            demo_balance: 13300,
            updated_at: new Date().toISOString()
          });

          // FORCE LOGOUT as requested for onboarding verification
          setLoadingMessage("VERIFYING SECURITY PARAMETERS...");
          setIsOnboarding(true);
          setTimeout(async () => {
             await web3auth.logout();
             setIsLoggedIn(false);
             setUser(null);
             setIsOnboarding(false);
             setLoginError("Quantum Security Active. Identity verified via Web3Auth MFA. Account secured. Please login again.");
          }, 4000);

          setUser(newUser);
        } else if (userDoc) {
          setLoadingMessage("SYNCING QUANTUM DATA...");
          const updatePayload: any = { 
            wallet_address: address,
            updated_at: new Date().toISOString()
          };
          if (location) updatePayload.location = location;
          
          // SYNC GMAIL INFO IF CURRENT VALUES ARE EMPTY OR DUMMY
          if (!userDoc.username || userDoc.username.startsWith('Quantum_')) {
            if (userInfo.name) updatePayload.username = userInfo.name;
          }
          if (!userDoc.avatar || userDoc.avatar.includes('dicebear')) {
            if (userInfo.profileImage) updatePayload.avatar = userInfo.profileImage;
          }
          
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('uid', uniqueId)
            .select()
            .single();

          if (updateError) {
            console.warn("Update error (non-fatal):", updateError);
            setUser(userDoc as User);
          } else {
            setUser(updatedUser as User);
          }

          // Ensure demo wallet exists
          const { data: walletData } = await supabase
            .from('demo_wallets')
            .select('id')
            .eq('id', uniqueId)
            .single();
          
          if (!walletData) {
            await supabase.from('demo_wallets').upsert({
              id: uniqueId,
              demo_balance: 13300,
              updated_at: new Date().toISOString()
            });
          }
        }
        setIsLoggedIn(true);
    } catch (error: any) {
      console.error("Login failed", error);
      setLoginError(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await web3auth.logout();
      setIsLoggedIn(false);
      setUser(null);
      setActiveTab('wallet');
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center z-50">
        <div className="relative w-24 h-24 mb-8">
          <div className="relative w-full h-full bg-orange-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.5)]">
            <Zap className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
        <div className="text-orange-500 font-mono text-xs tracking-[0.3em] uppercase space-y-2 text-center">
          <p className="animate-pulse">{loadingMessage}</p>
          <p className="text-[8px] text-white/20 font-bold">QUANTUM ENGINE V1.0.8-LIVE (SYNCED)</p>
        </div>
        <div className="mt-8 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-orange-600 w-1/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Configuration Error</h1>
        <p className="text-white/60 max-w-md mb-8 leading-relaxed">{configError}</p>
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center z-[100] p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-12 backdrop-blur-3xl text-center space-y-8"
        >
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(34,197,94,0.3)]">
            <ShieldCheck className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter">Identity Secured</h2>
            <p className="text-white/40 text-sm font-medium leading-relaxed">
              MFA authorization successful. Quantum protocols have been initialized. <br />
              <span className="text-orange-500 block mt-2 font-mono">ENCRYPTING ACCOUNT...</span>
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
            <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">Session Terminating for Safety</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        {loginError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500 text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-red-400"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-bold uppercase tracking-tight">{loginError}</p>
              <button onClick={() => setLoginError(null)} className="ml-auto p-1 hover:bg-white/20 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
        <LandingPage onLogin={handleLogin} />
      </>
    );
  }

  const tabs = [
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'markets', label: 'Markets', icon: BarChart3 },
    { id: 'trading', label: 'Trading', icon: Zap },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-orange-500/30 transition-colors duration-300",
      theme === 'dark' ? "bg-[#050505] text-white" : "bg-white text-black"
    )}>
      {/* Header */}
      <header className={cn(
        "fixed top-0 left-0 right-0 h-16 backdrop-blur-md border-b z-40 flex items-center justify-between px-4 md:px-8 transition-colors",
        theme === 'dark' ? "bg-black/80 border-white/5" : "bg-white/80 border-black/5"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.5)]">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:block uppercase">QUANTUM <span className="text-orange-500">FINANCE</span></span>
        </div>

        <div className="flex items-center gap-4">
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
            mode === 'real' ? "bg-red-500/10 border-red-500/50 text-red-500" : "bg-orange-500/10 border-orange-500/50 text-orange-500"
          )}>
            {mode} MODE
          </div>
          
          <button 
            onClick={toggleTheme}
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-white/5 text-white/60" : "hover:bg-black/5 text-black/60"
            )}
          >
            {theme === 'dark' ? <Globe className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "p-2 rounded-lg transition-colors md:hidden",
              theme === 'dark' ? "hover:bg-white/5 text-white" : "hover:bg-black/5 text-black"
            )}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className={cn("text-xs font-black tracking-tighter uppercase", theme === 'dark' ? "text-orange-500" : "text-orange-600")}>
                {user?.username || 'QUANTUM TRADER'}
              </span>
              <span className={cn("text-[10px] font-mono font-bold", theme === 'dark' ? "text-white/40" : "text-black/40")}>
                {user?.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 'CONNECTING...'}
              </span>
            </div>
            <div className="relative">
              <img src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=fallback`} alt="Avatar" className={cn("w-10 h-10 rounded-full border-2", theme === 'dark' ? "border-orange-500/20" : "border-orange-600/20")} />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#050505] animate-pulse" />
            </div>
          </div>
          {user?.is_trading && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full animate-pulse">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Live Engine</span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed inset-0 z-30 pt-20 px-4 md:hidden",
              theme === 'dark' ? "bg-black" : "bg-white"
            )}
          >
            <div className="grid gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl transition-all",
                    activeTab === tab.id 
                      ? "bg-orange-600 text-white" 
                      : theme === 'dark' ? "bg-white/5 text-white/60" : "bg-black/5 text-black/60"
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-4 p-4 rounded-xl bg-red-500/10 text-red-500 mt-4"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
      <aside className={cn(
        "fixed left-0 top-16 bottom-0 w-64 border-r hidden md:flex flex-col p-4 z-20 transition-colors",
        theme === 'dark' ? "bg-black/50 border-white/5" : "bg-white/50 border-black/5"
      )}>
        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                activeTab === tab.id 
                  ? "bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]" 
                  : theme === 'dark' ? "text-white/50 hover:text-white hover:bg-white/5" : "text-black/50 hover:text-black hover:bg-black/5"
              )}
            >
              <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-white" : theme === 'dark' ? "text-white/50 group-hover:text-white" : "text-black/50 group-hover:text-black")} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all mt-auto"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="pt-16 md:pl-64 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {activeTab === 'wallet' && (
            <WalletTab 
              user={user} 
              mode={mode} 
              realBalance={realBalance} 
            />
          )}
          {activeTab === 'markets' && <MarketsTab />}
          {activeTab === 'trading' && (
            <TradingTab 
              user={user} 
              mode={mode} 
              setMode={setMode} 
              realBalance={realBalance}
              isTradingGlobal={isTradingGlobal}
              setIsTradingGlobal={setIsTradingGlobal}
              selectedPairGlobal={selectedPairGlobal}
              setSelectedPairGlobal={setSelectedPairGlobal}
              selectedStrategyGlobal={selectedStrategyGlobal}
              setSelectedStrategyGlobal={setSelectedStrategyGlobal}
              tradeAmountGlobal={tradeAmountGlobal}
              setTradeAmountGlobal={setTradeAmountGlobal}
            />
          )}
          {activeTab === 'leaderboard' && <LeaderboardTab />}
          {activeTab === 'community' && <CommunityTab user={user} />}
          {activeTab === 'settings' && <SettingsTab user={user} setUser={setUser} mode={mode} onLogout={handleLogout} />}
        </div>
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 h-16 backdrop-blur-md border-t flex items-center justify-around px-2 md:hidden z-40 transition-colors",
        theme === 'dark' ? "bg-black/80 border-white/5" : "bg-white/80 border-black/5"
      )}>
        {tabs.slice(0, 5).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 transition-all",
              activeTab === tab.id ? "text-orange-500" : theme === 'dark' ? "text-white/40" : "text-black/40"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </nav>

      <QuantumAgentOverlay user={user} mode={mode} />
      {/* Footer / Version */}
      <footer className="py-8 px-4 border-t border-white/5 text-center">
        <p className="text-[8px] font-mono text-white/10 uppercase tracking-[0.5em] font-bold">
          Quantum Terminal Protocol v1.1.0-ALPHA (REAL-TIME ENGINE)
        </p>
      </footer>
    </div>
  );
}
