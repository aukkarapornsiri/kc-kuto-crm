-- AI connection state (including keys) is encrypted in Vault, scoped to this CRM application.
create or replace function public.crm_ai_store_config(p_name text,p_config text,p_expected_revision text default null)
returns void language plpgsql security definer set search_path=pg_catalog,vault,pg_temp as $$
declare sid uuid; previous jsonb;
begin
 if p_name !~ '^KC_CRM_AI_[a-f0-9]{64}$' or length(p_config)>16000 then raise exception 'Invalid AI configuration'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_name,0));
 select id into sid from vault.secrets where name=p_name;
 if sid is not null then select decrypted_secret::jsonb into previous from vault.decrypted_secrets where id=sid; end if;
 if (previous->>'revision') is distinct from p_expected_revision then raise exception 'Configuration changed; reload and retry' using errcode='40001'; end if;
 if jsonb_typeof(p_config::jsonb)<>'object' or p_config::jsonb->>'revision' is null then raise exception 'Invalid configuration'; end if;
 if sid is null then perform vault.create_secret(p_config,p_name,'CRM AI configuration');
 else perform vault.update_secret(sid,p_config,p_name,'CRM AI configuration');end if;
end $$;
revoke all on function public.crm_ai_store_config(text,text,text) from public,anon,authenticated;
grant execute on function public.crm_ai_store_config(text,text,text) to service_role;
create schema if not exists crm_ai_private;
revoke all on schema crm_ai_private from public,anon,authenticated;
create table if not exists crm_ai_private.rate_limits(user_id uuid primary key, window_at timestamptz not null, requests integer not null);
alter table crm_ai_private.rate_limits enable row level security;
revoke all on crm_ai_private.rate_limits from public,anon,authenticated;
create or replace function public.crm_ai_rate_limit(p_user uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,crm_ai_private,pg_temp as $$
declare result integer;
begin
 insert into crm_ai_private.rate_limits(user_id,window_at,requests) values(p_user,date_trunc('minute',now()),1)
 on conflict(user_id) do update set window_at=date_trunc('minute',now()),requests=case when rate_limits.window_at<date_trunc('minute',now()) then 1 else rate_limits.requests+1 end
 where rate_limits.window_at<date_trunc('minute',now()) or rate_limits.requests<10 returning requests into result;
 return result is not null;
end $$;
revoke all on function public.crm_ai_rate_limit(uuid) from public,anon,authenticated;
grant execute on function public.crm_ai_rate_limit(uuid) to service_role;
