export const ACCOUNT360_URL='https://kc-account-360-preview.saelim-m.chatgpt.site';
export async function fetchAccountInventory(client,signal){
 const {data,error}=await client.auth.getSession();if(error)throw error;
 if(!data?.session?.access_token)throw Error('กรุณาเข้าสู่ระบบเพื่อโหลดข้อมูล KC Account 360');
 const r=await fetch(ACCOUNT360_URL+'/api/integrations/cuto/inventory',{headers:{authorization:'Bearer '+data.session.access_token},cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
 const value=await r.json().catch(()=>({}));if(!r.ok)throw Error(value.error||'ไม่สามารถเชื่อมต่อ KC Account 360 ได้');
 if(value.service!=='kc-account360-inventory'||value.version!==1||!['catalog','warehouses','balances'].every(k=>Array.isArray(value[k])))throw Error('ข้อมูลจาก KC Account 360 ไม่สมบูรณ์');
 return value;
}
export function createAccountInventory({React,client}){
 const h=React.createElement;
 return function AccountInventory({lang='th',onClose}){
  const t=(th,en)=>lang==='th'?th:en;
  const [data,S]=React.useState(null),[error,E]=React.useState(''),[busy,B]=React.useState(false),[tab,T]=React.useState('PRODUCT'),[query,Q]=React.useState(''),[warehouse,W]=React.useState(''),[selected,D]=React.useState(null);
  const request=React.useRef(null),dialog=React.useRef(null);
  async function load(){request.current?.abort();const controller=new AbortController();request.current=controller;B(true);E('');try{const v=await fetchAccountInventory(client,controller.signal);if(!controller.signal.aborted)S(v);}catch(e){if(!controller.signal.aborted)E(e.message);}finally{if(!controller.signal.aborted)B(false);}}
  React.useEffect(()=>{load();return()=>request.current?.abort();},[]);
  React.useEffect(()=>{if(selected&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[selected]);
  const btn=(name,fn,extra={})=>h('button',{type:'button',onClick:fn,...extra},name);
  const tables=(heads,rows)=>h('div',{className:'crm-table-scroll'},h('table',{className:'crm-master-table'},h('thead',null,h('tr',null,heads.map((x,i)=>h('th',{key:i},x)))),h('tbody',null,rows.length?rows.map((r,i)=>h('tr',{key:i},r.map((v,j)=>h('td',{key:j},v??'—')))):h('tr',null,h('td',{colSpan:heads.length},t('ไม่มีข้อมูลใน KC Account 360 ที่ตรงกับตัวกรอง','No matching records in KC Account 360'))))));
  const catalog=data?.catalog||[],items=catalog.filter(x=>x.category==='PRODUCT'),money=v=>Number(v||0).toLocaleString(lang==='th'?'th-TH':'en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
  const matches=x=>[x.code,x.name,x.description,x.metadata?.partNumber,x.metadata?.brandName].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase()));
  const rows=catalog.filter(x=>x.category===tab&&matches(x));
  const kind=m=>m.catalogLevel==='kind';
  const stock=(data?.balances||[]).map(x=>({...x,name:items.find(p=>p.code===x.code)?.name||x.code})).filter(x=>(!warehouse||warehouse===x.warehouse)&&matches(x));
  return h('section',{className:'crm-settings crm-inventory crm-account360-inventory'},
   h('div',{className:'crm-actions'},onClose&&btn(t('กลับ','Back'),onClose),h('h1',null,t('สินค้าและคลัง','Products & Inventory'))),
   h('p',{className:'crm-notice'},t('แหล่งข้อมูล: KC Account 360 • แก้ไขสินค้าและรับ–จ่ายสต็อกที่ระบบบัญชี','Source: KC Account 360 • Manage products and stock movements in the accounting system')),
   h('div',{className:'crm-actions'},btn(t('รีเฟรชข้อมูล','Refresh'),load,{disabled:busy}),h('a',{href:ACCOUNT360_URL+'/?page=settings',target:'_blank',rel:'noopener noreferrer'},t('เปิด KC Account 360','Open KC Account 360')),data&&h('span',{role:'status'},t('โหลดล่าสุด: ','Last fetched: ')+new Date(data.fetchedAt).toLocaleString(lang==='th'?'th-TH':'en-GB'))),
   error&&h('p',{role:'alert',className:'crm-error'},error+(data?t(' • ข้อมูลด้านล่างเป็นข้อมูลที่โหลดครั้งก่อน',' • Showing previously loaded data'):'')),busy&&h('p',{role:'status'},t('กำลังโหลดข้อมูล…','Loading…')),
   data&&h(React.Fragment,null,
    h('div',{className:'crm-inventory-metrics'},[[t('สินค้า/บริการ','Products / Services'),items.length],[t('คลังสินค้า','Warehouses'),data.warehouses.length],[t('การควบคุมสต็อก','Stock control'),data.settings.enabled?t('เปิด','On'):t('ปิด','Off')]].map(([name,value])=>h('article',{key:name},h('span',null,name),h('strong',null,value)))),
    h('div',{className:'crm-tabs'},[['PRODUCT','สินค้าและบริการ','Products & Services'],['kind','ชนิดสินค้าและบริการ','Product kinds'],['PRODUCT_CATEGORY','หมวดสินค้าและบริการ','Product categories'],['PRODUCT_UNIT','หน่วยสินค้า','Units'],['PRODUCT_BRAND','แบรนด์','Brands'],['warehouses','คลังสินค้า','Warehouses'],['balances','ยอดคงเหลือและจุดแจ้งเตือน','Balances & Alerts']].map(([id,th,en])=>btn(t(th,en),()=>{T(id);Q('');W('');},{key:id,'aria-pressed':tab===id}))),
    h('div',{className:'crm-actions'},h('input',{type:'search',value:query,placeholder:t('ค้นหาชื่อ / รหัส / Part Number','Search name / code / part number'),'aria-label':t('ค้นหาสินค้าและคลัง','Search inventory'),onChange:e=>Q(e.target.value)}),tab==='balances'&&h('select',{value:warehouse,'aria-label':t('กรองคลัง','Filter warehouse'),onChange:e=>W(e.target.value)},h('option',{value:''},t('ทุกคลัง','All warehouses')),data.warehouses.map(w=>h('option',{key:w.code,value:w.code},w.name)))),
    tab==='PRODUCT'?tables([t('รหัส','Code'),t('ชื่อ','Name'),t('หน่วย','Unit'),t('หมวด','Category'),t('แบรนด์','Brand'),t('ราคาขาย','Sale price'),...(data.canSeeCost?[t('ราคาซื้อ','Purchase price')]:[]),'VAT',t('สถานะ','Status')],rows.map(x=>[x.code,btn(x.name,()=>D(x)),x.metadata.unit,x.metadata.categoryName,x.metadata.brandName,money(x.metadata.salePrice),...(data.canSeeCost?[money(x.metadata.purchasePrice)]:[]),x.metadata.vatMode,x.status])):
    tab==='warehouses'?tables([t('รหัส','Code'),t('คลังสินค้า','Warehouse'),t('ที่อยู่','Address'),t('สถานะ','Status')],data.warehouses.filter(matches).map(x=>[x.code,x.name,x.address,x.active?t('ใช้งาน','Active'):t('ไม่ใช้งาน','Inactive')])):
    tab==='balances'?h(React.Fragment,null,!data.settings.enabled&&h('p',{className:'crm-notice'},t('KC Account 360 ยังไม่เปิดการควบคุมสต็อก','Stock control is not enabled in KC Account 360')),tables([t('คลัง','Warehouse'),t('รหัสสินค้า','Item code'),t('สินค้า','Item'),t('คงเหลือ','On hand'),t('จุดแจ้งเตือน','Minimum'),t('สถานะ','Status')],stock.map(x=>[x.warehouse,x.code,x.name,x.quantity,x.minimum,x.minimum>0&&x.quantity<=x.minimum?t('ควรเติมสินค้า','Reorder'):'—']))):
    tables([t('รหัส','Code'),t('ชื่อ','Name'),t('คำอธิบาย','Description'),t('สถานะ','Status')],(tab==='kind'?catalog.filter(x=>x.category==='PRODUCT_CATEGORY'&&kind(x.metadata)&&matches(x)):rows.filter(x=>tab!=='PRODUCT_CATEGORY'||!kind(x.metadata))).map(x=>[x.code,x.name,x.description,x.status]))),
   selected&&h('dialog',{ref:dialog,className:'crm-inventory-dialog',style:{padding:'24px'},'data-kind':'item','aria-label':selected.name,onCancel:()=>D(null)},h('header',null,h('h2',null,selected.name),btn('×',()=>D(null),{'aria-label':t('ปิด','Close')})),h('div',{className:'crm-inventory-grid'},h('p',{className:'crm-inventory-wide'},selected.code),h('p',{className:'crm-inventory-wide',style:{whiteSpace:'pre-wrap'}},selected.description),...Object.entries(selected.metadata).map(([k,v])=>h('div',{key:k},h('span',null,({productType:'ประเภทสินค้า',itemType:'ประเภท',unit:'หน่วย',categoryName:'หมวดสินค้า',categoryId:'รหัสหมวด',brandName:'แบรนด์',partNumber:'Part Number',barcode:'บาร์โค้ด',salePrice:'ราคาขาย',purchasePrice:'ราคาซื้อ',vatMode:'VAT',inventoryControl:'ควบคุมสต็อก',serialNumberControl:'ควบคุม Serial',subscriptionPeriod:'รอบบริการ',subscriptionStartDate:'วันเริ่ม',subscriptionExpiryDate:'วันสิ้นสุด'}[k]||k)),h('p',null,typeof v==='boolean'?(v?t('ใช่','Yes'):t('ไม่','No')):String(v))))),h('footer',null,btn(t('ปิด','Close'),()=>D(null)))))
 }
}
