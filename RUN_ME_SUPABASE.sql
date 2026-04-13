-- ==============================================
-- 🚀 THE ULTIMATE RIDE EASY DATABASE SCRIPT
-- 🛠️ One-click setup for ALL tables, RLS, and Realtime
-- ==============================================

-- 1. DEEP CLEAN PROFILES CONSTRAINTS (Ensures 'rider' role works)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Only attempt if profiles table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'profiles') THEN
        FOR r IN (
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'profiles'::regclass AND contype = 'c'
        ) LOOP
            EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
        END LOOP;
    END IF;
END $$;

-- 2. CREATE/UPDATE CORE TABLES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email text,
  full_name text,
  role text CHECK (role IN ('rider', 'driver', 'admin')) DEFAULT 'rider',
  phone_number text,
  vehicle_number text,
  daily_goal integer DEFAULT 3000,
  upi_id text,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RENAME customer_id to rider_id if exists
DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE rides RENAME COLUMN customer_id TO rider_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  driver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_lat numeric,
  dropoff_lng numeric,
  status text CHECK (status IN ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested',
  fare_amount numeric,
  payment_status text CHECK (payment_status IN ('pending', 'paid')) DEFAULT 'pending',
  otp_code text,
  cancellation_reason text,
  razorpay_payment_id text,
  razorpay_signature text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_locations (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  is_online boolean DEFAULT false,
  is_busy boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid REFERENCES rides(id) ON DELETE CASCADE UNIQUE NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_type text CHECK (plan_type IN ('free', 'silver', 'gold', 'platinum')),
  status text DEFAULT 'active',
  start_date timestamp with time zone DEFAULT now(),
  end_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid REFERENCES rides(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    address TEXT NOT NULL,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, label)
);

CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method TEXT NOT NULL,
    details JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- 4. CLEAN & RE-APPLY POLICIES (Using 'rider' terminology)
DO $$ 
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
    
    -- Rides
    DROP POLICY IF EXISTS "Riders can view their own rides" ON rides;
    DROP POLICY IF EXISTS "Riders can request rides" ON rides;
    DROP POLICY IF EXISTS "Customers can view their own rides" ON rides;
    DROP POLICY IF EXISTS "Customers can request rides" ON rides;
    DROP POLICY IF EXISTS "Drivers can view requested or assigned rides" ON rides;
    DROP POLICY IF EXISTS "Drivers can update assigned rides" ON rides;
    DROP POLICY IF EXISTS "Rides are readable by participants and drivers" ON rides;
    
    -- Messages
    DROP POLICY IF EXISTS "Participants can view ride messages" ON ride_messages;
    DROP POLICY IF EXISTS "Participants can send ride messages" ON ride_messages;
    
    -- Layouts/Tracking
    DROP POLICY IF EXISTS "Driver locations are viewable by everyone" ON driver_locations;
    DROP POLICY IF EXISTS "Drivers can update their own location" ON driver_locations;
END $$;

-- Policy Applications
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Rides are readable by participants and drivers" ON rides FOR SELECT USING (
    auth.uid() = rider_id OR auth.uid() = driver_id OR status = 'requested' 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Riders can request rides" ON rides FOR INSERT WITH CHECK (auth.uid() = rider_id);
CREATE POLICY "Drivers can update assigned rides" ON rides FOR UPDATE 
    USING (driver_id = auth.uid() OR driver_id IS NULL) 
    WITH CHECK (driver_id = auth.uid() OR driver_id IS NULL);

CREATE POLICY "Participants can view ride messages" ON ride_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM rides WHERE rides.id = ride_messages.ride_id AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid()))
);
CREATE POLICY "Participants can send ride messages" ON ride_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM rides WHERE rides.id = ride_messages.ride_id AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid()))
    AND auth.uid() = sender_id
);

CREATE POLICY "Driver locations are viewable by everyone" ON driver_locations FOR SELECT USING (true);
CREATE POLICY "Drivers can update their own location" ON driver_locations FOR ALL USING (auth.uid() = user_id);

-- 5. REALTIME SETUP
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$ 
BEGIN
  -- Add tables to realtime if not already present
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rides') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rides;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'driver_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ride_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ride_messages;
  END IF;
END $$;

-- 6. GEOLOCATION HELPER
CREATE OR REPLACE FUNCTION get_nearby_drivers(pickup_lat decimal, pickup_lng decimal)
RETURNS SETOF driver_locations AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM driver_locations
  WHERE is_online = true AND is_busy = false
  ORDER BY st_distance(
    st_point(lng, lat)::geography,
    st_point(pickup_lng, pickup_lat)::geography
  )
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. NOTIFY SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';