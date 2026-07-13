-- Block 1: profile integrity, signature validation and atomic key events.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_registration text := coalesce(new.raw_user_meta_data ->> 'registration_type', '');
  requested_role public.app_role := 'driver'::public.app_role;
  requested_sector_id uuid;
  requested_full_name text;
begin
  -- Metadata only describes the pending request. It never grants approved
  -- access; approval remains an explicit administrative action.
  if requested_registration = 'duty_sergeant_pre_registration' then
    requested_role := 'duty_sergeant'::public.app_role;
  end if;

  select sector.id
    into requested_sector_id
  from public.sectors as sector
  where sector.active
    and upper(sector.name) = upper(btrim(new.raw_user_meta_data ->> 'sector'))
  order by sector.created_at
  limit 1;

  requested_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Usuario'
  );

  insert into public.profiles (
    id,
    full_name,
    rank,
    military_id,
    sector_id,
    role,
    status
  )
  values (
    new.id,
    requested_full_name,
    nullif(btrim(new.raw_user_meta_data ->> 'rank'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'military_id'), ''),
    requested_sector_id,
    requested_role,
    'pending'::public.approval_status
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Profile creation is now exclusively owned by the auth trigger.
drop policy if exists profiles_self_insert on public.profiles;

-- Keep historical QA evidence but reject this application's known empty
-- 700x220 WebP canvas hash, as well as malformed hashes, on every new row.
alter table public.key_events
  drop constraint if exists key_events_signature_sha256_format;
alter table public.key_events
  add constraint key_events_signature_sha256_format
  check (signature_sha256 ~ '^[0-9a-f]{64}$') not valid;

alter table public.key_events
  drop constraint if exists key_events_signature_not_blank;
alter table public.key_events
  add constraint key_events_signature_not_blank
  check (signature_sha256 <> '548636c0a6f7482af284e3e27efa96f0c5a59def1e32043c237165de3a513722') not valid;

alter table public.key_events
  drop constraint if exists key_events_signature_path_key;
alter table public.key_events
  add constraint key_events_signature_path_key unique (signature_path);

create or replace function private.sync_key_slot_from_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_status public.key_slot_status;
  next_status public.key_slot_status;
begin
  if new.event_type not in (
    'checkout'::public.key_event_type,
    'return'::public.key_event_type
  ) then
    return new;
  end if;

  select slot.status
    into current_status
  from public.key_slots as slot
  where slot.id = new.key_slot_id
    and slot.active
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'key_slot_not_found';
  end if;

  if new.event_type = 'checkout'::public.key_event_type then
    if current_status <> 'available'::public.key_slot_status then
      raise exception using
        errcode = 'P0001',
        message = 'key_slot_not_available';
    end if;
    next_status := 'checked_out'::public.key_slot_status;
  else
    if current_status <> 'checked_out'::public.key_slot_status then
      raise exception using
        errcode = 'P0001',
        message = 'key_slot_not_checked_out';
    end if;
    next_status := 'available'::public.key_slot_status;
  end if;

  update public.key_slots
  set status = next_status
  where id = new.key_slot_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'key_slot_update_failed';
  end if;

  return new;
end;
$$;

revoke all on function private.sync_key_slot_from_event() from public, anon, authenticated;

drop trigger if exists key_events_sync_slot on public.key_events;
create trigger key_events_sync_slot
  before insert on public.key_events
  for each row execute function private.sync_key_slot_from_event();

create or replace function public.record_key_event(
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
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.profiles%rowtype;
  recorded_event public.key_events%rowtype;
  signature_size bigint;
  signature_mimetype text;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not private.has_role(array[
    'duty_sergeant'::public.app_role,
    'admin'::public.app_role,
    'master_admin'::public.app_role
  ]) then
    raise exception using errcode = '42501', message = 'key_event_not_authorized';
  end if;

  if p_event_type not in (
    'checkout'::public.key_event_type,
    'return'::public.key_event_type
  ) then
    raise exception using errcode = '22023', message = 'invalid_key_event_type';
  end if;

  if nullif(btrim(p_mission), '') is null then
    raise exception using errcode = '22023', message = 'mission_required';
  end if;

  if nullif(btrim(p_client_event_id), '') is null then
    raise exception using errcode = '22023', message = 'client_event_id_required';
  end if;

  if p_signature_path not like current_user_id::text || '/%' then
    raise exception using errcode = '22023', message = 'invalid_signature_path';
  end if;

  if p_signature_sha256 !~ '^[0-9a-f]{64}$'
    or p_signature_sha256 = '548636c0a6f7482af284e3e27efa96f0c5a59def1e32043c237165de3a513722'
  then
    raise exception using errcode = '22023', message = 'invalid_signature';
  end if;

  select
    (object.metadata ->> 'size')::bigint,
    object.metadata ->> 'mimetype'
    into signature_size, signature_mimetype
    from storage.objects as object
    where object.bucket_id = 'key-signatures'
      and object.name = p_signature_path;

  if not found then
    raise exception using errcode = '22023', message = 'signature_not_found';
  end if;

  if signature_size < 600 or signature_mimetype <> 'image/webp' then
    raise exception using errcode = '22023', message = 'invalid_signature';
  end if;

  select profile.*
    into current_profile
  from public.profiles as profile
  where profile.id = current_user_id
    and profile.status = 'approved'::public.approval_status;

  if not found then
    raise exception using errcode = '42501', message = 'approved_profile_required';
  end if;

  -- Idempotent retry: return a successfully recorded client event.
  select event.*
    into recorded_event
  from public.key_events as event
  where event.client_event_id = p_client_event_id
    and event.holder_user_id = current_user_id;

  if found then
    return recorded_event;
  end if;

  insert into public.key_events (
    key_slot_id,
    event_type,
    holder_user_id,
    holder_name,
    holder_rank,
    holder_military_id,
    mission,
    destination,
    signature_path,
    signature_sha256,
    witnessed_by,
    notes,
    client_event_id
  )
  values (
    p_key_slot_id,
    p_event_type,
    current_user_id,
    current_profile.full_name,
    current_profile.rank,
    current_profile.military_id,
    btrim(p_mission),
    nullif(btrim(p_destination), ''),
    p_signature_path,
    p_signature_sha256,
    current_user_id,
    nullif(btrim(p_notes), ''),
    btrim(p_client_event_id)
  )
  returning * into recorded_event;

  -- key_events_sync_slot locks and updates the corresponding slot in this
  -- same transaction. Any failure rolls the event insert back.
  return recorded_event;
end;
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
Û};¶‰ËkºwµçeØøñ‘¥Ø±…ÍÍ9…µ”ô‰­•äµ½¹Ñ•áĞˆøñÍÁ…¸øñUÍ•ÉI½Õ¹¼øñÍµ…±°ùM…É•¹Ñ¼‘”¥„ğ½Íµ…±°øñˆùí‘ÕÑåM•É•…¹Ñôğ½ˆøğ½ÍÁ…¸øñÍÁ…¸øñ±½Õ‘MÕ¸¼øñÍµ…±°ùA¥É…ÍÍÕ¹Õ¹„ğ½Íµ…±°øñˆùíİ•…Ñ¡•ÉMÑ…ÑÕÌôôô‰±½…‘¥¹œˆü‰…ÉÉ•…¹‘¼±¥µ„¸¸¸ˆéİ•…Ñ¡•ÉMÑ…ÑÕÌôôô‰•ÉÉ½È‰ñğ…İ•…Ñ¡•Èü‰±¥µ„¥¹‘¥ÍÁ½»µÙ•°ˆé€‘í5…Ñ ¹É½Õ¹¡İ•…Ñ¡•È¹Ñ•µÁ•É…ÑÕÉ••±Í¥ÕÌ¥ôƒ
Áƒ
Ü€‘íİ•…Ñ¡•È¹‘•ÍÉ¥ÁÑ¥½¹õôğ½ˆøğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰­•äµ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸½¹±¥¬õí±½…‘ôøñI•™É•Í¡Ü¼ùÑÕ…±¥é…Èğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ5½¹¥Ñ½È …µ½¹¥Ñ½È¥ôøñ5½¹¥Ñ½È¼ù5½¹¥Ñ½Èğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù‘½Õµ•¹Ğ¹‘½Õµ•¹Ñ±•µ•¹Ğ¹É•ÅÕ•ÍÑÕ±±ÍÉ••¸ü¸ ¥ôøñáÁ…¹¼ùQ•±„¡•¥„ğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½¡•…‘•Èø4(€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰­•äµÍÕµµ…Éäˆøñ‘¥ØøñˆùíÍ±½ÑÌ¹±•¹Ñ¡ôğ½ˆøñÍµ…±°ùA½Í§ŸÕ•Ìğ½Íµ…±°øğ½‘¥Øøñ‘¥ØøñˆùíÍ±½ÑÌ¹™¥±Ñ•È¡Ìôø…½ÕĞ¡Ì¹¥¤¤¹±•¹Ñ¡ôğ½ˆøñÍµ…±°ù¥ÍÁ½»µÙ•¥Ìğ½Íµ…±°øğ½‘¥Øøñ‘¥ØøñˆùíÍ±½ÑÌ¹™¥±Ñ•È¡Ìôù½ÕĞ¡Ì¹¥¤¤¹±•¹Ñ¡ôğ½ˆøñÍµ…±°ùI•Ñ¥É…‘…Ìğ½Íµ…±°øğ½‘¥Øøğ½Í•Ñ¥½¸ø4(€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰­•äµÉ¥ˆùíÍ±½ÑÌ¹µ…À¡Ìôùí½¹ÍĞ”õ±…Ñ•ÍĞ¡Ì¹¥¤±‰ÕÍäõ½ÕĞ¡Ì¹¥¤íÉ•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõíÌ¹¥‘ô±…ÍÍ9…µ”õí‰ÕÍäü‰­•äµÍ±½Ğ‰ÕÍäˆè‰­•äµÍ±½Ğ‰ô½¹±¥¬õì ¤ôø…µ½¹¥Ñ½È˜™Í•ÑM•±•Ñ•¡Ì¥ôøñÍÑÉ½¹œùíÌ¹Í±½Ñ}¹Õµ‰•Éôğ½ÍÑÉ½¹œøñ-•åI½Õ¹¼øñˆùí‰ÕÍäü‰IQ%Iˆè‰%MA=;5Y0‰ôğ½ˆùí”˜˜ğøñÍµ…±°ùí”¹¡½±‘•É}¹…µ•ôğ½Íµ…±°øñ•´ùí”¹µ¥ÍÍ¥½¹ñğ‰M•´µ¥ÍÏ¼‰ôğ½•´øñÑ¥µ”ùí¹•Ü…Ñ”¡”¹½ÕÉÉ•‘}…Ğ¤¹Ñ½1½…±•Q¥µ•MÑÉ¥¹œ ‰ÁĞµ	Hˆ±í¡½ÕÈèˆÈµ‘¥¥Ğˆ±µ¥¹ÕÑ”èˆÈµ‘¥¥Ğ‰ô¥ôğ½Ñ¥µ”øğ¼ùôğ½‰ÕÑÑ½¸ùô¥ôğ½Í•Ñ¥½¸ø4(íÍ•±•Ñ•˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰­•äµµ½‘…°µ‰œˆøñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰­•äµµ½‘…°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰­•äµµ½‘…°µÑ¥Ñ±”ˆøñÍÑÉ½¹œùíÍ•±•Ñ•¹Í±½Ñ}¹Õµ‰•Éôğ½ÍÑÉ½¹œøñ‘¥ØøñÍµ…±°ùí½ÕĞ¡Í•±•Ñ•¹¥¤ü‰Y=1W<ˆè‰IQ%I‰ôğ½Íµ…±°øñ ÈùA½Í§Ÿ¼íÍ•±•Ñ•¹Í±½Ñ}¹Õµ‰•Éôğ½ Èøğ½‘¥Øøğ½‘¥Øøñ±…‰•°ùY¥…ÑÕÉ„•áÑ•É¹„½Ñ•µÁ½Ë…É¥„ñ¥¹ÁÕĞÙ…±Õ”õí•áÑ•É¹…±ô½¹¡…¹”õí”ôùÍ•ÑáÑ•É¹…°¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‰à¸èAÉ•™•¥ÑÕÉ„ƒŠP€ÄÁ@ÄÜĞˆ¼øğ½±…‰•°øñ±…‰•°ù5¥ÍÏ¼ñ¥¹ÁÕĞÙ…±Õ”õíµ¥ÍÍ¥½¹ô½¹¡…¹”õí”ôùÍ•Ñ5¥ÍÍ¥½¸¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÉ•ÅÕ¥É•¼øğ½±…‰•°øñ±…‰•°ù•ÍÑ¥¹¼ñ¥¹ÁÕĞÙ…±Õ”õí‘•ÍÑ¥¹…Ñ¥½¹ô½¹¡…¹”õí”ôùÍ•Ñ•ÍÑ¥¹…Ñ¥½¸¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô¼øğ½±…‰•°øñ±…‰•°±…ÍÍ9…µ”ô‰Í¥¹…ÑÕÉ”µ±…‰•°ˆøñÍÁ…¸øñA•¹1¥¹”¼ùÍÍ¥¹”½´¼‘•‘¼ğ½ÍÁ…¸øñ…¹Ù…ÌÉ•˜õí…¹Ù…Íôİ¥‘Ñ ôˆÜÀÀˆ¡•¥¡ĞôˆÈÈÀˆ½¹A½¥¹Ñ•É½İ¸õíÍÑ…ÉÑô½¹A½¥¹Ñ•É5½Ù”õí‘É…İô½¹A½¥¹Ñ•ÉUÀõíÍÑ½Áô½¹A½¥¹Ñ•É…¹•°õíÍÑ½Áô¼øñ‰ÕÑÑ½¸½¹±¥¬õí±•…ÉôøñI½Ñ…Ñ•Ü¼ù1¥µÁ…Èğ½‰ÕÑÑ½¸øğ½±…‰•°ùíµ•ÍÍ…”˜˜ñÀùíµ•ÍÍ…•ôğ½Àùôñ‘¥Ø±…ÍÍ9…µ”ô‰­•äµµ½‘…°µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùí±•…È ¤íÍ•ÑM•±•Ñ•¡¹Õ±°¥õôù…¹•±…Èğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰­•äµÍ…Ù”ˆ½¹±¥¬õíÍ…Ù•ô‘¥Í…‰±•õíÍ…Ù¥¹ñğ…¡…ÍM¥¹…ÑÕÉ•ôøñM…Ù”¼ùíÍ…Ù¥¹œü‰M…±Ù…¹‘¼¸¸¸ˆè‰ÍÍ¥¹…È”Í…±Ù…È‰ôğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½Í•Ñ¥½¸øğ½‘¥Øùôğ½µ…¥¸ø)ô