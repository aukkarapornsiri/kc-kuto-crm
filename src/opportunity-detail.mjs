export function createOpportunityDetail({React}){
 const h=React.createElement,clean=v=>v==null||v===''?'—':String(v);
 return function OpportunityDetail({record,lang='th',busy,canEdit,onEdit,onClose,children}){
  const ref=React.useRef(null),t=(th,en)=>lang==='th'?th:en;
  React.useEffect(()=>{const dialog=ref.current,previous=document.activeElement,overflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[record.id]);
  return h('dialog',{ref,className:'kc-lead-detail-modal kc-opportunity-detail','aria-label':t('รายละเอียดโอกาสการขาย','Opportunity details'),onCancel:e=>{e.preventDefault();onClose();},onClick:e=>{if(e.target===e.currentTarget){const box=e.currentTarget.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)onClose();}}},
   h('header',{className:'kc-lead-detail-header'},
    h('div',{className:'kc-lead-detail-title-row'},h('div',{className:'kc-lead-detail-mark','aria-hidden':true},'OP'),h('div',{className:'kc-lead-detail-heading'},h('div',{className:'kc-lead-detail-code'},clean(record.code)),h('h2',null,clean(record.name)),h('div',{className:'kc-lead-detail-sub'},clean(record.customer_name))),h('button',{type:'button',className:'kc-lead-detail-close','aria-label':t('ปิดรายละเอียดโอกาสการขาย','Close opportunity details'),onClick:onClose},'×')),
    h('div',{className:'kc-lead-detail-actions'},h('span',{className:'kc-lead-chip is-primary'},t('ขั้นตอน: ','Stage: ')+clean(record.stage)),h('span',{className:'kc-lead-chip is-accent'},t('สถานะ: ','Status: ')+clean(record.status)),h('span',{className:'kc-lead-owner-chip'},t('ผู้รับผิดชอบ: ','Owner: ')+clean(record.owner_name)),h('span',{className:'kc-lead-detail-actions-spacer'}),canEdit&&h('button',{type:'button',className:'kc-lead-action-btn',disabled:busy,onClick:onEdit},t('แก้ไข','Edit')))),
   h('div',{className:'kc-lead-detail-body'},h('div',{className:'kc-lead-section-title'},h('i',{className:'kc-lead-section-bar'}),h('strong',null,t('ข้อมูลโอกาสการขาย','Opportunity information'))),busy&&h('p',{role:'status'},t('กำลังโหลดข้อมูล…','Loading details…')),children,
    h('footer',{className:'kc-lead-detail-footer'},h('span',{className:'kc-lead-detail-audit'},t('อัปเดตล่าสุด: ','Last updated: ')+(record.updated_at?new Date(record.updated_at).toLocaleString(lang==='th'?'th-TH':'en-GB'):'—')))));
 };
}
