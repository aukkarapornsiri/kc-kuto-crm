import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleExperience} from '../supabase/functions/crm-experience/handler.mjs';
const env=k=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:'server-only'})[k];
const request=()=>new Request('https://example.supabase.co/functions/v1/crm-experience',{headers:{Authorization:'Bearer test-user'}});
test('anonymous and invalid users cannot read appearance',async()=>{
 const response=await handleExperience(new Request('https://example.com'),env,()=>{throw Error('must not fetch');});assert.equal(response.status,401);
 assert.equal((await handleExperience(request(),env,async()=>new Response('{}',{status:401}))).status,401);
});
test('inactive CRM profile is denied before privileged read',async()=>{
 let calls=0;const response=await handleExperience(request(),env,async()=>{calls++;return Response.json(calls===1?{id:'user'}:[{is_active:false}]);});
 assert.equal(response.status,403);assert.equal(calls,2);
});
test('active member receives only appearance/locale and no privileged headers on user lookup',async()=>{
 let calls=0;const response=await handleExperience(request(),env,async(url,options)=>{
  calls++;if(calls<3)assert.equal(options.headers.Authorization,'Bearer test-user');
  if(calls===3){assert.ok(url.endsWith('company_settings?select=ui_design,default_language&id=eq.1'));assert.equal(options.headers.Authorization,'Bearer server-only');}
  return Response.json(calls===1?{id:'user'}:calls===2?[{is_active:true}]:[{ui_design:{primary:'#0AADA9'},default_language:'en',ecosystem_scope:{private:'not returned'}}]);
 });
 assert.deepEqual(await response.json(),{ui_design:{primary:'#0AADA9'},default_language:'en'});assert.equal(calls,3);
});
