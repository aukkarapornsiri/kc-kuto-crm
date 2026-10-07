import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLeadDetailEnterprise} from '../src/lead-detail-enterprise.mjs';

const React={
 createElement:(type,props,...children)=>({type,props:props||{},children:children.flat().filter(v=>v!==false&&v!==null&&v!==undefined)}),
 useState:value=>[value,()=>{}],
 useEffect:()=>{}
};
const walk=node=>{
 const out=[];
 const visit=n=>{if(!n||typeof n!=='object')return;out.push(n);for(const c of n.children||[])visit(c);};
 visit(node);return out;
};

test('Figma lead detail renders enterprise popup, 24 compact fields, notes and assignment controls',()=>{
 const LeadDetail=createLeadDetailEnterprise({React});
 const tree=LeadDetail({
  record:{id:'1',code:'LD-2541',company_name:'บริษัท ทดสอบ',contact_name:'คุณ ทดสอบ',status:'new',priority:'medium',source:'Line',owner_name:'Sales Owner',note:'Long sales context',updated_at:'2026-10-07T10:00:00Z'},
  lang:'th',canEdit:true,canConvert:true,onClose:()=>{},onEdit:()=>{},onConvert:()=>{},loadOwners:async()=>[],onAssign:async()=>{}
 });
 const nodes=walk(tree);
 const classes=nodes.map(n=>n.props?.className).filter(Boolean);
 assert.ok(classes.includes('kc-lead-detail-overlay'));
 assert.ok(classes.includes('kc-lead-detail-modal'));
 assert.ok(classes.includes('kc-lead-owner-chip'));
 assert.ok(classes.includes('kc-lead-note-panel'));
 assert.equal(classes.filter(x=>x==='kc-lead-info-field').length,24);
 assert.ok(nodes.some(n=>n.type==='button'&&String(n.props?.className||'').includes('assign')));
 assert.ok(nodes.some(n=>n.type==='button'&&n.children.includes('แปลงเป็นลูกค้า')));
});
