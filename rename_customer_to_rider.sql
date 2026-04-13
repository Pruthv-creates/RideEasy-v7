-- ==============================================
-- 🔄 RENAME 'customer' ROLE TO 'rider'
-- ==============================================

-- 1. Update profiles data first
UPDATE profiles SET role = 'rider' WHERE role = 'customer';

-- 2. Robustly drop ALL existing check constraints on profiles table
-- (This prevents errors if multiple constraints exist from previous runs)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'profiles'::regclass AND contype = 'c'
    ) LOOP
        EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Add the new clean role constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('rider', 'driver', 'admin'));

ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'rider';

-- 2. Update rides table
ALTER TABLE rides RENAME COLUMN customer_id TO rider_id;

-- 3. Update subscriptions table
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
-- (Assuming plan_type was related, but it was just free/silver/gold/platinum)

-- 4. Update Policies (Replace 'customer' with 'rider' in policy logic)
-- This is handled by re-running the schema files or applying targeted updates.

-- 5. Notify pgrst
NOTIFY pgrst, 'reload schema';
