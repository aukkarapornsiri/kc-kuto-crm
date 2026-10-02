-- Extends role-access-fixture.sql, only in an isolated test database.
alter table profiles add column email text,add column display_name text,add column manager_id uuid;
update profiles set email=case when role='admin' then 'admin@example.test' else 'sales-a@example.test' end,display_name=case when role='admin' then 'Admin' else 'Sales A' end;
insert into profiles(id,role,is_active,email,display_name) values
 ('44444444-4444-4444-8444-444444444444','sales_user',true,'sales-b@example.test','Sales B'),
 ('55555555-5555-4555-8555-555555555555','sales_manager',true,'manager@example.test','Manager'),
 ('66666666-6666-4666-8666-666666666666','executive',true,'exec@example.test','Executive');
update profiles set manager_id='55555555-5555-4555-8555-555555555555' where id='22222222-2222-4222-8222-222222222222';
insert into custom_roles values('sales_user'),('sales_manager'),('executive');
insert into role_permissions(role_key,module,can_view,can_export) values('qa_support','dashboard',true,false),('sales_user','dashboard',true,false),('sales_manager','dashboard',true,false),('executive','dashboard',true,false);
create table crm_teams(id uuid primary key default gen_random_uuid(),leader_id uuid,member_ids uuid[],is_active boolean);
create table kc_dw_sales_order_facts(id uuid primary key default gen_random_uuid(),sales_email text,period_month date,net_amount numeric,status text,currency text);
insert into kc_dw_sales_order_facts(sales_email,period_month,net_amount,status,currency) values
 ('sales-a@example.test','2026-04-01',100.01,'converted','THB'),('sales-a@example.test','2026-05-01',200,'converted','THB'),
 ('sales-b@example.test','2026-04-01',500,'converted','THB'),('sales-b@example.test','2026-04-01',800,'cancelled','THB'),
 ('sales-b@example.test','2026-04-01',900,'converted','USD');
