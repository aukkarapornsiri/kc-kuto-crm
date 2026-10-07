export function createContactDetailEnterprise({React}){
 const h=React.createElement;
 const clean=v=>v==null||v===''?'-':String(v);
 const initials=name=>String(name||'SA').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'SA';
 return function ContactDetailEnterprise({record,lang='th',busy=false,canEdit=false,onClose,onEdit,children}){
  const t=(th,en)=>lang==='th'?th:en;
  const modalRef=React.useRef(null);
  React.useEffect(()=>{
   if(!record)return;
   const previous=document.activeElement,overflow=document.body.style.overflow;
   document.body.style.overflow='hidden';modalRef.current?.querySelector('button')?.focus();
   const key=e=>{if(e.key==='Escape'){e.preventDefault();onClose?.();}if(e.key==='Tab'){const items=[...modalRef.current.querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled),[tabindex="0"]')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
   document.addEventListener('keydown',key);
   return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus?.();};
  },[record?.id]);
  if(!record)return null;
  const ownerName=clean(record.owner_name&&record.owner_name!=='-'?record.owner_name:t('ยังไม่ได้มอบหมาย','Unassigned'));
  const fields=[
   [t('ชื่อลูกค้า','Account'),record.company],
   [t('คำนำหน้า','Salutation'),record.salutation],
   [t('ชื่อ','First Name'),record.first_name],
   [t('นามสกุล','Last Name'),record.last_name],
   [t('ชื่อผู้ติดต่อ','Contact'),record.name],
   [t('ตำแหน่ง','Position'),record.position],
   [t('โทรศัพท์','Phone'),record.phone],
   [t('โทรศัพท์มือถือ','Mobile'),record.mobile],
   [t('อีเมล','Email'),record.email],
   [t('LINE ID','LINE ID'),record.line_id],
   [t('แผนก','Department'),record.department],
   [t('งานถัดไป','Next Action'),record.next_action],
   [t('บทบาท','Role'),record.role],
   [t('ระดับอำนาจตัดสินใจ','Influence Level'),record.influence_level],
   [t('สถานะ','Status'),record.status],
   [t('รายงานถึง','Reports To'),record.reports_to_name],
   [t('ประเทศ','Country'),record.mailing_country],
   [t('ถนน / เลขที่ / อาคาร','Street / Building'),record.mailing_street],
   [t('เมือง / เขต / อำเภอ','City / District'),record.mailing_city],
   [t('รัฐ / จังหวัด','State / Province'),record.mailing_state],
   [t('รหัสไปรษณีย์','Postal Code'),record.mailing_postal_code],
   [t('เจ้าของผู้ติดต่อ','Contact Owner'),record.owner_name],
   [t('ผู้ติดต่อหลัก','Primary Contact'),record.is_primary?t('ใช่','Yes'):t('ไม่ใช่','No')]
  ];
  return h('div',{className:'kc-lead-detail-overlay',style:{alignItems:'center'},role:'presentation',onMouseDown:e=>{if(e.target===e.currentTarget)onClose?.();}},
   h('section',{ref:modalRef,className:'kc-lead-detail-modal',style:{maxHeight:'calc(100dvh - 40px)',overflowY:'auto'},role:'dialog','aria-modal':true,'aria-label':t('รายละเอียดผู้ติดต่อ','Contact Detail')},
    h('header',{className:'kc-lead-detail-header'},
     h('div',{className:'kc-lead-detail-title-row'},
      h('div',{className:'kc-lead-detail-mark','aria-hidden':true},'CT'),
      h('div',{className:'kc-lead-detail-heading'},h('div',{className:'kc-lead-detail-code'},clean(record.code)),h('h2',null,clean(record.name)),h('div',{className:'kc-lead-detail-sub'},t('Contact Detail · ข้อมูลล่าสุดใน CRM','Contact Detail · Latest CRM information'))),
      h('button',{type:'button',className:'kc-lead-detail-close','aria-label':t('ปิดรายละเอียด','Close detail'),onClick:onClose},'×')
     ),
     h('div',{className:'kc-lead-detail-actions'},
      h('span',{className:'kc-lead-chip is-primary'},t('สถานะ: ','Status: ')+clean(record.status)),
      h('span',{className:'kc-lead-chip is-accent'},t('บทบาท: ','Role: ')+clean(record.role)),
      h('span',{className:'kc-lead-chip'},clean(record.company)),
      h('span',{className:'kc-lead-owner-chip'},h('span',{className:'kc-lead-owner-avatar'},initials(ownerName)),h('span',{className:'kc-lead-owner-meta'},h('span',null,t('ผู้รับผิดชอบ','Assignee')),h('strong',null,ownerName))),
      h('span',{className:'kc-lead-detail-actions-spacer'}),
      canEdit&&h('button',{type:'button',className:'kc-lead-action-btn',onClick:onEdit},t('แก้ไข','Edit')),
      h('button',{type:'button',className:'kc-lead-action-btn',onClick:onClose},t('ปิดรายละเอียด','Close Detail'))
     )
    ),
    h('div',{className:'kc-lead-detail-body'},
     h('div',{className:'kc-lead-section-title'},h('i',{className:'kc-lead-section-bar'}),h('strong',null,t('ข้อมูลผู้ติดต่อ','Contact Information')),h('span',null,t('ข้อมูลทั่วไปแสดงแบบ Compact เพื่อให้เห็นบริบทได้เร็ว','Compact information for fast context'))),
     h('div',{className:'kc-lead-info-grid'},fields.map(([label,value])=>h('div',{className:'kc-lead-info-field',key:label},h('div',{className:'kc-lead-info-label'},label),h('div',{className:'kc-lead-info-value'},clean(value))))),
     h('section',{className:'kc-lead-note-wrap'},
      h('div',{className:'kc-lead-section-title'},h('i',{className:'kc-lead-section-bar'}),h('strong',null,t('หมายเหตุสำคัญ','Important Notes')),h('span',null,t('พื้นที่หลักสำหรับบริบทการขายและความต้องการของลูกค้า · Auto Height ตามข้อมูล','Primary sales context · Auto height'))),
      h('div',{className:'kc-lead-note-panel'},h('div',{className:'kc-lead-note-head'},h('span',{'aria-hidden':true},'▤'),t('หมายเหตุ / Sales Context','Notes / Sales Context')),h('div',{className:'kc-lead-note-body'},clean(record.description||record.note)))
     ),
     children,
     h('footer',{className:'kc-lead-detail-footer'},
      h('span',{className:'kc-lead-detail-audit'},t('อัปเดตล่าสุด: ','Last updated: ')+(record.updated_at?new Date(record.updated_at).toLocaleString(lang==='th'?'th-TH':'en-US'):'-')+' · Owner: '+ownerName),
      h('span',{className:'kc-lead-detail-footer-spacer'}),
     )
    )
   )
  );
 };
}
