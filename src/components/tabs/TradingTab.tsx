import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Play, Square, RefreshCcw, TrendingUp, TrendingDown, Clock, Activity, History, ChevronDown, AlertCircle, Info, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { User, ModeType, TradingMode, Trade, LiveTradeUpdate } from '../../types';
import { APP_CONFIG } from '../../config';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { ethers } from 'ethers';
import { web3auth } from '../../lib/web3auth';
import { withRetry, getBufferedGasPrice } from '../../lib/web3utils';

// Mock ABI for the trading contract
const TRADING_ABI = [
  "function fund() public payable",
  "function startTrade(string pair, string strategy) public",
  "function stopTrade(string pair) public",
  "function getBalance(address user) public view returns (uint256)",
  "event TradeStarted(address indexed user, string pair, uint256 amount)",
  "event TradeSettled(address indexed user, string pair, uint256 pnl)"
];

interface TradingTabProps {
  user: User | null;
  mode: ModeType;
  setMode: (mode: ModeType) => void;
}

export default function TradingTab({ user, mode, setMode }: TradingTabProps) {
  const [selectedPair, setSelectedPair] = useState(APP_CONFIG.SUPPORTED_PAIRS[0]);
  const [selectedStrategy, setSelectedStrategy] = useState<TradingMode>("Aggressive");
  const [isTrading, setIsTrading] = useState(false);
  const [tradeAmount, setTradeAmount] = useState<number>(100);
  const [liveUpdates, setLiveUpdates] = useState<LiveTradeUpdate[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [demoBalance, setDemoBalance] = useState<number>(0);
  const [floatingPnl, setFloatingPnl] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBlockchainSyncing, setIsBlockchainSyncing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor Network Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Demo Balance
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'demo_wallets', user.uid), (snapshot: any) => {
      if (snapshot.exists()) {
        setDemoBalance(snapshot.data().demoBalance);
      } else {
        setDoc(snapshot.ref, { uid: user.uid, demoBalance: 10000, updatedAt: serverTimestamp() });
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Live Updates
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'trade_live_updates'),
      where('uid', '==', user.uid),
      where('modeType', '==', mode)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updates = snapshot.docs.map(doc => doc.data() as LiveTradeUpdate);
      setLiveUpdates(updates);
      if (updates.length > 0) {
        setIsTrading(true);
        const totalPnl = updates.reduce((acc, curr) => acc + curr.floatingPnl, 0);
        setFloatingPnl(totalPnl);
      } else {
        setIsTrading(false);
        setFloatingPnl(0);
      }
    });
    return () => unsubscribe();
  }, [user, mode]);

  // Fetch Trade History
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'trades'),
      where('uid', '==', user.uid),
      where('modeType', '==', mode),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTradeHistory(snapshot.docs.map(doc => doc.data() as Trade));
    });
    return () => unsubscribe();
  }, [user, mode]);

  // Timer for active trade
  useEffect(() => {
    if (isTrading) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        // Simulate floating PnL for demo mode
        if (mode === 'demo') {
          setFloatingPnl(prev => prev + (Math.random() - 0.48) * 2);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTrading, mode]);

  const startTrading = async () => {
    if (!user) return;
    
    if (!isOnline) {
      alert("You are offline. Please check your internet connection.");
      return;
    }

    if (mode === 'demo' && demoBalance < tradeAmount) {
      alert("Insufficient demo balance!");
      return;
    }

    try {
      setIsBlockchainSyncing(true);

      if (mode === 'real') {
        const provider = new ethers.BrowserProvider(web3auth.provider!);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(APP_CONFIG.CONTRACT_ADDRESS, TRADING_ABI, signer);

        // Execute on-chain transaction with retry logic
        await withRetry(async () => {
          const gasPrice = await getBufferedGasPrice(provider);
          const tx = await contract.startTrade(selectedPair, selectedStrategy, {
            value: ethers.parseEther((tradeAmount / 600).toString()), // Mock conversion for BNB
            gasPrice
          });
          await tx.wait();
        });
      }

      const updateId = `update_${Date.now()}`;
      const newUpdate: LiveTradeUpdate = {
        updateId,
        uid: user.uid,
        pair: selectedPair,
        modeType: mode,
        tradeMode: selectedStrategy,
        amount: tradeAmount,
        floatingPnl: 0,
        status: "Running",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'trade_live_updates', updateId), newUpdate);
      
      if (mode === 'demo') {
        await updateDoc(doc(db, 'demo_wallets', user.uid), {
          demoBalance: demoBalance - tradeAmount,
          updatedAt: serverTimestamp()
        });
      }
      
      setIsTrading(true);
    } catch (error) {
      console.error("Failed to start trade", error);
      alert("Transaction failed or timed out. Please try again.");
    } finally {
      setIsBlockchainSyncing(false);
    }
  };

  const stopTrading = async () => {
    if (!user || liveUpdates.length === 0) return;

    try {
      setIsBlockchainSyncing(true);
      const update = liveUpdates[0];

      if (mode === 'real') {
        const provider = new ethers.BrowserProvider(web3auth.provider!);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(APP_CONFIG.CONTRACT_ADDRESS, TRADING_ABI, signer);

        // Execute on-chain settlement with retry logic
        await withRetry(async () => {
          const gasPrice = await getBufferedGasPrice(provider);
          const tx = await contract.stopTrade(selectedPair, { gasPrice });
          await tx.wait();
        });
      }

      const finalPnl = floatingPnl;
      const tradeId = `trade_${Date.now()}`;
      
      const newTrade: Trade = {
        tradeId,
        uid: user.uid,
        pair: update.pair,
        modeType: mode,
        tradeMode: update.tradeMode,
        amount: update.amount,
        pnl: finalPnl,
        status: "Completed",
        timeTaken: elapsedTime,
        startedAt: update.startedAt,
        endedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'trades', tradeId), newTrade);
      await deleteDoc(doc(db, 'trade_live_updates', update.updateId));

      if (mode === 'demo') {
        await updateDoc(doc(db, 'demo_wallets', user.uid), {
          demoBalance: demoBalance + update.amount + finalPnl,
          updatedAt: serverTimestamp()
        });
      }

      setIsTrading(false);
      setFloatingPnl(0);
    } catch (error) {
      console.error("Failed to stop trade", error);
      alert("Settlement failed. Your funds are safe on-chain, please try again.");
    } finally {
      setIsBlockchainSyncing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Mode Switcher & Balance */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2 p-1 bg-black rounded-2xl border border-white/5">
          <button 
            onClick={() => !isTrading && setMode('demo')}
            disabled={isTrading}
            className={cn(
              "px-6 py-3 rounded-xl font-bold text-sm transition-all uppercase tracking-widest",
              mode === 'demo' ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]" : "text-white/40 hover:text-white",
              isTrading && "opacity-50 cursor-not-allowed"
            )}
          >
            Demo Trade
          </button>
          <button 
            onClick={() => !isTrading && setMode('real')}
            disabled={isTrading}
            className={cn(
              "px-6 py-3 rounded-xl font-bold text-sm transition-all uppercase tracking-widest",
              mode === 'real' ? "bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]" : "text-white/40 hover:text-white",
              isTrading && "opacity-50 cursor-not-allowed"
            )}
          >
            Real Trade
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5">
            {isOnline ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              isOnline ? "text-green-500" : "text-red-500"
            )}>
              {isOnline ? 'Network Stable' : 'Network Offline'}
            </span>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Available Balance</p>
            <h3 className="text-3xl font-black tracking-tight">
              {mode === 'demo' ? `$${demoBalance.toLocaleString()}` : `$2,542.12`}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trading Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 space-y-6">
            <h3 className="font-bold text-xl uppercase tracking-tighter flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" /> Trading Setup
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Asset Pair</label>
                <select 
                  value={selectedPair}
                  onChange={(e) => setSelectedPair(e.target.value)}
                  disabled={isTrading}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm font-bold focus:outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer"
                >
                  {APP_CONFIG.SUPPORTED_PAIRS.map(pair => (
                    <option key={pair} value={pair}>{pair}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Strategy</label>
                <div className="grid grid-cols-2 gap-2">
                  {APP_CONFIG.TRADING_MODES.map(strat => (
                    <button
                      key={strat}
                      onClick={() => setSelectedStrategy(strat as TradingMode)}
                      disabled={isTrading}
                      className={cn(
                        "p-3 rounded-xl text-xs font-bold border transition-all",
                        selectedStrategy === strat 
                          ? "bg-orange-600/10 border-orange-600 text-orange-500" 
                          : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                      )}
                    >
                      {strat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Amount (USDT)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(Number(e.target.value))}
                    disabled={isTrading}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm font-bold focus:outline-none focus:border-orange-500 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                    {[100, 500, 1000].map(val => (
                      <button 
                        key={val}
                        onClick={() => setTradeAmount(val)}
                        disabled={isTrading}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold transition-all"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={isTrading ? stopTrading : startTrading}
              disabled={isBlockchainSyncing || !isOnline}
              className={cn(
                "w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg",
                isTrading 
                  ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" 
                  : "bg-orange-600 hover:bg-orange-700 shadow-orange-600/20",
                (isBlockchainSyncing || !isOnline) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isBlockchainSyncing ? (
                <>
                  <RefreshCcw className="w-6 h-6 animate-spin" /> SYNCING...
                </>
              ) : isTrading ? (
                <>
                  <Square className="w-6 h-6 fill-white" /> STOP ENGINE
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-white" /> START ENGINE
                </>
              )}
            </button>

            {mode === 'demo' && (
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-500/70 leading-relaxed">
                  You are currently in <strong>DEMO MODE</strong>. All trades are simulated and do not affect real assets. You can reset your demo balance in Settings.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Live Status & Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Trade Panel */}
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 relative overflow-hidden">
            {isTrading && (
              <div className={cn(
                "absolute top-0 left-0 w-full h-1 animate-pulse",
                mode === 'real' ? "bg-orange-600" : "bg-blue-600"
              )} />
            )}
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  isTrading 
                    ? mode === 'real' ? "bg-orange-600 animate-pulse" : "bg-blue-600 animate-pulse"
                    : "bg-white/5"
                )}>
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl uppercase tracking-tighter">Live Status</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest">{isTrading ? 'Engine Active' : 'Engine Idle'}</p>
                </div>
              </div>
              
              {isTrading && (
                <div className="text-right">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Elapsed Time</p>
                  <div className={cn(
                    "flex items-center gap-2 font-mono text-xl font-bold",
                    mode === 'real' ? "text-orange-500" : "text-blue-500"
                  )}>
                    <Clock className="w-4 h-4" />
                    {formatTime(elapsedTime)}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Current Pair</p>
                <p className="text-2xl font-black">{isTrading ? selectedPair : '---'}</p>
              </div>
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Active Amount</p>
                <p className="text-2xl font-black">{isTrading ? `$${tradeAmount}` : '---'}</p>
              </div>
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Floating PnL</p>
                <p className={cn(
                  "text-2xl font-black",
                  floatingPnl > 0 ? "text-green-500" : floatingPnl < 0 ? "text-red-500" : "text-white"
                )}>
                  {isTrading ? `${floatingPnl > 0 ? '+' : ''}${floatingPnl.toFixed(2)} USDT` : '---'}
                </p>
              </div>
            </div>

            {isTrading && (
              <div className={cn(
                "mt-8 p-6 rounded-3xl border",
                mode === 'real' ? "bg-orange-600/5 border-orange-600/20" : "bg-blue-600/5 border-blue-600/20"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-widest",
                    mode === 'real' ? "text-orange-500" : "text-blue-500"
                  )}>Execution Feed</span>
                  <span className={cn(
                    "flex items-center gap-1 text-[10px] uppercase font-mono",
                    mode === 'real' ? "text-orange-500/60" : "text-blue-500/60"
                  )}>
                    <RefreshCcw className="w-3 h-3 animate-spin" /> Live Updates
                  </span>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono text-white/40">
                      <span className="flex items-center gap-2">
                        <div className={cn(
                          "w-1 h-1 rounded-full",
                          mode === 'real' ? "bg-orange-500" : "bg-blue-500"
                        )} />
                        Bot scanning {selectedPair} orderbook...
                      </span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trade History */}
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-xl uppercase tracking-tighter flex items-center gap-2">
                <History className="w-5 h-5 text-white/40" /> Recent Trades
              </h3>
              <button className="text-orange-500 text-xs font-bold hover:underline uppercase tracking-widest">View All</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
                    <th className="pb-4 font-black">Pair</th>
                    <th className="pb-4 font-black">Mode</th>
                    <th className="pb-4 font-black">Amount</th>
                    <th className="pb-4 font-black">Result</th>
                    <th className="pb-4 font-black">Time</th>
                    <th className="pb-4 font-black text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {tradeHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-white/20 font-medium italic">
                        No trade history found.
                      </td>
                    </tr>
                  ) : (
                    tradeHistory.map((trade) => (
                      <tr key={trade.tradeId} className="border-b border-white/5 group hover:bg-white/[0.02] transition-all">
                        <td className="py-4 font-bold">{trade.pair}</td>
                        <td className="py-4">
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 text-white/60 uppercase">
                            {trade.tradeMode}
                          </span>
                        </td>
                        <td className="py-4 font-mono text-xs">${trade.amount}</td>
                        <td className={cn(
                          "py-4 font-bold",
                          trade.pnl > 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                        </td>
                        <td className="py-4 text-white/40 text-xs">{formatTime(trade.timeTaken)}</td>
                        <td className="py-4 text-right">
                          <span className="text-[10px] font-black text-green-500 uppercase tracking-widest px-2 py-1 bg-green-500/10 rounded-full">
                            {trade.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
