import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateMaster,CATEGORIES} from '../src/master-data.mjs';
const base={category:'unit',code:' pcs ',name_th:'ชิ้น',name_en:'Piece',sort_order:0,status:'active'};
test('all reference categories accept valid bilingual values and canonicalize codes',()=>{for(const [category] of CATEGORIES)assert.equal(validateMaster({...base,category}).code,'PCS');});
test('rejects empty names, unknown categories/status and invalid orders',()=>{for(const patch of [{name_th:''},{category:'profiles'},{status:'deleted'},{sort_order:''},{sort_order:-1},{sort_order:0.1},{sort_order:10000},{code:'<script>'},{code:'x'.repeat(41)}])assert.throws(()=>validateMaster({...base,...patch}));});
test('only allowed fields reach the backend',()=>{const value=validateMaster({...base,version:999,id:'foreign-id',role:'admin'});assert.equal(value.version,undefined);assert.equal(value.id,undefined);assert.equal(value.role,undefined);});

test('optional English name, description, category references and forged fields',()=>{assert.equal(validateMaster({...base,name_en:'',description:' Sample '}).name_en,'ชิ้น');assert.equal(validateMaster({...base,description:' Sample '}).description,'Sample');assert.throws(()=>validateMaster({...base,description:'x'.repeat(5001)}));assert.throws(()=>validateMaster({...base,category:'product_category',income_account_id:'not-a-uuid'}));assert.equal(validateMaster({...base,category:'unit',income_account_id:'00000000-0000-4000-8000-000000000001'}).income_account_id,null);});
