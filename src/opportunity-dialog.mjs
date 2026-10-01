import {OPTIONS} from './internal-options.mjs';

export function opportunityStagePatch(stage) {
  if(stage==='Won')return {stage,status:'won',probability:100,forecast_category:'Closed Won'};
  if(stage==='Lost')return {stage,status:'lost',probability:0,forecast_category:'Closed Lost'};
  return {stage,status:'open'};
}

export function createOpportunityDialog({React}) {
  const h=React.createElement;
  return function OpportunityDialog({lang,editing,setEditing,lookup,masters,busy,error,message,onSave,onClose}) {
    const t=(th,en)=>lang==='th'?th:en,ref=React.useRef(null),inputRef=React.useRef(null);
    const customers=lookup.customers||[],people=(lookup.profiles||[]).filter(x=>x.is_active!==false||x.id===editing.owner_id);
    const account=customers.find(x=>x.id===editing.customer_id);
    const [search,Search]=React.useState(account?.name||''),[expanded,Expanded]=React.useState(false),[active,Active]=React.useState(0);
    const listId=React.useId(),titleId=React.useId();
    React.useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>{if(dialog.open)dialog.close();};},[]);
    const closed=['Won','Lost'].includes(editing.stage);
    const matches=customers.filter(x=>[x.name,x.name_en,x.code,x.tax_id].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase()))).slice(0,50);
    const set=(key,value)=>setEditing(old=>({...old,[key]:value}));
    const selectCustomer=row=>{setEditing(old=>({...old,customer_id:row.id,customer_name:row.name,contact_id:'',contact_name:''}));Search(row.name);Expanded(false);inputRef.current?.focus();};
    const input=(key,label,extra={})=>h('input',{'aria-label':label,value:editing[key]??'',disabled:busy,onChange:e=>set(key,e.target.value),...extra});
    const field=(label,control,required=false)=>h('label',{className:'crm-opportunity-field'},h('span',null,required&&h('b',{'aria-hidden':true},'* '),label),h('div',{className:'crm-opportunity-control'},control));
    const select=(key,label,values,extra={})=>h('select',{'aria-label':label,value:editing[key]||'',disabled:busy,onChange:e=>set(key,e.target.value),...extra},h('option',{value:''},t('--ไม่มี--','--None--')),values.map(([value,name])=>h('option',{key:value,value},name)));
    const stageOptions=[...OPTIONS.opportunities.stage.map(value=>[value,value]),...masters.filter(x=>x.category==='sales_stage'&&!OPTIONS.opportunities.stage.includes(x.name_en)).map(x=>[x.name_en,lang==='th'?x.name_th:x.name_en])];
    if(editing.stage&&!stageOptions.some(x=>x[0]===editing.stage))stageOptions.unshift([editing.stage,editing.stage]);
    const accountSearch=h('div',{className:'crm-opportunity-lookup',onBlur:e=>{if(!e.currentTarget.contains(e.relatedTarget))Expanded(false);}},
      h('div',{className:'crm-opportunity-search'},h('input',{ref:inputRef,role:'combobox','aria-label':t('ชื่อลูกค้า','Account Name'),'aria-autocomplete':'list','aria-expanded':expanded,'aria-controls':listId,'aria-activedescendant':expanded&&matches[active]?listId+'-'+active:undefined,autoComplete:'off',required:true,disabled:busy,value:search,placeholder:t('ค้นหาลูกค้า…','Search accounts…'),onFocus:()=>Expanded(true),onChange:e=>{Search(e.target.value);Expanded(true);Active(0);if(editing.customer_id)setEditing(old=>({...old,customer_id:'',customer_name:'',contact_id:'',contact_name:''}));},onKeyDown:e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();Expanded(true);Active(i=>Math.max(0,Math.min(matches.length-1,i+(e.key==='ArrowDown'?1:-1))));}else if(e.key==='Enter'&&expanded){e.preventDefault();if(matches[active])selectCustomer(matches[active]);}else if(e.key==='Escape'&&expanded){e.preventDefault();e.stopPropagation();Expanded(false);}}}),h('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,'aria-hidden':true},h('circle',{cx:10,cy:10,r:6}),h('path',{d:'m15 15 6 6'}))),
      expanded&&h('div',{id:listId,role:'listbox','aria-label':t('รายชื่อลูกค้า','Account results'),className:'crm-opportunity-results'},matches.length?matches.map((row,index)=>h('button',{id:listId+'-'+index,key:row.id,type:'button',role:'option','aria-selected':editing.customer_id===row.id,className:index===active?'is-active':'',onMouseDown:e=>e.preventDefault(),onClick:()=>selectCustomer(row)},h('strong',null,row.name),h('small',null,[row.code,row.name_en].filter(Boolean).join(' · ')))):h('p',null,t('ไม่พบลูกค้า กรุณาสร้างลูกค้าในเมนูลูกค้าก่อน','No accounts found. Create an account in Accounts first.'))),
      search&&!editing.customer_id&&!expanded&&h('small',{className:'crm-opportunity-invalid'},t('กรุณาเลือกลูกค้าจากรายชื่อ','Select an account from the results')));
    return h('dialog',{ref,className:'crm-profile-dialog crm-opportunity-dialog','aria-labelledby':titleId,onCancel:e=>{e.preventDefault();if(!busy)onClose();}},
      h('form',{'aria-label':t('ฟอร์มโอกาสการขาย','Opportunity form'),onSubmit:onSave},
        h('header',{className:'crm-opportunity-header'},h('h2',{id:titleId},editing.id?t('แก้ไขโอกาสการขาย','Edit Opportunity'):t('สร้างโอกาสใหม่','New Opportunity')),h('button',{type:'button',disabled:busy,'aria-label':t('ปิดฟอร์ม','Close form'),onClick:onClose},'×')),
        h('div',{className:'crm-profile-body crm-opportunity-body'},h('p',{className:'crm-opportunity-required'},h('b',null,'* '),t('= ข้อมูลที่จำเป็น','= Required information')),error&&h('p',{role:'alert',className:'crm-error'},error),message&&h('p',{role:'status',className:'crm-notice'},message),
          h('section',{className:'crm-opportunity-section'},h('h3',null,t('เกี่ยวกับโอกาส','About')),
            field(t('ชื่อโอกาส','Opportunity Name'),input('name',t('ชื่อโอกาส','Opportunity Name'),{required:true,autoFocus:true,maxLength:10000}),true),
            field(t('ชื่อลูกค้า','Account Name'),accountSearch,true),
            field(t('วันที่ปิด','Close Date'),input('close_date',t('วันที่ปิด','Close Date'),{type:'date',required:true}),true),
            field(t('จำนวนเงิน','Amount'),input('amount',t('จำนวนเงิน','Amount'),{type:'number',min:0,max:999999999999999.99,step:'0.01'})),
            field(t('คำอธิบาย','Description'),h('textarea',{'aria-label':t('คำอธิบาย','Description'),value:editing.solution||'',disabled:busy,rows:3,onChange:e=>set('solution',e.target.value)})),
            field(t('เจ้าของโอกาส','Opportunity Owner'),select('owner_id',t('เจ้าของโอกาส','Opportunity Owner'),people.map(x=>[x.id,x.display_name||x.name||x.email]),{required:true}))),
          h('section',{className:'crm-opportunity-section'},h('h3',null,t('สถานะ','Status')),
            field(t('ขั้น','Stage'),select('stage',t('ขั้น','Stage'),stageOptions,{required:true,onChange:e=>setEditing(old=>({...old,...opportunityStagePatch(e.target.value),...(!['Won','Lost'].includes(e.target.value)&&['Closed Won','Closed Lost'].includes(old.forecast_category)?{forecast_category:'Pipeline'}:{})}))}),true),
            field(t('ความเป็นไปได้ (%)','Probability (%)'),input('probability',t('ความเป็นไปได้ (%)','Probability (%)'),{type:'number',min:0,max:100,step:1,readOnly:closed})),
            field(t('ประเภทของการคาดการณ์','Forecast Category'),select('forecast_category',t('ประเภทของการคาดการณ์','Forecast Category'),(closed?[editing.stage==='Won'?'Closed Won':'Closed Lost']:OPTIONS.opportunities.forecast_category.filter(x=>!x.startsWith('Closed'))).map(x=>[x,x]),{required:true}),true),
            field(t('ขั้นต่อไป','Next Step'),input('next_action',t('ขั้นต่อไป','Next Step')))),
          h('details',{className:'crm-profile-additional',open:editing.stage==='Lost'?true:undefined},h('summary',null,t('ข้อมูลเพิ่มเติมใน CRM','Additional CRM Information')),
            field(t('ผู้ติดต่อ','Contact'),select('contact_id',t('ผู้ติดต่อ','Contact'),(lookup.contacts||[]).filter(x=>x.customer_id===editing.customer_id).map(x=>[x.id,x.name]),{disabled:busy||!editing.customer_id})),
            field(t('สินค้า / บริการ','Product / Service'),input('product',t('สินค้า / บริการ','Product / Service'))),
            field(t('คู่แข่ง','Competitor'),input('competitor',t('คู่แข่ง','Competitor'))),
            field(t('ความสำคัญ','Priority'),select('priority',t('ความสำคัญ','Priority'),OPTIONS.opportunities.priority.map(x=>[x,x]))),
            field(t('เหตุผลที่แพ้','Lost Reason'),input('lost_reason',t('เหตุผลที่แพ้','Lost Reason'),{required:editing.stage==='Lost'}),editing.stage==='Lost'))),
        h('footer',{className:'crm-profile-footer'},h('button',{type:'button',disabled:busy,onClick:onClose},t('ยกเลิก','Cancel')),!editing.id&&h('button',{type:'submit',value:'save-new',disabled:busy},t('บันทึกและสร้าง','Save & New')),h('button',{type:'submit',value:'save',disabled:busy,className:'crm-save'},t('บันทึก','Save')))));
  };
}
