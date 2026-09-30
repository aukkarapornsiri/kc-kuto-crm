import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterAccounts,safeAccountWebsite} from '../src/account-list-view.mjs';
const rows=[{id:'a',name:'Zulu',owner_id:'u',status:'Active',billing_city:'Bangkok',created_at:'2026-09-29T10:00:00Z'},{id:'b',name:'Alpha',owner_id:'v',status:'Prospect',created_at:'2026-09-01T10:00:00Z'}];
test('account views filter and sort without mutating source',()=>{assert.deepEqual(filterAccounts(rows).map(x=>x.id),['b','a']);assert.equal(rows[0].id,'a');for(const opts of [{view:'mine',ownerId:'u'},{query:'Bangkok'},{view:'week',now:new Date('2026-09-30T10:00:00Z')},{view:'active'}])assert.deepEqual(filterAccounts(rows,opts).map(x=>x.id),['a']);assert.deepEqual(filterAccounts(rows,{view:'recent',recentIds:['a','b']}).map(x=>x.id),['a','b']);assert.equal(filterAccounts(rows,{view:'mine'}).length,0);});
test('website links accept web URLs and reject executable or credential URLs',()=>{assert.equal(safeAccountWebsite('example.com'),'https://example.com/');for(const url of ['javascript:alert(1)','data:text/html,<script>','https://user:pass@example.com','not a url'])assert.equal(safeAccountWebsite(url),null);});
