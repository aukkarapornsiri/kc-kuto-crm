alter table public.quotations
  add column if not exists account360_financial_record_id text not null default '',
  add column if not exists account360_event_id text not null default '',
  add column if not exists account360_sync_status text not null default 'not_synced',
  add column if not exists account360_synced_at timestamptz,
  add column if not exists account360_last_error text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='quotations_account360_sync_status_check'
      and conrelid='public.quotations'::regclass
  ) then
    alter table public.quotations
      add constraint quotations_account360_sync_status_check
      check (account360_sync_status in ('not_synced','not_configured','ready','syncing','synced','error'));
  end if;
end $$;

create index if not exists idx_quotations_account360_sync
on public.quotations(account360_sync_status,updated_at desc);

notify pgrst,'reload schema';
