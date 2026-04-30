export type TradingMode = "Aggressive" | "Momentum" | "Scalping" | "Conservative";
export type ModeType = "demo" | "real";

export interface User {
  uid: string;
  wallet_address: string;
  username: string;
  avatar: string;
  created_at: string;
  trade_volume?: number; // Total volume for ranking
  followers?: string[]; // UIDs of followers
  following?: string[]; // UIDs of following
  location?: any;
  is_verified?: boolean;
  verification_code?: string;
  is_trading?: boolean;
  active_trade_amount?: number;
  active_strategy?: TradingMode;
  active_mode?: ModeType;
  trade_start_time?: string;
}

export interface Trade {
  id: string; // From trades.id
  uid: string;
  type: string;
  pair: string;
  trade_mode: TradingMode;
  entry_price: number;
  exit_price?: number;
  size: number;
  pnl: number;
  mode_type: ModeType;
  status: string;
  time_taken?: number;
  created_at: string;
}

export interface LiveTradeUpdate {
  id: string;
  uid: string;
  pair: string;
  mode_type: ModeType;
  trade_mode: TradingMode;
  amount: number;
  floating_pnl: number;
  status: string;
  started_at: string;
  updated_at: string;
}

export interface DemoWallet {
  id: string;
  demo_balance: number;
  updated_at: string;
}

export interface Post {
  id: string; // From posts.id
  uid: string;
  content: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by?: string[]; // UIDs of users who liked
  username?: string;
  avatar?: string;
  trade_volume?: number;
}

export interface Comment {
  id: string; // From comments.id
  post_id: string;
  uid: string;
  content: string;
  created_at: string;
  username?: string;
  avatar?: string;
}

export interface LeaderboardEntry {
  uid: string;
  username: string;
  avatar: string;
  total_balance: number;
  total_profit: number;
  updated_at: string;
}
