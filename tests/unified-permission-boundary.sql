begin;
create temp table qa_access_ids as select
(select id from public.profiles where is_super_admin and private.crm_active_user(id) limit 1) as super_id,
(select id from public.profiles where not is_super_admin and role='custom' and private.crm_active_user(id) limit 1) as member_id;
grant select on qa_access_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select super_id::text from qa_access_ids),true);
update public.role_permissions set can_view=true,can_edit=true,can_manage_settings=true where module='settings' and role_key=(select custom_role_key from public.profiles where id=(select member_id from qa_access_ids));
select set_config('request.jwt.claim.sub',(select member_id::text from qa_access_ids),true);
do $$ begin
 if not private.crm_can('settings','manage_settings') then raise exception 'Fixture lacks delegated settings'; end if;
 if private.crm_can('access','edit') then raise exception 'Member elevated'; end if;
 update public.role_permissions set can_delete=true where module='leads'; if found then raise exception 'Member changed permissions'; end if;
 update public.custom_roles set label_en=label_en; if found then raise exception 'Member changed roles'; end if;
 update public.profiles set job_title='must not persist' where id=(select super_id from qa_access_ids); if found then raise exception 'Member changed another user'; end if;
 begin update public.profiles set role='admin',custom_role_key=null where id=auth.uid(); raise exception 'Self elevation succeeded'; exception when insufficient_privilege then null;end;
 begin perform public.crm_set_role_permissions('admin','[]','[]'); raise exception 'RPC elevation succeeded'; exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',(select super_id::text from qa_access_ids),true);
update public.role_permissions set can_view=false,can_create=false,can_edit=false,can_delete=false,can_import=false,can_export=false,can_approve=false,can_assign=false,can_manage_settings=false where module='inventory' and role_key=(select custom_role_key from public.profiles where id=(select member_id from qa_access_ids));
select set_config('request.jwt.claim.sub',(select member_id::text from qa_access_ids),true);
do $$ begin
 if private.crm_can('inventory','view') or exists(select 1 from public.crm_price_items) then raise exception 'Denied inventory visible'; end if;
 begin perform public.crm_inventory_item_action(gen_random_uuid(),'delete',now()); raise exception 'Denied RPC accepted'; exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',(select super_id::text from qa_access_ids),true);
update public.role_permissions set can_view=true,can_create=true where module='inventory' and role_key=(select custom_role_key from public.profiles where id=(select member_id from qa_access_ids));
select set_config('request.jwt.claim.sub',(select member_id::text from qa_access_ids),true);
do $$ begin
 if not private.crm_can('inventory','view') or not private.crm_can('inventory','create') or private.crm_can('inventory','delete') then raise exception 'Matrix grant not effective'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select super_id::text from qa_access_ids),true);
update public.profiles set is_active=false where id=(select member_id from qa_access_ids);
select set_config('request.jwt.claim.sub',(select member_id::text from qa_access_ids),true);
do $$ begin
 if private.crm_active_user() or private.crm_can('inventory','view') or exists(select 1 from public.crm_price_items) or exists(select 1 from public.role_permissions) then raise exception 'Suspended user has access'; end if;
end $$;
reset role;
do $$ declare p record;begin
 for p in select id from public.profiles where deleted_at is not null or deletion_requested_at is not null or not is_active or exists(select 1 from public.crm_user_onboarding o where o.user_id=profiles.id and o.completed_at is null) loop
 perform set_config('request.jwt.claim.sub',p.id::text,true);
 if private.crm_can('customers','view') or private.crm_can('access','manage_settings') then raise exception 'Blocked profile has access';end if;
 end loop;
end $$;
rollback;
select 'PASS: delegated settings cannot escalate; direct table and RPC denials; matrix grant/revoke; suspended/deleted/onboarding blocked; all fixture changes rolled back' result;
