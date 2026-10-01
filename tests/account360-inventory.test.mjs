import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAccountInventory,ACCOUNT360_URL} from '../src/account360-inventory.mjs';
const client={auth:{getSession:async()=>({data:{session:{access_token:'user-session'}}})}};
const signal=new AbortController().signal;
test('requires a real session and accepts only a complete Account 360 response',async()=>{
 await assert.rejects(fetchAccountInventory({auth:{getSession:async()=>({data:{}})}},signal),/เข้าสู่ระบบ/);
 const old=global.fetch;
 try{
  global.fetch=async(url,init)=>{assert.equal(url,ACCOUNT360_URL+'/api/integrations/cuto/inventory');assert.equal(init.headers.authorization,'Bearer user-session');return Response.json({service:'kc-account360-inventory',version:1,catalog:[],warehouses:[],balances:[]});};
  assert.equal((await fetchAccountInventory(client,signal)).catalog.length,0);
  global.fetch=async()=>Response.json({error:'Denied'},{status:403});await assert.rejects(fetchAccountInventory(client,signal),/Denied/);
  global.fetch=async()=>Response.json({catalog:[]});await assert.rejects(fetchAccountInventory(client,signal),/ไม่สมบูรณ์/);
 }finally{global.fetch=old;}
});
