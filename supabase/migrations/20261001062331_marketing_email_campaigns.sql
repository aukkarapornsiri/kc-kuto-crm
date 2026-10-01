-- Marketing audiences, immutable send snapshots, private sender credentials and worker queue.
create table public.crm_email_templates (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 160),
 subject text not null default '', preview_text text not null default '', html text not null default '' check(length(html)<=200000),
 text text not null default '' check(length(text)<=200000), layout text not null default 'blank',
 owner_id uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);
create table public.crm_email_groups (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160),
 description text not null default '', owner_id uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.crm_email_group_members (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.crm_email_groups(id) on delete cascade,
 email text not null check(email=lower(trim(email)) and email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' and length(email)<=254),
 name text not null default '', source_type text not null check(source_type in ('customers','contacts')), source_id uuid not null,
 unique(group_id,email)
);
create table public.crm_email_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 160),
 subject text not null check(length(subject) between 1 and 200 and subject !~ E'[\r\n]'), preview_text text not null default '',
 html text not null default '' check(length(html)<=200000), text text not null default '' check(length(text)<=200000),
 layout text not null default 'blank', group_ids uuid[] not null default '{}',
 owner_id uuid not null default auth.uid() references public.profiles(id),
 status text not null default 'draft' check(status in ('draft','scheduled','queued','sending','sent','partial','failed','cancelled')),
 scheduled_at timestamptz, recipient_count int not null default 0, sent_count int not null default 0, failed_count int not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.crm_email_recipients (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.crm_email_campaigns(id) on delete cascade,
 email text not null, name text not null default '', status text not null default 'pending' check(status in ('pending','sending','sent','failed','skipped')),
 unsubscribe_token uuid not null default gen_random_uuid() unique, attempts int not null default 0,
 next_attempt_at timestamptz not null default now(), claimed_at timestamptz, provider_id text, error text, sent_at timestamptz,
 unique(campaign_id,email)
);
create table public.crm_email_opt_outs (email text primary key, created_at timestamptz not null default now());
create table public.crm_email_sender (
 id boolean primary key default true check(id), from_name text not null default '', from_email text not null default '',
 reply_to text not null default '', postal_address text not null default '', enabled boolean not null default false,
 verified_at timestamptz, updated_at timestamptz not null default now()
);
insert into public.crm_email_sender(id) values(true);
create index crm_email_templates_owner_idx on public.crm_email_templates(owner_id);
create index crm_email_groups_owner_idx on public.crm_email_groups(owner_id);
create index crm_email_members_source_idx on public.crm_email_group_members(source_id);
create index crm_email_campaigns_owner_idx on public.crm_email_campaigns(owner_id);
create index crm_email_campaigns_queue_idx on public.crm_email_campaigns(scheduled_at) where status in ('queued','scheduled','sending');
create index crm_email_recipients_queue_idx on public.crm_email_recipients(next_attempt_at,campaign_id) where status='pending';
create index crm_email_recipients_campaign_idx on public.crm_email_recipients(campaign_id);
alter table public.crm_email_templates enable row level security;
alter table public.crm_email_groups enable row level security;
alter table public.crm_email_group_members enable row level security;
alter table public.crm_email_campaigns enable row level security;
alter table public.crm_email_recipients enable row level security;
alter table public.crm_email_opt_outs enable row level security;
alter table public.crm_email_sender enable row level security;
create policy email_templates_read on public.crm_email_templates for select to authenticated using(private.crm_can('activities','view'));
create policy email_templates_create on public.crm_email_templates for insert to authenticated with check(private.crm_can('activities','create') and owner_id=(select auth.uid()));
create policy email_templates_delete on public.crm_email_templates for delete to authenticated using(private.crm_can('activities','delete') and (owner_id=(select auth.uid()) or private.crm_is_admin()));
create policy email_groups_read on public.crm_email_groups for select to authenticated using(private.crm_can('activities','view'));
create policy email_groups_create on public.crm_email_groups for insert to authenticated with check(private.crm_can('activities','create') and owner_id=(select auth.uid()));
create policy email_groups_edit on public.crm_email_groups for update to authenticated using(private.crm_can('activities','edit') and (owner_id=(select auth.uid()) or private.crm_is_admin())) with check(private.crm_can('activities','edit') and (owner_id=(select auth.uid()) or private.crm_is_admin()));
create policy email_groups_delete on public.crm_email_groups for delete to authenticated using(private.crm_can('activities','delete') and (owner_id=(select auth.uid()) or private.crm_is_admin()));
create policy email_members_read on public.crm_email_group_members for select to authenticated using(private.crm_can('activities','view'));
create policy email_members_create on public.crm_email_group_members for insert to authenticated with check(exists(select 1 from public.crm_email_groups g where g.id=group_id and (g.owner_id=(select auth.uid()) or private.crm_is_admin())) and private.crm_can('activities','create') and (
 (source_type='customers' and exists(select 1 from public.customers c where c.id=source_id and lower(trim(c.email))=crm_email_group_members.email and c.status<>'inactive')) or
 (source_type='contacts' and exists(select 1 from public.contacts c where c.id=source_id and lower(trim(c.email))=crm_email_group_members.email and c.status<>'inactive'))));
