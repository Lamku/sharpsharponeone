/*
# TerraVault investments, plans, and yield accrual

## Overview
Adds the data layer for the Products tab: a catalog of investment plans, a table
recording each user's purchased packages (with start timestamp and accrual
state), and RPC functions that handle purchasing a plan (balance check + wallet
debit + investment record) and accruing daily yields for elapsed time.

## New Tables
1. `plans` — the 7 investment packages shown in the Products tab.
   - id (text, PK) — e.g. "plan-1", "terra-alpha"
   - name, cost, daily_yield, duration_days, total_return
   - locked (bool) — true for "Coming Soon" packages
   - sort_order (int)
2. `investments` — a user's purchased packages.
   - id (uuid, PK)
   - user_id (uuid, FK -> profiles, default auth.uid())
   - plan_id (text, FK -> plans)
   - plan_name, cost, daily_yield, duration_days, total_return
   - start_at (timestamptz, default now()) — purchase timestamp
   - end_at (timestamptz) — start + duration
   - days_elapsed (int, default 0) — how many daily yields already credited
   - active (bool, default true) — false once fully matured
   - created_at

## Modified Tables
- `transactions`: add 'yield' to the allowed `type` values so daily yields can
  be recorded as wallet credits. Done by dropping/recreating the CHECK constraint.

## RPC Functions
- `purchase_plan(p_plan_id)` — looks up the plan, rejects locked plans, checks
  wallet balance >= cost, debits the wallet via an 'investment' transaction
  (the existing trigger adjusts the balance and posts activity), inserts an
  investments row with start_at = now(), and returns a result object.
- `accrue_yields()` — for each active investment owned by the caller, computes
  how many daily yields are due based on elapsed time since start_at, credits
  them via 'yield' transactions (trigger adjusts balance + posts activity),
  advances days_elapsed, and marks the investment inactive once matured.

## Security (RLS)
- plans: public read (anon, authenticated); no client writes.
- investments: owner-scoped select (authenticated, auth.uid() = user_id).
  Inserts/updates only happen through SECURITY DEFINER RPCs.

## Notes
1. The wallet balance is never mutated directly by the frontend; the
   transaction trigger remains the single mutator.
2. Daily yields accrue based on real elapsed time (24h per yield), credited
   on demand when accrue_yields() is called (e.g. on app load).
*/

-- ========== plans ==========
CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  cost numeric(14,2) NOT NULL,
  daily_yield numeric(14,2) NOT NULL,
  duration_days int NOT NULL,
  total_return numeric(14,2) NOT NULL,
  locked boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_plans" ON plans;
CREATE POLICY "read_plans" ON plans FOR SELECT
  TO anon, authenticated USING (true);

INSERT INTO plans (id, name, cost, daily_yield, duration_days, total_return, locked, sort_order) VALUES
  ('plan-1', 'Plan 1', 5000, 1000, 90, 90000, false, 1),
  ('plan-2', 'Plan 2', 15000, 3320, 90, 298800, false, 2),
  ('plan-3', 'Plan 3', 35000, 6220, 90, 559800, false, 3),
  ('plan-4', 'Plan 4', 45000, 11200, 90, 1008000, false, 4),
  ('plan-5', 'Plan 5', 100000, 26200, 90, 2358000, false, 5),
  ('terra-alpha', 'Terra Project Alpha', 200000, 0, 90, 0, true, 6),
  ('terra-prime', 'Terra Project Prime', 400000, 0, 90, 0, true, 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cost = EXCLUDED.cost,
  daily_yield = EXCLUDED.daily_yield,
  duration_days = EXCLUDED.duration_days,
  total_return = EXCLUDED.total_return,
  locked = EXCLUDED.locked,
  sort_order = EXCLUDED.sort_order;

-- ========== add 'yield' to transactions type constraint ==========
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','withdrawal','check_in','welcome_bonus','investment','referral','yield'));

-- ========== investments ==========
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  plan_name text NOT NULL,
  cost numeric(14,2) NOT NULL,
  daily_yield numeric(14,2) NOT NULL,
  duration_days int NOT NULL,
  total_return numeric(14,2) NOT NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL,
  days_elapsed int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investments_user ON investments (user_id, created_at DESC);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_investments" ON investments;
CREATE POLICY "select_own_investments" ON investments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ========== RPC: purchase_plan ==========
CREATE OR REPLACE FUNCTION purchase_plan(p_plan_id text)
RETURNS jsonb AS $$
DECLARE
  pl record;
  bal numeric;
BEGIN
  SELECT * INTO pl FROM plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Plan not found');
  END IF;
  IF pl.locked THEN
    RETURN jsonb_build_object('success', false, 'message', 'This package is coming soon. Stay tuned!');
  END IF;

  SELECT wallet_balance INTO bal FROM profiles WHERE id = auth.uid();
  IF bal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found');
  END IF;
  IF bal < pl.cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance. Please top up via the Deposit section.');
  END IF;

  INSERT INTO transactions (user_id, type, amount, description)
    VALUES (auth.uid(), 'investment', pl.cost, 'Purchased ' || pl.name);
  INSERT INTO investments (user_id, plan_id, plan_name, cost, daily_yield, duration_days, total_return, end_at)
    VALUES (auth.uid(), pl.id, pl.name, pl.cost, pl.daily_yield, pl.duration_days, pl.total_return, now() + (pl.duration_days || ' days')::interval);

  RETURN jsonb_build_object('success', true, 'message', pl.name || ' purchased successfully! Daily yields are now active.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== RPC: accrue_yields ==========
CREATE OR REPLACE FUNCTION accrue_yields()
RETURNS jsonb AS $$
DECLARE
  inv record;
  days_due int;
  total_credited numeric := 0;
  inv_count int := 0;
BEGIN
  FOR inv IN SELECT * FROM investments WHERE user_id = auth.uid() AND active = true FOR UPDATE LOOP
    days_due := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - inv.start_at)) / 86400)::int - inv.days_elapsed);
    IF days_due > 0 THEN
      IF inv.days_elapsed + days_due >= inv.duration_days THEN
        days_due := inv.duration_days - inv.days_elapsed;
        UPDATE investments SET days_elapsed = duration_days, active = false WHERE id = inv.id;
      ELSE
        UPDATE investments SET days_elapsed = days_elapsed + days_due WHERE id = inv.id;
      END IF;
      IF days_due > 0 THEN
        INSERT INTO transactions (user_id, type, amount, description)
          VALUES (auth.uid(), 'yield', inv.daily_yield * days_due, 'Daily yield for ' || inv.plan_name);
        total_credited := total_credited + inv.daily_yield * days_due;
        inv_count := inv_count + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'credited', total_credited, 'count', inv_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION purchase_plan(text) TO authenticated;
GRANT EXECUTE ON FUNCTION accrue_yields() TO authenticated;
