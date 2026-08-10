-- 1. Create user_library_state table
create table if not exists user_library_state (
    user_id uuid primary key references auth.users(id) on delete cascade,
    revision bigint not null default 0,
    updated_at timestamptz not null default now()
);

-- 2. Enable RLS for the state table
alter table user_library_state enable row level security;

create policy "Users can view their own library state" on user_library_state
  for select using (auth.uid() = user_id);

-- 3. Create the increment RPC function
create or replace function increment_library_revision(p_user_id uuid)
returns bigint as $$
declare
    new_revision bigint;
begin
    insert into user_library_state (user_id, revision, updated_at)
    values (p_user_id, 1, now())
    on conflict (user_id) do update
    set revision = user_library_state.revision + 1,
        updated_at = now()
    returning revision into new_revision;
    
    return new_revision;
end;
$$ language plpgsql security definer;

-- 4. Clean up liked_songs if those columns exist
alter table liked_songs 
  drop column if exists device_id,
  drop column if exists version;

-- 5. Force schema cache reload
NOTIFY pgrst, 'reload schema';
