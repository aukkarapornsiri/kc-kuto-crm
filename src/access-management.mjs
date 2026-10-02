export const MODULE_LABELS={dashboard:['แดชบอร์ด','Dashboard'],leads:['ลูกค้าเป้าหมาย','Leads'],customers:['ลูกค้า','Customers'],contacts:['ผู้ติดต่อ','Contacts'],opportunities:['โอกาสการขาย','Opportunities'],quotations:['ใบเสนอราคา','Quotations'],contracts:['สัญญาและต่ออายุ','Contracts'],assets:['ทรัพย์สิน','Assets'],tickets:['งานบริการ','Service tickets'],activities:['กิจกรรม','Activities'],documents:['เอกสาร','Documents'],reports:['รายงาน','Reports'],ai:['ผู้ช่วย AI','AI assistant'],settings:['ตั้งค่าระบบ','Settings']};
export const ACTION_LABELS={view:['ดู','View'],create:['สร้าง','Create'],edit:['แก้ไข','Edit'],delete:['ลบ / ยกเลิก','Delete'],export:['ส่งออก','Export'],approve:['อนุมัติ','Approve'],assign:['มอบหมาย','Assign'],import:['นำเข้า','Import'],manage_settings:['ตั้งค่าระบบ','Manage settings']};
export const DASHBOARD_LABELS={my:['ของฉัน','My dashboard'],sales:['ฝ่ายขาย','Sales'],manager:['ผู้จัดการ','Manager'],exec:['ผู้บริหาร','Executive'],service:['งานบริการ','Service'],renewal:['ต่ออายุสัญญา','Renewals'],admin:['ผู้ดูแลระบบ','Administration'],ai:['ผู้ช่วย AI','AI assistant']};

export function createAccessManagement({React,RecordEditor,Permissions,Feed}){
 const h=React.createElement;
 const tabs=[['users','ผู้ใช้','Users'],['roles','บทบาทและสิทธิ์','Roles and permissions'],['dashboards','การมองเห็นแดชบอร์ด','Dashboard visibility'],['workflow','ขั้นตอนอนุมัติ','Approval workflow'],['audit','บันทึกการตรวจสอบ','Audit log']];
 return function AccessManagement({lang}){
  const tr=(th,en)=>lang==='th'?th:en;
  const [tab,T]=React.useState('roles'),[visited,V]=React.useState(['roles']),[editor,E]=React.useState(null),[revision,R]=React.useState(0);
  function change(id){T(id);V(old=>old.includes(id)?old:[...old,id]);}
  const onKey=(e)=>{const index=tabs.findIndex(x=>x[0]===tab);let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();change(tabs[next][0]);e.currentTarget.parentElement.querySelectorAll('[role=tab]')[next].focus();};
  return h('section',{className:'crm-settings crm-access'},
   h('header',{className:'crm-access-heading'},h('div',null,h('h1',null,tr('บทบาทและสิทธิ์','Roles and permissions')),h('p',null,tr('จัดการผู้ใช้ บทบาท และการเข้าถึงข้อมูลใน KC CuTo CRM','Manage users, roles and access in KC CuTo CRM'))),h('span',{className:'crm-access-badge'},tr('การควบคุมสิทธิ์การใช้งาน','Access control'))),
   h('div',{className:'crm-access-banner'},h('svg',{'aria-hidden':true,width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,style:{flexShrink:0}},h('path',{d:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z'}),h('path',{d:'m8 12 3 3 5-6'})),h('div',null,h('strong',null,tr('จัดการการเข้าถึงจากจุดเดียว','Manage access in one place')),h('p',null,tr('เลือกบทบาทเพื่อตรวจสอบสิทธิ์ การเปลี่ยนแปลงจะมีผลเมื่อกดบันทึก','Select a role to review access. Changes take effect when saved.')))),
   h('div',{className:'crm-access-card'},h('div',{className:'crm-access-tabs',role:'tablist','aria-label':tr('การจัดการสิทธิ์','Access management')},tabs.map(([id,th,en])=>h('button',{key:id,id:'access-tab-'+id,type:'button',role:'tab','aria-selected':tab===id,'aria-controls':'access-panel-'+id,tabIndex:tab===id?0:-1,onKeyDown:onKey,onClick:()=>change(id)},tr(th,en)))),
    tabs.filter(([id])=>visited.includes(id)).map(([id,th,en])=>h('div',{key:id,id:'access-panel-'+id,role:'tabpanel','aria-labelledby':'access-tab-'+id,hidden:tab!==id,className:'crm-access-panel'},
     id==='users'?h(RecordEditor,{lang,kind:'users'}):id==='workflow'?h(RecordEditor,{lang,kind:'workflow'}):id==='audit'?(tab==='audit'?h(Feed,{lang,audit:true}):null):id==='dashboards'?h(Permissions,{lang,mode:'dashboards'}):h(React.Fragment,null,
      editor&&h('section',{className:'crm-access-role-editor','aria-label':tr('จัดการบทบาท','Manage role')},h(RecordEditor,{lang,kind:'roles',initialEdit:editor.row,initialCreate:!editor.row,onSaved:()=>{E(null);R(v=>v+1);},onCancel:()=>E(null),hidePermissions:true})),
      h(Permissions,{lang,revision,onCreate:()=>E({row:null}),onEdit:row=>E({row})}))))));
 };
}
