create table if not exists public.duty_rosters (
  id uuid primary key default gen_random_uuid(),
  duty_date date not null unique,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.duty_rosters enable row level security;

grant select, insert, update, delete on public.duty_rosters to authenticated;

create policy "duty_rosters_read"
on public.duty_rosters
for select
to authenticated
using (true);

create policy "duty_rosters_master_insert"
on public.duty_rosters
for insert
to authenticated
with check (
  private.has_role(array['master_admin'::app_role])
  and created_by = (select auth.uid())
);

create policy "duty_rosters_master_update"
on public.duty_rosters
for update
to authenticated
using (private.has_role(array['master_admin'::app_role]))
with check (private.has_role(array['master_admin'::app_role]));

create policy "duty_rosters_master_delete"
on public.duty_rosters
for delete
to authenticated
using (private.has_role(array['master_admin'::app_role]));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duty_rosters'
  ) then
    alter publication supabase_realtime add table public.duty_rosters;
  end if;
end
$$;
