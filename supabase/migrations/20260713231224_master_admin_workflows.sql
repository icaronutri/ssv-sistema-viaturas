-- Block 2: master-admin-only profile approvals and duty roster management.

drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_master_update on public.profiles;
create policy profiles_master_update
on public.profiles for update to authenticated
using (private.has_role(array['master_admin'::public.app_role]))
with check (private.has_role(array['master_admin'::public.app_role]));

create or replace function public.master_update_profile(
  p_profile_id uuid,
  p_status public.approval_status,
  p_role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  other_masters integer;
begin
  if auth.uid() is null or not private.has_role(array['master_admin'::public.app_role]) then
    raise exception using errcode='42501', message='master_admin_required';
  end if;
  select * into target_profile from public.profiles where id=p_profile_id for update;
  if not found then raise exception using errcode='P0002', message='profile_not_found'; end if;

  if target_profile.role='master_admin'::public.app_role
     and target_profile.status='approved'::public.approval_status
     and (p_role<>'master_admin'::public.app_role or p_status<>'approved'::public.approval_status) then
    select count(*) into other_masters from public.profiles
    where id<>p_profile_id and role='master_admin'::public.app_role and status='approved'::public.approval_status;
    if other_masters=0 then raise exception using errcode='23514', message='cannot_block_last_master_admin'; end if;
  end if;

  update public.profiles set
    role=p_role,
    status=p_status,
    approved_by=case when p_status='approved'::public.approval_status then auth.uid() else null end,
    approved_at=case when p_status='approved'::public.approval_status then now() else null end,
    updated_at=now()
  where id=p_profile_id returning * into updated_profile;
  return updated_profile;
end;
$$;
revoke all on function public.master_update_profile(uuid,public.approval_status,public.app_role) from public,anon;
grant execute on function public.master_update_profile(uuid,public.approval_status,public.app_role) to authenticated;

create or replace function public.master_set_duty_roster(p_duty_date date,p_profile_id uuid)
returns public.duty_rosters
language plpgsql
security definer
set search_path=''
as $$
declare saved public.duty_rosters%rowtype;
begin
  if auth.uid() is null or not private.has_role(array['master_admin'::public.app_role]) then
    raise exception using errcode='42501', message='master_admin_required';
  end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and status='approved'::public.approval_status and role in ('duty_sergeant'::public.app_role,'admin'::public.app_role,'master_admin'::public.app_role)) then
    raise exception using errcode='23514', message='invalid_roster_profile';
  end if;
  insert into public.duty_rosters(duty_date,profile_id,created_by,updated_at)
  values(p_duty_date,p_profile_id,auth.uid(),now())
  on conflict(duty_date) do update set profile_id=excluded.profile_id,created_by=auth.uid(),updated_at=now()
  returning * into saved;
  return saved;
end;
$$;
revoke all on function public.master_set_duty_roster(date,uuid) from public,anon;
grant execute on function public.master_set_duty_roster(date,uuid) to authenticated;
