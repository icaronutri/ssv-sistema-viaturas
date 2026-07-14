-- The RLS policies already enforce master_admin. Keep RPCs invoker-scoped so
-- they cannot bypass any future row-level restriction.
alter function public.master_update_profile(uuid,public.approval_status,public.app_role) security invoker;
alter function public.master_set_duty_roster(date,uuid) security invoker;
