alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add constraint crm_profile_phone_length check(length(phone)<=150);
alter table public.profiles add constraint crm_profile_avatar_owner check(avatar_path is null or (split_part(avatar_path,'/',1)=id::text and length(avatar_path)<250));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('crm-profile-photos','crm-profile-photos',false,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy crm_avatar_read on storage.objects for select to authenticated using(bucket_id='crm-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy crm_avatar_create on storage.objects for insert to authenticated with check(bucket_id='crm-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles where id=auth.uid() and is_active));
create policy crm_avatar_delete on storage.objects for delete to authenticated using(bucket_id='crm-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
