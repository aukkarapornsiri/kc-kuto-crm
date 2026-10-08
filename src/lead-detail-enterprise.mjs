export function createLeadDetailEnterprise({React}){
 const h=React.createElement;
 const clean=v=>v==null||v===''?'-':String(v);
 const initials=name=>String(name||'SA').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'SA';
 return function LeadDetailEnterprise({record,lang='th',busy=false,canEdit=false,canAssign=false,canConvert=false,onAccount,onClose,onEdit,onConvert,loadOwners,onAssign,onActivity,onOpportunity}){
  const t=(th,en)=>lang==='th'?th:en;
  const [assignOpen,setAssignOpen]=React.useState(false);
  const [owners,setOwners]=React.useState([]);
  const [ownerId,setOwnerId]=React.useState(record?.owner_id||'');
  const [assignBusy,setAssignBusy]=React.useState(false);
  const [assignError,setAssignError]=React.useState('');
  React.useEffect(()=>{setOwnerId(record?.owner_id||'');setAssignOpen(false);setAssignError('');},[record?.id,record?.owner_id]);
  if(!record)return null;
  const ownerName=clean(record.owner_name&&record.owner_name!=='-'?record.owner_name:t('ยังไม่ได้มอบหมาย','Unassigned'));
  const openAssign=async()=>{setAssignError('');setAssignOpen(v=>!v);if(assignOpen||owners.length)return;try{const list=await loadOwners?.()||[];setOwners(list.filter(x=>x&&x.is_active!==false&&String(x.department_group||'').trim().toLowerCase()==='sales'));}catch(e){setAssignError(e.message||String(e));}};
  const confirmAssign=async()=>{const person=owners.find(x=>x.id===ownerId);if(!person)return;setAssignBusy(true);setAssignError('');try{await onAssign?.(person);setAssignOpen(false);}catch(e){setAssignError(e.message||String(e));}finally{setAssignBusy(false);}};
  const fields=[
   [t('ชื่อบริษัท','Company'),record.company_name],[t('คำนำหน้า','Salutation'),record.salutation],[t('ชื่อ','First Name'),record.first_name],[t('นามสกุล','Last Name'),record.last_name],
   [t('ชื่อผู้ติดต่อ','Contact'),record.contact_name],[t('ตำแหน่ง','Position'),record.position],[t('โทรศัพท์','Phone'),record.phone],[t('โทรศัพท์มือถือ','Mobile'),record.mobile||record.phone],
   [t('อีเมล','Email'),record.email],[t('เว็บไซต์','Website'),record.website],['LINE ID',record.line_id],[t('แหล่งที่มา','Source'),record.source],
   [t('สินค้าที่สนใจ','Product Interest'),record.product_interest],[t('งบประมาณ','Budget'),record.budget],[t('คะแนน','Score'),record.score],[t('สถานะ','Status'),record.status],
   [t('ความสำคัญ','Priority'),record.priority],[t('ประเทศ','Country'),record.mailing_country],[t('ถนน / เลขที่ / อาคาร','Street / Building'),record.mailing_street],[t('เมือง / เขต / อำเภอ','City / District'),record.mailing_city],
   [t('รัฐ / จังหวัด','State / Province'),record.mailing_state],[t('รหัสไปรษณีย์','Postal Code'),record.mailing_postal_code],[t('งานถัดไป','Next Action'),record.next_action],[t('ผู้รับผิดชอบ','Owner'),record.owner_name]
  ];
  return h('div',{className:'kc-lead-detail-overlay',role:'presentation',onMouseDown:e=>{if(e.target===e.currentTarget)onClose?.();}},
   h('section',{className:'kc-lead-detail-modal',role:'dialog','aria-modal':true,'aria-label':t('รายละเอียดลีด','Lead Detail')},
    h('header',{className:'kc-lead-detail-header'},
     h('div',{className:'kc-lead-detail-title-row'},
      h('div',{className:'kc-lead-detail-mark','aria-hidden':true},'LD'),
      h('div',{className:'kc-lead-detail-heading'},h('div',{className:'kc-lead-detail-code'},clean(record.code)),h('h2',null,clean(record.company_name)),h('div',{className:'kc-lead-detail-sub'},t('Lead Detail · ข้อมูลล่าสุดใน CRM','Lead Detail · Latest CRM information'))),
      h('button',{type:'button',className:'kc-lead-detail-close','aria-label':t('ปิดรายละเอียด','Close detail'),onClick:onClose},'×')
     ),
     h('div',{className:'kc-lead-detail-actions'},
      h('span',{className:'kc-lead-chip is-primary'},t('สถานะ: ','Status: ')+clean(record.status)),
      h('span',{className:'kc-lead-chip is-accent'},t('ความสำคัญ: ','Priority: ')+clean(record.priority)),
      h('span',{className:'kc-lead-chip'},t('แหล่งที่มา: ','Source: ')+clean(record.source)),
      h('span',{className:'kc-lead-owner-chip'},h('span',{className:'kc-lead-owner-avatar'},initials(ownerName)),h('span',{className:'kc-lead-owner-meta'},h('span',null,t('ผู้รับผิดชอบ','Assignee')),h('strong',null,ownerName))),
      h('span',{className:'kc-lead-detail-actions-spacer'}),
      canAssign&&h('button',{type:'button',className:'kc-lead-action-btn assign',onClick:openAssign},h('span',{'aria-hidden':true},'＋'),t('Assign Lead','Assign Lead')),
      onAccount&&h('button',{type:'button',className:'kc-lead-action-btn',onClick:onAccount},t('เปิดลูกค้า','Open Account')),
      canEdit&&h('button',{type:'button',className:'kc-lead-action-btn',onClick:onEdit},t('แก้ไข','Edit')),
      canConvert&&h('button',{type:'button',className:'kc-lead-action-btn primary',onClick:onConvert,disabled:busy},t('แปลงเป็นลูกค้า','Convert to Customer')),
      h('button',{type:'button',className:'kc-lead-action-btn',onClick:onClose},t('ปิดรายละเอียด','Close Detail'))
     ),
     assignOpen&&h('div',{className:'kc-lead-assign-panel'},
      h('label',null,t('เลือกพนักงานฝ่ายขาย','Select Sales employee'),h('select',{value:ownerId,onChange:e=>setOwnerId(e.target.value),disabled:assignBusy},h('option',{value:''},t('เลือกผู้รับผิดชอบ','Choose assignee')),owners.map(x=>h('option',{key:x.id,value:x.id},x.display_name||x.name||x.email)))),
      h('button',{type:'button',className:'kc-lead-action-btn primary',onClick:confirmAssign,disabled:assignBusy||!ownerId},assignBusy?t('กำลังบันทึก...','Saving...'):t('ยืนยัน Assign','Assign')),
      assignError&&h('div',{className:'kc-lead-assign-error',role:'alert'},assignError)
     )
    ),
    h('div',{className:'kc-lead-detail-body'},
     h('div',{className:'kc-lead-section-title'},h('i',{className:'kc-lead-section-bar'}),h('strong',null,t('ข้อมูลลีด','Lead Information')),h('span',null,t('ข้อมูลทั่วไปแสดงแบบ Compact เพื่อให้เห็นบริบทได้เร็ว','Compact information for fast context'))),
     h('div',{className:'kc-lead-info-grid'},fields.map(([label,value])=>h('div',{className:'kc-lead-info-field',key:label},h('div',{className:'kc-lead-info-label'},label),h('div',{className:'kc-lead-info-value'},clean(value))))),
     h('section',{className:'kc-lead-note-wrap'},
      h('div',{className:'kc-lead-section-title'},h('i',{className:'kc-lead-section-bar'}),h('strong',null,t('หมายเหตุสำคัญ','Important Notes')),h('span',null,t('พื้นที่หลักสำหรับบริบทการขายและความต้องการของลูกค้า · Auto Height ตามข้อมูล','Primary sales context · Auto height'))),
      h('div',{className:'kc-lead-note-panel'},h('div',{className:'kc-lead-note-head'},h('span',{'aria-hidden':true},'▤'),t('หมายเหตุ / Sales Context','Notes / Sales Context')),h('div',{className:'kc-lead-note-body'},clean(record.note)))
     ),
     h('footer',{className:'kc-lead-detail-footer'},
      h('span',{className:'kc-lead-detail-audit'},t('อัปเดตล่าสุด: ','Last updated: ')+(record.updated_at?new Date(record.updated_at).toLocaleString(lang==='th'?'th-TH':'en-US'):'-')+' · Owner: '+ownerName),
      h('span',{className:'kc-lead-detail-footer-spacer'}),
      onActivity&&h('button',{type:'button',className:'kc-lead-action-btn',onClick:onActivity},t('บันทึกกิจกรรม','Add Activity')),
      onOpportunity&&h('button',{type:'button',className:'kc-lead-action-btn primary',onClick:onOpportunity},t('สร้าง Opportunity','Create Opportunity'))
     )
    )
   )
  );
 };
}
