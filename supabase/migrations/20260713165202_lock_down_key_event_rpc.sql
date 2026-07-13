-- Force all authenticated key event writes through the validated RPC.

alter function public.record_key_event(
  uuid,
  public.key_event_type,
  text,
  text,
  text,
  text,
  text,
  text
) security definer;

drop policy if exists key_events_insert on public.key_events;
revoke insert on public.key_events from authenticated;
