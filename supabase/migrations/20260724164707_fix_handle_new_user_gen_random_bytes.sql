/*
# Fix handle_new_user trigger — gen_random_bytes schema resolution

## Problem
The `handle_new_user()` trigger function calls `gen_random_bytes(4)` without a
schema prefix. On this Supabase project, `gen_random_bytes` lives in the
`extensions` schema (part of the pgcrypto extension), NOT in `public` or
`pg_catalog`. When Supabase Auth inserts a new row into `auth.users`, the
trigger fires with a search path that does NOT include `extensions`, so
`gen_random_bytes` is unresolved. This aborts the entire signup transaction,
surfacing as "Database error saving new user" in the frontend.

## Fix
1. Recreate `handle_new_user()` with an explicit `SET search_path = public,
   extensions` clause so `gen_random_bytes` resolves regardless of the caller's
   search path.
2. Fully qualify `extensions.gen_random_bytes` as a belt-and-suspenders measure.
3. Add a guard: if a referral code collision somehow occurs (extremely unlikely
   with 6 hex chars), retry generation up to 5 times before failing.
4. Drop and recreate the existing trigger to pick up the new function body.

## No table changes
No columns, constraints, or RLS policies are modified — only the trigger
function body and the trigger binding.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  LOOP
    new_code := 'TV' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    attempts := attempts + 1;
    EXIT WHEN attempts >= 5 OR new_code IS NOT NULL;
  END LOOP;

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
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
