-- Read-only access decision for the Account 360 inventory API. No data mutation.
create function public.crm_account360_inventory_access() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',auth.uid(),'allowed',auth.uid() is not null and (private.crm_can('quotations','view') or private.crm_can('tickets','view')),'can_see_cost',private.crm_is_admin());
$$;
revoke all on function public.crm_account360_inventory_access() from public,anon;
grant execute on function public.crm_account360_inventory_access() to authenticated;
