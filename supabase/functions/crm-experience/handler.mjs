// Public function code; all privileged credentials are read only from server environment.
export async function handleExperience(request,env,requestFetch=fetch) {
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'GET,OPTIONS','Content-Type':'application/json','Cache-Control':'private, no-store'};
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return new Response('ok',{headers});
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer .+/i.test(authorization))return json({error:'Unauthorized'},401);
 const base=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
 try {
  const userResponse=await requestFetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:authorization}});
  if(!userResponse.ok)return json({error:'Unauthorized'},401);
  const user=await userResponse.json();
  if(!user.id)return json({error:'Unauthorized'},401);
  const profileResponse=await requestFetch(base+'/rest/v1/profiles?select=is_active&id=eq.'+encodeURIComponent(user.id),{headers:{apikey:anon,Authorization:authorization}});
  if(!profileResponse.ok)return json({error:'CRM access required'},403);
  const profiles=await profileResponse.json();
  if(profiles.length!==1||profiles[0].is_active!==true)return json({error:'Active CRM profile required'},403);
  // Return appearance only. Company details and ecosystem reference IDs stay behind admin RLS.
  const response=await requestFetch(base+'/rest/v1/company_settings?select=ui_design&id=eq.1',{headers:{apikey:service,Authorization:'Bearer '+service}});
  if(!response.ok)return json({error:'Unable to load appearance'},502);
  const rows=await response.json();
  return json({ui_design:rows[0]?.ui_design??null});
 }catch{return json({error:'Appearance service unavailable'},502);}
}
