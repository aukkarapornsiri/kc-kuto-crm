do $$ declare target text; begin
 foreach target in array array['crm_service_repairs','crm_service_claims','crm_service_parts'] loop
  execute format('alter table public.%I add column if not exists document_profile jsonb',target);
  execute format('alter table public.%I add constraint %I check(document_profile is null or (jsonb_typeof(document_profile)=''object'' and pg_column_size(document_profile)<=16384))',target,target||'_document_profile_valid');
  execute format('create trigger crm_document_profile_on_insert before insert on public.%I for each row execute function private.crm_document_profile_defaults()',target);
 end loop;
end $$;
