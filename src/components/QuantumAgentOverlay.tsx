import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Zap, Bell, TrendingUp, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { quantumAgent } from '../services/quantumAgent';

export default function QuantumAgentOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([
    { role: 'agent', content: "Quantum Agent online. Real-time BNB Chain intelligence synced. How can I assist your alpha generation today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Periodic Whale Alerts
  useEffect(() => {
    const interval = setInterval(() => {
      const alert = quantumAgent.generateWhaleAlert();
      setAlerts(prev => [alert, ...prev].slice(0, 3));
      
      // Auto-dismiss alert after 10s
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a !== alert));
      }, 10000);
    }, 45000); // Every 45s a whale might move

    return () => clearInterval(interval);
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
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-white fill-white" />
                </div>
                <div className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed text-white/90">
                  {alert}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Chat Trigger */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-[60] w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/40 hover:scale-110 transition-all group active:scale-95"
      >
        <Bot className="w-7 h-7 text-white" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black animate-pulse" />
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
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/40" />
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
