import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileNames,profileDisplayName} from '../src/profile-names.mjs';
test('legacy names populate separate fields without mutating the profile',()=>{
 const row={display_name:'Monchai Aukkarapornsiri'};
 assert.deepEqual(profileNames(row),{first_name:'Monchai',last_name:'Aukkarapornsiri'});
 assert.deepEqual(row,{display_name:'Monchai Aukkarapornsiri'});
});
test('explicit multiword names and blank surname are preserved',()=>{
 assert.deepEqual(profileNames({first_name:'Mary Jane',last_name:'van der Berg',display_name:'Old Name'}),{first_name:'Mary Jane',last_name:'van der Berg'});
 assert.deepEqual(profileNames({first_name:'สมชาย',last_name:'',display_name:'Old Name'}),{first_name:'สมชาย',last_name:''});
 assert.deepEqual(profileNames({display_name:'สมชาย'}),{first_name:'สมชาย',last_name:''});
 assert.equal(profileDisplayName(' สมชาย ',' ใจดี '),'สมชาย ใจดี');
 assert.equal(profileDisplayName('สมชาย',''),'สมชาย');
});
