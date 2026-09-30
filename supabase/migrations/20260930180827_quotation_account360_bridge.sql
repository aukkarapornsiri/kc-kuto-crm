
alter table public.quotations
  add column if not exists issue_date date default current_date,
  add column if not exists payment_terms integer default 30,
  add column if not exists tax_rate numeric default 7,
  add column if not exists wht_rate numeric default 0,
  add column if not exists project_name text default '',
  add column if not exists prepared_by text default '',
  add column if not exists prepared_by_email text default '',
  add column if not exists prepared_by_phone text default '',
  add column if not exists counterparty_address text default '',
  add column if not exists counterparty_tax_id text default '',
  add column if not exists payment_instructions text default '',
  add column if not exists withholding_tax numeric default 0,
  add column if not exists net_total numeric default 0,
  add column if not exists source_system text default 'KC KuTo CRM',
  add column if not exists account360_url text default '',
  add column if not exists account360_document_no text default '',
  add column if not exists document_language text default 'th';

do $$ begin
  alter table public.quotations add constraint quotations_payment_terms_check check (payment_terms between 0 and 365);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quotations add constraint quotations_tax_rate_check check (tax_rate between 0 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quotations add constraint quotations_wht_rate_check check (wht_rate between 0 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quotations add constraint quotations_document_language_check check (document_language in ('th','en'));
exception when duplicate_object then null; end $$;

notify pgrst,'reload schema';

