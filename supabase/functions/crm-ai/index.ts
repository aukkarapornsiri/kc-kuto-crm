import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {validateConfig,publicConfig,callProvider} from './providers.mjs';
const base=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(base,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const read=async(q:any)=>{const {data,error}=await q;if(error)throw Error(error.code==='40001'?'409: Configuration changed. Reload and retry.':'Server configuration storage failed');return data;};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return json({error:'Sign in required'},401);
  const userdb=createClient(base,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data,error}=await userdb.auth.getUser(authorization.slice(7));if(error||!data.user)return json({error:'Session expired'},401);
  const profile=await read(db.from('profiles').select('id,role,custom_role_key,is_active,is_super_admin').eq('id',data.user.id).maybeSingle());
  if(!profile?.is_active)return json({error:'Inactive user'},403);
  const raw=await req.text();if(raw.length>24000)return json({error:'Request too large'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
  const action=body.action||'generate';if(!['status','configure','test','disable','generate'].includes(action))return json({error:'Unknown action'},400);
  const admin=profile.role==='admin'||profile.is_super_admin===true;
  if(action!=='generate'&&!admin)return json({error:'Only an administrator can manage AI connections'},403);
  if(!admin){const permission=await read(db.from('role_permissions').select('can_view').eq('role_key',profile.role==='custom'?profile.custom_role_key:profile.role).eq('module','ai').maybeSingle());if(!permission?.can_view)return json({error:'AI permission required'},403);}
  const company='KC CuTo CRM'; // Application scope is server-owned, never a user-editable profile field.
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(company)))).map(x=>x.toString(16).padStart(2,'0')).join('');const name='KC_CRM_AI_'+digest;
  const saved=await read(db.rpc('kc_get_integration_secret',{p_name:name}));let config=saved?JSON.parse(saved):null;
  const store=async(next:any)=>{next={...next,revision:crypto.randomUUID(),updated_at:new Date().toISOString()};await read(db.rpc('crm_ai_store_config',{p_name:name,p_config:JSON.stringify(next),p_expected_revision:config?.revision||null}));config=next;return next;};
  if(action==='status')return json({...publicConfig(config),company});
  if(action==='configure'){if((body.revision||null)!==(config?.revision||null))return json({error:'Configuration changed. Reload and retry.'},409);await store(validateConfig(body,config||{}));return json({...publicConfig(config),company});}
  if(action==='disable'){if(config)await store({...config,enabled:false});return json({...publicConfig(config),company});}
  if(!config?.api_key)return json({error:'AI is not configured. Ask your administrator to save and test a connection.'},409);
  if(action==='generate'&&(!config.enabled||!config.verified_at))return json({error:'AI connection is disabled or has not passed a connection test.'},409);
  if(!await read(db.rpc('crm_ai_rate_limit',{p_user:profile.id})))return json({error:'Too many AI requests. Wait one minute and retry.'},429);
  if(action==='test'){
   try{await callProvider(config,'Reply with the word OK only.');await store({...config,enabled:true,verified_at:new Date().toISOString(),last_error:null});return json({...publicConfig(config),company});}
   catch(e){const message=e instanceof Error?e.message:'Connection test failed';await store({...config,enabled:false,verified_at:null,last_error:message});return json({error:message,...publicConfig(config)},422);}
  }
  const prompt=String(body.prompt||'').trim(),system=String(body.system||'');if(!prompt||prompt.length>12000||system.length>4000)return json({error:'Prompt is required and must be within the allowed length'},400);
  return json({text:await callProvider(config,prompt,{system,maxTokens:body.maxTokens}),provider:config.provider,model:config.model});
 }catch(e){const message=e instanceof Error?e.message:'AI request failed';return json({error:message},message.startsWith('409:')?409:400);}
});
