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
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    // Check for invalid config
    if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('TODO')) {
      setConfigError("Firebase configuration is missing or invalid. Please set up Firebase via the AIS Agent.");
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
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
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as User);
        } else {
          // Create new user if not exists
          const newUser: User = {
            uid: firebaseUser.uid,
            walletAddress: firebaseUser.uid, // Placeholder, Web3Auth will provide real one
            username: firebaseUser.displayName || `User_${firebaseUser.uid.slice(0, 5)}`,
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const web3authProvider = await web3auth.connect();
      if (!web3authProvider) throw new Error("No provider returned");

      const ethersProvider = new ethers.BrowserProvider(web3authProvider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();

      // Get user info from Web3Auth
      const userInfo = await web3auth.getUserInfo();

      // Sign in to Firebase or update user doc
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) {
          const newUser: User = {
            uid: auth.currentUser.uid,
            walletAddress: address,
            username: userInfo.name || auth.currentUser.displayName || `User_${address.slice(0, 6)}`,
            avatar: userInfo.profileImage || auth.currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', auth.currentUser.uid), newUser);
          setUser(newUser);
        } else {
          const existingData = userDoc.data() as User;
          if (existingData.walletAddress !== address) {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { walletAddress: address });
            setUser({ ...existingData, walletAddress: address });
          } else {
            setUser(existingData);
          }
        }
      }
      setIsLoggedIn(true);
    } catch (error) {
      console.error("Login failed", error);
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
        <img src={APP_CONFIG.LOADING_GIF} alt="Loading..." className="w-24 h-24 mb-4" />
        <p className="text-blue-500 font-mono animate-pulse">INITIALIZING QUANTUM ENGINE...</p>
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
    return <LandingPage onLogin={handleLogin} />;
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
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-md border-b border-white/5 z-40 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:block">QUANTUM <span className="text-blue-500">FINANCE</span></span>
        </div>

        <div className="flex items-center gap-4">
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
            mode === 'real' ? "bg-red-500/10 border-red-500/50 text-red-500" : "bg-blue-500/10 border-blue-500/50 text-blue-500"
          )}>
            {mode} MODE
          </div>
          
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors md:hidden"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-white/70">{user?.username}</span>
              <span className="text-[10px] text-white/40 font-mono">{user?.walletAddress.slice(0, 6)}...{user?.walletAddress.slice(-4)}</span>
            </div>
            <img src={user?.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10" />
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
            className="fixed inset-0 bg-black z-30 pt-20 px-4 md:hidden"
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
                    activeTab === tab.id ? "bg-blue-600 text-white" : "bg-white/5 text-white/60"
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
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-black/50 border-r border-white/5 hidden md:flex flex-col p-4 z-20">
        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                activeTab === tab.id 
                  ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]" 
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-white" : "text-white/50 group-hover:text-white")} />
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
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-2 md:hidden z-40">
        {tabs.slice(0, 5).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 transition-all",
              activeTab === tab.id ? "text-blue-500" : "text-white/40"
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
