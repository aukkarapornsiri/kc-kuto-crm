const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createHandler(admin) {
  const reply = (status, body) => new Response(JSON.stringify(body), {status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  return async req => {
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
    if(req.method!=='POST') return reply(405,{error:'method_not_allowed'});
    try {
      const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if(!token) return reply(401,{error:'unauthorized'});
      const {data:auth,error:authError} = await admin.auth.getUser(token);
      if(authError||!auth?.user) return reply(401,{error:'unauthorized'});
      const {data:allowed,error:accessError}=await admin.rpc('crm_actor_can',{p_actor:auth.user.id,p_module:'access',p_action:'delete'});
      if(accessError)return reply(503,{error:'unavailable'});
      if(allowed!==true)return reply(403,{error:'forbidden'});
      let body; try { body=await req.json(); } catch { return reply(400,{error:'invalid_request'}); }
      if(!body||!uuid.test(body.user_id||'')||body.confirm!==true) return reply(400,{error:'invalid_request'});
      if(body.user_id===auth.user.id) return reply(409,{error:'cannot_delete_self'});
      // Deactivate first: CRM RLS rejects even an existing access token.
      const args={p_actor:auth.user.id,p_target:body.user_id,p_finalize:false};
      const {data:started,error:startError} = await admin.rpc('crm_archive_user',args);
      if(startError) return reply(startError.code==='42501'?403:startError.code==='P0002'?404:409,{error:'archive_rejected'});
      if(started?.deleted) return reply(200,{ok:true});
      const {error:banError} = await admin.auth.admin.updateUserById(body.user_id,{ban_duration:'876000h'});
      if(banError) return reply(503,{error:'disabled_retry_delete'});
      const {error:finishError} = await admin.rpc('crm_archive_user',{...args,p_finalize:true});
      if(finishError) return reply(503,{error:'disabled_retry_delete'});
      return reply(200,{ok:true});
    } catch { return reply(503,{error:'unavailable_retry'}); }
  };
}
