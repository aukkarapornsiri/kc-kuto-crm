create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $seed$
begin
 if not exists(select 1 from vault.secrets where name='KC_MARKETING_CRON_TOKEN') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'KC_MARKETING_CRON_TOKEN','Private marketing worker credential');
 end if;
end $seed$;
select cron.schedule('kc-marketing-email-worker','* * * * *',$job$
 select net.http_post(
  url:='https://tocsxnprspiogawignib.supabase.co/functions/v1/marketing-email',
  headers:=jsonb_build_object('Content-Type','application/json','x-marketing-worker',(select decrypted_secret from vault.decrypted_secrets where name='KC_MARKETING_CRON_TOKEN')),
  body:='{"action":"worker"}'::jsonb,timeout_milliseconds:=55000
 );
$job$);
