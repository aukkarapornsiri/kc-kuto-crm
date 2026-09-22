import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const env=(n:string)=>(Deno.env.get(n)??"").trim();
const supabaseUrl=env("SUPABASE_URL"), anonKey=env("SUPABASE_ANON_KEY"), serviceKey=env("SUPABASE_SERVICE_ROLE_KEY");
const siteUrl=env("KC_KUTO_SITE_URL")||"https://aukkarapornsiri.github.io/kc-kuto-crm/";
const adminClient=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const secretCache=new Map<string,string>();

async function secret(name:string){
  if(secretCache.has(name)) return secretCache.get(name)??"";
  const direct=env(name);
  if(direct){secretCache.set(name,direct);return direct;}
  const {data,error}=await adminClient.rpc("kc_get_integration_secret",{p_name:name});
  const value=error?"":String(data??"").trim();
  secretCache.set(name,value);
  return value;
}
async function config(provider:string){
  const {data}=await adminClient.from("integration_connections").select("config").eq("provider",provider).maybeSingle();
  return (data?.config??{}) as Record<string,unknown>;
}
async function currentUser(req:Request){
  const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");
  if(!token)return null;
  const verifier=createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await verifier.auth.getUser(token);
  return error?null:data.user;
}
async function getProfile(id:string){
  const {data}=await adminClient.from("profiles").select("id,email,display_name,role,custom_role_key,is_active").eq("id",id).maybeSingle();
  return data;
}
async function requireAdmin(req:Request){
  const user=await currentUser(req); if(!user)return{error:json({error:"Unauthorized"},401)};
  const profile=await getProfile(user.id);
  if(!profile?.is_active||profile.role!=="admin")return{error:json({error:"Admin permission required"},403)};
  return{user,profile};
}
async function requirePermission(req:Request,module:string,action:string){
  const user=await currentUser(req); if(!user)return{error:json({error:"Unauthorized"},401)};
  const profile=await getProfile(user.id); if(!profile?.is_active)return{error:json({error:"Inactive user"},403)};
  if(profile.role==="admin")return{user,profile};
  const roleKey=profile.role==="custom"?profile.custom_role_key:profile.role;
  const {data}=await adminClient.from("role_permissions").select("*").eq("role_key",roleKey).eq("module",module).maybeSingle();
  const field=({view:"can_view",create:"can_create",edit:"can_edit",delete:"can_delete",export:"can_export",approve:"can_approve",assign:"can_assign",import:"can_import",manage_settings:"can_manage_settings"} as Record<string,string>)[action];
  if(!field||!data?.[field])return{error:json({error:"Permission denied"},403)};
  return{user,profile};
}
async function setStatus(provider:string,status:string,error?:string|null){
  const patch:any={status,enabled:status==="connected"||status==="configured",last_checked_at:new Date().toISOString(),last_error:error??null,updated_at:new Date().toISOString()};
  if(status==="connected")patch.last_success_at=new Date().toISOString();
  await adminClient.from("integration_connections").update(patch).eq("provider",provider);
}
async function startRun(provider:string,resource:string,direction:string,userId?:string|null){
  const {data}=await adminClient.from("integration_sync_runs").insert({provider,resource,direction,requested_by:userId??null,status:"running"}).select().single();
  return data?.id??null;
}
async function finishRun(id:string|null,status:string,c:any={},details:any={},error?:string|null){
  if(!id)return;
  await adminClient.from("integration_sync_runs").update({status,records_seen:c.seen??0,records_created:c.created??0,records_updated:c.updated??0,records_failed:c.failed??0,details,error_message:error??null,finished_at:new Date().toISOString()}).eq("id",id);
}
async function msConfig(){
  const c=await config("microsoft_calendar");
  return{
    tenant:await secret("MS365_TENANT_ID"),
    clientId:await secret("MS365_CLIENT_ID"),
    clientSecret:await secret("MS365_CLIENT_SECRET"),
    calendarUser:String(c.calendar_user??"").trim()
  };
}
async function msToken(){
  const c=await msConfig();
  if(!c.tenant||!c.clientId||!c.clientSecret)return null;
  const body=new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,scope:"https://graph.microsoft.com/.default",grant_type:"client_credentials"});
  const r=await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  if(!r.ok)throw new Error(`Microsoft token request failed (${r.status})`);
  return (await r.json()).access_token as string;
}
async function googleToken(){
  const clientId=await secret("GOOGLE_CLIENT_ID"),clientSecret=await secret("GOOGLE_CLIENT_SECRET"),refreshToken=await secret("GOOGLE_REFRESH_TOKEN");
  if(!clientId||!clientSecret||!refreshToken)return null;
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  if(!r.ok)throw new Error(`Google OAuth token request failed (${r.status})`);
  return (await r.json()).access_token as string;
}
async function checkProvider(provider:string){
  if(provider==="microsoft_intune"){
    const token=await msToken();if(!token)return{configured:false,connected:false,message:"Microsoft Graph credentials missing"};
    const r=await fetch("https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$top=1&$select=id,deviceName",{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});
    if(!r.ok)throw new Error(`Intune Graph check failed (${r.status})`);
    return{configured:true,connected:true,message:"Microsoft Intune connected"};
  }
  if(provider==="microsoft_calendar"){
    const c=await msConfig(),token=await msToken();
    if(!token||!c.calendarUser)return{configured:false,connected:false,message:"Microsoft Calendar credentials or calendar user missing"};
    const r=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.calendarUser)}/calendar?$select=id,name,owner`,{headers:{Authorization:`Bearer ${token}`}});
    if(!r.ok)throw new Error(`Microsoft Calendar check failed (${r.status})`);
    const cal=await r.json();return{configured:true,connected:true,account:c.calendarUser,calendar:cal.name??null};
  }
  if(provider==="google_calendar"){
    const token=await googleToken();if(!token)return{configured:false,connected:false,message:"Google Calendar OAuth credentials missing"};
    const c=await config("google_calendar"),calendarId=String(c.calendar_id??"primary");
    const r=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,{headers:{Authorization:`Bearer ${token}`}});
    if(!r.ok)throw new Error(`Google Calendar check failed (${r.status})`);
    const cal=await r.json();return{configured:true,connected:true,account:cal.id??calendarId,calendar:cal.summary??null};
  }
  if(provider==="inventory"){
    const c=await config("inventory"),base=String(c.base_url??"").replace(/\/$/,""),apiKey=await secret("INVENTORY_API_KEY");
    if(!base||!apiKey)return{configured:false,connected:false,message:"Inventory API endpoint or key missing"};
    const path=String(c.assets_path??"/api/assets"),header=String(c.auth_header??"Authorization"),scheme=String(c.auth_scheme??"Bearer");
    const headers:any={Accept:"application/json"};headers[header]=scheme?`${scheme} ${apiKey}`:apiKey;
    const join=path.includes("?")?"&":"?",r=await fetch(`${base}${path}${join}limit=1`,{headers});
    if(!r.ok)throw new Error(`Inventory API check failed (${r.status})`);
    return{configured:true,connected:true,endpoint:base};
  }
  if(provider==="stripe"){
    const key=await secret("STRIPE_SECRET_KEY"),webhook=await secret("STRIPE_WEBHOOK_SECRET"),c=await config("stripe");
    const professional=String(c.professional_price_id??"")||env("STRIPE_PRICE_PROFESSIONAL_YEARLY");
    const enterprise=String(c.enterprise_price_id??"")||env("STRIPE_PRICE_ENTERPRISE_YEARLY");
    if(!key||!webhook||!professional||!enterprise)return{configured:false,connected:false,message:"Stripe secret key, webhook secret, or Price IDs are incomplete"};
    const headers={Authorization:`Bearer ${key}`};
    const accountResp=await fetch("https://api.stripe.com/v1/account",{headers});
    if(!accountResp.ok)throw new Error(`Stripe account check failed (${accountResp.status})`);
    for(const priceId of [professional,enterprise]){
      const priceResp=await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,{headers});
      if(!priceResp.ok)throw new Error(`Stripe Price check failed for ${priceId} (${priceResp.status})`);
      const price=await priceResp.json();
      if(price.active!==true)throw new Error(`Stripe Price ${priceId} is not active`);
    }
    const acc=await accountResp.json();
    const {count:webhookCount}=await adminClient.from("billing_webhook_events").select("*",{count:"exact",head:true}).eq("status","processed");
    const webhookVerified=(webhookCount??0)>0;
    return{configured:true,connected:webhookVerified,webhook_verified:webhookVerified,account:acc.id??null,country:acc.country??null,message:webhookVerified?"Stripe API, Prices, and webhook signature verified":"Stripe API and Prices verified; waiting for the first signature-verified webhook event"};
  }
  throw new Error("Unknown provider");
}
const allowedConfig:any={
  microsoft_intune:{secrets:["MS365_TENANT_ID","MS365_CLIENT_ID","MS365_CLIENT_SECRET"],config:[]},
  microsoft_calendar:{secrets:["MS365_TENANT_ID","MS365_CLIENT_ID","MS365_CLIENT_SECRET"],config:["calendar_user"]},
  google_calendar:{secrets:["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","GOOGLE_REFRESH_TOKEN"],config:["calendar_id"]},
  inventory:{secrets:["INVENTORY_API_KEY"],config:["base_url","assets_path","auth_header","auth_scheme"]},
  stripe:{secrets:["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"],config:["professional_price_id","enterprise_price_id"]}
};
async function handleConfigure(req:Request){
  const admin=await requireAdmin(req);if("error"in admin)return admin.error;
  const body=await req.json().catch(()=>({})),provider=String(body.provider??""),spec=allowedConfig[provider];
  if(!spec)return json({error:"Unsupported provider"},400);
  const incomingSecrets=body.secrets??{},incomingConfig=body.config??{};
  for(const name of spec.secrets){
    const value=String(incomingSecrets[name]??"").trim();
    if(value){const {error}=await adminClient.rpc("kc_set_integration_secret",{p_name:name,p_value:value});if(error)return json({error:error.message},400);secretCache.delete(name);}
  }
  const safeConfig:any={};
  for(const key of spec.config){if(incomingConfig[key]!==undefined)safeConfig[key]=incomingConfig[key];}
  if(Object.keys(safeConfig).length){
    const current=await config(provider);
    await adminClient.from("integration_connections").update({config:{...current,...safeConfig},updated_by:admin.user.id,updated_at:new Date().toISOString()}).eq("provider",provider);
  }
  try{
    const result=await checkProvider(provider),status=result.connected?"connected":result.configured?"configured":"not_configured";
    await setStatus(provider,status,result.connected?null:result.message??null);
    return json({ok:true,provider,status,...result});
  }catch(e){
    const message=e instanceof Error?e.message:"Connection test failed";await setStatus(provider,"error",message);
    return json({ok:true,provider,status:"error",connected:false,error:message});
  }
}
async function handleStatus(req:Request){
  const admin=await requireAdmin(req);if("error"in admin)return admin.error;
  const {data}=await adminClient.from("integration_connections").select("provider,display_name,category,enabled,status,config,required_secrets,last_checked_at,last_success_at,last_error").order("category").order("provider");
  const {data:presence}=await adminClient.rpc("kc_integration_secret_presence");
  const present=new Set((presence??[]).filter((x:any)=>x.present).map((x:any)=>x.secret_name));
  return json({integrations:(data??[]).map((x:any)=>{
    const credentials_present=(x.required_secrets??[]).every((n:string)=>present.has(n)||Boolean(env(n)));
    return{
      ...x,
      status:credentials_present?x.status:"not_configured",
      enabled:credentials_present?x.enabled:false,
      config:x.provider==="stripe"?{...(x.config??{}),webhook_url:`${supabaseUrl}/functions/v1/stripe-webhook`}:x.config,
      credentials_present
    };
  })});
}
async function handleCheck(req:Request){
  const admin=await requireAdmin(req);if("error"in admin)return admin.error;
  const provider=String((await req.json().catch(()=>({})))?.provider??""),run=await startRun(provider,"connection","health_check",admin.user.id);
  try{const result=await checkProvider(provider),status=result.connected?"connected":result.configured?"configured":"not_configured";await setStatus(provider,status,result.connected?null:result.message??null);await finishRun(run,result.connected?"success":"skipped",{},result);return json({provider,status,...result});}
  catch(e){const message=e instanceof Error?e.message:"Connection test failed";await setStatus(provider,"error",message);await finishRun(run,"failed",{}, {},message);return json({provider,status:"error",connected:false,error:message},502);}
}
async function handleIntune(req:Request){
  const access=await requirePermission(req,"assets","view");if("error"in access)return access.error;
  const token=await msToken();if(!token)return json({devices:[],configured:false,status:"not_configured"});
  let next:string|null="https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$top=999&$select=id,deviceName,serialNumber,manufacturer,model,managementState,complianceState,lastSyncDateTime,operatingSystem,osVersion,userPrincipalName";
  const devices:any[]=[];let pages=0;
  while(next&&pages<5){const r=await fetch(next,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});if(!r.ok)return json({error:`Microsoft Graph failed (${r.status})`},502);const d=await r.json();devices.push(...(d.value??[]));next=d["@odata.nextLink"]??null;pages++;}
  await setStatus("microsoft_intune","connected",null);return json({devices,truncated:Boolean(next),configured:true,status:"connected"});
}
function times(a:any){const start=new Date(a.scheduled_at),end=new Date(start.getTime()+3600000);return{start,end};}
async function pushMicrosoft(a:any){
  const c=await msConfig(),token=await msToken();if(!token||!c.calendarUser)throw new Error("Microsoft Calendar is not configured");
  const {start,end}=times(a),body:any={subject:a.subject,body:{contentType:"HTML",content:a.description||""},start:{dateTime:start.toISOString().replace("Z",""),timeZone:"UTC"},end:{dateTime:end.toISOString().replace("Z",""),timeZone:"UTC"},isOnlineMeeting:a.type==="Online Meeting"};
  if(a.type==="Online Meeting")body.onlineMeetingProvider="teamsForBusiness";
  const r=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.calendarUser)}/calendar/events`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(`Microsoft Calendar create failed (${r.status})`);
  const event=await r.json();return{id:event.id,calendarId:"primary",webUrl:event.webLink??null,meetingUrl:event.onlineMeeting?.joinUrl??null};
}
async function pushGoogle(a:any){
  const token=await googleToken();if(!token)throw new Error("Google Calendar is not configured");
  const c=await config("google_calendar"),calendarId=String(c.calendar_id??"primary"),{start,end}=times(a);
  const body:any={summary:a.subject,description:a.description||"",start:{dateTime:start.toISOString(),timeZone:"Asia/Bangkok"},end:{dateTime:end.toISOString(),timeZone:"Asia/Bangkok"}};
  let qs="?sendUpdates=all";
  if(a.type==="Online Meeting"){body.conferenceData={createRequest:{requestId:crypto.randomUUID(),conferenceSolutionKey:{type:"hangoutsMeet"}}};qs+="&conferenceDataVersion=1";}
  const r=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${qs}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(`Google Calendar create failed (${r.status})`);
  const event=await r.json();return{id:event.id,calendarId,webUrl:event.htmlLink??null,meetingUrl:event.hangoutLink??null};
}
async function handleCalendarPush(req:Request){
  const access=await requirePermission(req,"activities","edit");if("error"in access)return access.error;
  const body=await req.json().catch(()=>({})),provider=String(body.provider??""),activityId=String(body.activity_id??"");
  if(!["microsoft_calendar","google_calendar"].includes(provider)||!activityId)return json({error:"provider and activity_id are required"},400);
  const {data:a}=await adminClient.from("activities").select("*").eq("id",activityId).maybeSingle();if(!a)return json({error:"Activity not found"},404);
  const run=await startRun(provider,"calendar_event","push",access.user.id);
  try{
    const event=provider==="microsoft_calendar"?await pushMicrosoft(a):await pushGoogle(a);
    await adminClient.from("calendar_event_links").upsert({activity_id:activityId,provider,external_event_id:event.id,external_calendar_id:event.calendarId,web_url:event.webUrl,sync_status:"synced",last_error:null,last_synced_at:new Date().toISOString()},{onConflict:"activity_id,provider"});
    await adminClient.from("activities").update({calendar_provider:provider,external_event_id:event.id,external_calendar_id:event.calendarId,meeting_url:event.meetingUrl,sync_status:"synced",sync_error:null,updated_at:new Date().toISOString()}).eq("id",activityId);
    await setStatus(provider,"connected",null);await finishRun(run,"success",{seen:1,updated:1},{external_event_id:event.id});
    return json({ok:true,provider,activity_id:activityId,...event});
  }catch(e){
    const message=e instanceof Error?e.message:"Calendar sync failed";await adminClient.from("activities").update({sync_status:"error",sync_error:message}).eq("id",activityId);await setStatus(provider,message.includes("not configured")?"not_configured":"error",message);await finishRun(run,"failed",{seen:1,failed:1},{},message);return json({error:message,provider},message.includes("not configured")?409:502);
  }
}
async function inventorySettings(){
  const c=await config("inventory");
  return{base:String(c.base_url??"").replace(/\/$/,""),path:String(c.assets_path??"/api/assets"),header:String(c.auth_header??"Authorization"),scheme:String(c.auth_scheme??"Bearer"),key:await secret("INVENTORY_API_KEY")};
}
async function inventoryRequest(path:string,init:RequestInit={}){
  const s=await inventorySettings();if(!s.base||!s.key)throw new Error("Inventory system is not configured");
  const headers=new Headers(init.headers??{});headers.set("Accept","application/json");headers.set(s.header,s.scheme?`${s.scheme} ${s.key}`:s.key);if(init.body)headers.set("Content-Type","application/json");
  return fetch(`${s.base}${path}`,{...init,headers});
}
function normalizeAsset(row:any){
  const externalId=String(row.id??row.asset_id??row.code??row.asset_code??row.serial_number??row.serial??crypto.randomUUID()),raw=String(row.status??row.asset_status??"active").toLowerCase(),allowed=["active","inactive","expired","maintenance","inuse","spare","retired","replaced"];
  return{source_provider:"inventory",external_source_id:externalId,name:String(row.name??row.asset_name??row.device_name??externalId),customer_name:String(row.customer_name??row.customer??""),category:String(row.category??row.asset_category??"Other"),brand:String(row.brand??row.manufacturer??""),model:String(row.model??""),serial_number:row.serial_number??row.serial??null,warranty_start:row.warranty_start??null,warranty_end:row.warranty_end??null,status:allowed.includes(raw)?raw:"active",location:row.location??null,last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()};
}
async function handleInventoryPull(req:Request){
  const access=await requirePermission(req,"assets","import");if("error"in access)return access.error;const s=await inventorySettings(),run=await startRun("inventory","assets","pull",access.user.id);
  try{
    const r=await inventoryRequest(s.path);if(!r.ok)throw new Error(`Inventory pull failed (${r.status})`);const payload=await r.json(),rows=Array.isArray(payload)?payload:(payload.assets??payload.items??payload.data??[]);let created=0,updated=0,failed=0;
    for(const row of rows){try{const item=normalizeAsset(row),{data:existing}=await adminClient.from("assets").select("id").eq("source_provider","inventory").eq("external_source_id",item.external_source_id).maybeSingle();if(existing?.id){await adminClient.from("assets").update(item).eq("id",existing.id);updated++;}else{await adminClient.from("assets").insert(item);created++;}}catch{failed++;}}
    const status=failed?"partial":"success";await setStatus("inventory","connected",null);await finishRun(run,status,{seen:rows.length,created,updated,failed},{source:s.path});return json({ok:true,status,seen:rows.length,created,updated,failed});
  }catch(e){const message=e instanceof Error?e.message:"Inventory sync failed";await setStatus("inventory",message.includes("not configured")?"not_configured":"error",message);await finishRun(run,"failed",{}, {},message);return json({error:message},message.includes("not configured")?409:502);}
}
async function handleInventoryPush(req:Request){
  const access=await requirePermission(req,"assets","edit");if("error"in access)return access.error;const body=await req.json().catch(()=>({})),assetId=String(body.asset_id??""),{data:a}=await adminClient.from("assets").select("*").eq("id",assetId).maybeSingle();if(!a)return json({error:"Asset not found"},404);
  const s=await inventorySettings(),method=a.external_source_id?"PUT":"POST",remote=a.external_source_id?`${s.path}/${encodeURIComponent(a.external_source_id)}`:s.path,run=await startRun("inventory","asset","push",access.user.id);
  try{const r=await inventoryRequest(remote,{method,body:JSON.stringify(a)});if(!r.ok)throw new Error(`Inventory push failed (${r.status})`);const result=await r.json().catch(()=>({})),externalId=String(result.id??result.asset_id??a.external_source_id??"");await adminClient.from("assets").update({source_provider:"inventory",external_source_id:externalId||a.external_source_id,last_synced_at:new Date().toISOString()}).eq("id",assetId);await setStatus("inventory","connected",null);await finishRun(run,"success",{seen:1,updated:1},{external_id:externalId||null});return json({ok:true,external_id:externalId||null});}
  catch(e){const message=e instanceof Error?e.message:"Inventory push failed";await setStatus("inventory",message.includes("not configured")?"not_configured":"error",message);await finishRun(run,"failed",{seen:1,failed:1},{},message);return json({error:message},message.includes("not configured")?409:502);}
}
async function stripe(path:string,params?:URLSearchParams){
  const key=await secret("STRIPE_SECRET_KEY");if(!key)throw new Error("Stripe Billing is not configured");
  const r=await fetch(`https://api.stripe.com/v1${path}`,{method:params?"POST":"GET",headers:{Authorization:`Bearer ${key}`,...(params?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body:params});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error?.message??`Stripe request failed (${r.status})`);return data;
}
async function ensureStripeCustomer(user:any,profile:any){
  const {data:b}=await adminClient.from("billing_account").select("*").eq("id",1).single();if(b?.customer_external_id)return b.customer_external_id;
  const p=new URLSearchParams();if(user.email)p.set("email",user.email);p.set("name",profile?.display_name||user.email||"KC KuTo Admin");p.set("metadata[kc_kuto_profile_id]",user.id);const customer=await stripe("/customers",p);await adminClient.from("billing_account").update({customer_external_id:customer.id,status:"configured",updated_at:new Date().toISOString()}).eq("id",1);return customer.id as string;
}
async function handleCheckout(req:Request){
  const admin=await requireAdmin(req);if("error"in admin)return admin.error;const body=await req.json().catch(()=>({})),planKey=String(body.plan_key??"professional_yearly"),{data:plan}=await adminClient.from("billing_plans").select("*").eq("plan_key",planKey).eq("active",true).maybeSingle();if(!plan)return json({error:"Plan not found"},404);
  const c=await config("stripe"),priceId=String(planKey==="enterprise_yearly"?c.enterprise_price_id??"":c.professional_price_id??"")||env(plan.stripe_price_env_key||"");
  if(!(await secret("STRIPE_SECRET_KEY"))||!priceId){await setStatus("stripe","not_configured","Stripe key or price ID missing");return json({error:"Stripe Billing is not configured",configured:false},409);}
  try{const customerId=await ensureStripeCustomer(admin.user,admin.profile),p=new URLSearchParams();p.set("mode","subscription");p.set("customer",customerId);p.set("line_items[0][price]",priceId);p.set("line_items[0][quantity]","1");p.set("success_url",`${siteUrl}?billing=success`);p.set("cancel_url",`${siteUrl}?billing=cancelled`);p.set("client_reference_id",admin.user.id);p.set("metadata[plan_key]",planKey);const session=await stripe("/checkout/sessions",p);await setStatus("stripe","configured","Checkout created; waiting for a signature-verified Stripe webhook before Connected");return json({ok:true,url:session.url,session_id:session.id,status:"configured"});}
  catch(e){const message=e instanceof Error?e.message:"Stripe checkout failed";await setStatus("stripe","error",message);return json({error:message},502);}
}
async function handlePortal(req:Request){
  const admin=await requireAdmin(req);if("error"in admin)return admin.error;const {data:b}=await adminClient.from("billing_account").select("*").eq("id",1).single();if(!b?.customer_external_id)return json({error:"Stripe customer is not configured"},409);
  try{const p=new URLSearchParams();p.set("customer",b.customer_external_id);p.set("return_url",siteUrl);const session=await stripe("/billing_portal/sessions",p);return json({ok:true,url:session.url});}catch(e){return json({error:e instanceof Error?e.message:"Stripe portal failed"},502);}
}
function localInsight(prompt:string,system?:string){const text=prompt.trim().replace(/\s+/g," "),thai=/[ก-๙]/.test(text),short=text.length>900?text.slice(0,900)+"…":text;return thai?["AI Insight","• สรุป: "+(short||"ยังไม่มีข้อมูลเพียงพอ"),"• คำแนะนำ: ตรวจสอบข้อมูลลูกค้า สถานะ Pipeline และกิจกรรมล่าสุดก่อนดำเนินการขั้นถัดไป",system?"• ใช้บริบทระบบประกอบแล้ว":""].filter(Boolean).join("\n"):["AI Insight","• Summary: "+(short||"Not enough information."),"• Recommended next step: validate customer context, pipeline status, and latest activity.",system?"• System context was incorporated.":""].filter(Boolean).join("\n");}
async function handleAi(req:Request){const access=await requirePermission(req,"ai","view");if("error"in access)return access.error;const body=await req.json().catch(()=>({})),prompt=String(body.prompt??"").trim();if(!prompt)return json({error:"prompt is required"},400);return json({text:localInsight(prompt,body.system)});}
function tempPassword(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%",bytes=crypto.getRandomValues(new Uint8Array(18));return Array.from(bytes,b=>chars[b%chars.length]).join("");}
async function handleInvite(req:Request){const admin=await requireAdmin(req);if("error"in admin)return admin.error;const body=await req.json().catch(()=>({})),email=String(body.email??"").trim().toLowerCase();if(!email||!email.includes("@"))return json({error:"Valid email is required"},400);const {data,error}=await adminClient.auth.admin.inviteUserByEmail(email,{redirectTo:siteUrl});if(error)return json({error:error.message},400);if(data.user?.id&&body.role)await adminClient.from("profiles").update({role:body.role,department_group:body.department_group??"Sales",updated_at:new Date().toISOString()}).eq("id",data.user.id);return json({ok:true,user_id:data.user?.id??null,email});}
async function handleReset(req:Request){const admin=await requireAdmin(req);if("error"in admin)return admin.error;const body=await req.json().catch(()=>({})),userId=String(body.user_id??"").trim();if(!userId)return json({error:"user_id is required"},400);const password=tempPassword(),{error}=await adminClient.auth.admin.updateUserById(userId,{password});if(error)return json({error:error.message},400);return json({ok:true,temporary_password:password});}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  const path=new URL(req.url).pathname;
  try{
    if(path.endsWith("/integrations/status"))return await handleStatus(req);
    if(path.endsWith("/integrations/configure"))return await handleConfigure(req);
    if(path.endsWith("/integrations/check"))return await handleCheck(req);
    if(path.endsWith("/intune-devices"))return await handleIntune(req);
    if(path.endsWith("/calendar/push"))return await handleCalendarPush(req);
    if(path.endsWith("/inventory/pull"))return await handleInventoryPull(req);
    if(path.endsWith("/inventory/push"))return await handleInventoryPush(req);
    if(path.endsWith("/billing/checkout"))return await handleCheckout(req);
    if(path.endsWith("/billing/portal"))return await handlePortal(req);
    if(path.endsWith("/ai-insight"))return await handleAi(req);
    if(path.endsWith("/admin/invite-user"))return await handleInvite(req);
    if(path.endsWith("/admin/reset-password"))return await handleReset(req);
    if(path.endsWith("/health")||path.endsWith("/server"))return json({ok:true,service:"kc-kuto-server",version:8});
    return json({error:"Not found",path},404);
  }catch(e){return json({error:e instanceof Error?e.message:"Unexpected server error"},500);}
});