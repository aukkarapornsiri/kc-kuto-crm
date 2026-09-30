import test from 'node:test';
import assert from 'node:assert/strict';
import {SIDEBAR_GROUPS,SIDEBAR_PRIMARY_ORDER,createGroupedNavigation} from '../src/grouped-navigation.mjs';

const all=['dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings'];
const modules=all.map(id=>({id,icon:'svg'}));
const state={value:null};
const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children}),useState:init=>{
  if(state.value===null)state.value=init();
  return [state.value,update=>{state.value=update(state.value);}];
},useEffect:()=>{}};
const Grouped=createGroupedNavigation({React});
const render=(lang='en',activeModule='dashboard')=>Grouped({lang,activeModule,modules,renderModule:module=>({type:'module',props:{id:module.id},children:[]})});
const children=node=>node.children.flatMap(child=>Array.isArray(child)?child:[child]).filter(Boolean);
const buttons=node=>children(node).flatMap(child=>child.type==='button'?[child]:child.children?buttons(child):[]);
const shownModules=node=>children(node).flatMap(child=>child.type==='module'?[child.props.id]:child.children?shownModules(child):[]);

test('every module is assigned exactly once, with ten top-level choices',()=>{
  const grouped=SIDEBAR_GROUPS.flatMap(group=>group.modules);
  assert.equal(new Set(grouped).size,grouped.length);
  assert.deepEqual([...new Set([...grouped,...SIDEBAR_PRIMARY_ORDER])].filter(id=>all.includes(id)).sort(),[...all].sort());
  assert.equal(SIDEBAR_PRIMARY_ORDER.length,10);
  assert.deepEqual(SIDEBAR_GROUPS.map(group=>group.id),['sales','service','insights']);
  assert.deepEqual(buttons(render()).map(button=>button.props['aria-label']),['Sales','Service','Analytics']);
  assert.deepEqual(shownModules(render()),['dashboard','leads','contacts','customers',...SIDEBAR_GROUPS[0].modules,'activities','documents','settings']);
});

test('groups expand and collapse without changing module destinations',()=>{
  globalThis.document={documentElement:{dataset:{}}};
  const service=buttons(render()).find(button=>button.props['aria-label']==='Service');
  service.props.onClick();
  assert.deepEqual(shownModules(render()).filter(id=>['assets','tickets'].includes(id)),['tickets','assets']);
  buttons(render()).find(button=>button.props['aria-label']==='Service').props.onClick();
  assert.equal(shownModules(render()).includes('assets'),false);
  assert.equal(buttons(render('th')).find(button=>button.props['aria-label']==='บริการ').props['aria-expanded'],false);
  delete globalThis.document;
});