create policy email_members_delete on public.crm_email_group_members for delete to authenticated using(private.crm_can('activities','edit') and exists(select 1 from public.crm_email_groups g where g.id=group_id and (g.owner_id=(select auth.uid()) or private.crm_is_admin())));
create policy email_campaigns_read on public.crm_email_campaigns for select to authenticated using(private.crm_can('activities','view'));
create policy email_campaigns_create on public.crm_email_campaigns for insert to authenticated with check(private.crm_can('activities','create') and owner_id=(select auth.uid()) and status='draft' and recipient_count=0 and sent_count=0 and failed_count=0 and scheduled_at is null);
create policy email_campaigns_edit on public.crm_email_campaigns for update to authenticated using(private.crm_can('activities','edit') and owner_id=(select auth.uid()) and status='draft') with check(private.crm_can('activities','edit') and owner_id=(select auth.uid()) and status='draft');
create policy email_recipients_read on public.crm_email_recipients for select to authenticated using(private.crm_can('activities','view'));
create policy email_sender_read on public.crm_email_sender for select to authenticated using(private.crm_can('activities','view'));
revoke all on public.crm_email_templates,public.crm_email_groups,public.crm_email_group_members,public.crm_email_campaigns,public.crm_email_recipients,public.crm_email_opt_outs,public.crm_email_sender from anon,authenticated;
grant select,insert,delete on public.crm_email_templates,public.crm_email_groups,public.crm_email_group_members to authenticated;
grant update(name,description,updated_at) on public.crm_email_groups to authenticated;
grant select,insert on public.crm_email_campaigns to authenticated;
grant update(title,subject,preview_text,html,text,layout,group_ids,updated_at) on public.crm_email_campaigns to authenticated;
grant select(id,campaign_id,email,name,status,attempts,provider_id,error,sent_at) on public.crm_email_recipients to authenticated;
grant select on public.crm_email_sender to authenticated;
grant all on public.crm_email_templates,public.crm_email_groups,public.crm_email_group_members,public.crm_email_campaigns,public.crm_email_recipients,public.crm_email_opt_outs,public.crm_email_sender to service_role;

create function public.crm_email_save_group(p_id uuid,p_name text,p_description text,p_members jsonb) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare gid uuid;
begin
 if jsonb_typeof(p_members)<>'array' or jsonb_array_length(p_members)>10000 then raise exception 'Invalid recipient list'; end if;
 if p_id is null then insert into public.crm_email_groups(name,description) values(trim(p_name),coalesce(p_description,'')) returning id into gid;
 else update public.crm_email_groups set name=trim(p_name),description=coalesce(p_description,''),updated_at=now() where id=p_id returning id into gid;
 if gid is null then raise exception 'Group not editable'; end if; delete from public.crm_email_group_members where group_id=gid; end if;
 insert into public.crm_email_group_members(group_id,email,name,source_type,source_id)
 select distinct on(lower(trim(x.email))) gid,lower(trim(x.email)),coalesce(x.name,''),x.source_type,x.source_id
 from jsonb_to_recordset(p_members) as x(email text,name text,source_type text,source_id uuid);
 return gid;
end $$;
revoke all on function public.crm_email_save_group(uuid,text,text,jsonb) from public,anon;
grant execute on function public.crm_email_save_group(uuid,text,text,jsonb) to authenticated;

