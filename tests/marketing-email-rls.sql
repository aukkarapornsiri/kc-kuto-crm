begin;
do $setup$ declare actor uuid; begin select id into actor from public.profiles where role='admin' and is_active limit 1;perform set_config('request.jwt.claim.sub',actor::text,true);end $setup$;
set local role authenticated;
do $test$ declare account_id uuid;contact_id uuid;gid uuid;cid uuid;n int;begin
 insert into public.customers(name,email,status) values('QA marketing rollback','qa-marketing@example.invalid','Active') returning id into account_id;
 insert into public.contacts(name,last_name,email,status,customer_id) values('QA contact','Contact','QA-Marketing@example.invalid','active',account_id) returning id into contact_id;
 gid:=public.crm_email_save_group(null,'QA group','Test',jsonb_build_array(jsonb_build_object('email','qa-marketing@example.invalid','name','QA','source_type','customers','source_id',account_id),jsonb_build_object('email','QA-Marketing@example.invalid','name','Contact','source_type','contacts','source_id',contact_id)));
 select count(*) into n from public.crm_email_group_members where group_id=gid;if n<>1 then raise exception 'Email deduplication failed';end if;
 begin perform public.crm_email_save_group(null,'Invalid group','',jsonb_build_array(jsonb_build_object('email','arbitrary@example.invalid','source_type','customers','source_id',account_id)));raise exception 'Arbitrary email accepted';exception when insufficient_privilege then null;end;
 insert into public.crm_email_campaigns(title,subject,text,group_ids) values('QA campaign','Subject','Content',array[gid]) returning id into cid;
 perform set_config('test.campaign_id',cid::text,true);
 begin update public.crm_email_campaigns set status='queued' where id=cid;raise exception 'Client bypassed send API';exception when insufficient_privilege then null;end;
 begin perform public.crm_email_claim();raise exception 'Client worker access';exception when insufficient_privilege then null;end;
 begin perform public.crm_email_queue(cid,auth.uid(),now(),'<script>bad</script>');raise exception 'Client queue access';exception when insufficient_privilege then null;end;
end $test$;
reset role;
do $queue$ declare cid uuid:=current_setting('test.campaign_id')::uuid;n int;begin
 begin perform public.crm_email_queue(cid,auth.uid(),null,'<p>Safe</p>');raise exception 'Unconfigured sender accepted';exception when raise_exception then if sqlerrm<>'Configure verified sender first' then raise;end if;end;
 update public.crm_email_sender set enabled=true,verified_at=now();
 n:=public.crm_email_queue(cid,auth.uid(),now()+interval '1 day','<p>Safe snapshot</p>');if n<>1 then raise exception 'Snapshot recipient count failed';end if;
 select count(*) into n from public.crm_email_claim();if n<>0 then raise exception 'Sent before scheduled time';end if;
 update public.crm_email_campaigns set scheduled_at=now()-interval '1 minute' where id=cid;
 select count(*) into n from public.crm_email_claim();if n<>1 then raise exception 'Due queue not claimed';end if;
 select count(*) into n from public.crm_email_claim();if n<>0 then raise exception 'Recipient claimed twice';end if;
end $queue$;
set local role anon;
do $deny$ begin begin perform * from public.crm_email_campaigns;raise exception 'Anonymous campaign access';exception when insufficient_privilege then null;end;end $deny$;
rollback;
select 'PASS: linked recipient validation, deduplication, draft guard, server-only queue and claims, sender guard, UTC schedule and no duplicate claims; fixtures rolled back' as result;
