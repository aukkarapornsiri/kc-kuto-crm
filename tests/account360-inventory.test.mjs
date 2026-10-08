import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAccountInventory} from '../src/account360-inventory.mjs';
test('disconnected Account 360 connector never sends a CRM token to the external system',async()=>{
 const original=global.fetch;let calls=0;
 try{global.fetch=async()=>{calls++;throw Error('Unexpected external request');};
 for(const client of [{},{auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})}}])await assert.rejects(fetchAccountInventory(client,new AbortController().signal),/Direct connection disconnected/);
 assert.equal(calls,0);
 }finally{global.fetch=original;}
});
