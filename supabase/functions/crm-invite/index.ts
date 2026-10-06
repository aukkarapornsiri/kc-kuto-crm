import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
const site='https://kc-cuto.kaicomhub.com/';
const headers={'Access-Control-Allow-Origin':site.slice(0,-1),'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:auth,error:authError}=await client.auth.getUser(token);
  if(authError||!auth.user)return reply({error:'Unauthorized'},401);
  const {data:profile,error:profileError}=await client.from('profiles').select('role,is_active').eq('id',auth.user.id).single();
  if(profileError||profile?.role!=='admin'||!profile.is_active)return reply({error:'Admin permission required'},403);
  const body=await req.json();const email=String(body.email||'').trim().toLowerCase();
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'อีเมลไม่ถูกต้อง'},400);
  const {data:recent}=await client.from('crm_access_invitations').select('last_sent_at').eq('email',email).maybeSingle();
  if(recent?.last_sent_at&&Date.now()-Date.parse(recent.last_sent_at)<60000)return reply({error:'กรุณารอ 1 นาทีก่อนส่งซ้ำ'},429);
  const {data:existing,error:prepareError}=await client.rpc('crm_prepare_invitation',{p_email:email,p_actor:auth.user.id});
  if(prepareError)return reply({error:prepareError.message},400);
  // Existing identities receive a secure recovery link; their password is never set by Admin.
  const sent=existing?await client.auth.resetPasswordForEmail(email,{redirectTo:site}):await client.auth.admin.inviteUserByEmail(email,{redirectTo:site});
  if(sent.error){await client.from('crm_access_invitations').update({status:'failed'}).eq('email',email);return reply({error:sent.error.message},400);}
  const {error:recordError}=await client.from('crm_access_invitations').update({status:'sent',last_sent_at:new Date().toISOString()}).eq('email',email);
  if(recordError)return reply({error:'ส่งอีเมลแล้ว แต่บันทึกสถานะไม่สำเร็จ กรุณาโหลดรายชื่อใหม่ก่อนส่งซ้ำ'},500);
  return reply({ok:true,email});
 }catch{return reply({error:'ส่งคำเชิญไม่สำเร็จ กรุณาลองใหม่'},500);}
});
