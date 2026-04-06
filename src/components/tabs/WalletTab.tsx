import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, Copy, Share2, QrCode, Send, ArrowDownLeft, Plus, History, ExternalLink, CheckCircle2, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../../lib/utils';
import { User, ModeType } from '../../types';
import { APP_CONFIG } from '../../config';

interface WalletTabProps {
  user: User | null;
  mode: ModeType;
}

export default function WalletTab({ user, mode }: WalletTabProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCopy = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const balances = [
    { symbol: 'BNB', name: 'Binance Coin', balance: mode === 'demo' ? '10.00' : '1.452', value: mode === 'demo' ? '$5,800.00' : '$842.12', icon: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png' },
    { symbol: 'USDT', name: 'Tether', balance: mode === 'demo' ? '5,000.00' : '1,250.00', value: mode === 'demo' ? '$5,000.00' : '$1,250.00', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    { symbol: 'USDC', name: 'USD Coin', balance: mode === 'demo' ? '2,500.00' : '450.00', value: mode === 'demo' ? '$2,500.00' : '$450.00', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
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
              {mode === 'demo' ? '$13,300.00' : '$2,542.12'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-md rounded-xl border border-white/10 font-mono text-xs">
              {user?.walletAddress.slice(0, 8)}...{user?.walletAddress.slice(-8)}
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
          { icon: Plus, label: 'Fund Trading', color: 'bg-orange-500' },
          { icon: Send, label: 'Send', color: 'bg-purple-500' },
          { icon: ArrowDownLeft, label: 'Receive', color: 'bg-green-500' },
          { icon: History, label: 'History', color: 'bg-blue-500' },
        ].map((action, i) => (
          <button 
            key={i}
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
