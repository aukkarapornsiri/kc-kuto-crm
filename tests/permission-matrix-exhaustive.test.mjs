import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccess,permitsPage,filterModules} from '../src/role-access.mjs';
import {MODULES,ACTIONS} from '../src/settings-model.mjs';
import {SI_CUSTOM_ROLE_DEFAULTS} from '../src/settings-workspace.mjs';
const builtin=['admin','executive','sales_manager','sales_user','finance','service_agent','renewal_owner'];
const roles=[...new Set([...builtin,...SI_CUSTOM_ROLE_DEFAULTS.map(x=>x.role_key),'customer_service','service_engineer','service_manager','service_supervisor'])];
for(const role of roles)test(`${role}: isolated action grants, blocked accounts, menus and direct-page denial`,()=>{
 const profile={is_active:true,role:builtin.includes(role)?role:'custom',custom_role_key:role,is_super_admin:false};
 for(const module of MODULES)for(const granted of ACTIONS){
  const rows=[{module,['can_'+granted]:true}];
  for(const action of ACTIONS)assert.equal(canAccess(profile,rows,module,action),action===granted,`${module}/${action} should follow only its own grant`);
  for(const state of [{is_active:false},{deleted_at:'2026-10-09'},{deletion_requested_at:'2026-10-09'},{access_active:false}])assert.equal(canAccess({...profile,...state},rows,module,granted),false);
 }
 const rows=MODULES.map(module=>({module,...Object.fromEntries(ACTIONS.map(a=>['can_'+a,true]))}));
 const access={profile,rows,dashboards:[],can:(m,a)=>canAccess(profile,rows,m,a)};
 for(const page of ['set-users','set-roles','set-permissions','set-dashboard-access'])assert.equal(permitsPage(access,'settings',page),false,'Delegated settings must never authorize access administration');
 const denied={...access,can:()=>false};
 assert.deepEqual(filterModules(MODULES.map(id=>({id,subs:[{id:id+'-list'}]})),denied),[]);
 for(const module of MODULES)assert.equal(permitsPage(denied,module,module+'-list'),false,'Direct page must fail closed');
});
