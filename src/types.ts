export type TradingMode = "Aggressive" | "Momentum" | "Scalping" | "Conservative";
export type ModeType = "demo" | "real";

export interface User {
  uid: string;
  walletAddress: string;
  username: string;
  avatar: string;
  createdAt: string;
}

export interface Trade {
  tradeId: string;
  uid: string;
  pair: string;
  modeType: ModeType;
  tradeMode: TradingMode;
  amount: number;
  pnl: number;
  status: string;
  timeTaken: number;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
}

export interface LiveTradeUpdate {
  updateId: string;
  uid: string;
  pair: string;
  modeType: ModeType;
  tradeMode: TradingMode;
  amount: number;
  floatingPnl: number;
  status: string;
  startedAt: string;
  updatedAt: string;
}

export interface DemoWallet {
  uid: string;
  demoBalance: number;
  updatedAt: string;
}

export interface Post {
  postId: string;
  uid: string;
  content: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  username?: string;
  avatar?: string;
}

export interface Comment {
  commentId: string;
  postId: string;
  uid: string;
  content: string;
  createdAt: string;
  username?: string;
  avatar?: string;
}

export interface LeaderboardEntry {
  uid: string;
  username: string;
  avatar: string;
  totalBalance: number;
  totalProfit: number;
  updatedAt: string;
}
