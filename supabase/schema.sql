create table if not exists public.scoretap_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique,
  display_name text not null,
  recovery_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scoretap_cloud_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  teams jsonb not null default '[]'::jsonb,
  games jsonb not null default '[]'::jsonb,
  current_game jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_scoretap_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scoretap_profiles_updated_at on public.scoretap_profiles;
create trigger scoretap_profiles_updated_at
before update on public.scoretap_profiles
for each row execute function public.set_scoretap_updated_at();

drop trigger if exists scoretap_cloud_state_updated_at on public.scoretap_cloud_state;
create trigger scoretap_cloud_state_updated_at
before update on public.scoretap_cloud_state
for each row execute function public.set_scoretap_updated_at();

alter table public.scoretap_profiles enable row level security;
alter table public.scoretap_cloud_state enable row level security;

drop policy if exists "scoretap profiles select own" on public.scoretap_profiles;
create policy "scoretap profiles select own"
on public.scoretap_profiles for select
using (auth.uid() = id);

drop policy if exists "scoretap profiles insert own" on public.scoretap_profiles;
create policy "scoretap profiles insert own"
on public.scoretap_profiles for insert
with check (auth.uid() = id);

drop policy if exists "scoretap profiles update own" on public.scoretap_profiles;
create policy "scoretap profiles update own"
on public.scoretap_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "scoretap cloud state select own" on public.scoretap_cloud_state;
create policy "scoretap cloud state select own"
on public.scoretap_cloud_state for select
using (auth.uid() = user_id);

drop policy if exists "scoretap cloud state insert own" on public.scoretap_cloud_state;
create policy "scoretap cloud state insert own"
on public.scoretap_cloud_state for insert
with check (auth.uid() = user_id);

drop policy if exists "scoretap cloud state update own" on public.scoretap_cloud_state;
create policy "scoretap cloud state update own"
on public.scoretap_cloud_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
