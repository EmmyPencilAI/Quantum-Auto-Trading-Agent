import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Zap, Bell, TrendingUp, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { quantumAgent } from '../services/quantumAgent';
import { User, ModeType } from '../types';
import { supabase } from '../lib/supabase';

interface QuantumAgentOverlayProps {
  user: User | null;
  mode: ModeType;
}

export default function QuantumAgentOverlay({ user, mode }: QuantumAgentOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([
    { role: 'agent', content: "Quantum Agent online. Real-time BNB Chain intelligence synced. How can I assist your alpha generation today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMilestoneRef = useRef<number>(0);

  // Milestone & Trade Alert Checker
  useEffect(() => {
    if (!user) return;
    
    const checkMilestone = async () => {
      const { data: lead } = await supabase.from('leaderboard').select('total_profit').eq('uid', user.uid).eq('mode_type', mode).single();
      const profit = lead?.total_profit || 0;
      
      if (profit > 1000 && profit > lastMilestoneRef.current + 500) {
        const milestone = quantumAgent.generateUserMilestone(user.username, profit, mode);
        if (milestone) {
          setAlerts(prev => [milestone, ...prev].slice(0, 3));
          lastMilestoneRef.current = profit;
          setTimeout(() => setAlerts(prev => prev.filter(a => a !== milestone)), 15000);
        }
      }
    };

    // Real-time Trade Alert (Listening to completed trades)
    const channel = supabase
      .channel('trade_alerts')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trades', filter: `uid=eq.${user.uid}` }, (payload) => {
        if (payload.new.status === 'Completed') {
          const pnl = payload.new.pnl;
          const msg = `[QUANTUM ALPHA] Trade Settled | Result: ${pnl > 0 ? 'PROFIT' : 'LOSS'} | PnL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
          setAlerts(prev => [msg, ...prev].slice(0, 3));
          setTimeout(() => setAlerts(prev => prev.filter(a => a !== msg)), 8000);
        }
      })
      .subscribe();

    const interval = setInterval(checkMilestone, 30000); // Check every 30s
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user, mode]);

  useEffect(() => {
    // Initialize audio element
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.4;
  }, []);

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (alerts.length > 0) {
      playSound();
    }
  }, [alerts.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Periodic Updates (Whales & Market)
  useEffect(() => {
    const whaleInterval = setInterval(() => {
      const alert = quantumAgent.generateWhaleAlert();
      setAlerts(prev => [alert, ...prev].slice(0, 3));
      setTimeout(() => setAlerts(prev => prev.filter(a => a !== alert)), 10000);
    }, 60000); // 1 min

    const marketInterval = setInterval(async () => {
      const update = await quantumAgent.generateMarketUpdate();
      setAlerts(prev => [update, ...prev].slice(0, 3));
      setTimeout(() => setAlerts(prev => prev.filter(a => a !== update)), 15000);
    }, 120000); // 2 mins

    return () => {
      clearInterval(whaleInterval);
      clearInterval(marketInterval);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    const response = await quantumAgent.generateResponse(userMsg);
    setMessages(prev => [...prev, { role: 'agent', content: response }]);
    setIsTyping(false);
  };

  // Floating Chat Trigger
  return (
    <>
      {/* Global Notifications */}
      <div className="fixed top-24 right-4 z-[100] space-y-2 pointer-events-none">
        <AnimatePresence>
          {alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="bg-black/90 border border-orange-500/30 backdrop-blur-xl p-4 rounded-2xl shadow-2xl max-w-xs pointer-events-auto"
            >
              <div className="flex items-start gap-3">
                <img src="/logo.png" className="w-10 h-10 object-contain shrink-0" />
                <div className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed text-white/90">
                  {alert}
                </div>
                <button 
                  onClick={() => setAlerts(prev => prev.filter((_, idx) => idx !== i))}
                  className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3 text-white/40" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Chat Trigger */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 z-[60] w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/40 hover:scale-110 transition-all group active:scale-95"
      >
        {isOpen ? <X className="w-7 h-7 text-white" /> : <Bot className="w-7 h-7 text-white" />}
        {!isOpen && <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black animate-pulse" />}
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-40 right-6 z-[65] w-80 md:w-96 h-[500px] bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden backdrop-blur-3xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-orange-600/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-display uppercase tracking-tight">Quantum Agent</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest">Real-time Intelligence</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors group"
                title="Close Chat"
              >
                <X className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-orange-600 text-white rounded-tr-none" 
                      : "bg-white/5 text-white/80 rounded-tl-none border border-white/5"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce delay-75" />
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce delay-150" />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/5 bg-black/40">
              <div className="relative flex items-center gap-2">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Quantum Intelligence..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-orange-500/50 transition-all"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-orange-600 rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
