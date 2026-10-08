import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInventory} from '../src/inventory.mjs';
const flatten=n=>n&&typeof n==='object'?[n,...(n.children||[]).flatMap(flatten)]:[];
const label=n=>(n.children||[]).map(x=>typeof x==='string'?x:typeof x==='object'?label(x):'').join('');
function render(allowed){
 const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useEffect:()=>{},useRef:()=>({current:null}),useState:x=>[x&&typeof x==='object'&&'items' in x?{...x,items:[{id:'one',code:'TEST',name:'Test item',status:'active',price:10,cost:5,unit:'unit',stock_mode:'service'}]}:x,()=>{}]};
 const Page=createInventory({React,client:{},useApp:()=>({demoMode:false,profile:{id:'sales',role:'sales_user',is_active:true}}),useAccess:()=>({can:(module,action)=>module==='inventory'&&allowed.includes(action)})});
 return flatten(Page({lang:'en'})).filter(n=>n.type==='button').map(label);
}
test('inventory exposes each action for a normal sales user only when granted',()=>{
 const viewer=render(['view']);assert.ok(!viewer.includes('Add product or service'));assert.ok(!viewer.includes('✎ Edit'));assert.ok(!viewer.includes('Delete'));
 const creator=render(['view','create']);assert.ok(creator.includes('Add product or service'));assert.ok(!creator.includes('✎ Edit'));assert.ok(!creator.includes('Delete'));
 const editor=render(['view','edit']);assert.ok(editor.includes('✎ Edit'));assert.ok(!editor.includes('Add product or service'));assert.ok(!editor.includes('Delete'));
 const deleter=render(['view','delete']);assert.ok(deleter.includes('Delete'));assert.ok(!deleter.includes('✎ Edit'));
});
