import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/crm-user-admin/handler.mjs';
import {removeUser} from '../src/delete-user.mjs';
const actor='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
function fixture(overrides={}){
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:overrides.authError}),admin:{updateUserById:async(...args)=>{calls.push(['ban',...args]);return {error:overrides.banError};}}},
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:overrides.role||'admin',is_active:overrides.active!==false}})})})}),
 rpc:async(name,args)=>{if(name==='crm_actor_can')return {data:overrides.allowed??((overrides.role||'super_admin')==='super_admin'&&overrides.active!==false)};calls.push(['rpc',args]);return {data:{deleted:!!overrides.deleted},error:args.p_finalize?overrides.finishError:overrides.startError};}};
 const send=(body={user_id:target,confirm:true},opts={})=>createHandler(client)(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify(body),...opts}));
 return {calls,send};
}
test('active Super Admin: deactivate, ban, finalize in order',async()=>{
 const {send,calls}=fixture();assert.equal((await send()).status,200);
 assert.equal(calls[0][1].p_finalize,false);assert.equal(calls[0][1].p_actor,actor);
 assert.deepEqual(calls[1],['ban',target,{ban_duration:'876000h'}]);assert.equal(calls[2][1].p_finalize,true);
});
for(const [label,options,status] of [['invalid token',{authError:{}},401],['member',{role:'sales_user'},403],['ordinary admin',{role:'admin'},403],['incomplete onboarding',{allowed:false},403],['disabled admin',{active:false},403]])test(label+' cannot mutate',async()=>{
 const f=fixture(options);assert.equal((await f.send()).status,status);assert.equal(f.calls.length,0);
});
test('self deletion, malformed ID and missing confirmation cannot mutate',async()=>{
 for(const [body,status] of [[{user_id:actor,confirm:true},409],[{user_id:'bad',confirm:true},400],[{user_id:target},400]]){
 const f=fixture();assert.equal((await f.send(body)).status,status);assert.equal(f.calls.length,0);}
});
test('database rejection never bans',async()=>{const f=fixture({startError:{code:'42501'}});assert.equal((await f.send()).status,403);assert.equal(f.calls.length,1);});
test('ban failure leaves deactivated record retryable, no finalization',async()=>{
 const f=fixture({banError:{}}),r=await f.send();assert.equal(r.status,503);assert.equal((await r.json()).error,'disabled_retry_delete');assert.equal(f.calls.length,2);
});
test('finalization failure reports incomplete instead of success',async()=>{const f=fixture({finishError:{}});assert.equal((await f.send()).status,503);});
test('repeat completed removal is idempotent',async()=>{const f=fixture({deleted:true});assert.equal((await f.send()).status,200);assert.equal(f.calls.length,1);});
test('GET and anonymous calls cannot mutate',async()=>{
 const f=fixture();assert.equal((await f.send(undefined,{method:'GET',body:undefined})).status,405);assert.equal((await f.send(undefined,{headers:{}})).status,401);assert.equal(f.calls.length,0);
});
test('frontend sends explicit target and recognizes partial failure',async()=>{
 await removeUser({functions:{invoke:async(name,{body})=>{assert.equal(name,'crm-user-admin');assert.deepEqual(body,{user_id:target,confirm:true});return {data:{ok:true}};}}},target);
 await assert.rejects(removeUser({functions:{invoke:async()=>({error:{context:{json:async()=>({error:'disabled_retry_delete'})}}})}},target),/disabled_retry_delete/);
});
