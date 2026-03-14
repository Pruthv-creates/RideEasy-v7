-- ==============================================
-- 🚀 RIDE EASY FULL DATABASE UPDATE SCRIPT (SUBSCRIPTIONS FIX)
-- Copy ALL of this script and run it in the Supabase SQL Editor
-- ==============================================

-- 1. FIX THE RIDES STATUS CONSTRAINT
DO $$ 
BEGIN 
    ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
    ALTER TABLE rides ADD CONSTRAINT rides_status_check 
        CHECK (status IN ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'));
EXCEPTION
    WHEN others THEN 
        RAISE NOTICE 'Could not update constraint automatically.';
END $$;

-- 2. DRIVER LOCATIONS TABLE
create table if not exists driver_locations (
  user_id uuid references profiles(id) primary key,
  lat numeric not null,
  lng numeric not null,
  is_online boolean default true,
  is_busy boolean default false,
  updated_at timestamp with time zone default now()
);

alter table driver_locations enable row level security;
DO $$
BEGIN
    DROP POLICY IF EXISTS "Driver locations are viewable by everyone" ON driver_locations;
    DROP POLICY IF EXISTS "Drivers can update their own location" ON driver_locations;
    DROP POLICY IF EXISTS "Drivers can update their own location update" ON driver_locations;
END $$;
create policy "Driver locations are viewable by everyone" on driver_locations for select using ( true );
create policy "Drivers can update their own location" on driver_locations for insert with check ( auth.uid() = user_id );
create policy "Drivers can update their own location update" on driver_locations for update using ( auth.uid() = user_id );

-- 3. RATINGS TABLE
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'ratings') THEN
        DROP TABLE ratings CASCADE;
    END IF;
END $$;

create table ratings (
    id uuid default gen_random_uuid() primary key,
    ride_id uuid references rides(id) unique not null,
    reviewer_id uuid references profiles(id) not null,
    reviewee_id uuid references profiles(id) not null,
    rating integer check (rating >= 1 and rating <= 5) not null,
    feedback text,
    created_at timestamp with time zone default now()
);

alter table ratings enable row level security;
create policy "Everyone can insert ratings" on ratings for insert with check (true);
create policy "Everyone can view ratings" on ratings for select using (true);

-- 4. SUBSCRIPTIONS TABLE & POLICIES
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  plan_type text check (plan_type in ('free', 'silver', 'gold', 'platinum')),
  status text default 'active',
  start_date timestamp with time zone default now(),
  end_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table subscriptions enable row level security;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "Users can view their own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "Users can insert their own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "Users can update their own subscription" ON subscriptions;
END $$;

-- Broad policy for simplicity in dev, more specific in prod
create policy "Users can view their own subscription" on subscriptions for select using ( auth.uid() = user_id );
create policy "Users can insert their own subscription" on subscriptions for insert with check ( auth.uid() = user_id );
create policy "Users can update their own subscription" on subscriptions for update using ( auth.uid() = user_id );

-- 5. RELOAD
NOTIFY pgrst, 'reload schema';