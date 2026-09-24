export const CATEGORIES = [
 ['customer_type','ประเภทลูกค้า','Customer Type'],['industry','ประเภทธุรกิจ','Industry'],
 ['lead_source','แหล่งที่มาของลูกค้า','Lead Source'],['sales_stage','ขั้นตอนการขาย','Sales Stage'],
 ['product_category','หมวดหมู่สินค้า','Product Category'],['region','ภูมิภาค','Region'],
 ['tier','ระดับ','Tier'],['unit','หน่วย','Unit'],['tag','แท็ก','Tag'],['loss_reason','เหตุผลที่แพ้','Loss Reason'],
 ['asset_type','ประเภทสินทรัพย์','Asset type'],['asset_brand','ยี่ห้อสินทรัพย์','Asset brand'],['asset_model','รุ่นสินทรัพย์','Asset model'],['asset_status','สถานะสินทรัพย์','Asset status'],['warranty_status','สถานะประกัน','Warranty status'],['license_status','สถานะไลเซนส์','License status'],['asset_location','ที่ตั้งสินทรัพย์','Asset location']
];
export function validateMaster(input) {
 const out={category:String(input.category??''),code:String(input.code??'').trim().toUpperCase(),name_th:String(input.name_th??'').trim(),name_en:String(input.name_en??'').trim(),sort_order:Number(input.sort_order),status:input.status};
 if(!CATEGORIES.some(([id])=>id===out.category))throw Error('หมวดหมู่ไม่ถูกต้อง / Invalid category');
 if(!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(out.code))throw Error('Code: A–Z, 0–9, _ หรือ - ไม่เกิน 40 ตัว / Maximum 40 characters');
 if(!out.name_th||out.name_th.length>200||!out.name_en||out.name_en.length>200)throw Error('กรอกชื่อไทยและอังกฤษ ไม่เกิน 200 ตัว / Both names required, maximum 200 characters');
 if(String(input.sort_order).trim()===''||!Number.isInteger(out.sort_order)||out.sort_order<0||out.sort_order>9999)throw Error('ลำดับต้องเป็นจำนวนเต็ม 0–9999 / Order must be an integer from 0 to 9999');
 if(!['active','inactive'].includes(out.status))throw Error('สถานะไม่ถูกต้อง / Invalid status');
 return out;
}
export function createMasterData({React,client,useApp}) {
 const h=React.createElement;
 let demoRows=[];
 return function MasterDataPage({lang,scope}) {
  const tr=(th,en)=>lang==='th'?th:en;
  const {demoMode,profile}=useApp();
  const canEdit=demoMode||profile?.role==='admin';
  const [category,setCategory]=React.useState(scope==='assets'?'asset_type':scope==='stages'?'sales_stage':'customer_type'),[rows,setRows]=React.useState([]),[query,setQuery]=React.useState('');
  const [loading,setLoading]=React.useState(true),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[message,setMessage]=React.useState('');
  const [editing,setEditing]=React.useState(null);
  const [reload,setReload]=React.useState(0);
  React.useEffect(()=>{
   let active=true;setLoading(true);setError('');setRows([]);
   async function load(){try{
    let data;
    if(demoMode)data=demoRows.filter(row=>row.category===category);
    else {const result=await client.from('master_data_items').select('*').eq('category',category).order('sort_order').order('code').limit(1000);if(result.error)throw result.error;data=result.data;}
    if(active)setRows(data??[]);
   }catch(e){if(active)setError(tr('โหลดข้อมูลไม่สำเร็จ: ','Unable to load data: ')+e.message);}finally{if(active)setLoading(false);}}
   load();return()=>{active=false;};
  },[category,reload,demoMode]);
  function open(row){setError('');setMessage('');setEditing(row?{...row}:{category,code:'',name_th:'',name_en:'',sort_order:0,status:'active'});}
  async function save(event){event.preventDefault();if(busy||!canEdit||!editing)return;
   setBusy(true);setError('');setMessage('');
   try {
    const value=validateMaster(editing);
    if(demoMode){
     if(demoRows.some(row=>row.category===value.category&&row.code===value.code&&row.id!==editing.id))throw Error(tr('Code ซ้ำในหมวดหมู่นี้','Duplicate code in this category'));
     const row={...value,id:editing.id??crypto.randomUUID(),version:(editing.version??0)+1};demoRows=demoRows.filter(r=>r.id!==row.id).concat(row);
    }else{
     const request=editing.id?client.from('master_data_items').update(value).eq('id',editing.id).eq('version',editing.version):client.from('master_data_items').insert(value);
     const {data,error:failure}=await request.select('id').maybeSingle();
     if(failure)throw Error(failure.code==='23505'?tr('Code ซ้ำในหมวดหมู่นี้','Duplicate code in this category'):failure.message);
     if(!data)throw Error(tr('ข้อมูลถูกแก้ไขแล้วหรือไม่มีสิทธิ์ กรุณาโหลดใหม่','Record changed or access denied. Reload before saving.'));
    }
    setEditing(null);setReload(v=>v+1);setMessage(demoMode?tr('บันทึกเฉพาะโหมดทดลอง ไม่ได้เขียนฐานข้อมูลจริง','Saved in demo memory only; production database unchanged'):tr('บันทึกลงฐานข้อมูลแล้ว','Saved to database'));
   }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const visible=rows.filter(row=>`${row.code} ${row.name_th} ${row.name_en}`.toLowerCase().includes(query.trim().toLowerCase()));
  const field=(key,label,type='text')=>h('label',{className:'crm-field',key},h('span',null,label),h('input',{type,'aria-label':label,value:editing[key],required:true,maxLength:key==='code'?40:200,min:type==='number'?0:undefined,max:type==='number'?9999:undefined,disabled:busy,onChange:e=>setEditing(old=>({...old,[key]:e.target.value}))}));
  return h('section',{className:'crm-settings'},h('h1',null,scope==='assets'?tr('ตั้งค่าสินทรัพย์','Asset settings'):scope==='stages'?tr('ตั้งค่า Sales Stage','Sales stage settings'):tr('ข้อมูลหลัก','Master Data')),
   h('p',null,tr('จัดการรายการอ้างอิงแยกตามหมวดหมู่ การเปลี่ยนแปลงนี้ไม่แก้ข้อมูลในเอกสารเดิม','Manage reference records by category. Changes do not rewrite existing documents.')),
   scope&&h('p',{className:'crm-notice'},tr('รายการอ้างอิงนี้บันทึกลงฐานข้อมูลได้ แต่ยังไม่เปลี่ยนตัวเลือกและกฎในฟอร์มธุรกิจเดิมโดยอัตโนมัติ','These reference records persist in the database; existing business-form options and rules are not automatically changed.')),
   demoMode&&h('p',{className:'crm-notice'},tr('โหมดทดลอง • ข้อมูลเก็บเฉพาะระหว่างทดลองใช้งาน','Demo mode • Data is stored in memory for this session only')),
   h('div',{className:'crm-tabs'},CATEGORIES.filter(([id])=>!scope||(scope==='stages'?id==='sales_stage':['asset_type','asset_brand','asset_model','asset_status','warranty_status','license_status','asset_location'].includes(id))).map(([id,th,en])=>h('button',{key:id,type:'button',disabled:busy,'aria-pressed':category===id,onClick:()=>{setCategory(id);setEditing(null);setMessage('');setQuery('');}},tr(th,en)))),
   h('div',{className:'crm-actions'},h('input',{type:'search',className:'crm-search','aria-label':tr('ค้นหาข้อมูลหลัก','Search master data'),value:query,onChange:e=>setQuery(e.target.value)}),h('button',{onClick:()=>setReload(v=>v+1),disabled:busy||loading},tr('โหลดใหม่','Reload')),canEdit&&h('button',{className:'crm-save',disabled:busy||loading,onClick:()=>open(null)},tr('เพิ่มรายการ','Add Item'))),
   error&&h('p',{role:'alert',className:'crm-error'},error),message&&h('p',{role:'status',className:'crm-notice'},message),
   loading?h('p',{role:'status'},tr('กำลังโหลด…','Loading…')):h('div',{style:{overflowX:'auto'}},h('table',{className:'crm-master-table'},h('thead',null,h('tr',null,['Code',tr('ชื่อ (ไทย)','Name (TH)'),tr('ชื่อ (EN)','Name (EN)'),tr('ลำดับ','Order'),tr('สถานะ','Status'),''].map((v,i)=>h('th',{key:i},v)))),h('tbody',null,visible.map(row=>h('tr',{key:row.id},h('td',null,row.code),h('td',null,row.name_th),h('td',null,row.name_en),h('td',null,row.sort_order),h('td',null,row.status==='active'?tr('ใช้งานอยู่','Active'):tr('ปิดใช้งาน','Inactive')),h('td',null,canEdit&&h('button',{onClick:()=>open(row),disabled:busy,'aria-label':tr('แก้ไข ','Edit ')+row.code},tr('แก้ไข','Edit'))))),!visible.length&&h('tr',null,h('td',{colSpan:6},tr('ไม่พบรายการ','No records found')))))),
   rows.length===1000&&h('p',null,tr('แสดง 1,000 รายการแรกในหมวดนี้','Showing the first 1,000 records in this category')),
   editing&&h('form',{onSubmit:save,'aria-label':tr('แบบฟอร์มข้อมูลหลัก','Master data form'),className:'crm-master-form'},h('h2',null,editing.id?tr('แก้ไขรายการ','Edit Item'):tr('เพิ่มรายการ','Add Item')),h('div',{className:'crm-grid'},field('code','Code'),field('name_th',tr('ชื่อ (ไทย)','Name (TH)')),field('name_en',tr('ชื่อ (EN)','Name (EN)')),field('sort_order',tr('ลำดับ','Order'),'number'),h('label',{className:'crm-field'},h('span',null,tr('สถานะ','Status')),h('select',{'aria-label':tr('สถานะ','Status'),value:editing.status,disabled:busy,onChange:e=>setEditing(old=>({...old,status:e.target.value}))},h('option',{value:'active'},tr('ใช้งานอยู่','Active')),h('option',{value:'inactive'},tr('ปิดใช้งาน','Inactive'))))),h('div',{className:'crm-actions'},h('button',{type:'button',disabled:busy,onClick:()=>setEditing(null)},tr('ยกเลิก','Cancel')),h('button',{type:'submit',className:'crm-save',disabled:busy},busy?tr('กำลังบันทึก…','Saving…'):tr('บันทึก','Save'))))
  );
 };
}
