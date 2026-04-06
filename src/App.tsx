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
  AlertTriangle
} from 'lucide-react';
import { web3auth, initWeb3Auth } from './lib/web3auth';
import { auth, db } from './lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ethers } from 'ethers';
import { APP_CONFIG } from './config';
import { cn } from './lib/utils';
import { User, ModeType } from './types';

// Components
import LandingPage from './components/LandingPage';
import WalletTab from './components/tabs/WalletTab';
import MarketsTab from './components/tabs/MarketsTab';
import TradingTab from './components/tabs/TradingTab';
import LeaderboardTab from './components/tabs/LeaderboardTab';
import CommunityTab from './components/tabs/CommunityTab';
import SettingsTab from './components/tabs/SettingsTab';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('wallet');
  const [mode, setMode] = useState<ModeType>('demo');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("INITIALIZING QUANTUM ENGINE...");
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Apply theme to body
    document.body.className = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // Check for invalid config
    if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('TODO')) {
      setConfigError("Firebase configuration is missing or invalid. Please set up Firebase via the AIS Agent.");
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        setLoadingMessage("CONNECTING TO WEB3AUTH...");
        await initWeb3Auth();
      } catch (error) {
        console.error("Failed to initialize Web3Auth:", error);
      } finally {
        setLoading(false);
      }
    };
    init();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
            setIsLoggedIn(true);
          } else if (web3auth.status === 'connected') {
            // If Web3Auth is connected but no user doc yet, handleLogin will create it
            setIsLoggedIn(true);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        // Only set logged out if Web3Auth is also not connected
        if (web3auth.status !== 'connected') {
          setIsLoggedIn(false);
          setUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setLoginError(null);
      setLoadingMessage("OPENING WALLET MODAL...");
      
      // Ensure Web3Auth is initialized
      if (web3auth.status === 'not_ready') {
        await initWeb3Auth();
      }

      if (web3auth.status === 'not_ready') {
        throw new Error("Web3Auth failed to initialize. Check your Client ID and domain settings.");
      }

      const web3authProvider = await web3auth.connect();
      if (!web3authProvider) throw new Error("No provider returned. Did you close the modal?");

      setLoadingMessage("SYNCING WITH BLOCKCHAIN...");
      const ethersProvider = new ethers.BrowserProvider(web3authProvider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();

      // Get user info from Web3Auth
      const userInfo = await web3auth.getUserInfo();

      setLoadingMessage("AUTHENTICATING WITH QUANTUM...");
      // Sign in to Firebase anonymously if not already signed in
      // This ensures onAuthStateChanged doesn't kick the user out
      let firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        const { signInAnonymously } = await import('firebase/auth');
        const cred = await signInAnonymously(auth);
        firebaseUser = cred.user;
      }

      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists()) {
          const newUser: User = {
            uid: firebaseUser.uid,
            walletAddress: address,
            username: userInfo.name || firebaseUser.displayName || `User_${address.slice(0, 6)}`,
            avatar: userInfo.profileImage || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        } else {
          const existingData = userDoc.data() as User;
          if (existingData.walletAddress !== address) {
            await updateDoc(doc(db, 'users', firebaseUser.uid), { walletAddress: address });
            setUser({ ...existingData, walletAddress: address });
          } else {
            setUser(existingData);
          }
        }
        setIsLoggedIn(true);
      }
    } catch (error: any) {
      console.error("Login failed", error);
      setLoginError(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await web3auth.logout();
    await signOut(auth);
    setIsLoggedIn(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 bg-orange-600/20 blur-xl rounded-full animate-pulse" />
          <div className="relative w-full h-full bg-orange-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.5)]">
            <Zap className="w-12 h-12 text-white fill-white animate-bounce" />
          </div>
        </div>
        <p className="text-orange-500 font-mono text-sm tracking-[0.3em] animate-pulse uppercase">{loadingMessage}</p>
        <div className="mt-8 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-orange-600"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
          />
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
        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs font-mono text-white/40 break-all">
          {JSON.stringify(firebaseConfig)}
        </div>
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

          <div className="hidden md:flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className={cn("text-xs font-medium", theme === 'dark' ? "text-white/70" : "text-black/70")}>{user?.username}</span>
              <span className={cn("text-[10px] font-mono", theme === 'dark' ? "text-white/40" : "text-black/40")}>{user?.walletAddress.slice(0, 6)}...{user?.walletAddress.slice(-4)}</span>
            </div>
            <img src={user?.avatar} alt="Avatar" className={cn("w-8 h-8 rounded-full border", theme === 'dark' ? "border-white/10" : "border-black/10")} />
          </div>
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
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'wallet' && <WalletTab user={user} mode={mode} />}
              {activeTab === 'markets' && <MarketsTab />}
              {activeTab === 'trading' && <TradingTab user={user} mode={mode} setMode={setMode} />}
              {activeTab === 'leaderboard' && <LeaderboardTab />}
              {activeTab === 'community' && <CommunityTab user={user} />}
              {activeTab === 'settings' && <SettingsTab user={user} setUser={setUser} mode={mode} />}
            </motion.div>
          </AnimatePresence>
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
    </div>
  );
}
