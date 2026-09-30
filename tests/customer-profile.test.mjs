import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord,fieldsFor} from '../src/internal-model.mjs';
import {parentCustomerOptions,hydrateRelations} from '../src/record-profile.mjs';
test('customer addresses and parent reference round trip independently',()=>{
 const input={name:'Test Account',parent_customer_id:'parent',address:'Billing Street',billing_country:'Thailand',billing_city:'Bangkok',province:'Bangkok',billing_postal_code:'10110',shipping_country:'Japan',shipping_street:'Shipping Street',shipping_city:'Tokyo',shipping_state:'Tokyo',shipping_postal_code:'1000001',description:'Description',owner_id:'owner'};
 const output=validateRecord('customers',input);
 for(const [key,value] of Object.entries(input))assert.equal(output[key],value);
 assert.throws(()=>validateRecord('customers',{name:' '}),/Required/);
 assert.equal(fieldsFor('customers').find(f=>f.key==='parent_customer_id').type,'relation');
});
test('parent choices reject self and indirect descendants',()=>{
 const rows=[{id:'a'},{id:'b',parent_customer_id:'a'},{id:'c',parent_customer_id:'b'},{id:'d'}];
 assert.deepEqual(parentCustomerOptions(rows,{id:'a'}).map(x=>x.id),['d']);
 assert.equal(parentCustomerOptions(rows,{}).length,4);
});
test('all linked modules resolve renamed customers without changing their IDs',()=>{
 for(const entity of ['leads','contacts','branches','opportunities','quotations','contracts','assets','tickets','activities','documents']){
  const [row]=hydrateRelations(entity,[{id:'record',customer_id:'account',customer_name:'Old'}],{customers:[{id:'account',name:'Updated'}]});
  assert.equal(row.customer_id,'account');assert.equal(row[entity==='contacts'?'company':'customer_name'],'Updated');
 }
});
