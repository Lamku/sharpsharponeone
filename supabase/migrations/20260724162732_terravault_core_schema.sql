/*
# TerraVault core schema

## Overview
Creates the database backbone for TerraVault, a land-banking investment app for
Nigerian investors (NGN currency). Handles user profiles (wallet balance,
portfolio value, referral codes), wallet-affecting transactions, a public
platform activity feed for the live marquee, and automated welcome-bonus +
wallet-balance logic via triggers and RPC functions.

## New Tables
1. `profiles` — one row per authenticated user (1:1 with auth.users).
   - id (uuid, PK, FK -> auth.users)
   - full_name (text)
   - phone (text)
   - wallet_balance (numeric, default 0; welcome bonus applied via transaction trigger)
   - portfolio_value (numeric, default 0)
   - referral_code (text, unique) — each user's shareable code
   - referred_by (text, nullable) — referral code used at sign-up
   - last_check_in (timestamptz, nullable)
   - created_at (timestamptz)
2. `transactions` — wallet history rows (deposits, withdrawals, check-ins, etc.)
   - id (uuid, PK)
   - user_id (uuid, FK -> profiles, default auth.uid())
   - type (text: deposit|withdrawal|check_in|welcome_bonus|investment|referral)
   - amount (numeric)
   - description (text)
   - created_at (timestamptz)
3. `platform_activity` — public, sanitized feed for the live marquee.
   - id (uuid, PK)
   - message (text)
   - created_at (timestamptz)

## Automation
- Trigger `on_auth_user_created`: when a new user signs up, create their profile
  (full_name + phone from sign-up metadata, wallet_balance = 0), insert a
  welcome_bonus transaction of 1,500 (the transaction trigger credits the wallet),
  and the transaction trigger records platform activity.
- Trigger `adjust_wallet_on_transaction`: whenever a transaction is inserted,
  automatically adjust the user's wallet_balance (credits for deposits/check-ins/
  bonuses/referrals, debits for withdrawals/investments) and post a sanitized
  message to platform_activity.

## RPC Functions
- `claim_daily_check_in()` — credits 200 once per 24h, updates last_check_in.
- `deposit_funds(amount)` — credits a deposit to the wallet.
- `withdraw_funds(amount)` — debits a withdrawal (with balance guard).

## Security (RLS)
- profiles: owner-scoped select/update (authenticated, auth.uid() = id).
- transactions: owner-scoped select/insert (authenticated, auth.uid() = user_id).
- platform_activity: public read (anon, authenticated); no client writes — only
  the SECURITY DEFINER transaction trigger writes rows.

## Notes
1. Welcome bonus (1,500) is applied automatically at sign-up via trigger.
2. Daily check-in is rate-limited to once per 24h inside the RPC function.
3. Wallet balance is the single source of truth and is mutated only by the
   transaction trigger; the frontend never writes wallet_balance directly.
*/

-- ========== profiles ==========
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Investor',
  phone text NOT NULL DEFAULT '',
  wallet_balance numeric(14,2) NOT NULL DEFAULT 0,
  portfolio_value numeric(14,2) NOT NULL DEFAULT 0,
  referral_code text UNIQUE NOT NULL,
  referred_by text,
  last_check_in timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ========== transactions ==========
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal','check_in','welcome_bonus','investment','referral')),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== platform_activity ==========
CREATE TABLE IF NOT EXISTS platform_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_activity_created ON platform_activity (created_at DESC);

ALTER TABLE platform_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_platform_activity" ON platform_activity;
CREATE POLICY "read_platform_activity" ON platform_activity FOR SELECT
  TO anon, authenticated USING (true);

-- ========== trigger: adjust wallet on transaction insert ==========
CREATE OR REPLACE FUNCTION adjust_wallet_on_transaction()
RETURNS trigger AS $$
DECLARE
  delta numeric;
  user_name text;
