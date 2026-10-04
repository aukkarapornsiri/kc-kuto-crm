import {bangkokOrderDate} from './sales-map-model.mjs';
const normalize=v=>String(v||'').trim().toLowerCase();
const time=v=>Number.isFinite(Date.parse(v))?Date.parse(v):null;
export function followUpSummary(data,now=new Date()){
 const stamp=+now,today=bangkokOrderDate(now),end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+90);
 const activities=Array.isArray(data.activities)?data.activities:null;
 const pending=(activities||[]).filter(r=>!['completed','cancelled'].includes(normalize(r.status)));
 const dated=pending.filter(r=>time(r.scheduled_at)!==null).sort((a,b)=>time(a.scheduled_at)-time(b.scheduled_at));
 const completed=(activities||[]).filter(r=>normalize(r.status)==='completed'&&['Call','Email','Meeting','Online Meeting','Visit','Demo','LINE Contact','Proposal Follow-up','Renewal Follow-up','Service Follow-up'].includes(r.type)&&time(r.scheduled_at)!==null&&time(r.scheduled_at)<=stamp).sort((a,b)=>time(b.scheduled_at)-time(a.scheduled_at));
 return {available:activities!==null,lastContact:completed[0]||null,nextAppointment:dated.find(r=>time(r.scheduled_at)>=stamp)||null,overdue:dated.filter(r=>time(r.scheduled_at)<stamp),undated:pending.filter(r=>time(r.scheduled_at)===null),pending:dated,quotes:Array.isArray(data.quotations)?data.quotations.filter(r=>['draft','sent','pending','approved'].includes(normalize(r.status))):null,renewals:Array.isArray(data.contracts)?data.contracts.filter(r=>normalize(r.status)==='active'&&r.end_date>=today&&r.end_date<=end.toISOString().slice(0,10)):null,communications:activities===null?null:activities.filter(r=>['Email','LINE Contact','Call'].includes(r.type)).sort((a,b)=>(time(b.scheduled_at)||0)-(time(a.scheduled_at)||0))};
}
export function customerGaps(customer){return ['tax_id','owner_id','phone','email','address'].filter(k=>!String(customer[k]||'').trim());}
export function contactLink(kind,value){const v=String(value||'').trim();if(kind==='phone'&&/^[+\d\s().-]{5,30}$/.test(v))return 'tel:'+v.replace(/[^+\d]/g,'');if(kind==='email'&&/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(v))return 'mailto:'+v;return null;}
