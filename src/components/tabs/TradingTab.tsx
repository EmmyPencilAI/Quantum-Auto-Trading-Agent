import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Play, Square, RefreshCcw, TrendingUp, TrendingDown, Clock, Activity, History, ChevronDown, AlertCircle, Info, Wifi, WifiOff } from 'lucide-react';
import { cn, getLogo } from '../../lib/utils';
import { User, ModeType, TradingMode, Trade, LiveTradeUpdate } from '../../types';
import { APP_CONFIG } from '../../config';
import { supabase } from '../../lib/supabase';
import { ethers } from 'ethers';
import HFTTradingView from '../HFTTradingView';
import { useTradingEngine } from '../../hooks/useTradingEngine';
import { useNetworkQuality } from '../../hooks/useNetworkQuality';

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
  realBalance?: string;
  isTradingGlobal: boolean;
  setIsTradingGlobal: (val: boolean) => void;
  selectedPairGlobal: string;
  setSelectedPairGlobal: (val: string) => void;
  selectedStrategyGlobal: TradingMode;
  setSelectedStrategyGlobal: (val: TradingMode) => void;
  tradeAmountGlobal: number;
  setTradeAmountGlobal: (val: number) => void;
}

export default function TradingTab({ 
  user, mode, setMode, realBalance = "0.0000",
  isTradingGlobal, setIsTradingGlobal,
  selectedPairGlobal, setSelectedPairGlobal,
  selectedStrategyGlobal, setSelectedStrategyGlobal,
  tradeAmountGlobal, setTradeAmountGlobal
}: TradingTabProps) {
  const network = useNetworkQuality();
  const [demoBalance, setDemoBalance] = useState<number>(0);
  const [floatingPnl, setFloatingPnl] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBlockchainSyncing, setIsBlockchainSyncing] = useState(false);
  const [tickerPrices, setTickerPrices] = useState<Record<string, string>>({});
  const [tradingLogs, setTradingLogs] = useState<{ msg: string, time: string, type: 'info' | 'trade' | 'profit' | 'loss' }[]>([
    { msg: 'Quantum Autobot Alpha Engine Warm-up...', time: new Date().toLocaleTimeString([], { hour12: false }), type: 'info' }
  ]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all ticker prices
  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price');
        const data = await res.json();
        const prices: Record<string, string> = {};
        APP_CONFIG.SUPPORTED_PAIRS.forEach(pair => {
          const symbol = pair.replace('/', '');
          const match = data.find((t: any) => t.symbol === symbol);
          if (match) {
            prices[pair] = parseFloat(match.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
        });
        setTickerPrices(prices);
      } catch (e) {
        console.warn("Ticker fetch failed", e);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 10000); // 10s
    return () => clearInterval(interval);
  }, []);

  // Use alias for simpler internal usage
  const isTrading = isTradingGlobal;
  const setIsTrading = setIsTradingGlobal;
  const selectedPair = selectedPairGlobal;
  const setSelectedPair = setSelectedPairGlobal;
  const selectedStrategy = selectedStrategyGlobal;
  const setSelectedStrategy = setSelectedStrategyGlobal;
  const tradeAmount = tradeAmountGlobal;
  const setTradeAmount = setTradeAmountGlobal;

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

  // Restore persistent trading state
  useEffect(() => {
    if (user?.is_trading) {
      setIsTrading(true);
      if (user.active_strategy) setSelectedStrategy(user.active_strategy);
      if (user.active_trade_amount) setTradeAmount(user.active_trade_amount);
      if (user.active_mode) setMode(user.active_mode);
    }
  }, [user]);

  // Fetch Demo Balance
  useEffect(() => {
    if (!user) return;
    
    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('demo_wallets')
        .select('*')
        .eq('id', user.uid)
        .single();
      
      if (data) {
        setDemoBalance(data.demo_balance);
      } else {
        await supabase.from('demo_wallets').upsert({ id: user.uid, demo_balance: 10000, updated_at: new Date().toISOString() });
      }
    };
    fetchBalance();

    const channel = supabase
      .channel('demo_wallet_trading')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demo_wallets', filter: `id=eq.${user.uid}` }, (payload: any) => {
        if (payload.new) setDemoBalance(payload.new.demo_balance);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const { 
    marketData, 
    currentPosition, 
    tradesCount, 
    totalPnL, 
    currentLotSize,
    tradeHistory,
    liveTrades 
  } = useTradingEngine(user, mode, selectedStrategy, isTrading, tradeAmount, selectedPair);

  const isSettling = !isTrading && liveTrades.length > 0;

  // Timer for active trade
  useEffect(() => {
    if (isTrading) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        
        // Add dynamic logs
        if (Math.random() > 0.7) {
          const timestamp = new Date().toLocaleTimeString([], { hour12: false });
          const logTemplates = [
            `Scanning ${selectedPair} liquidity...`,
            `Order flow: ${marketData?.orderFlow || 'NEUTRAL'}`,
            `Momentum shift detected at ${marketData?.price.toFixed(2) || '0.00'}`,
            `Quantum layer validating trade trajectory...`,
            `Sentiment analysis: BULLISH CONVERGENCE`
          ];
          const msg = logTemplates[Math.floor(Math.random() * logTemplates.length)];
          setTradingLogs(prev => [{ msg, time: timestamp, type: 'info' as const }, ...prev].slice(0, 10));
        }

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
  }, [isTrading, mode, selectedPair, marketData]);

  // Sync floating PnL and trade logs from engine
  useEffect(() => {
    if (isTrading && mode === 'real' && currentPosition) {
       // Real mode logic: floating pnl is derived from market price vs entry
       if (marketData) {
         const pnl = currentPosition.type === 'LONG' 
           ? (marketData.price - currentPosition.entryPrice) * currentPosition.size * 10
           : (currentPosition.entryPrice - marketData.price) * currentPosition.size * 10;
         setFloatingPnl(pnl);
       }
    }
  }, [currentPosition, marketData, isTrading, mode]);

  useEffect(() => {
    if (currentPosition) {
      const timestamp = new Date(currentPosition.startTime).toLocaleTimeString([], { hour12: false });
      const msg = `${currentPosition.type} order executed | Lot: ${currentPosition.size.toFixed(3)} | Amount: $${tradeAmount}`;
      setTradingLogs(prev => {
        if (prev[0]?.msg === msg) return prev;
        return [{ msg, time: timestamp, type: 'trade' as const }, ...prev].slice(0, 10);
      });
    }
  }, [currentPosition, tradeAmount]);

  const startTrading = async () => {
    if (!user) return;
    
    if (!isOnline) {
      alert("You are offline. Please check your internet connection.");
      return;
    }

    if (mode === 'real' && !network.isSafe) {
      alert(`NETWORK UNSTABLE: Your current connection (Latency: ${network.rtt}ms, Speed: ${network.downlink}Mbps) is not stable enough for high-frequency real mode trading. Please find a more reliable connection to prevent execution errors.`);
      return;
    }

    if (mode === 'real') {
      // Use realBalance prop
      const bal = parseFloat(realBalance);
      if (bal <= 0) {
        alert("REAL MODE INACTIVE: Insufficient Live Funds. Please deposit BNB or USDT to activate Quantum Hand.");
        return;
      }
    }

    if (mode === 'demo' && demoBalance < tradeAmount) {
      alert("Insufficient demo balance!");
      return;
    }

    try {
      setIsBlockchainSyncing(true);
      setTradingLogs([]);
      setIsTrading(true);
    } catch (error) {
      console.error("Failed to start trade", error);
      alert("Transaction failed or timed out. Please try again.");
    } finally {
      setIsBlockchainSyncing(false);
    }
  };

  const stopTrading = async () => {
    try {
      setIsBlockchainSyncing(true);
      setIsTrading(false);
      setTradingLogs(prev => [{ msg: "STOP COMMAND ISSUED. QUANTUM ENGINE SETTLING POSITIONS...", time: new Date().toLocaleTimeString(), type: 'info' as const }, ...prev]);
    } catch (error) {
      console.error("Failed to stop trade", error);
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
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 group relative">
              {isOnline ? (
                <Wifi className={cn("w-3 h-3", network.isSafe ? "text-green-500" : "text-yellow-500")} />
              ) : (
                <WifiOff className="w-3 h-3 text-red-500" />
              )}
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                !isOnline ? "text-red-500" : network.isSafe ? "text-green-500" : "text-yellow-500"
              )}>
                {!isOnline ? 'Offline' : network.isSafe ? 'Secure Connection' : 'Unstable Feed'}
              </span>
              
              {/* Network Tooltip */}
              <div className="absolute top-full right-0 mt-2 p-3 bg-black border border-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none min-w-[120px]">
                <p className="text-[8px] font-bold text-white/40 uppercase mb-1">Latency: {network.rtt}ms</p>
                <p className="text-[8px] font-bold text-white/40 uppercase">Speed: {network.downlink}Mbps</p>
              </div>
            </div>
            {isTrading && (
              <p className="text-[8px] font-mono text-white/30 truncate mt-1">Current Lot: {currentLotSize.toFixed(3)}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs font-display text-white/40 uppercase tracking-widest mb-1">Available Balance</p>
            <h3 className="text-3xl font-display tracking-tight">
              {mode === 'demo' ? `$${demoBalance.toLocaleString()}` : `$${(parseFloat(realBalance) * 600).toLocaleString()}`}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Market Ticker */}
        <div className="lg:col-span-3 flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
          {APP_CONFIG.SUPPORTED_PAIRS.map(pair => (
            <div key={pair} className="px-4 py-2 bg-white/[0.03] border border-white/5 rounded-xl flex items-center gap-3 shrink-0 min-w-[140px]">
              <img src={getLogo(pair)} className="w-5 h-5 rounded-full" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">{pair}</span>
                <span className="text-xs font-mono font-bold">${tickerPrices[pair] || '---'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Trading Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 space-y-6">
            <h3 className="font-display text-xl uppercase tracking-tighter flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" /> Trading Setup
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">Asset Pair</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <img 
                      src={getLogo(selectedPair)} 
                      alt="" 
                      className="w-5 h-5 rounded-full object-cover"
                      onError={(e) => (e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=crypto')}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <select 
                    value={selectedPair}
                    onChange={(e) => setSelectedPair(e.target.value)}
                    disabled={isTrading}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 pl-12 text-sm font-bold focus:outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer"
                  >
                    {APP_CONFIG.SUPPORTED_PAIRS.map(pair => (
                      <option key={pair} value={pair}>{pair}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
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
              disabled={isBlockchainSyncing || isSettling || !isOnline}
              className={cn(
                "w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg",
                isTrading 
                  ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" 
                  : isSettling ? "bg-white/10 text-white/40 cursor-wait" : "bg-orange-600 hover:bg-orange-700 shadow-orange-600/20",
                (isBlockchainSyncing || !isOnline) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isBlockchainSyncing || isSettling ? (
                <>
                  <RefreshCcw className="w-6 h-6 animate-spin" /> {isSettling ? 'PROTOCOL SETTLING...' : 'SYNCING...'}
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
          {/* HFT Chart View */}
          <HFTTradingView marketData={marketData} currentPosition={currentPosition} />

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
                  <h3 className="font-display text-xl uppercase tracking-tighter">Live Status</h3>
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
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5 flex items-center gap-4">
                <img 
                  src={getLogo(isTrading ? selectedPair : 'BTC')} 
                  alt="" 
                  className={cn("w-10 h-10 rounded-full", !isTrading && "grayscale")}
                  onError={(e) => (e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=crypto')}
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Current Pair</p>
                  <p className="text-xl font-black">{isTrading ? selectedPair : '---'}</p>
                </div>
              </div>
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Active Amount</p>
                <p className="text-2xl font-black">{isTrading ? `$${tradeAmount}` : '---'}</p>
              </div>
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Floating PnL</p>
                <p className={cn(
                  "text-2xl font-black",
                  (floatingPnl + totalPnL) > 0 ? "text-green-500" : (floatingPnl + totalPnL) < 0 ? "text-red-500" : "text-white"
                )}>
                  {isTrading ? `${(floatingPnl + totalPnL) > 0 ? '+' : ''}${(floatingPnl + totalPnL).toFixed(2)} USDT` : '---'}
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
                <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {tradingLogs.length > 0 ? (
                    tradingLogs.map((log, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className={cn(
                          "flex items-center justify-between text-[10px] font-mono p-1 rounded",
                          log.type === 'trade' ? "bg-white/5 border-l-2 border-orange-500" : "text-white/40"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            log.type === 'trade' ? "bg-orange-500 animate-pulse" : mode === 'real' ? "bg-orange-500/40" : "bg-blue-500/40"
                          )} />
                          <span className={cn(log.type === 'trade' && "text-white font-bold")}>{log.msg}</span>
                        </span>
                        <span className="opacity-40">{log.time}</span>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                       <RefreshCcw className="w-5 h-5 text-white/10 animate-spin-slow" />
                       <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Awaiting execution...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Trade History */}
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-display text-xl uppercase tracking-tighter flex items-center gap-2">
                <History className="w-5 h-5 text-white/40" /> Recent Trades
              </h3>
              <button className="text-orange-500 text-xs font-display hover:underline uppercase tracking-widest">View All</button>
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
                      <tr key={trade.id} className="border-b border-white/5 group hover:bg-white/[0.02] transition-all">
                        <td className="py-4 font-bold">{trade.pair || 'BTC/USDT'}</td>
                        <td className="py-4">
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 text-white/60 uppercase">
                            {trade.mode}
                          </span>
                        </td>
                        <td className="py-4 font-mono text-xs">${trade.size * 1000}</td>
                        <td className={cn(
                          "py-4 font-bold",
                          trade.pnl > 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                        </td>
                        <td className="py-4 text-white/40 text-xs">{formatTime(trade.time_taken || 0)}</td>
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
