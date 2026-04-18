import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, TrendingUp, Search, Filter, ArrowUpRight, ArrowDownRight, Zap, Users } from 'lucide-react';
import { cn, getRank } from '../../lib/utils';
import { LeaderboardEntry, User } from '../../types';
import { supabase } from '../../lib/supabase';

export default function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradersMetadata, setTradersMetadata] = useState<Record<string, User>>({});

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('totalProfit', { ascending: false })
        .limit(10);
      
      if (data) {
        setLeaderboard(data as LeaderboardEntry[]);
        
        // Fetch metadata (tradeVolume) for these users
        const uids = (data as LeaderboardEntry[]).map(e => e.uid);
        const { data: usersData } = await supabase
          .from('users')
          .select('*')
          .in('uid', uids);
        
        if (usersData) {
          const meta: Record<string, User> = {};
          usersData.forEach((u: any) => meta[u.uid] = u);
          setTradersMetadata(meta);
        }
      }
      setLoading(false);
    };

    fetchLeaderboard();

    // Set up real-time subscription
    const channel = supabase
      .channel('public:leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const topThree = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-6"
        >
          <Trophy className="w-4 h-4 fill-orange-400" />
          Global Rankings
        </motion.div>
        <h2 className="text-4xl md:text-6xl font-display tracking-tighter mb-4 uppercase">Quantum <span className="text-orange-600">Elite</span></h2>
        <p className="text-white/50 text-lg font-sans">The top performing automated trading engines on the BNB Chain. Real mode data only.</p>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-5xl mx-auto px-4">
        {/* Rank 2 */}
        {topThree[1] && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="order-2 md:order-1 p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 text-center relative group hover:bg-white/[0.05] transition-all"
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-400 rounded-2xl flex items-center justify-center shadow-lg">
              <Medal className="w-6 h-6 text-white" />
            </div>
            <img src={topThree[1].avatar} alt="Avatar" className="w-24 h-24 rounded-full mx-auto mb-6 border-4 border-slate-400/20" />
            <h3 className="text-xl font-display mb-2">{topThree[1].username}</h3>
            <p className="text-green-500 font-display text-2xl tracking-tighter">+${topThree[1].totalProfit.toLocaleString()}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mt-2 font-display">Rank #2</p>
          </motion.div>
        )}

        {/* Rank 1 */}
        {topThree[0] && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="order-1 md:order-2 p-10 rounded-[3rem] bg-orange-600/10 border border-orange-600/30 text-center relative group hover:bg-orange-600/20 transition-all shadow-[0_0_50px_rgba(249,115,22,0.2)]"
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-xl animate-bounce">
              <Trophy className="w-8 h-8 text-white fill-white" />
            </div>
            <img src={topThree[0].avatar} alt="Avatar" className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-yellow-500/20" />
            <h3 className="text-2xl font-display mb-2">{topThree[0].username}</h3>
            <p className="text-green-500 font-display text-3xl tracking-tighter">+${topThree[0].totalProfit.toLocaleString()}</p>
            <div className="mt-3">
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                getRank(tradersMetadata[topThree[0].uid]?.tradeVolume).bg,
                getRank(tradersMetadata[topThree[0].uid]?.tradeVolume).color
              )}>
                {getRank(tradersMetadata[topThree[0].uid]?.tradeVolume).name}
              </span>
            </div>
            <p className="text-xs text-orange-500 uppercase tracking-widest mt-2 font-display">Global Champion</p>
          </motion.div>
        )}

        {/* Rank 3 */}
        {topThree[2] && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="order-3 p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 text-center relative group hover:bg-white/[0.05] transition-all"
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-amber-700 rounded-2xl flex items-center justify-center shadow-lg">
              <Medal className="w-6 h-6 text-white" />
            </div>
            <img src={topThree[2].avatar} alt="Avatar" className="w-24 h-24 rounded-full mx-auto mb-6 border-4 border-amber-700/20" />
            <h3 className="text-xl font-display mb-2">{topThree[2].username}</h3>
            <p className="text-green-500 font-display text-2xl tracking-tighter">+${topThree[2].totalProfit.toLocaleString()}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mt-2 font-display">Rank #3</p>
          </motion.div>
        )}
      </div>

      {/* List View */}
      <div className="max-w-5xl mx-auto p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <h3 className="font-display text-xl uppercase tracking-tighter">Full Leaderboard</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text" 
                placeholder="Search traders..." 
                className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
            <button className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="py-20 text-center text-white/20 animate-pulse font-mono tracking-widest uppercase">Fetching Elite Data...</div>
          ) : others.length === 0 && leaderboard.length <= 3 ? (
            <div className="py-20 text-center text-white/20 italic">No more traders found.</div>
          ) : (
            others.map((entry, i) => (
              <div key={entry.uid} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                <div className="flex items-center gap-6">
                  <span className="w-6 text-center text-xs font-black text-white/20 group-hover:text-white transition-colors">#{i + 4}</span>
                  <div className="flex items-center gap-4">
                    <img src={entry.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-white/10" />
                    <div>
                      <h4 className="font-bold text-sm tracking-tight">{entry.username}</h4>
                      <p className={cn(
                        "text-[8px] uppercase tracking-widest font-black",
                        getRank(tradersMetadata[entry.uid]?.tradeVolume).color
                      )}>
                        {getRank(tradersMetadata[entry.uid]?.tradeVolume).name}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-12">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Total Balance</p>
                    <p className="font-bold text-sm">${entry.totalBalance.toLocaleString()}</p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Total Profit</p>
                    <p className="font-black text-green-500 text-lg tracking-tighter">+${entry.totalProfit.toLocaleString()}</p>
                  </div>
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500 opacity-0 group-hover:opacity-100 transition-all">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-orange-600/5 border border-orange-600/10 flex items-center gap-4 group cursor-pointer hover:bg-orange-600/10 transition-all">
          <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Total Volume</p>
            <p className="text-xl font-black">$1.2B+</p>
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-green-500/5 border border-green-500/10 flex items-center gap-4 group cursor-pointer hover:bg-green-500/10 transition-all">
          <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Avg. ROI</p>
            <p className="text-xl font-black">24.5%</p>
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-purple-500/5 border border-purple-500/10 flex items-center gap-4 group cursor-pointer hover:bg-purple-500/10 transition-all">
          <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Active Traders</p>
            <p className="text-xl font-black">12,542</p>
          </div>
        </div>
      </div>
    </div>
  );
}
