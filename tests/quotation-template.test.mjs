import test from 'node:test';
import assert from 'node:assert/strict';
import {PAYMENT_TERMS,resolvePaymentTerm,paymentTermOptions} from '../src/quotation-payment-terms.mjs';
import {validateQuotationAsset,uploadQuotationAsset,QUOTATION_ASSET_LIMIT,QUOTATION_ASSET_BUCKET} from '../src/quotation-assets.mjs';
import {validateRecord} from '../src/internal-model.mjs';
test('all 12 payment choices preserve method separately from credit days',()=>{
 assert.equal(PAYMENT_TERMS.length,12);
 for(const term of PAYMENT_TERMS){const record=validateRecord('quotations',{issue_date:'2026-10-01',owner_id:'owner',customer_id:'customer',payment_term_code:term.code,payment_terms:99});assert.equal(record.payment_term_code,term.code);assert.equal(record.payment_terms,term.days);}
 assert.notEqual(resolvePaymentTerm('cash').code,resolvePaymentTerm('cheque-today').code);
 assert.equal(resolvePaymentTerm('deposit-30').days,0);
 assert.equal(resolvePaymentTerm('postdated-15').days,15);
 assert.equal(resolvePaymentTerm('',45).code,'net-45');
 assert.equal(paymentTermOptions('',21).at(-1).code,'legacy-21');
 assert.throws(()=>resolvePaymentTerm('unknown'),/Invalid payment/);
 assert.throws(()=>resolvePaymentTerm('legacy-999'),/Invalid payment/);
});
test('quotation images reject invalid/oversized files before any upload',()=>{
 for(const file of [{type:'image/svg+xml',size:10},{type:'image/png',size:0},{type:'image/png',size:QUOTATION_ASSET_LIMIT+1}])assert.throws(()=>validateQuotationAsset(file));
 validateQuotationAsset({type:'image/png',size:100});
});
test('image upload uses the private bucket, original bytes and immutable unique keys; errors propagate',async()=>{
 const calls=[],file=new Blob(['image bytes'],{type:'image/png'}),client={storage:{from:bucket=>({upload:async(key,body,options)=>{calls.push({bucket,key,body,options});return {data:{path:key},error:null};}})}};
 const first=await uploadQuotationAsset(client,file,'owner','logo'),second=await uploadQuotationAsset(client,file,'owner','seller-signature');
 assert.notEqual(first,second);assert.match(first,/^owner\/logo-.*\.png$/);assert.match(second,/^owner\/seller-signature-.*\.png$/);
 for(const call of calls){assert.equal(call.bucket,QUOTATION_ASSET_BUCKET);assert.equal(call.body,file);assert.equal(call.options.upsert,false);assert.equal(call.options.contentType,'image/png');}
 await assert.rejects(()=>uploadQuotationAsset({storage:{from:()=>({upload:async()=>({error:Error('Denied')})})}},file,'owner','logo'),/Denied/);
});
