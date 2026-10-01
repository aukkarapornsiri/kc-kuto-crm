begin;
do $setup$ declare a uuid;c uuid;c2 uuid;asset uuid;eng uuid:=gen_random_uuid();begin
 select id into a from public.profiles where role='admin' and is_active limit 1;perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('qa.admin',a::text,true);
 insert into auth.users(id,email) values(eng,eng||'@example.invalid');
 insert into public.profiles(id,email,role,custom_role_key,is_active) values(eng,eng||'@example.invalid','custom','service_engineer',true) on conflict(id) do update set role='custom',custom_role_key='service_engineer',is_active=true;
 perform set_config('qa.engineer',eng::text,true);
 insert into public.customers(name) values('QA Service rollback') returning id into c;perform set_config('qa.customer',c::text,true);
 insert into public.customers(name) values('QA Other customer rollback') returning id into c2;perform set_config('qa.other',c2::text,true);
 insert into public.assets(name,customer_id,serial_number,warranty_end) values('QA asset',c,'QA-SN',current_date+100) returning id into asset;perform set_config('qa.asset',asset::text,true);
end $setup$;
set local role authenticated;
do $workflow$ declare t uuid;r uuid;cl uuid;q uuid;s text;eng uuid:=current_setting('qa.engineer')::uuid;c uuid:=current_setting('qa.customer')::uuid;asset uuid:=current_setting('qa.asset')::uuid;oldserial text;begin
 insert into public.tickets(subject,customer_id,asset_id,assigned_to_id) values('QA repair workflow',c,asset,eng) returning id into t;perform set_config('qa.ticket',t::text,true);
 if not exists(select 1 from public.tickets where id=t and code like 'SR-%' and sla_snapshot->>'name'='Standard 24x7') then raise exception 'Number/SLA missing';end if;
 begin insert into public.tickets(subject,customer_id,asset_id) values('Cross customer',current_setting('qa.other')::uuid,asset);raise exception 'BAD: cross customer allowed';exception when raise_exception then if sqlerrm like 'BAD:%' then raise;end if;end;
 begin update public.tickets set status='closed' where id=t;raise exception 'BAD: close bypass';exception when raise_exception then if sqlerrm like 'BAD:%' then raise;end if;end;
 foreach s in array array['assigned','acknowledged','diagnosing','repairing'] loop update public.tickets set status=s where id=t;end loop;
 insert into public.crm_service_repairs(ticket_id,engineer_id) values(t,eng) returning id into r;
 insert into public.crm_service_parts(ticket_id,repair_id,part_no,name,quantity,unit_cost,selling_price) values(t,r,'P-1','Power supply',1,100,150);
 update public.crm_service_repairs set diagnosis='Power failure',root_cause='Power',action_taken='Replace',testing_result='Pass',qc_result='Pass',status='completed' where id=r;
 update public.tickets set root_cause='Power',action_taken='Replace',resolution='Repaired',testing_result='Pass',parts_changed=true,status='testing' where id=t;
 foreach s in array array['resolved','customer-confirmed','closed'] loop update public.tickets set status=s where id=t;end loop;
 if (select count(*) from public.crm_service_events where ticket_id=t)<9 then raise exception 'Missing audit events';end if;
 begin update public.crm_service_events set message='tampered' where ticket_id=t;raise exception 'BAD: audit mutable';exception when insufficient_privilege then null;end;
 -- RMA replacement must use the linked asset and ordered claim workflow.
 insert into public.tickets(subject,customer_id,asset_id,assigned_to_id) values('QA claim workflow',c,asset,eng) returning id into t;
 foreach s in array array['assigned','acknowledged','diagnosing','claim-processing'] loop update public.tickets set status=s where id=t;end loop;
 insert into public.crm_service_claims(ticket_id,vendor,replacement_serial_number) values(t,'QA Vendor','QA-NEW-SN') returning id into cl;
 foreach s in array array['submitted','vendor-received','inspection','waiting-parts','repair-replacement','shipped-back','received','qc','completed'] loop update public.crm_service_claims set status=s,details='{"qc_result":"Pass"}' where id=cl;end loop;
 if not exists(select 1 from public.assets where id=asset and serial_number='QA-NEW-SN') then raise exception 'Replacement did not update asset master';end if;
 update public.tickets set status='testing',root_cause='Device',action_taken='Replace',resolution='Replaced',testing_result='Pass' where id=t;
 foreach s in array array['resolved','customer-confirmed','closed'] loop update public.tickets set status=s where id=t;end loop;
 -- OOW, quotation and explicit customer approval.
 update public.assets set warranty_end=current_date-1 where id=asset;
 insert into public.tickets(subject,customer_id,asset_id,assigned_to_id) values('QA out of warranty',c,asset,eng) returning id into t;
 foreach s in array array['assigned','acknowledged','diagnosing'] loop update public.tickets set status=s where id=t;end loop;
 begin update public.tickets set status='repairing' where id=t;raise exception 'BAD: OOW approval bypass';exception when raise_exception then if sqlerrm like 'BAD:%' then raise;end if;end;
 insert into public.quotations(customer_id,owner_id,service_ticket_id,service_asset_id,items) values(c,current_setting('qa.admin')::uuid,t,asset,'[{"name":"Labor","qty":1,"price":500,"cost":0}]') returning id into q;
 update public.tickets set quotation_id=q,customer_approved=true,status='repairing',root_cause='Wear',action_taken='Repair',resolution='Fixed',testing_result='Pass' where id=t;
 foreach s in array array['testing','resolved','customer-confirmed','closed'] loop update public.tickets set status=s where id=t;end loop;
 if not exists(select 1 from public.quotations where id=q and service_ticket_id=t) then raise exception 'Quotation linkage missing';end if;
 -- Paused policy records a pause and removes it on resume.
 insert into public.tickets(subject,customer_id,asset_id,assigned_to_id) values('QA SLA workflow',c,asset,eng) returning id into t;perform set_config('qa.sla_ticket',t::text,true);
 foreach s in array array['assigned','acknowledged','diagnosing','waiting-customer'] loop update public.tickets set status=s where id=t;end loop;
 if not exists(select 1 from public.tickets where id=t and paused_at is not null) then raise exception 'SLA pause missing';end if;
 update public.tickets set status='diagnosing' where id=t;
