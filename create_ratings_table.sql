-- Create a table for ratings
create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references rides(id) on delete cascade not null,
  reviewer_id uuid references profiles(id) not null,
  reviewee_id uuid references profiles(id) not null,
  rating integer check (rating >= 1 and rating <= 5) not null,
  feedback text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table ratings enable row level security;

-- Policies for ratings
create policy "Ratings are viewable by everyone"
  on ratings for select
  using ( true );

create policy "Users can insert their own reviews"
  on ratings for insert
  with check ( auth.uid() = reviewer_id );

-- Enable Realtime for scores/analytics
alter publication supabase_realtime add table ratings;
