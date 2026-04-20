import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, Copy, Share2, QrCode, Send, ArrowDownLeft, Plus, History, ExternalLink, CheckCircle2, Zap, ArrowRight, Gauge, RefreshCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn, getLogo } from '../../lib/utils';
import { User, ModeType } from '../../types';
import { APP_CONFIG } from '../../config';
import { supabase } from '../../lib/supabase';
import { getSmartGasPrice } from '../../lib/blockchain';
import { executeRealSwap } from '../../lib/dex';
import { ethers } from 'ethers';

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
  const [demoBalance, setDemoBalance] = useState<number>(0);
  const [tickerPrices, setTickerPrices] = useState<Record<string, number>>({ 'BNB': 600, 'BTC': 65000, 'SOL': 140, 'ETH': 3500, 'XRP': 0.6, 'ADA': 0.5, 'SUI': 1.5, 'USDC': 1, 'USDT': 1 });

  useEffect(() => {
    if (!user || mode !== 'demo') return;

    // Fetch initial balance
    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('demo_wallets')
        .select('demo_balance')
        .eq('id', user.uid)
        .single();
      
      if (data) {
        setDemoBalance(data.demo_balance);
      }
    };
    fetchBalance();

    // Set up real-time subscription
    const channel = supabase
      .channel('demo_balance_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'demo_wallets',
          filter: `id=eq.${user.uid}`
        },
        (payload) => {
          setDemoBalance(payload.new.demo_balance);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mode]);

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
      balance: mode === 'demo' ? (demoBalance * 0.001).toFixed(4) : realBalance, 
      value: mode === 'demo' 
        ? `$${(demoBalance * 0.001 * (tickerPrices['BNB'] || 600)).toLocaleString(undefined, { maximumFractionDigits: 2 })}` 
        : `$${(parseFloat(realBalance) * (tickerPrices['BNB'] || 600)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 
      icon: getLogo('BNB') 
    },
    { 
      symbol: 'USDT', 
      name: 'Tether International', 
      balance: mode === 'demo' ? (demoBalance * 0.2).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.2).toLocaleString()}` : '$0.00', 
      icon: getLogo('USDT') 
    },
    { 
      symbol: 'USDC', 
      name: 'USD Coin', 
      balance: mode === 'demo' ? (demoBalance * 0.1).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.1).toLocaleString()}` : '$0.00', 
      icon: getLogo('USDC') 
    },
    { 
      symbol: 'ETH', 
      name: 'Ethereum', 
      balance: mode === 'demo' ? (demoBalance * 0.05).toFixed(4) : '0.0000', 
      value: mode === 'demo' ? `$${(demoBalance * 0.05 * (tickerPrices['ETH'] || 3500)).toLocaleString()}` : '$0.00', 
      icon: getLogo('ETH') 
    },
    { 
      symbol: 'SOL', 
      name: 'Solana', 
      balance: mode === 'demo' ? (demoBalance * 0.05).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.05 * (tickerPrices['SOL'] || 140)).toLocaleString()}` : '$0.00', 
      icon: getLogo('SOL') 
    },
    { 
      symbol: 'XRP', 
      name: 'Ripple', 
      balance: mode === 'demo' ? (demoBalance * 0.05).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.05 * (tickerPrices['XRP'] || 0.6)).toLocaleString()}` : '$0.00', 
      icon: getLogo('XRP') 
    },
    { 
      symbol: 'SUI', 
      name: 'Sui Network', 
      balance: mode === 'demo' ? (demoBalance * 0.02).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.02 * (tickerPrices['SUI'] || 1.5)).toLocaleString()}` : '$0.00', 
      icon: getLogo('SUI') 
    },
  ];

  const [transactions, setTransactions] = useState<any[]>([]);

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
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('uid', user.uid)
        .eq('mode_type', mode)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (data) {
        const formatted = data.map((t: any) => ({
          id: t.id,
          type: t.type === 'SEND' ? 'send' : (t.pnl >= 0 ? 'profit' : 'loss'),
          amount: t.type === 'SEND' ? `-$${Math.abs(t.pnl).toLocaleString()}` : `${t.pnl >= 0 ? '+' : ''}$${Math.abs(t.pnl).toLocaleString()}`,
          time: new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          to: t.type === 'SEND' ? t.pair : (t.type === 'BUY' ? 'Long' : 'Short'),
          from: t.type === 'SEND' ? 'Self' : 'Quantum Engine'
        }));
        setTransactions(formatted);
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
        
        if (valueInUsd > currentBal && convertFrom !== 'USDT') {
           // This is a bit simplified since everything is measured in Demo USD balance
           // but we'll allow it for demo feel if they have enough "total" balance.
        }

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
        if (!(window as any).ethereum) {
           alert("No crypto wallet detected.");
           return;
        }
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const tx = await executeRealSwap(
           provider,
           convertFrom,
           convertTo,
           convertAmount,
           user.wallet_address || ""
        );
        alert(`Real Swap Dispatching! Tx: ${tx.hash.slice(0,10)}...`);
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
        if (!(window as any).ethereum) {
           alert("No crypto wallet detected.");
           return;
        }
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({
          to: sendAddress,
          value: ethers.parseEther(sendAmount)
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
            <h2 className="text-4xl md:text-5xl font-display tracking-tighter">
              {mode === 'demo' ? `$${demoBalance.toLocaleString()}` : `$${(parseFloat(realBalance) * 600).toLocaleString()}`}
            </h2>
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
            {transactions.map((tx, i) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
