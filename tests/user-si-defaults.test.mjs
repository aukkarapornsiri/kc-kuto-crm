import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SI_DEPARTMENT_OPTIONS,SI_CUSTOM_ROLE_DEFAULTS,userRoleSelection,applyUserRoleSelection,departmentOptions} from '../src/settings-workspace.mjs';

test('SI department defaults are complete and unique',()=>{
 const values=SI_DEPARTMENT_OPTIONS.map(x=>x.value);
 assert.ok(values.length>=24);
 assert.equal(new Set(values).size,values.length);
 for(const required of ['Executive / Management','Sales','Pre-Sales / Solution Consulting','Engineering / Implementation','Cyber Security','Software / Application Development','Service Desk / Helpdesk','Finance','Accounting','Human Resources','Marketing','Internal IT / System Administration'])assert.ok(values.includes(required),required);
 assert.ok(departmentOptions('Legacy Department','th').some(([value])=>value==='Legacy Department'),'existing custom department remains selectable');
});
test('SI role defaults are complete and unique',()=>{
 const keys=SI_CUSTOM_ROLE_DEFAULTS.map(x=>x.role_key);
 assert.ok(keys.length>=60);
 assert.equal(new Set(keys).size,keys.length);
 for(const required of ['sales_director','account_manager','presales_manager','solution_architect','project_manager','system_engineer','network_engineer','security_engineer','cloud_engineer','software_developer','qa_engineer','support_engineer','procurement_manager','accounting_manager','hr_manager','marketing_manager','trainer','auditor','viewer'])assert.ok(keys.includes(required),required);
});
test('role dropdown maps system and custom roles to profile columns safely',()=>{
 const roles=[{role_key:'admin',is_system:true},{role_key:'solution_architect',is_system:false}];
 assert.deepEqual(applyUserRoleSelection({role:'sales_user',custom_role_key:null},'solution_architect',roles),{role:'custom',custom_role_key:'solution_architect'});
 assert.equal(userRoleSelection({role:'custom',custom_role_key:'solution_architect'}),'solution_architect');
 assert.deepEqual(applyUserRoleSelection({role:'custom',custom_role_key:'solution_architect'},'admin',roles),{role:'admin',custom_role_key:null});
});
