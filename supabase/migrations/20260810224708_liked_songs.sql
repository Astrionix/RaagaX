create table if not exists liked_songs (
    user_id uuid not null references auth.users(id) on delete cascade,
    song_id text not null,
    liked_at timestamptz not null default now(),
    device_id text,
    version bigint not null default 1,

    primary key (user_id, song_id)
);

-- Enable RLS
alter table liked_songs enable row level security;

-- Policies
create policy "Users can view their own liked songs" on liked_songs
  for select using (auth.uid() = user_id);

create policy "Users can insert their own liked songs" on liked_songs
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own liked songs" on liked_songs
  for update using (auth.uid() = user_id);

create policy "Users can delete their own liked songs" on liked_songs
  for delete using (auth.uid() = user_id);
