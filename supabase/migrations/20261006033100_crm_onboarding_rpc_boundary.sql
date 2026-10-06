alter function public.crm_complete_onboarding(jsonb) set schema private;
create function public.crm_complete_onboarding(p_details jsonb) returns void language sql security invoker set search_path='' as $$ select private.crm_complete_onboarding(p_details) $$;
revoke all on function public.crm_complete_onboarding(jsonb) from public,anon;
grant execute on function public.crm_complete_onboarding(jsonb) to authenticated;
