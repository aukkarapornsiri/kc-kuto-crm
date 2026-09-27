import assert from 'node:assert/strict';
import test from 'node:test';
import {SERVICE_VIEWS,filterServiceView,sortServiceRows} from '../src/service-list-view.mjs';

const rows=[
 {id:'a',code:'CASE-10',status:'open',priority:'high',assigned_to_id:'me',created_at:'2026-09-27'},
 {id:'b',code:'CASE-2',status:'waiting-customer',priority:'medium',assigned_to_id:'other',created_at:'2026-09-26'},
 {id:'c',code:'CASE-11',status:'resolved',priority:'critical',assigned_to_id:'me',created_at:'2026-09-25'},
 {id:'d',code:'CASE-1',status:'closed',priority:'low',assigned_to_id:'other',created_at:'2026-09-24'},
];

test('case list views and sort order reflect ticket fields',()=>{
 const ids=view=>filterServiceView(rows,{view,assigneeId:'me'}).map(x=>x.id);
 assert.deepEqual(SERVICE_VIEWS.map(x=>x.id),['open','mine','all','urgent','resolved']);
 assert.deepEqual(ids('open'),['a','b']);
 assert.deepEqual(ids('mine'),['a','c']);
 assert.deepEqual(ids('urgent'),['a']);
 assert.deepEqual(ids('resolved'),['c','d']);
 assert.deepEqual(sortServiceRows(rows).map(x=>x.id),['d','b','a','c']);
 assert.deepEqual(sortServiceRows(rows,'newest').map(x=>x.id),['a','b','c','d']);
});
