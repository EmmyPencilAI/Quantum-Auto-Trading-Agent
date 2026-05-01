-- ============================================================
-- QUANTUM TRADING ENGINE - Migration: v2
-- Run this in Supabase SQL Editor BEFORE deploying
-- ============================================================

-- 1. Add exit_price column to trades table (used for expandable trade details)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_price NUMERIC;

-- 2. Add updated_at column to trades table (used by settleTrade service)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Create profit_queue table (used by auto profit claiming in real mode)
CREATE TABLE IF NOT EXISTS profit_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT NOT NULL, -- No FK to avoid type mismatch; uid is user's identifier
    amount NUMERIC NOT NULL,
    token TEXT NOT NULL DEFAULT 'USDT',
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'claimed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS for profit_queue
ALTER TABLE profit_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on profit_queue" ON profit_queue;
CREATE POLICY "Allow all on profit_queue" ON profit_queue FOR ALL USING (true);

-- ============================================================
-- VERIFY: Run this after migration to confirm columns exist
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'trades';
-- ============================================================
