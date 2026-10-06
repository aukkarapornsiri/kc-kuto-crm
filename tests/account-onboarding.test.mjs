import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePersonalProfile} from '../src/account-onboarding.mjs';
test('onboarding requires names and bounds field lengths',()=>{
 assert.throws(()=>validatePersonalProfile({first_name:' ',last_name:'Test'}));
 assert.throws(()=>validatePersonalProfile({first_name:'Test',last_name:'A'.repeat(151)}));
});
test('onboarding trims personal data and never forwards roles',()=>{
 assert.deepEqual(validatePersonalProfile({first_name:' A ',last_name:' B ',role:'admin',is_super_admin:true}),{first_name:'A',last_name:'B',phone:'',job_title:''});
});
