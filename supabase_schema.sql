
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    username TEXT,
    avatar TEXT,
    trade_volume NUMERIC DEFAULT 0,
    followers TEXT[] DEFAULT '{}',
    following TEXT[] DEFAULT '{}',
    location JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Demo Wallets Table
CREATE TABLE IF NOT EXISTS demo_wallets (
    id TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    demo_balance NUMERIC DEFAULT 10000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Posts Table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT REFERENCES users(uid) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    liked_by TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    uid TEXT REFERENCES users(uid) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trades Table
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    uid TEXT REFERENCES users(uid) ON DELETE CASCADE,
    type TEXT NOT NULL,
    pair TEXT,
    trade_mode TEXT,
    entry_price NUMERIC NOT NULL,
    size NUMERIC NOT NULL,
    pnl NUMERIC NOT NULL,
    mode_type TEXT NOT NULL, -- 'demo' or 'real'
    status TEXT NOT NULL,
    time_taken INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard Table
CREATE TABLE IF NOT EXISTS leaderboard (
    uid TEXT REFERENCES users(uid) ON DELETE CASCADE,
    username TEXT,
    avatar TEXT,
    total_profit NUMERIC DEFAULT 0,
    total_balance NUMERIC DEFAULT 0,
    mode_type TEXT NOT NULL DEFAULT 'real', -- 'demo' or 'real'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (uid, mode_type)
);

-- RLS Policies (example - strictly simplified for now)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on users" ON users;
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true);

ALTER TABLE demo_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on demo_wallets" ON demo_wallets;
CREATE POLICY "Allow all on demo_wallets" ON demo_wallets FOR ALL USING (true);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on posts" ON posts;
CREATE POLICY "Allow all on posts" ON posts FOR ALL USING (true);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on comments" ON comments;
CREATE POLICY "Allow all on comments" ON comments FOR ALL USING (true);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on trades" ON trades;
CREATE POLICY "Allow all on trades" ON trades FOR ALL USING (true);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on leaderboard" ON leaderboard;
CREATE POLICY "Allow all on leaderboard" ON leaderboard FOR ALL USING (true);
