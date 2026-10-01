-- Consistent role resolution with the existing CRM permission engine.
create or replace function private.crm_service_engineer() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and is_active and role='custom' and custom_role_key='service_engineer') $$;
create function private.crm_service_master_guard() returns trigger language plpgsql set search_path='' as $$ declare t public.tickets;begin
 if tg_table_name='assets' then
 if new.branch_id is not null and not exists(select 1 from public.crm_branches where id=new.branch_id and customer_id=new.customer_id) then raise exception 'Asset branch customer mismatch';end if;
 if new.assigned_user_id is not null and not exists(select 1 from public.contacts where id=new.assigned_user_id and customer_id=new.customer_id) then raise exception 'Asset user customer mismatch';end if;
 elsif tg_table_name='quotations' and new.service_ticket_id is not null then
 select * into t from public.tickets where id=new.service_ticket_id;
 if t.id is null or t.customer_id is distinct from new.customer_id or t.asset_id is distinct from new.service_asset_id then raise exception 'Quotation ticket/customer/asset mismatch';end if;
 end if;return new;end $$;
create trigger service_master_links before insert or update on public.assets for each row execute function private.crm_service_master_guard();
create trigger service_quotation_links before insert or update on public.quotations for each row execute function private.crm_service_master_guard();
create function private.crm_service_settings_guard() returns trigger language plpgsql set search_path='' as $$ declare p text;n integer;begin
 if jsonb_typeof(new.config)<>'object' then raise exception 'Invalid settings';end if;
 for p in select jsonb_each_text.value from jsonb_each_text(coalesce(new.config->'prefixes','{}')) loop if p !~ '^[A-Za-z0-9_-]{1,20}$' then raise exception 'Prefix: use 1-20 letters, digits, underscores or hyphens';end if;end loop;
 for n in select jsonb_array_elements_text(coalesce(new.config->'escalation'->'thresholds','[]'))::int loop if n<1 or n>100 then raise exception 'SLA threshold must be 1-100';end if;end loop;
 if coalesce((new.config->'escalation'->>'waiting_hours')::int,48)<1 then raise exception 'Waiting alert must be positive';end if;new.updated_at:=now();return new;end $$;
create trigger service_settings_guard before insert or update on public.crm_service_settings for each row execute function private.crm_service_settings_guard();
-- Guard all direct API writes, including requesters, backup engineers and quote references.
do $$ declare def text;begin
 def:=pg_get_functiondef('private.crm_service_ticket_guard()'::regprocedure);
 def:=replace(def,'if new.assigned_to_id is not null and not exists',E'new.requester_id:=coalesce(new.requester_id,new.contact_id);\n if new.requester_id is not null and not exists(select 1 from public.contacts where id=new.requester_id and customer_id=new.customer_id) then raise exception ''Requester customer mismatch'';end if;\n if new.backup_engineer_id is not null and not exists(select 1 from public.profiles where id=new.backup_engineer_id and is_active) then raise exception ''Active backup engineer required'';end if;\n if new.quotation_id is not null and not exists(select 1 from public.quotations where id=new.quotation_id and customer_id=new.customer_id and service_ticket_id=new.id) then raise exception ''Quotation ticket mismatch'';end if;\n if new.assigned_to_id is not null and not exists');
 def:=replace(def,'new.code:=private.crm_service_number(''ticket'');',E'if new.team_id is null and a.id is not null then select id into new.team_id from public.crm_service_teams where active and name=coalesce((select config->''auto_assignment''->>a.category from public.crm_service_settings where id=''default''),case when a.category in (''Endpoint'',''Notebook'') then ''Client Support'' when a.category in (''Server'',''Storage'') then ''Infrastructure'' when a.category in (''Network'',''Firewall'',''Security'') then ''Network & Security'' when a.category=''Software'' then ''Application Support'' end) limit 1;end if;\n new.code:=private.crm_service_number(''ticket'');');
 execute def;end $$;
