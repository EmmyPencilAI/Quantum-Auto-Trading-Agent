import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Search, TrendingUp, TrendingDown, Globe, BarChart2, Zap } from 'lucide-react';
import { cn, getLogo } from '../../lib/utils';

export default function MarketsTab() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "colorTheme": "dark",
      "dateRange": "12M",
      "showChart": true,
      "locale": "en",
      "largeChartUrl": "",
      "isTransparent": true,
      "showSymbolLogo": true,
      "showFloatingTooltip": false,
      "width": "100%",
      "height": "600",
      "plotLineColorGrowing": "rgba(249, 115, 22, 1)",
      "plotLineColorFalling": "rgba(249, 115, 22, 1)",
      "gridLineColor": "rgba(240, 243, 250, 0)",
      "scaleFontColor": "rgba(209, 212, 220, 1)",
      "belowLineFillColorGrowing": "rgba(249, 115, 22, 0.12)",
      "belowLineFillColorFalling": "rgba(249, 115, 22, 0.12)",
      "belowLineFillColorGrowingBottom": "rgba(249, 115, 22, 0)",
      "belowLineFillColorFallingBottom": "rgba(249, 115, 22, 0)",
      "symbolActiveColor": "rgba(249, 115, 22, 0.12)",
      "tabs": [
        {
          "title": "Crypto",
          "symbols": [
            { "s": "BINANCE:BTCUSDT" },
            { "s": "BINANCE:ETHUSDT" },
            { "s": "BINANCE:BNBUSDT" },
            { "s": "BINANCE:SOLUSDT" },
            { "s": "BINANCE:SUIUSDT" },
            { "s": "BINANCE:XRPUSDT" },
            { "s": "BINANCE:ADAUSDT" },
            { "s": "BINANCE:DOGEUSDT" }
          ]
        }
      ]
    });
    if (container.current) {
      container.current.appendChild(script);
    }
    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, []);

  const stats = [
    { label: 'Market Cap', value: '$2.54T', change: '+2.4%', icon: Globe },
    { label: '24h Volume', value: '$84.2B', change: '-1.2%', icon: BarChart2 },
    { label: 'BTC Dominance', value: '52.4%', change: '+0.5%', icon: TrendingUp },
    { label: 'Active Trades', value: '1,254', change: '+124', icon: Zap },
  ];

  return (
    <div className="space-y-8">
      {/* Market Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all group cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-display opacity-40 uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-display tracking-tight">{stat.value}</span>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-1",
                stat.change.startsWith('+') ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
              )}>
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Market View */}
      <div className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-500" />
            </div>
            <h2 className="text-2xl font-display tracking-tight uppercase">Market Overview</h2>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text" 
              placeholder="Search assets..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
            />
          </div>
        </div>

        <div className="min-h-[600px] w-full" ref={container}>
          {/* TradingView Widget will be injected here */}
        </div>
      </div>

      {/* Top Gainers/Losers (Mock) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
          <h3 className="font-display text-lg mb-6 flex items-center gap-2 uppercase tracking-tighter">
            <TrendingUp className="w-5 h-5 text-green-500" /> Top Gainers
          </h3>
          <div className="space-y-4">
            {[
              { symbol: 'BTC', name: 'Bitcoin', price: '$64,231', change: '+2.4%' },
              { symbol: 'ETH', name: 'Ethereum', price: '$3,452', change: '+3.2%' },
              { symbol: 'SOL', name: 'Solana', price: '$145.23', change: '+12.4%' },
              { symbol: 'BNB', name: 'Binance Coin', price: '$582.12', change: '+8.2%' },
              { symbol: 'SUI', name: 'Sui', price: '$1.84', change: '+6.5%' },
            ].map((asset, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <img 
                    src={getLogo(asset.symbol)} 
                    className="coin-logo group-hover:scale-110 transition-transform" 
                    onError={(e) => (e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=crypto')}
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-bold text-sm tracking-tight">{asset.symbol}</h4>
                    <p className="text-[10px] opacity-40 uppercase font-bold">{asset.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{asset.price}</p>
                  <p className="text-[10px] text-green-500 font-bold">{asset.change}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
          <h3 className="font-display text-lg mb-6 flex items-center gap-2 uppercase tracking-tighter">
            <TrendingDown className="w-5 h-5 text-red-500" /> Top Losers
          </h3>
          <div className="space-y-4">
            {[
              { symbol: 'XRP', name: 'Ripple', price: '$0.62', change: '-4.2%' },
              { symbol: 'ADA', name: 'Cardano', price: '$0.45', change: '-3.8%' },
              { symbol: 'DOGE', name: 'Dogecoin', price: '$0.16', change: '-2.5%' },
            ].map((asset, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <img 
                    src={getLogo(asset.symbol)} 
                    className="coin-logo group-hover:scale-110 transition-transform" 
                     onError={(e) => (e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=crypto')}
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-bold text-sm tracking-tight">{asset.symbol}</h4>
                    <p className="text-[10px] opacity-40 uppercase font-bold">{asset.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{asset.price}</p>
                  <p className="text-[10px] text-red-500 font-bold">{asset.change}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
