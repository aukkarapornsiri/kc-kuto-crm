-- Exclude blacklisted accounts and their contacts from marketing audiences.
alter policy email_members_create on public.crm_email_group_members with check (
 exists(select 1 from public.crm_email_groups g where g.id=group_id and (g.owner_id=(select auth.uid()) or private.crm_is_admin()))
 and private.crm_can('activities','create')
 and (
  (source_type='customers' and exists(select 1 from public.customers c where c.id=source_id and lower(trim(c.email))=crm_email_group_members.email and lower(c.status) not in('inactive','blacklist')))
  or (source_type='contacts' and exists(select 1 from public.contacts c left join public.customers a on a.id=c.customer_id where c.id=source_id and lower(trim(c.email))=crm_email_group_members.email and c.status='active' and coalesce(lower(a.status),'active')<>'blacklist'))
 )
);
create or replace function public.crm_email_queue(p_id uuid,p_owner uuid,p_schedule timestamptz,p_html text) returns int language plpgsql security definer set search_path=public,pg_temp as $$
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
 and ((m.source_type='customers' and exists(select 1 from public.customers s where s.id=m.source_id and lower(trim(s.email))=m.email and lower(s.status) not in('inactive','blacklist')))
 or (m.source_type='contacts' and exists(select 1 from public.contacts s left join public.customers a on a.id=s.customer_id where s.id=m.source_id and lower(trim(s.email))=m.email and lower(s.status) not in('inactive','blacklist') and coalesce(lower(a.status),'active')<>'blacklist')));
 get diagnostics n=row_count;
 if n=0 or n>10000 then raise exception 'Recipient count must be 1–10,000 after removing unsubscribed and invalid addresses'; end if;
 update public.crm_email_campaigns set html=coalesce(p_html,''),status=case when p_schedule is null then 'queued' else 'scheduled' end,scheduled_at=coalesce(p_schedule,now()),recipient_count=n,updated_at=now() where id=c.id;
 return n;
end $$;
notify pgrst,'reload schema';