end $workflow$;
reset role;
-- Simulate elapsed time in the rollback-only fixture without altering production data.
alter table public.tickets disable trigger aa_service_ticket_guard;
update public.tickets set created_at=now()-interval '12 hours',sla_deadline=now()-interval '4 hours',paused_at=now()-interval '2 hours',status='waiting-customer' where id=current_setting('qa.sla_ticket')::uuid;
alter table public.tickets enable trigger aa_service_ticket_guard;
update public.tickets set status='diagnosing' where id=current_setting('qa.sla_ticket')::uuid;
do $$ begin if exists(select 1 from public.tickets where id=current_setting('qa.sla_ticket')::uuid and sla_deadline>now()-interval '90 minutes') then raise exception 'Resume incorrectly erased the existing SLA breach';end if;end $$;
select private.crm_service_sla_alerts();select private.crm_service_sla_alerts();
do $$ begin if (select count(*) from private.crm_service_alerts where ticket_id=current_setting('qa.sla_ticket')::uuid)<>4 then raise exception 'SLA alerts missing or duplicated';end if;end $$;
insert into public.tickets(subject,customer_id) values('QA hidden unassigned',current_setting('qa.customer')::uuid);
select set_config('request.jwt.claim.sub',current_setting('qa.engineer'),true);
set local role authenticated;
do $scope$ declare n int;begin
 select count(*) into n from public.tickets where customer_id=current_setting('qa.customer')::uuid;if n<>4 then raise exception 'Engineer visibility must include four assigned cases and exclude the unassigned case';end if;
 begin update public.tickets set assigned_to_id=current_setting('qa.admin')::uuid where id=current_setting('qa.sla_ticket')::uuid;raise exception 'BAD: engineer reassigned ticket';exception when raise_exception then if sqlerrm like 'BAD:%' then raise;end if;end;
 insert into public.crm_knowledge_articles(name,service_ticket_id,root_cause,solution) values('QA engineer article',current_setting('qa.ticket')::uuid,'QA','QA solution');
 begin insert into public.crm_service_sla_policies(name,response_minutes,resolution_minutes) values('Forbidden',1,1);raise exception 'BAD: engineer edited SLA policy';exception when insufficient_privilege then null;end;
end $scope$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $$ begin if exists(select 1 from public.crm_service_events) then raise exception 'Anonymous event read';end if;end $$;
reset role;
rollback;
select 'PASS: repair closure, ordered RMA replacement, OOW approval/quotation, paused SLA and deduplicated escalations, engineer assignment restrictions and immutable audit; fixtures rolled back' result;
