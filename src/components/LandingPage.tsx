import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Zap, Shield, TrendingUp, Cpu, Activity, ArrowRight, BrainCircuit, Globe, Layers } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { cn } from '../lib/utils';

interface LandingPageProps {
  onLogin: () => void;
}

// Background Grid Component (Aceternity Style)
const BackgroundGrid = () => (
  <div className="absolute inset-0 z-0 h-full w-full bg-[#030303] bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem]">
    <div className="absolute inset-0 bg-[#030303] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
  </div>
);

// Glowing Orb
const GlowingOrb = ({ className }: { className?: string }) => (
  <div className={cn("absolute rounded-full blur-[100px] pointer-events-none opacity-50", className)} />
);

export default function LandingPage({ onLogin }: LandingPageProps) {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);

  const features = [
    { icon: BrainCircuit, title: "Neural HFT Core", desc: "Our AI processes 1s K-lines across 10+ pairs simultaneously, identifying micro-momentum shifts invisible to human eyes." },
    { icon: Zap, title: "Sub-Second Execution", desc: "Bypassing standard RPC nodes for direct smart-contract execution. Enter and exit trades before the market reacts." },
    { icon: Shield, title: "Non-Custodial Vault", desc: "Your keys, your funds. Quantum executes trades on your behalf using Web3Auth without ever holding your assets." },
    { icon: Activity, title: "Dynamic Lot Scaling", desc: "The engine mathematically compounds your wins and instantly restricts size during drawdowns to protect capital." },
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-orange-500/30 font-sans relative overflow-x-hidden">
      <BackgroundGrid />
      
      {/* Orbs */}
      <GlowingOrb className="top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-600/30" />
      <GlowingOrb className="top-[40%] right-[-10%] w-[600px] h-[600px] bg-red-900/20" />
      <GlowingOrb className="bottom-[-10%] left-[20%] w-[800px] h-[800px] bg-orange-700/20" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-20 border-b border-white/5 bg-black/50 backdrop-blur-xl z-50 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Quantum" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
          <span className="font-display text-xl tracking-tighter uppercase text-white/90">QUANTUM <span className="text-orange-500 font-bold">FINANCE</span></span>
        </div>
        <button 
          onClick={onLogin}
          className="relative inline-flex h-10 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
        >
          <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#f97316_50%,#E2CBFF_100%)]" />
          <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-black px-6 py-1 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-3xl transition-all hover:bg-black/80">
            Launch Terminal
          </span>
        </button>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
        
        {/* HERO SECTION */}
        <section className="flex flex-col items-center justify-center text-center min-h-[70vh] py-20 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8"
          >
            <img src="/logo.png" alt="Quantum Logo" className="w-40 h-40 md:w-56 md:h-56 object-contain drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-red-600 blur-2xl opacity-20"></div>
            <h1 className="relative text-6xl md:text-[8rem] font-display font-black tracking-tighter leading-[0.85] uppercase bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40">
              ALGORITHMIC <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">DOMINANCE</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-8 max-w-2xl text-lg md:text-xl font-mono text-white/50 uppercase tracking-wide leading-relaxed"
          >
            A high-frequency AI momentum engine. We don't predict the market. <br/>
            <span className="text-orange-500 font-bold">We react faster than it.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-12 flex flex-col sm:flex-row gap-6"
          >
            <button
              onClick={onLogin}
              className="group relative px-8 py-4 bg-orange-600/10 border border-orange-500/50 hover:bg-orange-600 hover:border-orange-600 rounded-2xl font-bold uppercase tracking-widest overflow-hidden transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 via-orange-400/30 to-orange-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-2">
                Connect Web3 Wallet <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold uppercase tracking-widest transition-all backdrop-blur-sm">
              Read The Docs
            </button>
          </motion.div>
        </section>

        {/* MARKET TICKER */}
        <section className="py-10 border-y border-white/5 bg-black/20 backdrop-blur-sm my-20 -mx-6 md:-mx-12 px-6 md:px-12 overflow-hidden flex relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#030303] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#030303] to-transparent z-10" />
          <motion.div 
            animate={{ x: [0, -1000] }} 
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="flex gap-12 whitespace-nowrap"
          >
            {[...APP_CONFIG.SUPPORTED_PAIRS, ...APP_CONFIG.SUPPORTED_PAIRS].map((pair, i) => (
              <div key={i} className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity cursor-default">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="font-mono font-bold text-lg">{pair}</span>
                <span className="font-mono text-orange-500 tracking-tighter">HFT ACTIVE</span>
              </div>
            ))}
          </motion.div>
        </section>

        {/* BENTO GRID FEATURES */}
        <section className="py-24 relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display uppercase tracking-tighter font-black">
              The Engine <span className="text-orange-500">Architecture</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "relative group rounded-3xl p-8 bg-black/40 border border-white/10 overflow-hidden",
                  idx === 0 || idx === 3 ? "md:col-span-2" : "md:col-span-1"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
                    <feat.icon className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-display uppercase font-bold mb-3 tracking-wide">{feat.title}</h3>
                  <p className="text-sm font-mono text-white/50 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-900/10 to-transparent blur-3xl pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10 border border-white/10 bg-black/40 backdrop-blur-2xl p-12 md:p-20 rounded-[3rem]">
            <h2 className="text-5xl md:text-7xl font-display font-black tracking-tighter uppercase mb-6">
              Stop <span className="text-white/30 text-stroke">Guessing.</span> <br/>
              Start <span className="text-orange-500">Executing.</span>
            </h2>
            <p className="text-lg font-mono text-white/40 mb-10 max-w-xl mx-auto">
              Join the terminal. Deposit native liquidity. Let the algorithm harvest momentum.
            </p>
            <button 
              onClick={onLogin}
              className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
              Initialize Quantum
            </button>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="py-8 border-t border-white/5 bg-black/50 text-center backdrop-blur-xl relative z-10">
        <div className="flex flex-col items-center justify-center gap-4">
          <img src="/logo.png" alt="Quantum" className="w-8 h-8 object-contain opacity-50 grayscale hover:grayscale-0 transition-all" />
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/30">
            © {new Date().getFullYear()} QUANTUM AI TRADING SYSTEMS. DECENTRALIZED INFRASTRUCTURE.
          </p>
        </div>
      </footer>
    </div>
  );
}
