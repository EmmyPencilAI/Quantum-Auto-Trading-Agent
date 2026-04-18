import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, Copy, Share2, QrCode, Send, ArrowDownLeft, Plus, History, ExternalLink, CheckCircle2, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../../lib/utils';
import { User, ModeType } from '../../types';
import { APP_CONFIG } from '../../config';
import { supabase } from '../../lib/supabase';

interface WalletTabProps {
  user: User | null;
  mode: ModeType;
}

export default function WalletTab({ user, mode }: WalletTabProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [demoBalance, setDemoBalance] = useState<number>(0);

  useEffect(() => {
    if (!user || mode !== 'demo') return;

    // Fetch initial balance
    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('demo_wallets')
        .select('demoBalance')
        .eq('id', user.uid)
        .single();
      
      if (data) {
        setDemoBalance(data.demoBalance);
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
          setDemoBalance(payload.new.demoBalance);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mode]);

  const handleCopy = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const balances = [
    { 
      symbol: 'BNB', 
      name: 'Binance Coin', 
      balance: mode === 'demo' ? (demoBalance * 0.001).toFixed(4) : '0.0000', 
      value: mode === 'demo' ? `$${(demoBalance * 0.6).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png' 
    },
    { 
      symbol: 'USDT', 
      name: 'Tether', 
      balance: mode === 'demo' ? (demoBalance * 0.2).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.2).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' 
    },
    { 
      symbol: 'USDC', 
      name: 'USD Coin', 
      balance: mode === 'demo' ? (demoBalance * 0.1).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.1).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
    },
    { 
      symbol: 'SOL', 
      name: 'Solana', 
      balance: mode === 'demo' ? (demoBalance * 0.05).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.05).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/solana-sol-logo.png' 
    },
    { 
      symbol: 'ETH', 
      name: 'Ethereum', 
      balance: mode === 'demo' ? (demoBalance * 0.05).toFixed(4) : '0.0000', 
      value: mode === 'demo' ? `$${(demoBalance * 0.05).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' 
    },
    { 
      symbol: 'XRP', 
      name: 'Ripple', 
      balance: mode === 'demo' ? (demoBalance * 0.05).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.05).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/xrp-xrp-logo.png' 
    },
    { 
      symbol: 'ADA', 
      name: 'Cardano', 
      balance: mode === 'demo' ? (demoBalance * 0.03).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.03).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/cardano-ada-logo.png' 
    },
    { 
      symbol: 'SUI', 
      name: 'Sui', 
      balance: mode === 'demo' ? (demoBalance * 0.02).toFixed(2) : '0.00', 
      value: mode === 'demo' ? `$${(demoBalance * 0.02).toLocaleString()}` : '$0.00', 
      icon: 'https://cryptologos.cc/logos/sui-sui-logo.png' 
    },
  ];

  const transactions = [
    { id: 1, type: 'received', amount: '+0.5 BNB', from: '0x71...3a2b', time: '2h ago', status: 'completed' },
    { id: 2, type: 'sent', amount: '-100 USDT', to: '0x92...1f4e', time: '5h ago', status: 'completed' },
    { id: 3, type: 'profit', amount: '+25.4 USDT', from: 'Trading Bot', time: '1d ago', status: 'completed' },
  ];

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
              {mode === 'demo' ? `$${demoBalance.toLocaleString()}` : '$0.00'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-md rounded-xl border border-white/10 font-mono text-xs">
              {user?.walletAddress ? `${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-8)}` : '0x000...000'}
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
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowSend(false)}
                className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-bold hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  alert(`Sending ${sendAmount} to ${sendAddress}`);
                  setShowSend(false);
                }}
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
              <QRCodeSVG value={user?.walletAddress || ''} size={200} />
            </div>
            <p className="text-black/50 text-xs font-mono mb-4 break-all max-w-[200px] mx-auto">{user?.walletAddress}</p>
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
          { icon: History, label: 'History', color: 'bg-blue-500', onClick: () => alert('Showing Full Transaction History...') },
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
                    tx.type === 'received' ? "bg-green-500/10 text-green-500" : 
                    tx.type === 'sent' ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                  )}>
                    {tx.type === 'received' ? <ArrowDownLeft className="w-5 h-5" /> : 
                     tx.type === 'sent' ? <Send className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
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
