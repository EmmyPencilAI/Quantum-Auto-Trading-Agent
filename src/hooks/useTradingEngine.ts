import { useState, useEffect, useRef } from 'react';
import { analyzeMarket } from '../engine/strategy';
import { generateSignal } from '../engine/signalGenerator';
import { executeTrade } from '../engine/executor';
import { calculatePnL, settleTrade } from '../engine/settlement';
import { MarketData, TradeSignal, Position, Candle, TradeMode, ModeType } from '../engine/types';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export function useTradingEngine(user: any, mode: ModeType, strategy: TradeMode, isTrading: boolean) {
  const [currentLotSize, setCurrentLotSize] = useState(0.05);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradesCount, setTradesCount] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const engineLoopRef = useRef<NodeJS.Timeout | null>(null);

  // High Frequency Simulation Loop (roughly every 5 seconds for simulation, but can be scaled)
  useEffect(() => {
    if (isTrading && user) {
      engineLoopRef.current = setInterval(async () => {
        // 1. Simulate Market Data Ingestion
        const newPrice = 60000 + (Math.random() - 0.5) * 100;
        const newRsi = 30 + Math.random() * 40;
        const dummyCandles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
          time: Date.now() - (i * 1000),
          open: newPrice - (Math.random() * 5),
          high: newPrice + (Math.random() * 10),
          low: newPrice - (Math.random() * 10),
          close: newPrice + (Math.random() * 5),
        }));

        const data: MarketData = {
          price: newPrice,
          rsi: newRsi,
          momentum: Math.random(),
          liquidityZone: newRsi < 35 ? "LOW" : newRsi > 65 ? "HIGH" : "NEUTRAL",
          orderFlow: Math.random() > 0.8 ? "REVERSAL" : (newRsi < 40 ? "BUY_PRESSURE" : "SELL_PRESSURE"),
          timestamp: Date.now(),
          candles: dummyCandles
        };

        setMarketData(data);

        // 2. Strategy Analysis & Signal Generation
        const signal = generateSignal(data, currentLotSize);

        const startTime = Date.now();

        // 3. Execution HAND
        try {
          await executeTrade(signal, currentPosition, {
            onOpen: async (type, size) => {
              const pos: Position = {
                id: `pos_${Date.now()}`,
                type,
                entryPrice: data.price,
                size,
                startTime: Date.now(),
                mode: strategy,
                modeType: mode
              };
              setCurrentPosition(pos);
              setTradesCount(prev => prev + 1);
              
              // Sync to Firebase
              await setDoc(doc(db, 'trade_live_updates', pos.id), {
                ...pos,
                uid: user.uid,
                pair: 'BTC/USDT',
                floatingPnl: 0,
                status: "Running",
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            },
            onClose: async () => {
              if (currentPosition) {
                const pnl = calculatePnL(currentPosition.entryPrice, data.price, currentPosition.size, currentPosition.type);
                
                // 4. Settlement (ACCOUNTING)
                await settleTrade(user, pnl, currentPosition.size, {
                  creditUser: async (uid, amount) => {
                     if (mode === 'demo') {
                       const demoDoc = await getDoc(doc(db, 'demo_wallets', uid));
                       const currentBal = demoDoc.exists() ? demoDoc.data().demoBalance : 10000;
                       await updateDoc(doc(db, 'demo_wallets', uid), { 
                         demoBalance: currentBal + amount,
                         updatedAt: serverTimestamp()
                       });
                     }
                  },
                  creditTreasury: async (amount) => {
                    console.log(`Treasury credited with ${amount}`);
                  },
                  callSmartContract: async (params) => {
                    console.log("Simulating Blockchain settlement...");
                  }
                });

                // Finalize trade history
                await setDoc(doc(db, 'trades', currentPosition.id), {
                  ...currentPosition,
                  uid: user.uid,
                  pnl,
                  status: "Completed",
                  timeTaken: Math.floor((Date.now() - currentPosition.startTime) / 1000),
                  createdAt: new Date().toISOString()
                });

                // Update Leaderboard
                if (mode === 'real') {
                  const leaderboardDoc = await getDoc(doc(db, 'leaderboard', user.uid));
                  const currentProfit = leaderboardDoc.exists() ? leaderboardDoc.data().totalProfit : 0;
                  const currentBalance = leaderboardDoc.exists() ? leaderboardDoc.data().totalBalance : 0;
                  
                  await setDoc(doc(db, 'leaderboard', user.uid), {
                    uid: user.uid,
                    username: user.username,
                    avatar: user.avatar,
                    totalProfit: currentProfit + pnl,
                    totalBalance: currentBalance + pnl,
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                }

                await deleteDoc(doc(db, 'trade_live_updates', currentPosition.id));
                
                setTotalPnL(prev => prev + pnl);
                
                // Lot scaling logic
                if (pnl > 0) {
                  setCurrentLotSize(prev => Math.min(prev * 1.05, 1.0));
                } else {
                  setCurrentLotSize(0.05);
                }

                setCurrentPosition(null);
              }
            }
          });

          // Check for execution latency
          if (Date.now() - startTime > 10000) {
            console.error("HFT LATENCY ERROR: Real-time execution missed threshold.");
          }
        } catch (error) {
          console.error("EXECUTION ENGINE ERROR:", error);
        }

      }, 5000); 
    } else {
      if (engineLoopRef.current) clearInterval(engineLoopRef.current);
    }

    return () => {
      if (engineLoopRef.current) clearInterval(engineLoopRef.current);
    };
  }, [isTrading, user, mode, strategy, currentPosition, currentLotSize]);

  return { marketData, currentPosition, tradesCount, totalPnL, currentLotSize };
}
