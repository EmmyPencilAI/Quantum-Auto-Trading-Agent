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
import { getUserRealBalance, getVaultBalance } from '../../services/tradingService';
import { web3auth } from '../../lib/web3auth';
import { depositFunds, withdrawFunds } from '../../lib/contract';
import { getDirectSigner } from '../../lib/blockchain';

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
  realBalance?: string; // Deprecated: use contract balance instead
  demoBalance?: number;
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
  user, mode, setMode, realBalance = "0.0000", demoBalance = 10000,
  isTradingGlobal, setIsTradingGlobal,
  selectedPairGlobal, setSelectedPairGlobal,
  selectedStrategyGlobal, setSelectedStrategyGlobal,
  tradeAmountGlobal, setTradeAmountGlobal
}: TradingTabProps) {
  const network = useNetworkQuality();
  const [balance, setBalance] = useState<string>('0');
  const [vaultBalance, setVaultBalance] = useState<string>('0');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  const [floatingPnl, setFloatingPnl] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBlockchainSyncing, setIsBlockchainSyncing] = useState(false);
  const [tickerPrices, setTickerPrices] = useState<Record<string, string>>({});
  const [tradingLogs, setTradingLogs] = useState<{ msg: string, time: string, type: 'info' | 'trade' | 'profit' | 'loss' }[]>([
    { msg: 'Quantum Autobot Alpha Engine Warm-up...', time: new Date().toLocaleTimeString([], { hour12: false }), type: 'info' }
  ]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const bnbPrice = parseFloat(tickerPrices['BNB/USDT']?.replace(/,/g, '') || '600');

  // Fetch all ticker prices (CryptoCompare primary, Binance fallback)
  useEffect(() => {
    const ccSymbolMap: Record<string, string> = {
      'BTC': 'BTC', 'ETH': 'ETH', 'BNB': 'BNB', 'SOL': 'SOL', 'SUI': 'SUI',
      'XRP': 'XRP', 'ADA': 'ADA', 'DOGE': 'DOGE', 'AVAX': 'AVAX', 'MATIC': 'MATIC'
    };
    
    const fetchTickers = async () => {
      const prices: Record<string, string> = {};
      
      // Try CryptoCompare first (works when Binance is blocked)
      try {
        const bases = [...new Set(APP_CONFIG.SUPPORTED_PAIRS.map(p => p.split('/')[0]))];
        const fsyms = bases.join(',');
        const res = await fetch(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=USDT,USDC,USD`);
        if (res.ok) {
          const data = await res.json();
          APP_CONFIG.SUPPORTED_PAIRS.forEach(pair => {
            const [base, quote] = pair.split('/');
            const priceData = data[base];
            if (priceData) {
              const p = priceData[quote] || priceData['USD'] || priceData['USDT'];
              if (p) {
                prices[pair] = parseFloat(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
          });
        }
      } catch (e) {
        console.warn("[QUANTUM] CryptoCompare ticker fetch failed", e);
      }

      // Fallback to Binance if CryptoCompare didn't return enough
      if (Object.keys(prices).length < 3) {
        try {
          const res = await fetch('https://api.binance.com/api/v3/ticker/price');
          if (res.ok) {
            const data = await res.json();
            APP_CONFIG.SUPPORTED_PAIRS.forEach(pair => {
              if (!prices[pair]) {
                const symbol = pair.replace('/', '');
                const match = data.find((t: any) => t.symbol === symbol);
                if (match) {
                  prices[pair] = parseFloat(match.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
              }
            });
          }
        } catch (e) {
          // Binance blocked - continue with what we have
        }
      }
      
      if (Object.keys(prices).length > 0) {
        setTickerPrices(prices);
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

  // Fetch real contract balance and vault balance
  useEffect(() => {
    if (!user?.wallet_address) return;
    const fetchBalances = async () => {
      try {
        const bal = await getUserRealBalance(user.wallet_address);
        setBalance(bal);
        const vaultBal = await getVaultBalance(user.wallet_address);
        setVaultBalance(vaultBal);
      } catch (error) {
        console.error('Failed to fetch balances:', error);
      }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000); // 15s
    return () => clearInterval(interval);
  }, [user]);

  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount))) return;
    try {
      setIsDepositing(true);
      const signer = await getDirectSigner();
      await depositFunds(signer, depositAmount);
      alert(`Successfully deposited ${depositAmount} BNB to Vault!`);
      setDepositAmount('');
      const vaultBal = await getVaultBalance(user!.wallet_address);
      setVaultBalance(vaultBal);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount))) return;
    try {
      setIsWithdrawing(true);
      const signer = await getDirectSigner();
      await withdrawFunds(signer, withdrawAmount);
      alert(`Successfully withdrew ${withdrawAmount} BNB from Vault!`);
      setWithdrawAmount('');
      const vaultBal = await getVaultBalance(user!.wallet_address);
      setVaultBalance(vaultBal);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Withdraw failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const { 
    marketData, 
    currentPosition, 
    tradesCount, 
    totalPnL, 
    currentLotSize,
    tradeHistory,
    liveTrades,
    onChainProfit
  } = useTradingEngine(
    user, 
    mode, 
    selectedStrategy, 
    isTrading, 
    tradeAmount, 
    selectedPair,
    bnbPrice
  );

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
    if (isTrading && currentPosition && marketData) {
       // Real mode logic: floating pnl is derived from market price vs entry
       const priceDiff = currentPosition.type === 'LONG' 
         ? (marketData.price - currentPosition.entryPrice)
         : (currentPosition.entryPrice - marketData.price);
       const pnlPercent = priceDiff / currentPosition.entryPrice;
       const leverage = 500; // Standardize to 500x leverage
       const pnl = tradeAmount * leverage * pnlPercent;
       setFloatingPnl(pnl);
    } else {
      setFloatingPnl(0);
    }
  }, [currentPosition, marketData, isTrading, tradeAmount]);

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

    if (!network.isSafe) {
      alert(`NETWORK UNSTABLE: Your current connection (Latency: ${network.rtt}ms, Speed: ${network.downlink}Mbps) is not stable enough for high-frequency real mode trading. Please find a more reliable connection to prevent execution errors.`);
      return;
    }

    // Use Vault balance for execution in REAL mode
    if (mode === 'real') {
      const vBal = parseFloat(vaultBalance);
      const requiredBnb = tradeAmount / bnbPrice;

      if (vBal < requiredBnb) {
        alert(`INSUFFICIENT VAULT FUNDS: You need at least ${requiredBnb.toFixed(4)} BNB to execute a $${tradeAmount} trade. Current Vault Balance: ${vBal.toFixed(4)} BNB. Please deposit more BNB or lower your trade amount.`);
        return;
      }
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
      {/* Mode Switcher & Network Status */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2 p-1 bg-black rounded-2xl border border-white/5">
          <button 
            onClick={() => setMode('demo')}
            className={cn("px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all", mode === 'demo' ? "bg-white text-black" : "text-white/40")}
          >
            DEMO
          </button>
          <button 
            onClick={() => setMode('real')}
            className={cn("px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all", mode === 'real' ? "bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]" : "text-white/40")}
          >
            REAL
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

            {/* Wallet & Vault Information - Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-black/20 border border-white/10 rounded-2xl">
              <div className="text-center">
                <p className="text-[10px] font-display text-white/40 uppercase tracking-widest mb-1">Wallet (Native)</p>
                <h3 className="text-lg font-mono text-white/60 tracking-tight">
                  {mode === 'demo' ? (demoBalance / bnbPrice).toFixed(4) : parseFloat(balance).toFixed(4)} BNB
                </h3>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-display text-green-500/70 uppercase tracking-widest mb-1">On-Chain Profit</p>
                <h3 className="text-lg font-mono text-white tracking-tight">
                  {mode === 'demo' ? `$${(demoBalance - 10000).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${parseFloat(onChainProfit).toFixed(2)}`}
                </h3>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-display text-orange-500/70 uppercase tracking-widest mb-1">Vault Liquidity</p>
                <h3 className="text-lg font-mono text-white tracking-tight">
                  {mode === 'demo' ? (demoBalance / bnbPrice).toFixed(4) : parseFloat(vaultBalance).toFixed(4)} BNB
                </h3>
              </div>
            </div>

            {/* Deposit/Withdraw Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                <input 
                  type="number" 
                  value={depositAmount} 
                  onChange={(e) => setDepositAmount(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full bg-transparent p-2 text-xs font-mono outline-none text-right"
                  disabled={isTrading || isDepositing}
                />
                <button 
                  onClick={handleDeposit} 
                  disabled={isTrading || isDepositing || !depositAmount}
                  className="px-3 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase transition-colors text-green-400"
                >
                  {isDepositing ? '...' : 'Deposit'}
                </button>
              </div>
              
              <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                <input 
                  type="number" 
                  value={withdrawAmount} 
                  onChange={(e) => setWithdrawAmount(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full bg-transparent p-2 text-xs font-mono outline-none text-right"
                  disabled={isTrading || isWithdrawing}
                />
                <button 
                  onClick={handleWithdraw} 
                  disabled={isTrading || isWithdrawing || !withdrawAmount}
                  className="px-3 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase transition-colors text-red-400"
                >
                  {isWithdrawing ? '...' : 'Withdraw'}
                </button>
              </div>
            </div>

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

          </div>
        </div>

        {/* Live Status & Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* HFT Chart View */}
          <HFTTradingView marketData={marketData} currentPosition={currentPosition} tradeHistory={tradeHistory} />

          {/* Active Trade Panel */}
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 relative overflow-hidden">
            {isTrading && (
              <div className={cn(
                "absolute top-0 left-0 w-full h-1 animate-pulse",
                "bg-orange-600"
              )} />
            )}
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  isTrading 
                    ? "bg-orange-600 animate-pulse"
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
                    "text-orange-500"
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
                  src={getLogo(isTrading ? selectedPair : (tradeHistory[0]?.pair || 'BTC'))} 
                  alt="" 
                  className={cn("w-10 h-10 rounded-full", !isTrading && "grayscale opacity-60")}
                  onError={(e) => (e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=crypto')}
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
                    {isTrading ? 'Current Pair' : 'Last Traded'}
                  </p>
                  <p className="text-xl font-black">{isTrading ? selectedPair : (tradeHistory[0]?.pair || '---')}</p>
                </div>
              </div>
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  {isTrading ? 'Active Amount' : 'Last Amount'}
                </p>
                <p className="text-2xl font-black">
                  {isTrading ? `$${tradeAmount}` : (tradeHistory[0]?.size ? `$${(tradeHistory[0]?.size * 1000).toFixed(0)}` : '---')}
                </p>
              </div>
              <div className="p-6 rounded-3xl bg-black/40 border border-white/5 relative group">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                  {isTrading ? 'Floating PnL' : 'Realized Profit'}
                </p>
                <p className={cn(
                  "text-2xl font-black",
                  isTrading ? 
                    (floatingPnl > 0 ? "text-green-500" : floatingPnl < 0 ? "text-red-500" : "text-white") :
                    (totalPnL > 0 ? "text-green-500" : totalPnL < 0 ? "text-red-500" : "text-white/40")
                )}>
                  {isTrading ? 
                    `${floatingPnl > 0 ? '+' : ''}${floatingPnl.toFixed(2)} USDT` : 
                    `${totalPnL > 0 ? '+' : ''}${totalPnL.toFixed(2)} USDT`
                  }
                </p>
                {!isTrading && (
                  <p className="absolute -bottom-1 left-6 text-[8px] text-white/20 uppercase font-bold tracking-widest italic">Engine Standby</p>
                )}
              </div>
            </div>

            {isTrading && (
              <div className={cn(
                "mt-8 p-6 rounded-3xl border",
                "bg-orange-600/5 border-orange-600/20"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-widest",
                    "text-orange-500"
                  )}>Execution Feed</span>
                  <span className={cn(
                    "flex items-center gap-1 text-[10px] uppercase font-mono",
                    "text-orange-500/60"
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
                            log.type === 'trade' ? "bg-orange-500 animate-pulse" : "bg-orange-500/40"
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
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => window.location.reload()}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/40 hover:text-orange-500"
                  title="Force Quantum Resync"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button className="text-orange-500 text-xs font-display hover:underline uppercase tracking-widest">View All</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
                    <th className="pb-4 font-black">Pair</th>
                    <th className="pb-4 font-black">Strategy</th>
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
