-- Add KC Account 360 as a first-class accounting integration.
alter table public.integration_connections
  drop constraint if exists integration_connections_category_check,
  drop constraint if exists integration_connections_provider_check;

alter table public.integration_connections
  add constraint integration_connections_category_check
    check (category = any(array['device','calendar','inventory','billing','accounting']::text[])),
  add constraint integration_connections_provider_check
    check (provider = any(array['microsoft_intune','microsoft_calendar','google_calendar','inventory','stripe','kc_account_360']::text[]));

insert into public.integration_connections(
  provider,display_name,category,enabled,status,config,required_secrets,updated_at
)
values(
  'kc_account_360','KC Account 360','accounting',false,'not_configured',
  jsonb_build_object('base_url','https://kc-account-360-preview.saelim-m.chatgpt.site'),
  array['KC_ACCOUNT360_API_KEY']::text[],now()
)
on conflict(provider) do update
set display_name=excluded.display_name,
    category=excluded.category,
    config=coalesce(public.integration_connections.config,'{}'::jsonb)||excluded.config,
    required_secrets=excluded.required_secrets,
    updated_at=now();
