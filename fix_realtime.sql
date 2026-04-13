-- ============================================================
-- FIX: Enable Supabase Realtime for rides & driver_locations
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add rides table to the realtime publication safely
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'rides'
  ) then
    alter publication supabase_realtime add table rides;
  end if;
end $$;

-- 2. Add driver_locations so the rider can track the driver safely
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'driver_locations'
  ) then
    alter publication supabase_realtime add table driver_locations;
  end if;
end $$;

-- Unified read policy: riders see their rides, drivers see assigned/requested, admins see all
drop policy if exists "Rides are readable by participants and drivers" on rides;
create policy "Rides are readable by participants and drivers"
  on rides for select
  using (
    auth.uid() = rider_id
    OR auth.uid() = driver_id
    OR status = 'requested'
    OR exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 4. Drop old duplicate driver select policy if it exists
drop policy if exists "Drivers can view requested or assigned rides" on rides;

-- ============================================================
-- After running this SQL:
--   - Riders will receive real-time UPDATE events when the driver accepts
--   - The driver card, OTP, and map will all appear automatically
-- ============================================================
