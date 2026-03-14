-- ==============================================
-- 🚀 DRIVER SUBSCRIPTIONS SYSTEM
-- ==============================================

-- 1. Create Driver Plans Table
CREATE TABLE IF NOT EXISTS driver_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    plan_name TEXT CHECK (plan_name IN ('Daily Pass', 'Weekly Pro', 'Monthly Elite')),
    price NUMERIC NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE driver_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "Drivers can view their own subscriptions" 
ON driver_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Drivers can insert subscriptions" 
ON driver_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Helper Function to check if driver is subscribed
CREATE OR REPLACE FUNCTION is_driver_subscribed(driver_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM driver_subscriptions 
        WHERE user_id = driver_uuid 
        AND status = 'active' 
        AND end_date > NOW()
    );
END;
$$ LANGUAGE plpgsql;
