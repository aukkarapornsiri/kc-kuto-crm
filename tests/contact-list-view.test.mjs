import test from 'node:test';
import assert from 'node:assert/strict';
import {addRecentContact,CONTACT_VIEWS,filterContactView} from '../src/contact-list-view.mjs';

const now=new Date(2026,8,27,12);
const rows=[
  {id:'a',name:'Zara',owner_id:'u1',is_primary:true,created_at:'2026-09-20T05:00:00Z'},
  {id:'b',name:'Amara',owner_id:'u2',created_at:'2026-09-23T05:00:00Z'},
  {id:'c',name:'Boon',owner_id:'u1',created_at:'2026-09-26T05:00:00Z'},
];
test('contact list presets use actual owner, view history and local week boundary',()=>{
  assert.deepEqual(CONTACT_VIEWS.map(view=>view.id),['recent','mine','all','week','primary']);
  const ids=view=>filterContactView(rows,{view,ownerId:'u1',recentIds:['c','a'],now}).map(row=>row.id);
  assert.deepEqual(ids('all'),['b','c','a']);
  assert.deepEqual(ids('mine'),['c','a']);
  assert.deepEqual(ids('recent'),['c','a']);
  assert.deepEqual(ids('week'),['b','c']);
  assert.deepEqual(ids('primary'),['a']);
  assert.deepEqual(ids('unknown'),ids('all'));
});
test('recently viewed contact IDs are unique and bounded',()=>{
  assert.deepEqual(addRecentContact(['a','b','c'],'b'),['b','a','c']);
  assert.equal(addRecentContact(Array.from({length:80},(_,i)=>String(i)),'latest').length,50);
});
