import assert from 'node:assert/strict';
import {recentQuotationCustomers} from '../src/quotation-customer-picker.mjs';
const customers=Array.from({length:15},(_,i)=>({id:String(i),name:'Company '+i}));
const quotes=customers.map((c,i)=>({customer_id:c.id,created_at:`2026-09-${String(i+1).padStart(2,'0')}`}));
quotes.push({customer_id:'14',created_at:'2026-09-30'},{customer_id:'hidden',created_at:'2026-10-01'});
assert.deepEqual(recentQuotationCustomers(customers,quotes).map(c=>c.id),['14','13','12','11','10','9','8','7','6','5']);
assert.equal(quotes.length,17);assert.deepEqual(recentQuotationCustomers(customers,[]),[]);
console.log('PASS recent customer ordering, unique companies, 10 limit, access scope, no history');
