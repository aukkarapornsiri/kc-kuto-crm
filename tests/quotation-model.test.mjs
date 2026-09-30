import test from 'node:test';
import assert from 'node:assert/strict';
import {quotationTotals,quotationDefaults,quotationCustomer,ACCOUNT360_QUOTATIONS_URL} from '../src/quotation-model.mjs';
import {validateRecord} from '../src/internal-model.mjs';
import {createQuotationDocument} from '../src/quotation-document.mjs';
const items=[{name:'QA/E2E service',qty:2,price:100,discount:10}];
test('VAT and WHT use discounted base, independent rates and net payable',()=>{
 const q=quotationTotals(items,10,3);
 assert.deepEqual([q.subtotal,q.discount,q.vat,q.total,q.withholding_tax,q.net_total],[200,10,19,209,5.7,203.3]);
 assert.equal(quotationTotals(items,0,0).net_total,190);
 assert.equal(quotationTotals(items,7,3).net_total,197.6);
});
test('invalid quantities, discounts, taxes and empty lines fail before saving',()=>{
 for(const [v,w] of [[-1,0],[101,0],[7,101],[NaN,0],[7,Infinity]])assert.throws(()=>quotationTotals(items,v,w));
 for(const x of [[],[{...items[0],qty:0}],[{...items[0],discount:201}],[{...items[0],price:Infinity}]])assert.throws(()=>quotationTotals(x));
});
test('quotation extended fields round trip; protected fields never enter updates',()=>{
 const draft={...quotationDefaults({name:'QA/E2E author'},'en'),customer_id:'account',wht_rate:3,note:'QA/E2E terms',approval_status:'approved',status:'accepted'};
 const output=validateRecord('quotations',draft);
 assert.equal(output.tax_rate,7);assert.equal(output.wht_rate,3);assert.equal(output.prepared_by,'QA/E2E author');
 assert.equal(output.approval_status,undefined);assert.equal(output.status,undefined);
 assert.throws(()=>validateRecord('quotations',{...draft,payment_terms:1.5}));
 assert.throws(()=>validateRecord('quotations',{...draft,valid_until:'2000-01-01'}));
});
test('customer prefill keeps billing fields and Account link does not pretend to prefill',()=>{
 assert.deepEqual(quotationCustomer({address:'QA street',billing_city:'Bangkok',tax_id:'QA'}),{counterparty_address:'QA street, Bangkok',counterparty_tax_id:'QA'});
 const u=new URL(ACCOUNT360_QUOTATIONS_URL);assert.equal(u.search,'?page=ar');
});
test('print document handles real JSON company details and preserves saved totals',()=>{
 const Document=createQuotationDocument({React:{createElement:(tag,props,...children)=>({tag,props,children})}});
 const tree=Document({record:{id:'saved',items,total:250,net_total:240},company:{company_details:{address_en:'QA/E2E issuer address'}},lang:'en'});
 const out=JSON.stringify(tree);
 assert.ok(out.includes('QA/E2E issuer address'));assert.ok(out.includes('240.00 THB'));
 function inspect(node){for(const child of node.children.flat(Infinity)){if(child&&typeof child==='object'){assert.ok(child.tag,'Raw company JSON must not be passed to React as a child');inspect(child);}}}inspect(tree);
});
