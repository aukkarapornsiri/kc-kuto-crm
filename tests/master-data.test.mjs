import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateMaster,CATEGORIES} from '../src/master-data.mjs';
const base={category:'unit',code:' pcs ',name_th:'ชิ้น',name_en:'Piece',sort_order:0,status:'active'};
test('all reference categories accept valid bilingual values and canonicalize codes',()=>{for(const [category] of CATEGORIES)assert.equal(validateMaster({...base,category}).code,'PCS');});
test('rejects empty names, unknown categories/status and invalid orders',()=>{for(const patch of [{name_th:''},{name_en:''},{category:'profiles'},{status:'deleted'},{sort_order:''},{sort_order:-1},{sort_order:0.1},{sort_order:10000},{code:'<script>'},{code:'x'.repeat(41)}])assert.throws(()=>validateMaster({...base,...patch}));});
test('only allowed fields reach the backend',()=>{const value=validateMaster({...base,version:999,id:'foreign-id',role:'admin'});assert.equal(value.version,undefined);assert.equal(value.id,undefined);assert.equal(value.role,undefined);});
