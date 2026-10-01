import {createClient} from 'npm:@supabase/supabase-js@2';
import sanitize from 'npm:sanitize-html@2.17.0';
const base=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-marketing-worker','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const value=async(q:any)=>{const r=await q;if(r.error)throw Error(r.error.message);return r.data;};
const secret=async(name:string)=>String(await value(db.rpc('kc_get_integration_secret',{p_name:name}))||'');
const email=(v:unknown)=>String(v||'').trim().toLowerCase();
const valid=(v:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)&&v.length<=254;
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function cleanHTML(html:string){return sanitize(html,{allowedTags:[...sanitize.defaults.allowedTags,'img','table','tbody','thead','tr','td','th','div','span','h1','h2'],allowedAttributes:{'*':['style'],a:['href','title'],img:['src','alt','width','height'],td:['colspan','rowspan'],th:['colspan','rowspan']},allowedSchemes:['https','mailto'],allowedSchemesByTag:{img:['https']},allowProtocolRelative:false,allowedStyles:{'*':{'color':[/^(#[0-9a-f]{3,8}|[a-z]+|rgb\([\d\s,]+\))$/i],'background':[/^(#[0-9a-f]{3,8}|[a-z]+)$/i],'background-color':[/^(#[0-9a-f]{3,8}|[a-z]+)$/i],'font-family':[/^[a-z\s,'-]+$/i],'font-size':[/^\d+(px|pt|em|%)$/],'text-align':[/^(left|right|center)$/],'padding':[/^[\d\s.]+(px|em|%)$/],'margin':[/^auto$|^[\d\s.]+(px|em|%)$/],'max-width':[/^\d+(px|%)$/],'width':[/^\d+(px|%)$/],'border-top':[/^\d+px solid #[0-9a-f]{3,8}$/i]}}});}
async function auth(req:Request,action='view'){
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))throw Error('401: Sign in required');
 const userdb=createClient(base,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data,error}=await userdb.auth.getUser(authorization.slice(7));if(error||!data.user)throw Error('401: Session expired');
 const profile=await value(db.from('profiles').select('id,role,custom_role_key,is_active').eq('id',data.user.id).maybeSingle());
 if(!profile?.is_active)throw Error('403: Inactive user');
 if(profile.role!=='admin'){const p=await value(db.from('role_permissions').select('can_'+action).eq('role_key',profile.role==='custom'?profile.custom_role_key:profile.role).eq('module','activities').maybeSingle());if(!p?.['can_'+action])throw Error('403: Activity permission required');}
 return {userdb,profile};
}
async function settings(){return await value(db.from('crm_email_sender').select('*').eq('id',true).single());}
async function equal(a:string,b:string){if(!a||!b)return false;const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;}
async function worker(){
 const cfg=await settings(),apiKey=await secret('EMAIL_MARKETING_API_KEY');
 if(!cfg.enabled||!cfg.verified_at||!apiKey)return {processed:0,reason:'Sender not configured'};
 const rows=await value(db.rpc('crm_email_claim')),campaignIds=new Set<string>();
 // Refresh stale leases even if no new row was claimed.
 const active=await value(db.from('crm_email_campaigns').select('id').in('status',['queued','scheduled','sending']).lte('scheduled_at',new Date().toISOString()));
 for(const c of active)campaignIds.add(c.id);
 for(const r of rows){campaignIds.add(r.campaign_id);
  const c=await value(db.from('crm_email_campaigns').select('*').eq('id',r.campaign_id).single());
  const optOut=await value(db.from('crm_email_opt_outs').select('email').eq('email',r.email).maybeSingle());
  if(c.status==='cancelled'||optOut){await value(db.from('crm_email_recipients').update({status:'skipped',error:optOut?'Unsubscribed':'Cancelled'}).eq('id',r.id));continue;}
  const url=base+'/functions/v1/marketing-email?action=unsubscribe&token='+r.unsubscribe_token;
  const html='<div style="display:none">'+escape(c.preview_text)+'</div>'+c.html.replaceAll('{{name}}',escape(r.name||r.email))+'<hr><p style="font-size:12px;color:#666">'+escape(cfg.from_name)+' · '+escape(cfg.postal_address)+'<br><a href="'+url+'">ยกเลิกรับอีเมล / Unsubscribe</a></p>';
  const text=c.text.replaceAll('{{name}}',r.name||r.email)+'\n\n'+cfg.from_name+' · '+cfg.postal_address+'\nยกเลิกรับอีเมล / Unsubscribe: '+url;
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'crm/'+c.id+'/'+r.id},body:JSON.stringify({from:cfg.from_name.replace(/[<>"\r\n]/g,'')+' <'+cfg.from_email+'>',to:[r.email],reply_to:cfg.reply_to||undefined,subject:c.subject,html:c.html?html:undefined,text,headers:{'List-Unsubscribe':'<'+url+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}),signal:AbortSignal.timeout(8000)});
   const payload=await response.json().catch(()=>({}));
   if(response.ok&&payload.id)await value(db.from('crm_email_recipients').update({status:'sent',provider_id:payload.id,sent_at:new Date().toISOString(),error:null}).eq('id',r.id));
   else if(response.status===429&&r.attempts<4)await value(db.from('crm_email_recipients').update({status:'pending',next_attempt_at:new Date(Date.now()+Math.max(60000,Number(response.headers.get('retry-after')||60)*1000)).toISOString(),error:'Provider rate limit; retry scheduled'}).eq('id',r.id));
   else await value(db.from('crm_email_recipients').update({status:'failed',error:'Provider rejected email ('+response.status+'): '+String(payload.message||payload.name||'Unknown error').slice(0,300)}).eq('id',r.id));
  }catch{await value(db.from('crm_email_recipients').update({status:'failed',error:'Delivery outcome unknown; inspect provider log before sending again'}).eq('id',r.id));}
  await new Promise(resolve=>setTimeout(resolve,650));
 }
 for(const id of campaignIds)await value(db.rpc('crm_email_refresh',{p_id:id}));
 return {processed:rows.length};
}
async function unsubscribe(req:Request,token:string){
 if(!/^[0-9a-f-]{36}$/i.test(token))return new Response('Invalid link',{status:400});
 const r=await value(db.from('crm_email_recipients').select('email').eq('unsubscribe_token',token).maybeSingle());
 if(!r)return new Response('Link not found',{status:404});
 if(req.method==='POST'){await value(db.from('crm_email_opt_outs').upsert({email:r.email},{onConflict:'email'}));return new Response('<!doctype html><meta charset="utf-8"><p>ยกเลิกรับอีเมลเรียบร้อยแล้ว / You have unsubscribed.</p>',{headers:{'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':"default-src 'none'; form-action 'self'"}});}
 return new Response('<!doctype html><meta charset="utf-8"><title>Unsubscribe</title><h1>ยกเลิกรับอีเมล / Unsubscribe</h1><form method="post"><button type="submit">ยืนยัน / Confirm</button></form>',{headers:{'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':"default-src 'none'; form-action 'self'"}});
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const url=new URL(req.url);if(url.searchParams.get('action')==='unsubscribe')return await unsubscribe(req,url.searchParams.get('token')||'');
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const body=await req.json();
  if(body.action==='worker'){if(!await equal(req.headers.get('x-marketing-worker')||'',await secret('KC_MARKETING_CRON_TOKEN')))return json({error:'Unauthorized'},401);return json(await worker());}
  const {userdb,profile}=await auth(req,body.action==='queue'?'create':body.action==='cancel'?'edit':'view');
  if(body.action==='status'){const cfg=await settings();return json({...cfg,has_api_key:!!await secret('EMAIL_MARKETING_API_KEY')});}
  if(body.action==='configure'){
   if(profile.role!=='admin')return json({error:'Administrator required'},403);
   const cfg={from_name:String(body.from_name||'').trim().slice(0,120),from_email:email(body.from_email),reply_to:email(body.reply_to),postal_address:String(body.postal_address||'').trim().slice(0,600)};
   if(!cfg.from_name||!valid(cfg.from_email)||(cfg.reply_to&&!valid(cfg.reply_to))||!cfg.postal_address)throw Error('Provide sender name, email and company postal address');
   const apiKey=String(body.api_key||'').trim()||await secret('EMAIL_MARKETING_API_KEY');if(!apiKey)throw Error('Provide a Resend API key with domain access');
   const response=await fetch('https://api.resend.com/domains?limit=100',{headers:{Authorization:'Bearer '+apiKey},signal:AbortSignal.timeout(15000)});
   const domains=await response.json().catch(()=>({}));if(!response.ok)throw Error('Cannot verify sender domain; check API key and domain access');
   if(!domains.data?.some((d:any)=>d.status==='verified'&&d.name.toLowerCase()===cfg.from_email.split('@')[1]))throw Error('Sender domain must be verified in Resend');
   if(body.api_key)await value(db.rpc('crm_email_set_secret',{p_value:apiKey}));
   await value(db.from('crm_email_sender').update({...cfg,enabled:true,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',true));return json({ok:true});
  }
  if(body.action==='queue'){
   const c=await value(userdb.from('crm_email_campaigns').select('*').eq('id',body.id).single());if(c.owner_id!==profile.id||c.status!=='draft')throw Error('Only your draft can be sent');
   const count=await value(db.rpc('crm_email_queue',{p_id:c.id,p_owner:profile.id,p_schedule:body.scheduled_at||null,p_html:cleanHTML(c.html)}));return json({ok:true,recipient_count:count});
  }
  if(body.action==='cancel'){
   const c=await value(userdb.from('crm_email_campaigns').select('id,owner_id,status').eq('id',body.id).single());if(c.owner_id!==profile.id&&profile.role!=='admin')throw Error('Only owner or admin may cancel');
   await value(db.from('crm_email_campaigns').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',c.id).in('status',['queued','scheduled','sending']));
   await value(db.from('crm_email_recipients').update({status:'skipped',error:'Cancelled'}).eq('campaign_id',c.id).eq('status','pending'));return json({ok:true});
  }
  return json({error:'Unknown action'},400);
 }catch(e){const message=e instanceof Error?e.message:'Unexpected error';return json({error:message},message.startsWith('401:')?401:message.startsWith('403:')?403:400);}
});
