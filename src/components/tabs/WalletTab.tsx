import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, Copy, Share2, QrCode, Send, ArrowDownLeft, Plus, History, ExternalLink, CheckCircle2, Zap, ArrowRight, Gauge, RefreshCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn, getLogo } from '../../lib/utils';
import { User, ModeType } from '../../types';
import { APP_CONFIG } from '../../config';
import { supabase } from '../../lib/supabase';
import { getSmartGasPrice } from '../../lib/blockchain';
import { web3auth } from '../../lib/web3auth';
import { executeRealSwap, TOKEN_MAP, ERC20_ABI } from '../../lib/dex';
import { ethers } from 'ethers';
import { getUserRealBalance } from '../../services/tradingService';

interface WalletTabProps {
  user: User | null;
  mode: ModeType;
  realBalance?: string;
}

export default function WalletTab({ user, mode, realBalance = "0.0000" }: WalletTabProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [convertFrom, setConvertFrom] = useState('BNB');
  const [convertTo, setConvertTo] = useState('USDT');
  const [isConverting, setIsConverting] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [sendAsset, setSendAsset] = useState('BNB');
  const [isBlockchainSyncing, setIsBlockchainSyncing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tickerPrices, setTickerPrices] = useState<Record<string, number>>({ 'BNB': 600, 'BTC': 65000, 'SOL': 140, 'ETH': 3500, 'XRP': 0.6, 'ADA': 0.5, 'SUI': 1.5, 'USDC': 1, 'USDT': 1 });
  const [realTokenBalances, setRealTokenBalances] = useState<Record<string, string>>({});
  const [contractBalance, setContractBalance] = useState<string>('0');
  const [demoBalance, setDemoBalance] = useState<number>(10000);

  useEffect(() => {
    const fetchDemoBal = async () => {
      if (user?.uid && mode === 'demo') {
        const { data } = await supabase.from('demo_wallets').select('demo_balance').eq('id', user.uid).single();
        if (data) setDemoBalance(data.demo_balance);
      }
    };
    fetchDemoBal();
  }, [user, mode]);
  useEffect(() => {
    if (!user?.wallet_address) return;

    const fetchRealBalances = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(APP_CONFIG.BNB_CHAIN.RPC_URL);
        const chainId = APP_CONFIG.BNB_CHAIN.CHAIN_ID;
        const tokens = TOKEN_MAP[chainId];

        if (!tokens) return;

        const newBalances: Record<string, string> = {};

        // Use Promise.all for speed
        await Promise.all([
          // Fetch user balance from TradingVault contract
          (async () => {
            try {
              const balance = await getUserRealBalance(user.wallet_address);
              setContractBalance(balance);
            } catch (err) {
              console.warn('Failed to fetch contract balance:', err);
              setContractBalance('0');
            }
          })(),

          // Fetch token balances
          ...Object.entries(tokens).map(async ([symbol, address]) => {
            if (symbol === 'WBNB') return;

            try {
              const abi = [
                ...ERC20_ABI,
                'function decimals() external view returns (uint8)'
              ];
              const contract = new ethers.Contract(address, abi, provider);
              const [balance, dec]: [bigint, number] = await Promise.all([
                contract.balanceOf(user.wallet_address),
                contract.decimals().catch(() => 18)
              ]);
              newBalances[symbol] = ethers.formatUnits(balance, dec);
            } catch (tokenErr) {
              console.warn(`Failed to fetch balance for ${symbol}:`, tokenErr);
            }
          })
        ]);

        setRealTokenBalances(newBalances);
      } catch (err) {
        console.warn("Real balances fetch failed", err);
      }
    };

    fetchRealBalances();
    const interval = setInterval(fetchRealBalances, 15000); // 15s
    return () => clearInterval(interval);
  }, [user?.wallet_address]);


  const handleCopy = () => {
    if (user?.wallet_address) {
      navigator.clipboard.writeText(user.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const balances = [
    {
      symbol: 'BNB',
      name: 'Binance Coin',
      balance: parseFloat(realBalance).toFixed(4),
      value: `$${(parseFloat(realBalance) * (tickerPrices['BNB'] || 600)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: getLogo('BNB')
    },
    {
      symbol: 'USDT',
      name: 'Tether International',
      balance: realTokenBalances['USDT'] || '0.00',
      value: `$${(parseFloat(realTokenBalances['USDT'] || '0') * (tickerPrices['USDT'] || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: getLogo('USDT')
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      balance: realTokenBalances['USDC'] || '0.00',
      value: `$${(parseFloat(realTokenBalances['USDC'] || '0') * (tickerPrices['USDC'] || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: getLogo('USDC')
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: realTokenBalances['ETH'] || '0.0000',
      value: `$${(parseFloat(realTokenBalances['ETH'] || '0') * (tickerPrices['ETH'] || 3500)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: getLogo('ETH')
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      balance: realTokenBalances['SOL'] || '0.00',
      value: `$${(parseFloat(realTokenBalances['SOL'] || '0') * (tickerPrices['SOL'] || 140)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: getLogo('SOL')
    },
    {
      symbol: 'XRP',
      name: 'Ripple',
      balance: realTokenBalances['XRP'] || '0.00',
      value: `$${(parseFloat(realTokenBalances['XRP'] || '0') * (tickerPrices['XRP'] || 0.6)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: getLogo('XRP')
    },
    {
      symbol: 'SUI',
      name: 'Sui Network',
      balance: realTokenBalances['SUI'] || '0.00',
      value: `$${(parseFloat(realTokenBalances['SUI'] || '0') * (tickerPrices['SUI'] || 1.5)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: getLogo('SUI')
    },
  ];

  const providerObj = web3auth.provider || (window as any).ethereum;
  const hasWallet = !!providerObj;

  const handleManualSync = async () => {
    setIsBlockchainSyncing(true);
    try {
      if (web3auth.status !== 'connected') {
        await web3auth.connect();
      }
      // fetchTransactions is local to the effect, I should move it or just ignore and rely on channel
    } catch (e) {
      console.warn("Manual sync failed", e);
    } finally {
      setIsBlockchainSyncing(false);
    }
  };

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const symbols = ['BNBUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'SUIUSDT', 'USDCUSDT'];
        const res = await fetch('https://api.binance.com/api/v3/ticker/price');
        const data = await res.json();
        const prices: Record<string, number> = {};
        symbols.forEach(s => {
          const match = data.find((t: any) => t.symbol === s);
          if (match) {
            const sym = s.replace('USDT', '');
            prices[sym] = parseFloat(match.price);
          }
        });
        setTickerPrices(prev => ({ ...prev, ...prices }));
      } catch (e) {
        console.warn("Wallet price fetch failed", e);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchTransactions = async () => {
      if (!user?.uid) return;
      setIsLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('uid', user.uid)
          .eq('mode_type', 'real')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;

        if (data) {
          const formatted = data.map((t: any) => {
            try {
              const rawType = t.type || 'TRADE';
              const typeLower = rawType.toLowerCase();
              const pnlValue = t.pnl || 0;
              const isPositive = pnlValue >= 0 || typeLower === 'received' || typeLower === 'profit';
              
              let displayType = typeLower;
              if (typeLower === 'buy' || typeLower === 'sell') {
                displayType = pnlValue >= 0 ? 'profit' : 'loss';
              }

              return {
                id: t.id,
                type: displayType,
                amount: `${isPositive ? '+' : '-'}$${Math.abs(pnlValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                time: t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                to: t.pair || '---',
                from: typeLower === 'received' ? 'External Wallet' : 'Quantum Engine'
              };
            } catch (err) {
              console.error("Mapping error for trade:", t, err);
              return null;
            }
          }).filter(Boolean);
          setTransactions(formatted);
        }
      } catch (err: any) {
        console.error("History fetch failed:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchTransactions();

    const channel = supabase
      .channel('wallet_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `uid=eq.${user.uid}` }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mode]);

  const handleConvert = async () => {
    if (!convertAmount || !user) return;
    setIsConverting(true);
    try {
      const amount = parseFloat(convertAmount);
      if (mode === 'demo') {
        const { data: wallet } = await supabase.from('demo_wallets').select('demo_balance').eq('id', user.uid).single();
        const currentBal = wallet?.demo_balance || 0;
        
        // Use ticker prices for value conversion
        const fromPrice = tickerPrices[convertFrom] || 1;
        const toPrice = tickerPrices[convertTo] || 1;
        const valueInUsd = amount * fromPrice;
        
        // Just simulate a successful conversion log
        await supabase.from('trades').insert({
          uid: user.uid,
          type: 'CONVERT',
          pair: `${convertFrom}/${convertTo}`,
          trade_mode: 'Conservative',
          entry_price: fromPrice / toPrice,
          size: amount,
          pnl: 0, 
          mode_type: 'demo',
          status: 'Completed',
          created_at: new Date().toISOString()
        });

        alert(`CONVERSION SUCCESS: ${amount} ${convertFrom} swapped for ${((amount * fromPrice) / toPrice).toFixed(4)} ${convertTo}`);
      } else {
        setIsConverting(true);
        let pObj = web3auth.provider || (window as any).ethereum;
        if (!pObj && web3auth.status === 'ready') {
          try { pObj = await web3auth.connect(); } catch (e) { console.warn("Auto-connect failed", e); }
        }
        
        if (!pObj) {
           alert("No crypto wallet detected. Please log in via Google to use your Quantum Wallet.");
           setIsConverting(false);
           return;
        }

        try {
          const provider = new ethers.BrowserProvider(pObj);
          const tx = await executeRealSwap(
             provider,
             convertFrom,
             convertTo,
             convertAmount,
             user.wallet_address || ""
          );

          // Log real conversion to Supabase so it shows in history
          await supabase.from('trades').insert({
            uid: user.uid,
            type: 'CONVERT',
            pair: `${convertFrom}/${convertTo}`,
            trade_mode: 'Conservative',
            entry_price: (tickerPrices[convertFrom] || 1) / (tickerPrices[convertTo] || 1),
            size: amount,
            pnl: 0,
            mode_type: 'real',
            status: 'Completed',
            created_at: new Date().toISOString()
          });

          alert(`Quantum Swap Dispatched! Transaction Hash: ${tx.hash}`);
          setShowConvert(false);
          setConvertAmount('');
        } catch (swapErr: any) {
          console.error("Swap execution error:", swapErr);
          alert(`Swap Failed: ${swapErr.message || "Unknown error occurred during interaction with the DEX."}`);
        }
      }
      setShowConvert(false);
      setConvertAmount('');
    } catch (e) {
      console.error("Conversion failed", e);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSend = async () => {
    if (!sendAmount || !sendAddress || !user) return;
    
    try {
      const amount = parseFloat(sendAmount);
      
      if (mode === 'real') {
        let pObj = providerObj;
        if (!pObj && web3auth.status === 'ready') {
          pObj = await web3auth.connect();
        }
        
        if (!pObj) {
           alert("No crypto wallet detected. Please ensure you are logged in via Google.");
           return;
        }
        const provider = new ethers.BrowserProvider(pObj);
        const signer = await provider.getSigner();
        
        let tx;
        let amountWei;
        const rpcProvider = new ethers.JsonRpcProvider(APP_CONFIG.BNB_CHAIN.RPC_URL);
        
        if (sendAsset === 'BNB') {
          amountWei = ethers.parseEther(sendAmount);
          const balanceWei = await rpcProvider.getBalance(user.wallet_address);
          
          let sendWei = amountWei;
          if (balanceWei - amountWei < ethers.parseEther("0.001")) {
            sendWei = balanceWei - ethers.parseEther("0.001");
            if (sendWei <= 0n) throw new Error("Insufficient BNB to cover gas fees. Please leave at least 0.001 BNB for network fees.");
          }
          
          tx = await signer.sendTransaction({
            to: sendAddress,
            value: sendWei
          });
        } else {
          const chainId = APP_CONFIG.BNB_CHAIN.CHAIN_ID;
          const tokenAddress = TOKEN_MAP[chainId]?.[sendAsset];
          if (!tokenAddress) throw new Error("Unsupported token on this network.");
          
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
          const decimals = await tokenContract.decimals().catch(() => 18);
          amountWei = ethers.parseUnits(sendAmount, decimals);
          
          const bnbBalance = await rpcProvider.getBalance(user.wallet_address);
          if (bnbBalance < ethers.parseEther("0.0005")) {
             throw new Error("Insufficient BNB for gas fees. You need a small amount of BNB to send tokens.");
          }
          
          tx = await tokenContract.transfer(sendAddress, amountWei);
        }
        
        // Log real transaction to Supabase so it shows in history
        await supabase.from('trades').insert({
          uid: user.uid,
          type: 'SEND',
          pair: 'BNB',
          trade_mode: 'Conservative',
          entry_price: tickerPrices['BNB'] || 600,
          size: amount,
          pnl: -(amount * (tickerPrices['BNB'] || 600)),
          mode_type: 'real',
          status: 'Completed',
          created_at: new Date().toISOString()
        });

        alert(`Real Transaction Dispatching! Tx: ${tx.hash.slice(0,10)}...`);
      } else {
        const { data: wallet } = await supabase.from('demo_wallets').select('demo_balance').eq('id', user.uid).single();
        const currentBal = wallet?.demo_balance || 0;
        const assetPrice = tickerPrices[sendAsset] || 1;
        const totalValue = amount * assetPrice;

        if (totalValue > currentBal) {
          alert("Insufficient DEMO balance.");
          return;
        }

        await supabase.from('demo_wallets').update({
          demo_balance: currentBal - totalValue,
          updated_at: new Date().toISOString()
        }).eq('id', user.uid);

        await supabase.from('trades').insert({
          uid: user.uid,
          type: 'SEND',
          pair: sendAsset,
          trade_mode: 'Conservative',
          entry_price: assetPrice,
          size: amount,
          pnl: -totalValue,
          mode_type: 'demo',
          status: 'Completed',
          created_at: new Date().toISOString()
        });
        
        alert(`Demo Send Successful: ${amount} ${sendAsset}`);
      }
      setShowSend(false);
      setSendAmount('');
      setSendAddress('');
    } catch (e: any) {
      console.error("Transfer failed", e);
      alert("Transfer Error: " + (e.message || "Unknown error"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Header Card */}
      <div className={cn(
        "relative p-8 rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(249,115,22,0.3)] transition-all duration-500",
        mode === 'real' ? "bg-gradient-to-br from-orange-600 to-orange-800" : "bg-gradient-to-br from-blue-600 to-blue-800"
      )}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="font-display text-lg tracking-tight uppercase">MAIN WALLET</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-display uppercase tracking-widest border border-white/20">
              {mode} MODE
            </div>
          </div>

          <div className="mb-8">
            <p className="text-white/60 text-sm font-medium mb-1 uppercase tracking-widest">Total Balance</p>
            <div className="flex items-center gap-3">
              <h2 className="text-4xl md:text-5xl font-display tracking-tighter">
                {mode === 'demo' ? `$${demoBalance.toLocaleString()}` : `$${(parseFloat(realBalance) * (tickerPrices['BNB'] || 600)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              </h2>
              <button 
                onClick={handleManualSync}
                className={cn("p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white/40 hover:text-white", isBlockchainSyncing && "animate-spin text-orange-500")}
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-md rounded-xl border border-white/10 font-mono text-xs">
              {user?.wallet_address ? `${user.wallet_address.slice(0, 8)}...${user.wallet_address.slice(-8)}` : '0x000...000'}
              <button onClick={handleCopy} className="hover:text-orange-300 transition-colors">
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={() => setShowQR(!showQR)} className="p-2 bg-white/20 backdrop-blur-md rounded-xl hover:bg-white/30 transition-all">
              <QrCode className="w-5 h-5" />
            </button>
            <button className="p-2 bg-white/20 backdrop-blur-md rounded-xl hover:bg-white/30 transition-all">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Send Modal */}
      {showSend && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowSend(false)}
        >
          <div className="bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-display text-xl mb-6 uppercase tracking-tight">Send Assets</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">Select Asset</label>
                <select 
                  value={sendAsset}
                  onChange={(e) => setSendAsset(e.target.value)}
                  className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-all font-bold cursor-pointer"
                >
                  {balances.map(b => (
                    <option key={b.symbol} value={b.symbol} className="bg-[#111]">
                      {b.symbol} - {b.name} ({b.balance})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">Recipient Address</label>
                <input 
                  type="text" 
                  value={sendAddress}
                  onChange={(e) => setSendAddress(e.target.value)}
                  placeholder="0x..." 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">Amount</label>
                <input 
                  type="number" 
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 transition-all font-mono"
                />
              </div>

              <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-3 h-3 text-orange-500" />
                    <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Smart Gas Routing</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">FASTEST</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/40">Estimated Fee:</span>
                  <span className="font-mono text-green-500">~ 0.0005 BNB</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="h-full bg-orange-500" 
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowSend(false)}
                className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-bold hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSend}
                className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Fund Trading Modal */}
      {showFund && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowFund(false)}
        >
          <div className="bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Plus className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-white font-display text-xl mb-4 uppercase tracking-tight">Activate Trading Hand</h3>
            <p className="text-white/40 text-sm mb-8">Move funds from your main wallet to the Quantum Autobot engine. Real mode requires at least 0.1 BNB for activation.</p>
            
            <div className="space-y-4 mb-8">
              <button className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-all group">
                <div className="flex items-center gap-3">
                  <img src="https://cryptologos.cc/logos/binance-coin-bnb-logo.png" className="w-8 h-8 rounded-full" />
                  <span className="font-bold">BNB Chain</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">12.45 BNB</p>
                  <p className="text-[8px] opacity-40 uppercase tracking-widest">Available</p>
                </div>
              </button>
            </div>

            <button 
              onClick={() => {
                alert("Funding initiated. Syncing with Quantum Hand...");
                setShowFund(false);
              }}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
            >
              Transfer & Start
            </button>
          </div>
        </motion.div>
      )}

      {/* Convert Modal */}
      {showConvert && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowConvert(false)}
        >
          <div className="bg-[#111] border border-white/10 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-display text-2xl mb-8 uppercase tracking-tighter">Quantum Swap</h3>
            <div className="space-y-6 mb-8">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">From</label>
                <div className="flex items-center gap-4">
                  <select 
                    value={convertFrom}
                    onChange={(e) => setConvertFrom(e.target.value)}
                    className="bg-transparent text-lg font-bold outline-none flex-1"
                  >
                    {balances.map(b => <option key={b.symbol} value={b.symbol}>{b.symbol}</option>)}
                  </select>
                  <input 
                    type="number" 
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-right text-lg font-mono outline-none w-1/2"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                   <p className="text-[10px] text-white/20 font-mono">
                      ≈ ${convertAmount ? (parseFloat(convertAmount) * (tickerPrices[convertFrom] || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
                   </p>
                   <button 
                      onClick={() => setConvertAmount(balances.find(b => b.symbol === convertFrom)?.balance.replace(/,/g, '') || '0')}
                      className="text-[10px] text-orange-500 font-black uppercase tracking-widest hover:underline"
                   >
                      Max Available
                   </button>
                </div>
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center border-4 border-[#111] shadow-lg cursor-pointer hover:rotate-180 transition-all">
                  <RefreshCcw className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">To (Estimated)</label>
                <div className="flex items-center justify-between">
                  <select 
                    value={convertTo}
                    onChange={(e) => setConvertTo(e.target.value)}
                    className="bg-transparent text-lg font-bold outline-none"
                  >
                    {balances.map(b => <option key={b.symbol} value={b.symbol}>{b.symbol}</option>)}
                  </select>
                  <span className="text-lg font-mono text-green-500">
                    {convertAmount ? ((parseFloat(convertAmount) * (tickerPrices[convertFrom] || 1)) / (tickerPrices[convertTo] || 1)).toFixed(4) : '0.0000'}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleConvert}
              disabled={isConverting}
              className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-orange-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-xl shadow-orange-600/20"
            >
              {isConverting ? 'Swapping...' : 'Execute Swap'}
            </button>
            <p className="mt-4 text-[9px] text-white/30 text-center leading-relaxed italic">
               Note: Swaps incur BNB gas fees. Testnet liquidity may be limited, potentially causing slippage between estimated and actual received amounts.
            </p>
          </div>
        </motion.div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowQR(false)}
        >
          <div className="bg-white p-8 rounded-3xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-black font-bold text-xl mb-6">Receive Funds</h3>
            <div className="bg-white p-4 rounded-2xl shadow-inner mb-6">
              <QRCodeSVG value={user?.wallet_address || ''} size={200} />
            </div>
            <p className="text-black/50 text-xs font-mono mb-4 break-all max-w-[200px] mx-auto">{user?.wallet_address}</p>
            <button 
              onClick={handleCopy}
              className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all"
            >
              Copy Address
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Plus, label: 'Fund Trading', color: 'bg-orange-500', onClick: () => setShowFund(true) },
          { icon: Send, label: 'Send', color: 'bg-purple-500', onClick: () => setShowSend(true) },
          { icon: ArrowDownLeft, label: 'Receive', color: 'bg-green-500', onClick: () => setShowQR(true) },
          { icon: RefreshCcw, label: 'Convert', color: 'bg-blue-500', onClick: () => setShowConvert(true) },
        ].map((action, i) => (
          <button 
            key={i}
            onClick={action.onClick}
            className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all group"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg", action.color)}>
              <action.icon className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-sm uppercase tracking-tighter">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Balances & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Assets */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-display text-lg uppercase tracking-widest opacity-50">Your Assets</h3>
            <button className="text-orange-500 text-xs font-display hover:underline uppercase tracking-widest">View All</button>
          </div>
          <div className="space-y-2">
            {balances.map((asset, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-all group cursor-pointer">
                <div className="flex items-center gap-4">
                  <img src={asset.icon} alt={asset.symbol} className="w-10 h-10 rounded-full group-hover:scale-110 transition-transform" />
                  <div>
                    <h4 className="font-bold">{asset.symbol}</h4>
                    <p className="text-xs opacity-40">{asset.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{asset.balance}</p>
                  <p className="text-xs opacity-40">{asset.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-display text-lg uppercase tracking-widest opacity-50">Recent Activity</h3>
            <button className="text-orange-500 text-xs font-display hover:underline uppercase tracking-widest">History</button>
          </div>
          <div className="space-y-2">
            {isLoadingHistory && transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-20">
                <RefreshCcw className="w-8 h-8 animate-spin" />
                <p className="text-[10px] font-mono uppercase tracking-[0.3em]">Quantum Sync in progress...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 opacity-10">
                 <History className="w-8 h-8" />
                 <p className="text-[10px] font-mono uppercase tracking-[0.3em]">No records found</p>
              </div>
            ) : (
              transactions.map((tx, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-all group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    tx.type === 'received' || tx.type === 'profit' ? "bg-green-500/10 text-green-500" : 
                    tx.type === 'sent' || tx.type === 'send' || tx.type === 'loss' ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                  )}>
                    {tx.type === 'received' || tx.type === 'profit' ? <ArrowDownLeft className="w-5 h-5" /> : 
                     tx.type === 'sent' || tx.type === 'send' || tx.type === 'loss' ? <Send className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold capitalize">{tx.type}</h4>
                    <p className="text-[10px] opacity-40 font-mono">{tx.from || tx.to}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-bold", tx.amount.startsWith('+') ? "text-green-500" : "text-red-500")}>
                    {tx.amount}
                  </p>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest">{tx.time}</p>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
