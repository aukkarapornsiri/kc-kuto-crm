-- Test the live activity schema without retaining fixture records.
begin;
do $setup$
declare admin_id uuid;
begin
 select id into admin_id from public.profiles where role='admin' and is_active limit 1;
 if admin_id is null then raise exception 'Active CRM admin required'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
end;
$setup$;
set local role authenticated;
do $checks$
declare account_id uuid; other_id uuid; contact_id uuid; other_contact uuid; saved public.activities;
begin
 insert into public.customers(name) values('QA activity rollback account') returning id into account_id;
 insert into public.customers(name) values('QA activity rollback other') returning id into other_id;
 insert into public.contacts(name,customer_id) values('QA activity contact',account_id) returning id into contact_id;
 insert into public.contacts(name,customer_id) values('QA other contact',other_id) returning id into other_contact;
 insert into public.activities(subject,type,customer_id,customer_name,contact_id,contact_name,owner_id,status,priority,scheduled_at,reminder_at,description,next_action,meeting_url)
 values('QA activity popup','Online Meeting',account_id,'QA activity rollback account',contact_id,'QA activity contact',auth.uid(),'planned','high','2026-10-15T10:30:00+07:00','2026-10-15T10:00:00+07:00','Activity popup read-back','Send meeting notes','https://example.test/meeting') returning * into saved;
 if saved.customer_id<>account_id or saved.contact_id<>contact_id or saved.owner_id<>auth.uid()
  or saved.customer_name<>'QA activity rollback account' or saved.contact_name<>'QA activity contact'
  or saved.scheduled_at<>'2026-10-15T03:30:00Z'::timestamptz or saved.reminder_at<>'2026-10-15T03:00:00Z'::timestamptz
  or saved.description<>'Activity popup read-back' or saved.next_action<>'Send meeting notes'
  or saved.meeting_url<>'https://example.test/meeting' then raise exception 'Activity popup round trip failed'; end if;
 begin
  update public.activities set contact_id=other_contact where id=saved.id;
  raise exception 'Cross-account contact accepted';
 exception when foreign_key_violation or check_violation then null;
  when raise_exception then if SQLERRM not like 'Related record is inaccessible or belongs to another customer:%' then raise; end if;
 end;
 update public.activities set subject='QA activity edited',status='completed' where id=saved.id;
 if not exists(select 1 from public.activities a where a.id=saved.id and a.subject='QA activity edited' and a.status='completed' and a.contact_id=saved.contact_id)
  then raise exception 'Activity edit read-back failed'; end if;
 begin
  insert into public.activities(subject,scheduled_at) values('QA missing schedule',null);
  raise exception 'Missing schedule accepted';
 exception when not_null_violation then null; end;
end;
$checks$;
set local role anon;
do $anon_check$
begin
 begin
  insert into public.activities(subject) values('QA anonymous denied');
  raise exception 'Anonymous activity write allowed';
 exception when insufficient_privilege then null; end;
end;
$anon_check$;
rollback;
select 'PASS: activity popup fields, timezone, Customer/Contact/Owner links, edit read-back, cross-account rejection, required schedule and anonymous write denial; all fixture rows rolled back' as result;
