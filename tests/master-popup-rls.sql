begin;
do $$declare u uuid; begin
 select id into u from public.profiles where role='admin' and is_active limit 1;
 if u is null then raise exception 'Admin required for rollback test'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$declare a uuid; b uuid; c uuid; v integer; begin
 insert into public.master_data_items(category,code,name_th,name_en) values('accounting_account','QA_'||upper(replace(gen_random_uuid()::text,'-','')),'บัญชีทดสอบ','Test account') returning id into a;
 insert into public.master_data_items(category,code,name_th,name_en) values('business_line','QA_'||upper(replace(gen_random_uuid()::text,'-','')),'สายธุรกิจทดสอบ','Test business line') returning id into b;
 insert into public.master_data_items(category,code,name_th,name_en,description,business_line_id,income_account_id) values('product_category','QA_'||upper(replace(gen_random_uuid()::text,'-','')),'หมวดทดสอบ','Test category','รายละเอียดตามภาพ',b,a) returning id into c;
 if not exists(select 1 from public.master_data_items where id=c and description='รายละเอียดตามภาพ' and business_line_id=b and income_account_id=a) then raise exception 'Readback failed'; end if;
 update public.master_data_items set description='แก้ไขรายละเอียด' where id=c and version=1;
 if not exists(select 1 from public.master_data_items where id=c and description='แก้ไขรายละเอียด' and version=2 and income_account_id=a) then raise exception 'Edit failed'; end if;
 begin update public.master_data_items set income_account_id=b where id=c; raise exception 'Invalid account accepted'; exception when others then if sqlerrm='Invalid account accepted' then raise; end if; end;
 if (select count(*) from public.audit_logs where record_id=c)<>2 then raise exception 'Audit missing'; end if;
end $$;
reset role;
rollback;
select 'PASS: category references, description roundtrip, version update, invalid reference rejected and audit; all writes rolled back' as result;
