import React from 'react';
import { motion } from 'motion/react';
import { Zap, ChevronRight, Shield, TrendingUp, Globe, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { APP_CONFIG } from '../config';

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const features = [
    { icon: Zap, title: "Automated Trading", desc: "High-frequency execution engine built for speed and precision." },
    { icon: Shield, title: "Secure Wallet", desc: "Web3Auth integration for seamless social login and wallet creation." },
    { icon: TrendingUp, title: "Real-time Analytics", desc: "Live market monitoring and performance tracking across major assets." },
    { icon: Globe, title: "BNB Chain Native", desc: "Optimized for low fees and fast settlement on the Binance Smart Chain." },
  ];

  const steps = [
    { number: "01", title: "Connect Wallet", desc: "Sign in with your favorite social account via Web3Auth." },
    { number: "02", title: "Fund Account", desc: "Deposit BNB or USDT to start your trading journey." },
    { number: "03", title: "Choose Strategy", desc: "Select from Aggressive, Momentum, Scalping, or Conservative." },
    { number: "04", title: "Start Trading", desc: "Launch the engine and watch your portfolio grow in real-time." },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-blue-500/30">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 md:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8"
          >
            <Zap className="w-4 h-4 fill-blue-400" />
            Next-Gen Trading Engine
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-black tracking-tighter mb-6 leading-[0.9]"
          >
            QUANTUM <span className="text-blue-600">FINANCE</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {APP_CONFIG.DESCRIPTION}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onLogin}
              className="group relative px-8 py-4 bg-blue-600 rounded-xl font-bold text-lg overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.4)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative flex items-center gap-2">
                Launch Quantum App <ChevronRight className="w-5 h-5" />
              </span>
            </button>
            <button className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-lg transition-all border border-white/10">
              View Documentation
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 md:px-8 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl bg-black border border-white/5 hover:border-blue-500/30 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-white/50 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">HOW IT WORKS</h2>
            <p className="text-white/50">Four simple steps to start your automated trading journey.</p>
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
                <div className="w-16 h-16 bg-black border-2 border-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-black text-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-white/50">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Risk Warning */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-3xl mx-auto p-8 rounded-3xl bg-red-500/5 border border-red-500/20 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/10 rounded-full mb-6">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-red-500 mb-4 uppercase tracking-widest">Risk Warning</h3>
          <p className="text-white/60 leading-relaxed mb-4">
            Trading involves risk. Profit is not guaranteed. Market conditions can change rapidly.
            Quantum Finance provides tools and automation, but users are responsible for their decisions.
            Proceed with full understanding of the risks involved.
          </p>
          <p className="text-white/40 text-sm italic font-serif">Venture into the unknown. Trade with awareness.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 md:px-8 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Zap className="w-6 h-6 text-blue-600 fill-blue-600" />
          <span className="font-bold text-xl tracking-tight">QUANTUM FINANCE</span>
        </div>
        <p className="text-white/30 text-sm">© 2026 Quantum Finance Engine. All rights reserved.</p>
      </footer>
    </div>
  );
}
