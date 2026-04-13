-- ============================================================
-- FIX: Enable Supabase Realtime for rides & driver_locations
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add rides table to the realtime publication
--    Without this, postgres_changes subscriptions on 'rides' receive NOTHING.
alter publication supabase_realtime add table rides;

-- 2. Add driver_locations so the rider can track the driver
alter publication supabase_realtime add table driver_locations;

-- 3. Fix RLS so the realtime change is visible to BOTH customer and driver
--    The existing policy only allowed customers to see their OWN rides,
--    but the driver (who just accepted) also needs Realtime access to that row.
--    Drop old overlapping policies and add a clean combined one:

-- Drop old customer select policy (replace with combined one below)
drop policy if exists "Customers can view their own rides" on rides;

-- Unified read policy: customers see their rides, drivers see assigned/requested, admins see all
create policy "Rides are readable by participants and drivers"
  on rides for select
  using (
    auth.uid() = customer_id
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
