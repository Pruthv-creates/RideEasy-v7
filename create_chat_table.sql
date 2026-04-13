-- Create a table for real-time chat messages
create table if not exists ride_messages (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references rides(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table ride_messages enable row level security;

-- Policies for ride_messages
drop policy if exists "Ride participants can view messages" on ride_messages;
create policy "Ride participants can view messages"
  on ride_messages for select
  using (
    exists (
      select 1 from rides
      where rides.id = ride_messages.ride_id
      and (rides.rider_id = auth.uid() or rides.driver_id = auth.uid())
    )
  );

drop policy if exists "Ride participants can send messages" on ride_messages;
create policy "Ride participants can send messages"
  on ride_messages for insert
  with check (
    exists (
      select 1 from rides
      where rides.id = ride_messages.ride_id
      and (rides.rider_id = auth.uid() or rides.driver_id = auth.uid())
    )
    and auth.uid() = sender_id
  );

-- Enable Realtime safely
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'ride_messages'
  ) then
    alter publication supabase_realtime add table ride_messages;
  end if;
end $$;

-- Add index for performance
create index if not exists idx_ride_messages_ride_id on ride_messages(ride_id);
create index if not exists idx_ride_messages_created_at on ride_messages(created_at);
