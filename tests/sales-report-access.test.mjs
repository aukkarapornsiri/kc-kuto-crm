import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDashboardStudio} from '../src/dashboard-studio.mjs';
const person=(id,department_group)=>({id,name:id,department_group,active:true});
function harness(canLink){
 let state=[],index=0,effects=[];
 globalThis.localStorage={getItem:()=> 'off'};
 globalThis.window={matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}}),addEventListener(){},removeEventListener(){},dispatchEvent(){}};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),useState(initial){const i=index++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],value=>state[i]=value];},useEffect(fn){effects.push(fn);}};
 let requestedFull=false;
 const {Scene}=createDashboardStudio({React,useApp:()=>({demoMode:false,profile:{id:'viewer',is_active:true}}),readTargets:async(year,demo,profile,full)=>{requestedFull=full;return {scope:'company',can_link_sales:canLink,plan:{},people:[person('Sales A','Sales'),person('Accountant','Accounting'),person('Engineer','Software')],months:[]};}});
 return {async render(){index=0;effects=[];let tree=Scene({role:'sales',lang:'en'});if(!state[1]?.members.length){const cleanups=effects.slice(0,1).map(fn=>fn());await new Promise(resolve=>setImmediate(resolve));cleanups.forEach(fn=>fn?.());index=0;tree=Scene({role:'sales',lang:'en'});}return tree;},full:()=>requestedFull};
}
function planets(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(planets);return [...(node.props?.className==='dash-sales-planet'?[node]:[]),...node.children.flatMap(planets)];}
test('all departments read full company report; only Sales staff become planets and only Sales viewers get buttons',async()=>{for(const canLink of [true,false]){const view=harness(canLink),tree=await view.render(),nodes=planets(tree);assert.equal(view.full(),true);assert.equal(nodes.length,1);assert.equal(nodes[0].type,canLink?'button':'div');assert.equal(typeof nodes[0].props.onClick,canLink?'function':'undefined');assert.ok(nodes[0].props['aria-label'].startsWith('Sales A'));}});
