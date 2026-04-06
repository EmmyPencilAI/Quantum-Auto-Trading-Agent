import React from 'react';
import { motion } from 'motion/react';
import { Zap, ChevronRight, Shield, TrendingUp, Globe, Clock, ArrowRight, AlertTriangle, BarChart3, Users, Trophy, MessageSquare } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { cn } from '../lib/utils';

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const features = [
    { icon: Zap, title: "Automated Trading Engine", desc: "High-frequency execution engine built for speed and precision." },
    { icon: TrendingUp, title: "Real-time Market Monitoring", desc: "Live market monitoring and performance tracking across major assets." },
    { icon: BarChart3, title: "Multiple Trading Strategies", desc: "Choose from Aggressive, Momentum, Scalping, or Conservative." },
    { icon: Shield, title: "Web3 Wallet Integration", desc: "Web3Auth integration for seamless social login and wallet creation." },
    { icon: Clock, title: "Instant Settlement System", desc: "Automatic profit sharing and principal return upon trade completion." },
    { icon: Users, title: "Leaderboard & Community", desc: "Connect with top traders and share insights in the Quantum community." },
  ];

  const steps = [
    { number: "01", title: "Connect Wallet", desc: "Sign in with your favorite social account via Web3Auth." },
    { number: "02", title: "Fund Account", desc: "Deposit BNB or USDT to start your trading journey." },
    { number: "03", title: "Choose Strategy", desc: "Select from Aggressive, Momentum, Scalping, or Conservative." },
    { number: "04", title: "Start Trading", desc: "Launch the engine and watch your portfolio grow in real-time." },
  ];

  const tradingModes = [
    { name: "Aggressive", desc: "High frequency trading with rapid execution." },
    { name: "Momentum", desc: "Trend following strategy for sustained moves." },
    { name: "Scalping", desc: "Quick entries and exits for small price changes." },
    { name: "Conservative", desc: "Lower risk approach focusing on steady growth." },
  ];

  const assets = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "SUI/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "MATIC/USDT"];

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-orange-500/30 font-sans">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 md:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-600/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-8"
          >
            <Zap className="w-4 h-4 fill-orange-400" />
            Next-Gen Trading Engine
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-black tracking-tighter mb-6 leading-[0.9] uppercase"
          >
            QUANTUM <span className="text-orange-600">FINANCE</span>
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-xl md:text-3xl font-bold text-white/80 mb-6 uppercase tracking-tight"
          >
            Automated Web3 Trading Engine Built for Speed, Strategy, and Scale
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Trade smarter using automated strategies. Connect your wallet, fund trading, and start/stop anytime.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onLogin}
              className="group relative px-10 py-5 bg-orange-600 rounded-xl font-bold text-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(249,115,22,0.4)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative flex items-center gap-2 uppercase tracking-tighter">
                Get Started <ChevronRight className="w-5 h-5" />
              </span>
            </button>
            <button 
              onClick={onLogin}
              className="px-10 py-5 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-xl transition-all border border-white/10 uppercase tracking-tighter"
            >
              Launch App
            </button>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 md:px-8 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 uppercase">HOW IT WORKS</h2>
            <p className="text-white/50 text-lg">Four simple steps to start your automated trading journey.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 hidden lg:block -z-10" />
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative text-center"
              >
                <div className="w-16 h-16 bg-black border-2 border-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-black text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold mb-3 uppercase tracking-tight">{step.title}</h3>
                <p className="text-white/50 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 uppercase">CORE FEATURES</h2>
            <p className="text-white/50 text-lg">Everything you need to trade with confidence and scale.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:border-orange-500/30 transition-all group"
              >
                <div className="w-14 h-14 bg-orange-600/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-600 transition-colors">
                  <feature.icon className="w-7 h-7 text-orange-500 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-3 uppercase tracking-tight">{feature.title}</h3>
                <p className="text-white/50 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trading Modes */}
      <section className="py-24 px-4 md:px-8 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 uppercase">TRADING STRATEGIES</h2>
            <p className="text-white/50 text-lg">Select the mode that fits your risk profile and goals.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tradingModes.map((mode, i) => (
              <div key={i} className="p-8 rounded-3xl bg-black border border-white/5 text-center">
                <h3 className="text-2xl font-black text-orange-500 mb-2 uppercase tracking-tighter">{mode.name}</h3>
                <p className="text-white/50 text-sm">{mode.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo vs Real */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-10 rounded-[3rem] bg-blue-500/5 border border-blue-500/20">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">DEMO MODE</h3>
            <ul className="space-y-4 text-white/60">
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-blue-500" /> Practice with simulated funds</li>
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-blue-500" /> No real risk involved</li>
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-blue-500" /> Full testing environment</li>
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-blue-500" /> Reset balances anytime</li>
            </ul>
          </div>
          <div className="p-10 rounded-[3rem] bg-orange-500/5 border border-orange-500/20">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter text-orange-500">REAL MODE</h3>
            <ul className="space-y-4 text-white/60">
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-orange-500" /> Uses real BNB/USDT funds</li>
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-orange-500" /> Executes real trades on-chain</li>
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-orange-500" /> Real profit/loss outcomes</li>
              <li className="flex items-center gap-3"><ChevronRight className="w-4 h-4 text-orange-500" /> Instant 50/50 profit sharing</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Supported Assets */}
      <section className="py-24 px-4 md:px-8 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl font-black tracking-widest mb-12 uppercase text-white/30">SUPPORTED ASSETS</h2>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            {assets.map((asset, i) => (
              <div key={i} className="px-6 py-3 rounded-full bg-white/5 border border-white/10 font-mono text-sm font-bold">
                {asset}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Risk Warning */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-4xl mx-auto p-10 rounded-[3rem] bg-red-500/5 border border-red-500/20 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full mb-8">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-red-500 mb-6 uppercase tracking-widest">MANDATORY RISK WARNING</h3>
          <p className="text-white/70 text-lg md:text-xl leading-relaxed mb-8">
            Trading involves risk. Profit is not guaranteed. Market conditions can change rapidly.
            Quantum Finance provides tools and automation, but users are responsible for their decisions.
            Proceed with full understanding of the risks involved.
          </p>
          <p className="text-white/40 text-lg italic font-serif">Venture into the unknown. Trade with awareness.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4 md:px-8 text-center relative">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-600/10 blur-[100px] rounded-full -z-10" />
        <h2 className="text-4xl md:text-7xl font-black tracking-tighter mb-10 uppercase">READY TO LAUNCH?</h2>
        <button
          onClick={onLogin}
          className="px-12 py-6 bg-orange-600 rounded-2xl font-black text-2xl uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(249,115,22,0.5)]"
        >
          Launch Quantum App
        </button>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 md:px-8 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Zap className="w-8 h-8 text-orange-600 fill-orange-600" />
          <span className="font-black text-2xl tracking-tighter uppercase">QUANTUM FINANCE</span>
        </div>
        <div className="flex justify-center gap-8 mb-8 text-white/40 text-sm font-bold uppercase tracking-widest">
          <a href="https://guguroboticsreporter.medium.com/quantum-finance-55ce34afd39c" target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 transition-colors">Terms</a>
          <a href="#" className="hover:text-orange-500 transition-colors">Privacy</a>
          <a href="#" className="hover:text-orange-500 transition-colors">Docs</a>
          <a href="#" className="hover:text-orange-500 transition-colors">Support</a>
        </div>
        <p className="text-white/20 text-xs font-mono uppercase tracking-widest">© 2026 Quantum Finance Engine. Built on BNB Chain.</p>
      </footer>
    </div>
  );
}
