begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.crm_prepare_invitation('crm-onboarding-qa@example.invalid','d2dfa3ed-b941-4699-be10-507c7a99b373');
insert into auth.users(id,email,email_confirmed_at,encrypted_password,raw_app_meta_data) values('b96243b3-7853-4160-a581-0ce877adb410','crm-onboarding-qa@example.invalid',now(),'qa-rollback-only','{"provider":"email"}');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"b96243b3-7853-4160-a581-0ce877adb410"}',true);
set local role authenticated;
do $$ begin
 if private.crm_can('customers','view') then raise exception 'Pending user can read CRM'; end if;
 begin perform public.crm_prepare_invitation('evil@example.invalid','d2dfa3ed-b941-4699-be10-507c7a99b373');raise exception 'User can invite';exception when insufficient_privilege then null;end;
 begin update public.profiles set is_super_admin=true where id=auth.uid();raise exception 'Escalation allowed';exception when raise_exception then if sqlerrm='Escalation allowed' then raise; end if;end;
 begin perform public.crm_complete_onboarding('{"first_name":"","last_name":"QA"}');raise exception 'Blank name allowed';exception when raise_exception then if sqlerrm='Blank name allowed' then raise;end if;end;
 perform public.crm_complete_onboarding('{"first_name":"Test","last_name":"User","phone":"0123456789","job_title":"Sales","role":"admin"}');
 if not exists(select 1 from public.crm_user_onboarding where user_id=auth.uid() and completed_at is not null and personal_details->>'phone'='0123456789') then raise exception 'Profile not persisted';end if;
 if (select role from public.profiles where id=auth.uid())<>'sales_user' then raise exception 'Role changed';end if;
 if not private.crm_can('customers','view') then raise exception 'Completed user denied';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"d2dfa3ed-b941-4699-be10-507c7a99b373"}',true);
set local role authenticated;
do $$ begin
 begin update public.profiles set is_active=false where id=auth.uid();raise exception 'Super Admin disabled';exception when raise_exception then if sqlerrm='Super Admin disabled' then raise;end if;end;
 if not private.crm_is_admin() then raise exception 'Existing admin denied';end if;
end $$;
reset role;
select 'Invitation, onboarding, role protection and Super Admin checks passed' as result;
rollback;
