import {CATEGORIES,CATEGORY_LINKS,validateMaster,masterDemo,ensureMasterSamples} from './master-data-model.mjs?v=20261001-master-popup';
export {CATEGORIES,validateMaster};
export function createMasterData({React,client,useApp}) {
 const h=React.createElement;
 return function MasterDataPage({lang='th',scope,fixedCategory,compact=false,onChanged}) {
  const tr=(th,en)=>lang==='th'?th:en,{demoMode,profile}=useApp(),canEdit=demoMode||profile?.role==='admin';
  const [category,setCategory]=React.useState(fixedCategory||(scope==='assets'?'asset_type':scope==='stages'?'sales_stage':'customer_type')),[rows,setRows]=React.useState([]),[refs,setRefs]=React.useState([]),[query,setQuery]=React.useState('');
  const [loading,setLoading]=React.useState(true),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[message,setMessage]=React.useState(''),[editing,setEditing]=React.useState(null),[reload,setReload]=React.useState(0);
  const dialog=React.useRef(null),opener=React.useRef(null),lock=React.useRef(false);
  const categoryName=CATEGORIES.find(([id])=>id===category)?.[lang==='th'?1:2]||category;
  React.useEffect(()=>{if(fixedCategory){setCategory(fixedCategory);setQuery('');setEditing(null);}},[fixedCategory]);
  React.useEffect(()=>{
   let active=true;setLoading(true);setError('');setRows([]);
   async function load(){try{
    let data,links;
    if(demoMode){ensureMasterSamples();data=masterDemo.rows.filter(row=>row.category===category);links=masterDemo.rows;}
    else {const [result,lookup]=await Promise.all([client.from('master_data_items').select('*').eq('category',category).order('sort_order').order('code').limit(1000),client.from('master_data_items').select('*').in('category',['business_line','accounting_account']).order('sort_order').limit(1000)]);if(result.error)throw result.error;if(lookup.error)throw lookup.error;data=result.data;links=lookup.data;}
    if(active){setRows((data??[]).slice().sort((a,b)=>a.sort_order-b.sort_order||a.code.localeCompare(b.code)));setRefs(links??[]);}
   }catch(e){if(active)setError(tr('โหลดข้อมูลไม่สำเร็จ: ','Unable to load data: ')+e.message);}finally{if(active)setLoading(false);}}
   load();return()=>{active=false;};
  },[category,reload,demoMode]);
  React.useEffect(()=>{if(!editing)return;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';if(dialog.current&&!dialog.current.open)dialog.current.showModal();return()=>{document.body.style.overflow=oldOverflow;opener.current?.focus();};},[!!editing]);
  function close(){if(lock.current)return;setEditing(null);setError('');}
  function open(row){opener.current=document.activeElement;setError('');setMessage('');setEditing({category,code:'',name_th:'',name_en:'',description:'',sort_order:0,status:'active',...row});}
  async function save(event){event.preventDefault();if(lock.current||!canEdit||!editing)return;
   lock.current=true;setBusy(true);setError('');setMessage('');
   try {
    const value=validateMaster({...editing,code:editing.code.trim()||'REF-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase()});
    if(demoMode){
     if(masterDemo.rows.some(row=>row.category===value.category&&row.code===value.code&&row.id!==editing.id))throw Error(tr('Code ซ้ำในหมวดหมู่นี้','Duplicate code in this category'));
     const row={...value,id:editing.id??crypto.randomUUID(),version:(editing.version??0)+1};masterDemo.rows=masterDemo.rows.filter(r=>r.id!==row.id).concat(row);
    }else{
     const request=editing.id?client.from('master_data_items').update(value).eq('id',editing.id).eq('version',editing.version):client.from('master_data_items').insert(value);
     const {data,error:failure}=await request.select('id').maybeSingle();
     if(failure)throw Error(failure.code==='23505'?tr('Code ซ้ำในหมวดหมู่นี้','Duplicate code in this category'):failure.message);
     if(!data)throw Error(tr('ข้อมูลถูกแก้ไขแล้วหรือไม่มีสิทธิ์ กรุณาโหลดใหม่','Record changed or access denied. Reload before saving.'));
    }
    setEditing(null);setReload(v=>v+1);onChanged?.();setMessage(demoMode?tr('บันทึกเฉพาะโหมดทดลอง ไม่ได้เขียนฐานข้อมูลจริง','Saved in demo memory only; production database unchanged'):tr('บันทึกลงฐานข้อมูลแล้ว','Saved to database'));
   }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
  }
  const visible=rows.filter(row=>`${row.code} ${row.name_th} ${row.name_en} ${row.description||''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const field=(key,label,type='text')=>h('label',{className:'crm-field'+(type==='textarea'?' crm-master-wide':''),key},h('span',null,label+(key==='name_th'?' *':'')),h(type==='textarea'?'textarea':'input',{type:type==='textarea'?undefined:type,'aria-label':label,value:editing[key]??'',required:['name_th','sort_order'].includes(key),placeholder:key==='code'?tr('เว้นว่างเพื่อสร้างอัตโนมัติ','Leave blank to generate'):key==='name_en'?tr('ไม่ระบุจะใช้ชื่อไทย','Uses Thai name if empty'):undefined,maxLength:type==='textarea'?5000:key==='code'?40:200,rows:type==='textarea'?3:undefined,min:type==='number'?0:undefined,max:type==='number'?9999:undefined,autoFocus:key==='code',disabled:busy,onFocus:type==='number'?e=>e.target.select():undefined,onChange:e=>setEditing(old=>({...old,[key]:e.target.value}))}));
  const linkField=(key,label)=>{const choices=refs.filter(r=>r.category===(key==='business_line_id'?'business_line':'accounting_account')&&(r.status==='active'||r.id===editing[key]));return h('label',{className:'crm-field',key},h('span',null,label),h('select',{'aria-label':label,value:editing[key]||'',disabled:busy,onChange:e=>setEditing(old=>({...old,[key]:e.target.value||null}))},h('option',{value:''},tr('ยังไม่กำหนด','Not assigned')),choices.map(r=>h('option',{value:r.id,key:r.id},r.code+' · '+(lang==='th'?r.name_th:r.name_en)))));};
  return h('section',{className:'crm-settings crm-master-data'+(compact?' crm-master-embedded':'')},h(compact?'h2':'h1',null,compact?categoryName:scope==='assets'?tr('ตั้งค่าสินทรัพย์','Asset settings'):scope==='stages'?tr('ตั้งค่า Sales Stage','Sales stage settings'):tr('ข้อมูลหลัก','Master Data')),
   !compact&&h('p',null,tr('จัดการรายการอ้างอิงแยกตามหมวดหมู่ การเปลี่ยนแปลงนี้ไม่แก้ข้อมูลในเอกสารเดิม','Manage reference records by category. Changes do not rewrite existing documents.')),
   demoMode&&h('p',{className:'crm-notice'},tr('ข้อมูลตัวอย่างในโหมดทดลอง ไม่กระทบฐานข้อมูลจริง','Sample data in demo mode; production data is unchanged')),
   scope&&h('p',{className:'crm-notice'},tr('รายการอ้างอิงนี้บันทึกลงฐานข้อมูลได้ แต่ยังไม่เปลี่ยนตัวเลือกและกฎในฟอร์มธุรกิจเดิมโดยอัตโนมัติ','These references persist; existing business-form rules are not automatically changed.')),
   !fixedCategory&&h('div',{className:'crm-tabs'},CATEGORIES.filter(([id])=>!scope||(scope==='stages'?id==='sales_stage':['asset_type','asset_brand','asset_model','asset_status','warranty_status','license_status','asset_location'].includes(id))).map(([id,th,en])=>h('button',{key:id,type:'button',disabled:busy,'aria-pressed':category===id,onClick:()=>{setCategory(id);setEditing(null);setMessage('');setQuery('');}},tr(th,en)))),
   h('div',{className:'crm-actions'},h('input',{type:'search',className:'crm-search','aria-label':tr('ค้นหาข้อมูลหลัก','Search master data'),placeholder:tr('ค้นหารหัส ชื่อ หรือรายละเอียด','Search code, name or description'),value:query,onChange:e=>setQuery(e.target.value)}),h('button',{onClick:()=>setReload(v=>v+1),disabled:busy||loading},tr('โหลดใหม่','Reload')),canEdit&&h('button',{className:'crm-save',disabled:busy||loading,onClick:()=>open(null)},tr('เพิ่มรายการ','Add Item'))),
   error&&!editing&&h('p',{role:'alert',className:'crm-error'},error),message&&h('p',{role:'status',className:'crm-notice'},message),
   loading?h('p',{role:'status'},tr('กำลังโหลด…','Loading…')):h('div',{className:'crm-master-scroll'},h('table',{className:'crm-master-table'},h('thead',null,h('tr',null,['Code',tr('ชื่อ / รายละเอียด','Name / Description'),tr('ชื่อ (EN)','Name (EN)'),tr('ลำดับ','Order'),tr('สถานะ','Status'),''].map((v,i)=>h('th',{key:i},v)))),h('tbody',null,visible.map(row=>h('tr',{key:row.id},h('td',null,row.code),h('td',null,row.name_th,row.description&&h('small',{className:'crm-master-description'},row.description)),h('td',null,row.name_en),h('td',null,row.sort_order),h('td',null,row.status==='active'?tr('ใช้งานอยู่','Active'):tr('ปิดใช้งาน','Inactive')),h('td',null,canEdit&&h('button',{onClick:()=>open(row),disabled:busy,'aria-label':tr('แก้ไข ','Edit ')+row.code},tr('แก้ไข','Edit'))))),!visible.length&&h('tr',null,h('td',{colSpan:6},tr('ไม่พบรายการ','No records found')))))),
   rows.length===1000&&h('p',null,tr('แสดง 1,000 รายการแรกในหมวดนี้','Showing the first 1,000 records in this category')),
   editing&&h('dialog',{ref:dialog,className:'crm-master-dialog','data-size':category==='product_category'?'large':category==='asset_brand'?'small':'medium','aria-label':tr('จัดการข้อมูลหลัก','Master data dialog'),onCancel:e=>{e.preventDefault();close();}},h('form',{onSubmit:save,'aria-label':tr('แบบฟอร์มข้อมูลหลัก','Master data form')},h('header',null,h('h2',null,(editing.id?tr('แก้ไข ','Edit '):tr('เพิ่ม ','Add '))+categoryName),h('button',{type:'button','aria-label':tr('ปิด','Close'),disabled:busy,onClick:close},'×')),
    h('p',{className:'crm-master-hint'},tr('การแก้ไขไม่เปลี่ยนข้อมูลในเอกสารเดิม','Existing documents keep their saved data.')),error&&h('p',{role:'alert',className:'crm-error'},error),
    h('div',{className:'crm-master-grid'},field('code','Code'),field('name_th',tr('ชื่อ (ไทย)','Name (TH)')),field('name_en',tr('ชื่อ (EN)','Name (EN)')),field('sort_order',tr('ลำดับ','Order'),'number'),h('label',{className:'crm-field'},h('span',null,tr('สถานะ','Status')),h('select',{'aria-label':tr('สถานะ','Status'),value:editing.status,disabled:busy,onChange:e=>setEditing(old=>({...old,status:e.target.value}))},h('option',{value:'active'},tr('ใช้งานอยู่','Active')),h('option',{value:'inactive'},tr('ปิดใช้งาน','Inactive')))),
    category==='product_category'&&CATEGORY_LINKS.map((key,i)=>linkField(key,tr(['สายธุรกิจ','บัญชีรายได้','บัญชีต้นทุน / ค่าใช้จ่าย','บัญชีสินค้าคงเหลือ','บัญชีสินทรัพย์','รายได้รับล่วงหน้า'][i],['Business line','Income account','Cost / Expense account','Inventory account','Asset account','Deferred revenue account'][i]))),field('description',tr('รายละเอียด','Description'),'textarea')),
    h('footer',null,h('button',{type:'button',disabled:busy,onClick:close},tr('ยกเลิก','Cancel')),h('button',{type:'submit',className:'crm-save',disabled:busy},busy?tr('กำลังบันทึก…','Saving…'):tr('บันทึก','Save')))))
  );
 };
}
