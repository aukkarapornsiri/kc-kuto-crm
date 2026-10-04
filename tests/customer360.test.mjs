import test from 'node:test';import assert from 'node:assert/strict';
import {duplicateReasons,identityGroup,overview,timeline} from '../src/customer360-model.mjs';
test('duplicates require real matching identifiers, not blank values or punctuation-only phones',()=>{
 assert.deepEqual(duplicateReasons({id:'a'},{id:'b'}),[]);
 assert.deepEqual(duplicateReasons({id:'a',name:' ABC  Co ',tax_id:'1234567890123',phone:'081-234-5678'},{id:'b',name:'abc co',tax_id:'1234567890123',phone:'0812345678'}),['tax_id','phone','name']);
 assert.deepEqual(duplicateReasons({id:'a',name:'A',tax_id:'000',phone:'-'},{id:'b',name:'A',tax_id:'000',phone:'-'}),[]);
});
test('canonical group resolves from either member without including unrelated customers',()=>{
 const links=[{customer_id:'b',canonical_id:'a'},{customer_id:'c',canonical_id:'a'},{customer_id:'y',canonical_id:'z'}];
 assert.deepEqual(identityGroup('b',links),{root:'a',ids:['a','b','c']});assert.deepEqual(identityGroup('x',links),{root:'x',ids:['x']});
});
test('SO totals deduplicate upstream ids, reject non-THB/future/cancelled and respect Bangkok year boundary',()=>{
 const order={id:'1',source_system:'erp',source_so_id:'one',status:'converted',net_amount:'100.01',currency:'THB',converted_at:'2025-12-31T18:00:00Z'};
 const data={orders:[order,{...order,id:'2',net_amount:'120.02',synced_at:'2026-10-01'}, {...order,id:'3',source_so_id:'usd',currency:'USD'}, {...order,id:'4',source_so_id:'future',converted_at:'2026-11-01'}, {...order,id:'5',source_so_id:'void',status:'cancelled'}]};
 const result=overview(data,'2026-10-04');assert.equal(result.metrics[0].value,120.02);assert.equal(result.metrics[0].rows.length,1);assert.equal(result.lastPurchase,'2026-01-01');assert.equal(result.excludedOrders,2);
 assert.equal(result.metrics[1].value,null);
});
test('unavailable is different from empty; open pipeline excludes won and invalid amounts',()=>{
 assert.equal(overview({orders:null}).metrics[0].value,null);assert.equal(overview({orders:[]}).metrics[0].value,0);
 const data={opportunities:[{status:'open',stage:'proposal',amount:300},{status:'open',stage:'Closed Won',amount:900},{status:'lost',amount:99}],tickets:[{status:'closed'},{status:'open'}],contracts:[{status:'active',end_date:'2026-10-04'},{status:'active',end_date:'2027-01-02'},{status:'active',end_date:'2027-01-03'}]};
 const m=overview(data,'2026-10-04').metrics;assert.equal(m[1].value,300);assert.equal(m[3].value,1);assert.equal(m[4].value,2);
 assert.equal(overview({opportunities:[{status:'open',amount:null}]}).metrics[1].value,null);
});
test('timeline identifies derived dates honestly and keeps durable status changes',()=>{
 const data={activities:[{id:'a',subject:'Call',created_at:'2026-10-01',updated_at:'2026-10-01',scheduled_at:'2026-10-05'}],orders:null};
 const events=timeline(data,[{id:'event',module:'tickets',record_id:'t',action:'UPDATE',created_at:'2026-10-03',status:'closed'}]);
 assert.equal(events.length,3);assert.equal(events[0].action,'scheduled');assert.equal(events[1].derived,false);assert.equal(events[2].derived,true);
});
test('captured inserts and updates replace redundant derived timeline entries',()=>{
 const data={contacts:[{id:'c',created_at:'2026-10-01',updated_at:'2026-10-02'}]};
 const captured=[{id:'i',module:'contacts',record_id:'c',action:'INSERT',created_at:'2026-10-01'},{id:'u',module:'contacts',record_id:'c',action:'UPDATE',created_at:'2026-10-02'}];
 assert.equal(timeline(data,captured).length,2);assert.ok(timeline(data,captured).every(e=>!e.derived));
});
