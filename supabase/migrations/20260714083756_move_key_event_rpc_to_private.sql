-- Keep the privileged transaction outside the exposed public schema.
-- SECURITY DEFINER is required because authenticated operational users may
-- insert a validated key event and update its slot atomically, but must not
-- receive direct INSERT/UPDATE privileges that would bypass this validation.

alter function public.record_key_event(
  uuid,
  public.key_event_type,
  text,
  text,
  text,
  text,
  text,
  text
) set schema private;

revoke all on function private.record_key_event(
  uuid,
  public.key_event_type,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

create function public.record_key_event(
  p_key_slot_id uuid,
  p_event_type public.key_event_type,
  p_mission text,
  p_destination text,
  p_notes text,
  p_signature_path text,
  p_signature_sha256 text,
  p_client_event_id text
)
returns public.key_events
language sql
security invoker
set search_path = ''
as $$
  select private.record_key_event(
    p_key_slot_id,
    p_event_type,
    p_mission,
    p_destination,
    p_notes,
    p_signature_path,
    p_signature_sha256,
    p_client_event_id
  );
$$;

revoke all on function public.record_key_event(
  uuid,
  public.key_event_type,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.record_key_event(
  uuid,
  public.key_event_type,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
grant execute on function public.record_key_event(
  uuid,
  public.key_event_type,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