create function public.crm_email_set_secret(p_value text) returns void language plpgsql security definer set search_path=vault,pg_temp as $$
declare sid uuid;
begin
 if length(trim(p_value))<10 then raise exception 'Invalid API key'; end if;
 select id into sid from vault.secrets where name='EMAIL_MARKETING_API_KEY';
 if sid is null then perform vault.create_secret(p_value,'EMAIL_MARKETING_API_KEY','Marketing sender API key');
 else perform vault.update_secret(sid,p_value,'EMAIL_MARKETING_API_KEY','Marketing sender API key'); end if;
end $$;
revoke all on function public.crm_email_set_secret(text) from public,anon,authenticated;
grant execute on function public.crm_email_set_secret(text) to service_role;

create function public.crm_email_queue(p_id uuid,p_owner uuid,p_schedule timestamptz,p_html text) returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.crm_email_campaigns; n int;
begin
 select * into c from public.crm_email_campaigns where id=p_id and owner_id=p_owner for update;
 if not found or c.status<>'draft' then raise exception 'Only an owned draft can be queued'; end if;
 if not exists(select 1 from public.crm_email_sender where id and enabled and verified_at is not null) then raise exception 'Configure verified sender first'; end if;
 if p_schedule is not null and p_schedule<now()+interval '1 minute' then raise exception 'Schedule at least one minute ahead'; end if;
 if length(trim(c.subject))=0 or (length(trim(c.text))=0 and length(trim(coalesce(p_html,'')))=0) then raise exception 'Missing email content'; end if;
 if cardinality(c.group_ids)=0 or exists(select 1 from unnest(c.group_ids) gid where not exists(select 1 from public.crm_email_groups where id=gid)) then raise exception 'Choose valid recipient groups'; end if;
 insert into public.crm_email_recipients(campaign_id,email,name)
 select distinct on(m.email) c.id,m.email,m.name from public.crm_email_group_members m where m.group_id=any(c.group_ids)
 and not exists(select 1 from public.crm_email_opt_outs o where o.email=m.email)
 and ((m.source_type='customers' and exists(select 1 from public.customers s where s.id=m.source_id and lower(trim(s.email))=m.email and s.status<>'inactive'))
 or (m.source_type='contacts' and exists(select 1 from public.contacts s where s.id=m.source_id and lower(trim(s.email))=m.email and s.status<>'inactive')));
 get diagnostics n=row_count;
 if n=0 or n>10000 then raise exception 'Recipient count must be 1–10,000 after removing unsubscribed and invalid addresses'; end if;
 update public.crm_email_campaigns set html=coalesce(p_html,''),status=case when p_schedule is null then 'queued' else 'scheduled' end,scheduled_at=coalesce(p_schedule,now()),recipient_count=n,updated_at=now() where id=c.id;
 return n;
end $$;
revoke all on function public.crm_email_queue(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.crm_email_queue(uuid,uuid,timestamptz,text) to service_role;

create function public.crm_email_claim() returns setof public.crm_email_recipients language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- An uncertain in-flight send is never automatically retried after its lease expires.
 update public.crm_email_recipients set status='failed',error='Delivery outcome unknown; inspect provider log before sending again' where status='sending' and claimed_at<now()-interval '5 minutes';
 return query with picked as (
 select r.id from public.crm_email_recipients r join public.crm_email_campaigns c on c.id=r.campaign_id
 where r.status='pending' and r.next_attempt_at<=now() and c.status in ('scheduled','queued','sending') and c.scheduled_at<=now()
 order by c.scheduled_at,r.id limit 5 for update of r skip locked
 ) update public.crm_email_recipients r set status='sending',claimed_at=now(),attempts=attempts+1 from picked where r.id=picked.id returning r.*;
end $$;
revoke all on function public.crm_email_claim() from public,anon,authenticated;
grant execute on function public.crm_email_claim() to service_role;
create function public.crm_email_refresh(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pending int; sent int; failed int;
begin
 select count(*) filter(where status in('pending','sending')),count(*) filter(where status='sent'),count(*) filter(where status='failed') into pending,sent,failed from public.crm_email_recipients where campaign_id=p_id;
 update public.crm_email_campaigns set sent_count=sent,failed_count=failed,status=case when status='cancelled' then status when pending>0 then 'sending' when sent=recipient_count then 'sent' when sent=0 and failed=0 then 'cancelled' when sent>0 then 'partial' else 'failed' end,updated_at=now() where id=p_id;
end $$;
revoke all on function public.crm_email_refresh(uuid) from public,anon,authenticated;
grant execute on function public.crm_email_refresh(uuid) to service_role;
notify pgrst,'reload schema';
