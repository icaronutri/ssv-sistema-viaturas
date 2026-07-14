-- Preserve the original key events and record the institutional decision in a
-- separate, append-only audit table. Application roles receive read-only
-- access, restricted by RLS to master administrators.

create table public.key_event_audits (
  key_event_id uuid primary key references public.key_events(id) on delete restrict,
  disposition text not null check (disposition in ('invalid', 'annulled')),
  reason_code text not null check (reason_code = 'blank_signature_test'),
  audit_note text not null check (length(btrim(audit_note)) >= 20),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.key_event_audits enable row level security;

revoke all on table public.key_event_audits from public, anon, authenticated;
grant select on table public.key_event_audits to authenticated;

create policy key_event_audits_master_select
on public.key_event_audits for select to authenticated
using (private.has_role(array['master_admin'::public.app_role]));

insert into public.key_event_audits (
  key_event_id,
  disposition,
  reason_code,
  audit_note,
  decided_by
)
select
  event.id,
  'annulled',
  'blank_signature_test',
  'Evento de teste anulado por decisão do responsável institucional do SSV. O registro original e a assinatura vazia foram preservados para rastreabilidade.',
  '7f1de64f-233c-4537-8c09-b00e2e1c0a05'::uuid
from public.key_events as event
where event.id in (
  'ed9ef49e-bdcb-477a-8b7d-cb0853afcda0'::uuid,
  '680149ae-4c26-4d7e-9f41-b7ee85b8cd58'::uuid,
  '8a32507e-6c33-47ae-8dd9-40cfb767a99f'::uuid,
  'b56923f8-cfc7-4727-ae59-9fd2fc19b37e'::uuid
)
and event.signature_sha256 = '548636c0a6f7482af284e3e27efa96f0c5a59def1e32043c237165de3a513722';

do $$
begin
  if (
    select count(*)
    from public.key_event_audits
    where key_event_id in (
      'ed9ef49e-bdcb-477a-8b7d-cb0853afcda0'::uuid,
      '680149ae-4c26-4d7e-9f41-b7ee85b8cd58'::uuid,
      '8a32507e-6c33-47ae-8dd9-40cfb767a99f'::uuid,
      'b56923f8-cfc7-4727-ae59-9fd2fc19b37e'::uuid
    )
  ) <> 4 then
    raise exception 'expected four blank-signature test events to be audited';
  end if;
end;
$$;
