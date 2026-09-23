import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DEFAULT_DESIGN,validateDesign,validateScope,readableInk} from '../src/experience.mjs';
test('Account 360 defaults are valid and unknown fields do not reach persistence',()=>{
 assert.deepEqual(validateDesign({...DEFAULT_DESIGN,unsafe:'ignore'}),DEFAULT_DESIGN);
 assert.equal(DEFAULT_DESIGN.primary,'#0AADA9');
});
test('invalid and injected design values are rejected',()=>{
 for(const change of [{primary:'url(https://example.com)'},{font:'anything; color:red'},{fontSize:14},{radius:'999'},{density:'random'},{sidebar:null}])assert.throws(()=>validateDesign({...DEFAULT_DESIGN,...change}));
});
test('Account scope requires paired valid IDs and valid branch codes',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 assert.throws(()=>validateScope({account_tenant_id:id}));
 assert.throws(()=>validateScope({eam_company_id:'not-a-uuid'}));
 assert.throws(()=>validateScope({branch_code:'bad space'}));
 assert.deepEqual(validateScope({account_tenant_id:id,account_company_id:id,branch_code:'HQ'}),{account_tenant_id:id,account_company_id:id,eam_company_id:'',branch_code:'HQ'});
 assert.equal(validateScope({}).account_company_id,'');
});
test('preview foreground is readable on black and white',()=>{
 assert.equal(readableInk('#FFFFFF'),'#172033');assert.equal(readableInk('#000000'),'#FFFFFF');
});