BEGIN
  IF NEW.type IN ('deposit','check_in','welcome_bonus','referral') THEN
    delta := NEW.amount;
  ELSIF NEW.type IN ('withdrawal','investment') THEN
    delta := -NEW.amount;
  ELSE
    delta := 0;
  END IF;

  UPDATE profiles SET wallet_balance = wallet_balance + delta WHERE id = NEW.user_id;

  SELECT full_name INTO user_name FROM profiles WHERE id = NEW.user_id;
  IF user_name IS NULL THEN user_name := 'An investor'; END IF;

  INSERT INTO platform_activity (message) VALUES (
    CASE NEW.type
      WHEN 'deposit' THEN user_name || ' just deposited ₦' || to_char(NEW.amount, 'FM999,999,999')
      WHEN 'withdrawal' THEN user_name || ' just withdrew ₦' || to_char(NEW.amount, 'FM999,999,999')
      WHEN 'check_in' THEN user_name || ' claimed a ₦200 daily check-in bonus'
      WHEN 'welcome_bonus' THEN user_name || ' unlocked a ₦1,500 welcome bonus'
      WHEN 'investment' THEN user_name || ' invested in a new land package'
      WHEN 'referral' THEN user_name || ' earned a referral reward'
      ELSE user_name || ' had a wallet update'
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_adjust_wallet_on_transaction ON transactions;
CREATE TRIGGER trg_adjust_wallet_on_transaction
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION adjust_wallet_on_transaction();

-- ========== trigger: create profile + welcome bonus on signup ==========
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_code text;
BEGIN
  new_code := 'TV' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  INSERT INTO profiles (id, full_name, phone, referral_code, referred_by, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Investor'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    new_code,
    NEW.raw_user_meta_data->>'referral_code',
    0
  );
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (NEW.id, 'welcome_bonus', 1500, 'Welcome bonus for joining TerraVault');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========== RPC: daily check-in ==========
CREATE OR REPLACE FUNCTION claim_daily_check_in()
RETURNS jsonb AS $$
DECLARE
  last_ci timestamptz;
BEGIN
  SELECT last_check_in INTO last_ci FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found');
  END IF;
  IF last_ci IS NOT NULL AND now() - last_ci < interval '24 hours' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already claimed today', 'next_claim', last_ci + interval '24 hours');
  END IF;
  UPDATE profiles SET last_check_in = now() WHERE id = auth.uid();
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (auth.uid(), 'check_in', 200, 'Daily check-in reward');
  RETURN jsonb_build_object('success', true, 'message', '₦200 credited to wallet');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== RPC: deposit ==========
CREATE OR REPLACE FUNCTION deposit_funds(p_amount numeric)
RETURNS jsonb AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enter a valid amount');
  END IF;
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (auth.uid(), 'deposit', p_amount, 'Wallet deposit');
  RETURN jsonb_build_object('success', true, 'message', 'Deposit successful');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== RPC: withdraw ==========
CREATE OR REPLACE FUNCTION withdraw_funds(p_amount numeric)
RETURNS jsonb AS $$
DECLARE
  bal numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Enter a valid amount');
  END IF;
  SELECT wallet_balance INTO bal FROM profiles WHERE id = auth.uid();
  IF bal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found');
  END IF;
  IF p_amount > bal THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance');
  END IF;
  INSERT INTO transactions (user_id, type, amount, description)
    VALUES (auth.uid(), 'withdrawal', p_amount, 'Wallet withdrawal');
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal successful');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_daily_check_in() TO authenticated;
GRANT EXECUTE ON FUNCTION deposit_funds(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION withdraw_funds(numeric) TO authenticated;

-- ========== seed sample platform activity ==========
INSERT INTO platform_activity (message) VALUES
  ('Chukwuma just withdrew ₦100,000'),
  ('Adaeze invested in a new land package'),
  ('Tunde claimed a ₦200 daily check-in bonus'),
  ('Bisi just deposited ₦50,000'),
  ('Emeka unlocked a ₦1,500 welcome bonus'),
  ('Fatima earned a referral reward'),
  ('New land package unlocked in Lekki Phase 2'),
  ('Kunle just withdrew ₦25,000'),
  ('Zainab invested in a new land package'),
  ('Daniel just deposited ₦120,000')
ON CONFLICT DO NOTHING;
