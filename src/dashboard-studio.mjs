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
export function createDashboardStudio({React,useApp}){
 const h=React.createElement;
 function Scene({role,lang,children}){
  const config=DASHBOARD_ROLES[role]||DASHBOARD_ROLES.my,i=lang==='th'?0:1,{demoMode}=useApp();
  const [motion,Motion]=React.useState(()=>{try{return localStorage.getItem('kc-dashboard-motion')!=='off';}catch{return true;}});
  function toggle(){Motion(old=>{try{localStorage.setItem('kc-dashboard-motion',old?'off':'on');}catch{}return !old;});}
  return h('section',{className:'kc-dashboard-studio','data-dashboard-role':role,'data-motion':motion?'on':'off',style:{'--dash-accent':config.accent}},
   h('header',{className:'dash-hero'},h('div',{className:'dash-hero-copy'},h('div',{className:'dash-eyebrow'},h('span',{'aria-hidden':true,className:'dash-signal'}),config.eyebrow),h('h1',null,config.title[i]),h('p',null,config.description[i]),h('div',{className:'dash-hero-meta'},h('span',null,config.focus[i]),h('span',{className:'dash-source'},demoMode?(i?'Demo workspace':'พื้นที่ทดลอง'):(i?'Access scoped workspace':'ข้อมูลตามสิทธิ์ของคุณ')))),
    role==='ai'?h('div',{className:'dash-mascot'},h('div',{className:'dash-mascot-aura','aria-hidden':true}),h('img',{src:new URL('../assets/ai-robot.png',import.meta.url).href,alt:i?'KC AI assistant robot':'หุ่นยนต์ผู้ช่วย KC AI',className:'dash-mascot-robot',width:240,height:220,draggable:false}),h('div',{className:'dash-mascot-shadow','aria-hidden':true})):h('div',{className:'dash-orbit','aria-hidden':true},h('div',{className:'dash-orbit-ring'}),h('div',{className:'dash-orbit-ring dash-orbit-second'}),h('span',null,'KC',h('small',null,'CUTO'))),
    h('button',{type:'button',className:'dash-motion','aria-pressed':!motion,onClick:toggle},motion?(i?'Pause motion':'หยุดการเคลื่อนไหว'):(i?'Enable motion':'เปิดการเคลื่อนไหว'))),
   h('div',{className:'dash-content',key:role},children));
 }
 return {Scene};
}
export function createTargetVisuals(React){
 const h=React.createElement;
 return function TargetVisuals({metrics,lang,onMonth,onReset}){
  const th=lang==='th',max=chartDomain(metrics.rows),cash=n=>n===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n),percent=metrics.attainment===null?null:metrics.attainment*100;
  return h('div',{className:'dash-target-visuals'},
   h('section',{className:'dash-chart','aria-label':th?'กราฟยอดขายเทียบเป้ารายเดือน':'Monthly sales versus target chart'},
    h('div',{className:'dash-chart-heading'},h('div',null,h('h3',null,th?'เส้นทางสู่เป้าหมาย':'Progress toward target'),h('p',null,th?'กดเดือนเพื่อดูรายละเอียด · หน่วยบาท':'Select a month for detail · THB')),h('button',{type:'button',onClick:onReset},th?'แสดงช่วงทั้งหมด':'Full period')),
    h('div',{className:'dash-legend'},h('span',null,h('i',{className:'dash-key-target'}),th?'เป้าหมาย':'Target'),h('span',null,h('i',{className:'dash-key-actual'}),th?'ยอดจริง':'Actual')),
    h('div',{className:'dash-axis-caption'},cash(max)+' '+(th?'บาท':'THB')),
    h('div',{className:'dash-columns'},metrics.rows.map(row=>h('button',{type:'button',className:'dash-month',key:row.month,onClick:()=>onMonth(row.month),'aria-label':`${row.month} · ${th?'เป้า':'Target'} ${cash(row.target)} · ${th?'ยอดจริง':'Actual'} ${cash(row.actual)}`,title:`${row.month}\n${th?'เป้า':'Target'}: ${cash(row.target)}\n${th?'ยอดจริง':'Actual'}: ${cash(row.actual)}`},h('span',{className:'dash-bars','aria-hidden':true},h('i',{className:'dash-bar-target',style:{height:Math.max(0,Number(row.target)||0)/max*100+'%'}}),h('i',{className:'dash-bar-actual',style:{height:Math.max(0,row.actual)/max*100+'%'}})),h('span',{className:'dash-month-label'},row.month)))),h('div',{className:'dash-axis-caption'},'0')),
   h('section',{className:'dash-attainment','aria-label':th?'สัดส่วนยอดขายเทียบเป้า':'Target attainment'},h('h3',null,th?'ทำได้เทียบเป้า':'Target attainment'),h('div',{className:'dash-ring',style:{'--attainment':Math.max(0,Math.min(100,percent||0))+'%'}},h('strong',null,percent===null?'—':cash(percent)+'%',h('small',null,th?'ของเป้าช่วงที่เลือก':'of selected target'))),h('p',null,percent===null?(th?'ยังไม่มีเป้าสำหรับคำนวณสัดส่วน':'No positive target for comparison'):(th?'ยอดที่ยังขาดจากเป้า ':'Remaining to target ')+cash(metrics.remaining)+(th?' บาท':' THB'))));
 };
}
