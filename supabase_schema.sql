-- Create a table for public user profiles
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('rider', 'driver', 'admin')) default 'rider',
  phone_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;

-- Create policies for profiles
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Create a table for rides
create table if not exists rides (
  id uuid default gen_random_uuid() primary key,
  rider_id uuid references profiles(id) on delete cascade not null,
  driver_id uuid references profiles(id) on delete set null,
  pickup_address text not null,
  dropoff_address text not null,
  status text check (status in ('requested', 'accepted', 'in_progress', 'completed', 'cancelled')) default 'requested',
  fare_amount numeric,
  payment_status text check (payment_status in ('pending', 'paid')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_lat numeric,
  dropoff_lng numeric
);

-- Enable RLS for rides
alter table rides enable row level security;

-- Policies for rides
-- 1. Riders can see their own rides
drop policy if exists "Riders can view their own rides" on rides;
create policy "Riders can view their own rides"
  on rides for select
  using ( auth.uid() = rider_id );

-- 2. Drivers can see available requested rides AND rides they accepted
drop policy if exists "Drivers can view requested or assigned rides" on rides;
create policy "Drivers can view requested or assigned rides"
  on rides for select
  using ( 
    (status = 'requested') OR 
    (driver_id = auth.uid()) OR
    (auth.uid() in (select id from profiles where role = 'admin'))
  );

-- 3. Riders can insert (request) rides
drop policy if exists "Riders can request rides" on rides;
create policy "Riders can request rides"
  on rides for insert
  with check ( auth.uid() = rider_id );

-- 4. Drivers can update rides (accept, complete)
drop policy if exists "Drivers can update assigned rides" on rides;
create policy "Drivers can update assigned rides"
  on rides for update
  using ( driver_id = auth.uid() OR driver_id is null ) 
  with check ( driver_id = auth.uid() OR driver_id is null );

-- Trigger to handle new user signup and automatically create a profile
-- (This is optional but recommended. Alternatively, we can insert into profiles manually on client)
-- For this simple implementation, we will handle profile insertion on the Client Side after signUp.
