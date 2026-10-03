import {TARGET_EVENT,targetMetrics} from './sales-target-model.mjs?v=20261002-targets';
import {createSalesMotion} from './sales-motion.mjs?v=20261004-loop';
import {createAIRobot} from './ai-robot.mjs?v=20261002-wave';
export const DASHBOARD_ROLES={
 my:{title:['แดชบอร์ดของฉัน','My Dashboard'],eyebrow:'PERSONAL WORKSPACE',accent:'#2dd4bf',description:['เริ่มจากงานสำคัญ แล้วติดตามโอกาสที่อยู่ในมือคุณ','Start with your priorities, then follow the opportunities you own.'],focus:['งานวันนี้ · งานค้าง · เป้าของฉัน','Today · Follow-ups · My targets']},
 sales:{title:['แดชบอร์ดฝ่ายขาย','Sales Dashboard'],eyebrow:'SALES PERFORMANCE',accent:'#38bdf8',description:['มองเป้าหมาย ยอดขาย และโอกาสปิดการขายในภาพเดียว','See targets, sales and opportunities together.'],focus:['ยอดขาย · Pipeline · กิจกรรม','Sales · Pipeline · Activities']},
 manager:{title:['แดชบอร์ดผู้จัดการ','Sales Manager Dashboard'],eyebrow:'TEAM PERFORMANCE',accent:'#a78bfa',description:['ติดตามเป้าและผลงานของทีม เพื่อวางแผนขั้นตอนถัดไป','Track team targets and performance to plan the next step.'],focus:['เป้าทีม · ผลงานรายคน · ช่องว่างจากเป้า','Team targets · People · Target gap']},
 exec:{title:['แดชบอร์ดผู้บริหาร','Executive Dashboard'],eyebrow:'EXECUTIVE OVERVIEW',accent:'#67e8f9',description:['ภาพรวมยอดขายและเป้าหมาย สำหรับการตัดสินใจระดับบริษัท','Company sales and targets for a clear business overview.'],focus:['เป้าบริษัท · ยอดจริง · ผลงานทีม','Company target · Actuals · Teams']},
 service:{title:['แดชบอร์ดงานบริการ','Service Dashboard'],eyebrow:'SERVICE OPERATIONS',accent:'#60a5fa',description:['เห็นเคสที่ต้องดูแล ภาระงาน และคุณภาพการบริการ','Monitor cases, workload and service quality.'],focus:['เคสเปิด · SLA · ความพึงพอใจ','Open cases · SLA · Satisfaction']},
 renewal:{title:['แดชบอร์ดต่ออายุสัญญา','Renewal Dashboard'],eyebrow:'CUSTOMER CONTINUITY',accent:'#fbbf24',description:['ติดตามสัญญาใกล้ครบกำหนด และโอกาสดูแลลูกค้าต่อเนื่อง','Keep upcoming renewals and customer follow-ups in view.'],focus:['สัญญา · วันครบกำหนด · การติดตาม','Contracts · Expiry · Follow-ups']},
 admin:{title:['แดชบอร์ดผู้ดูแลระบบ','Admin Dashboard'],eyebrow:'SYSTEM OPERATIONS',accent:'#c4b5fd',description:['ดูภาพรวมผู้ใช้ การเข้าใช้งาน และประวัติของระบบ','Review users, access activity and system history.'],focus:['ผู้ใช้งาน · การเข้าระบบ · Audit','Users · Access · Audit']},
 ai:{title:['แดชบอร์ด AI','AI Dashboard'],eyebrow:'ASSISTED INSIGHTS',accent:'#f0abfc',description:['รวมข้อมูลเชิงลึกและข้อเสนอแนะ เพื่อช่วยจัดลำดับการทำงาน','Review insights and suggestions to prioritize your work.'],focus:['ข้อมูลเชิงลึก · คำแนะนำ · งานถัดไป','Insights · Suggestions · Next steps']}
};
export function chartDomain(rows){return Math.max(1,...rows.flatMap(r=>[Number(r.target)||0,Number(r.actual)||0]));}
export function createDashboardStudio({React,useApp,readTargets}){
 const h=React.createElement,AIRobot=createAIRobot(React);
 function Scene({role,lang,children}){
  const config=DASHBOARD_ROLES[role]||DASHBOARD_ROLES.my,i=lang==='th'?0:1,{demoMode,profile}=useApp();
  const [motion,Motion]=React.useState(()=>{try{return localStorage.getItem('kc-dashboard-motion')!=='off';}catch{return true;}});
  const [sales,Sales]=React.useState({percent:null,status:'loading'});
  React.useEffect(()=>{let active=true,request=0;
   async function refresh(){const id=++request;try{const data=await readTargets(new Date().getFullYear(),demoMode,profile);if(!active||id!==request)return;const scope=role==='my'||data.scope==='self'?profile?.id:data.scope==='team'?'team':'company';const metrics=targetMetrics(data,{scope});const percent=data.plan&&metrics.attainment!==null?metrics.attainment*100:null;Sales({percent:Number.isFinite(percent)?percent:null,status:percent===null?'empty':'ready'});}catch{if(active&&id===request)Sales({percent:null,status:'error'});}}
   Sales({percent:null,status:'loading'});if(role==='ai')return;refresh();window.addEventListener(TARGET_EVENT,refresh);window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{active=false;window.removeEventListener(TARGET_EVENT,refresh);window.removeEventListener('focus',refresh);clearInterval(timer);};
  },[role,demoMode,profile?.id,profile?.role]);
  const [reduced,Reduced]=React.useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  React.useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>Reduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const fill=Math.max(0,Math.min(100,sales.percent??0)),[growth,Growth]=React.useState(0);
  React.useEffect(()=>{if(!motion||reduced){Growth(fill);return;}let frame,start;Growth(0);const tick=now=>{start??=now;const p=Math.min(1,(now-start)/2200),ease=1-Math.pow(1-p,3);Growth(ease*fill);if(p<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[motion,reduced,role,fill]);
  const value=sales.percent===null?'—':sales.percent.toFixed(1)+'%',caption=sales.status==='loading'?(i?'Loading…':'กำลังโหลด…'):sales.status==='error'?(i?'Unable to load':'โหลดไม่ได้'):sales.percent===null?(i?'No sales target':'ยังไม่มีเป้ายอดขาย'):(i?'of annual target':'ของเป้ายอดขายปีนี้');
  function toggle(){const next=!motion;try{localStorage.setItem('kc-dashboard-motion',next?'on':'off');window.dispatchEvent(new Event('kc-dashboard-motion'));}catch{}Motion(next);}
  return h('section',{className:'kc-dashboard-studio','data-dashboard-role':role,'data-motion':motion?'on':'off',style:{'--dash-accent':config.accent}},
   h('header',{className:'dash-hero'},h('div',{className:'dash-hero-copy'},h('div',{className:'dash-eyebrow'},h('span',{'aria-hidden':true,className:'dash-signal'}),config.eyebrow),h('h1',null,config.title[i]),h('p',null,config.description[i]),h('div',{className:'dash-hero-meta'},h('span',null,config.focus[i]),h('span',{className:'dash-source'},demoMode?(i?'Demo workspace':'พื้นที่ทดลอง'):(i?'Access scoped workspace':'ข้อมูลตามสิทธิ์ของคุณ')))),
    role==='ai'?h('div',{className:'dash-mascot'},h('div',{className:'dash-mascot-aura','aria-hidden':true}),h(AIRobot,{label:i?'KC AI assistant robot':'หุ่นยนต์ผู้ช่วย KC AI',className:'dash-mascot-robot'}),h('div',{className:'dash-mascot-shadow','aria-hidden':true})):h('div',{className:'dash-orbit','aria-label':(i?'Sales attainment ':'ยอดขายเทียบเป้า ')+value+' · '+caption,style:{'--dash-growth':growth}},h('svg',{className:'dash-growth-ring',viewBox:'0 0 160 160','aria-hidden':true},h('circle',{className:'dash-growth-track',cx:80,cy:80,r:68,pathLength:100}),h('circle',{className:'dash-growth-progress',cx:80,cy:80,r:68,pathLength:100,strokeDasharray:'100 100',strokeDashoffset:100-growth}),h('circle',{className:'dash-growth-inner',cx:80,cy:80,r:54,pathLength:100})),h('div',{className:'dash-growth-spark','aria-hidden':true}),h('span',{className:'dash-growth-center'},h('em',null,value),h('i',null,caption))),
    h('button',{type:'button',className:'dash-motion','aria-pressed':!motion,onClick:toggle},motion?(i?'Pause motion':'หยุดการเคลื่อนไหว'):(i?'Enable motion':'เปิดการเคลื่อนไหว')),h('div',{className:'dash-sales-banner'})),
   h('div',{className:'dash-content',key:role},children));
 }
 return {Scene};
}
export const createTargetVisuals=createSalesMotion;
