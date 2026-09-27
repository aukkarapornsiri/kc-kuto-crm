import assert from 'node:assert/strict';
import test from 'node:test';
import {SALES_VIEWS,filterSalesView} from '../src/sales-list-view.mjs';

const rows=[
 {id:'a',status:'open',owner_id:'me',close_date:'2026-09-15'},
 {id:'b',status:'open',owner_id:'other',close_date:'2026-10-01'},
 {id:'c',status:'won',owner_id:'me',close_date:'2026-09-20'},
 {id:'d',status:'lost',owner_id:'other',close_date:'2026-09-29'},
];

test('sales views keep open, owned, closing and won lists distinct',()=>{
 const ids=view=>filterSalesView(rows,{view,ownerId:'me',now:new Date('2026-09-27T00:00:00Z')}).map(x=>x.id);
 assert.deepEqual(SALES_VIEWS.map(x=>x.id),['open','mine','all','closing','won']);
 assert.deepEqual(ids('open'),['a','b']);
 assert.deepEqual(ids('mine'),['a','c']);
 assert.deepEqual(ids('closing'),['a']);
 assert.deepEqual(ids('won'),['c']);
 assert.deepEqual(ids('all'),['a','b','c','d']);
});
