import {createWorkspaceTheme,WORKSPACE_SHADOWS} from './workspace-theme.mjs';
// Editable source for the Settings extension. The original frontend is distributed as a bundle.
export const DEFAULT_DESIGN = Object.freeze({primary:'#0AADA9',sidebar:'#172033',background:'#F7FAFA',font:'IBM Plex Sans Thai',fontSize:'14',radius:'12',density:'comfortable'});
export const FONTS = ['IBM Plex Sans Thai','Anuphan','Inter','system'];
const HEX = /^#[0-9a-f]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateDesign(value) {
  if (!value || typeof value !== 'object') throw Error('Invalid design');
  const result = Object.fromEntries(Object.keys(DEFAULT_DESIGN).map(key=>[key,value[key]]));
  for(const key of ['primary','sidebar','background']) if(!HEX.test(result[key])) throw Error('Invalid color');
  if(!FONTS.includes(result.font)||!['14','16','18'].includes(result.fontSize)||!['8','12','16'].includes(result.radius)||!['comfortable','compact'].includes(result.density)) throw Error('Invalid design option');
  return result;
}
export function validateScope(value) {
  const result = {};
  for(const key of ['account_tenant_id','account_company_id','eam_company_id']) {
    result[key]=String(value[key]??'').trim();
    if(result[key]&&!UUID.test(result[key])) throw Error(`${key}: UUID required`);
  }
  result.branch_code=String(value.branch_code??'').trim();
  if(result.branch_code&&!/^[A-Z0-9_-]{1,30}$/.test(result.branch_code)) throw Error('Branch code: A–Z, 0–9, _ or -; maximum 30');
  if(Boolean(result.account_tenant_id)!==Boolean(result.account_company_id)) throw Error('Account 360 requires both Tenant ID and Company ID');
  return result;
}
export function readableInk(hex) {
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#172033':'#FFFFFF';
}
export function createExperience({React,client,useApp,palette}) {
  const h=React.createElement;
  const eventName='kc-crm-design-saved';
  let demoDesign=null;
  let demoScope={};
  let companyDesign=null,personalDesign=null;
  function applyDesign(input) {
    const root=document.documentElement;
    if(!input) {
      for(const name of ['primary','sidebar','sidebar-ink','background','font','font-size','radius','row-padding','surface','surface-ink','background-ink','primary-ink','border','shadow'])root.style.removeProperty('--crm-'+name);
      delete root.dataset.crmPersonal;palette.teal='#0EA5A0';return;
    }
    const value=validateDesign(input);
    palette.teal=value.primary;
    const vars={primary:value.primary,sidebar:value.sidebar,'sidebar-ink':readableInk(value.sidebar),background:value.background,font:value.font==='system'?'system-ui, sans-serif':`'${value.font}', 'Anuphan', sans-serif`,'font-size':value.fontSize+'px',radius:value.radius+'px','row-padding':value.density==='compact'?'6px':'12px'};
    for(const [key,v] of Object.entries(vars))root.style.setProperty('--crm-'+key,v);
  }
  function useThemeRefresh() {
    const [,setVersion]=React.useState(0);
    React.useEffect(()=>{const fn=()=>setVersion(v=>v+1);window.addEventListener(eventName,fn);return()=>window.removeEventListener(eventName,fn);},[]);
  }
  function repaint(){
    applyDesign(companyDesign);
    const root=document.documentElement;
    for(const name of ['surface','surface-ink','background-ink','primary-ink','border','shadow'])root.style.removeProperty('--crm-'+name);
    delete root.dataset.crmPersonal;
    document.getElementById('crm-personal-actions')?.remove();
    if(personalDesign?.enabled){
      const companyPrimary=palette.teal;
      applyDesign({...DEFAULT_DESIGN,...companyDesign,primary:personalDesign.primary,sidebar:personalDesign.sidebar,background:personalDesign.background,radius:personalDesign.radius==='0'||personalDesign.radius==='24'?'12':personalDesign.radius});
      const vars={surface:personalDesign.surface,'surface-ink':readableInk(personalDesign.surface),'background-ink':readableInk(personalDesign.background),'primary-ink':readableInk(personalDesign.primary),border:personalDesign.border,shadow:WORKSPACE_SHADOWS[personalDesign.shadow],radius:personalDesign.radius+'px'};
      for(const [key,value] of Object.entries(vars))root.style.setProperty('--crm-'+key,value);
      root.dataset.crmPersonal='true';
      // Personal colors are a screen-only layer; retain company palette for document generation.
      palette.teal=companyPrimary;
      const rgb=[1,3,5].map(i=>parseInt(companyPrimary.slice(i,i+2),16)).join(', ');
      const sheet=document.createElement('style');sheet.id='crm-personal-actions';
      sheet.textContent=`@media screen{html[data-crm-personal=true] .kc-app button[style*="background-color: rgb(${rgb})"]{background-color:var(--crm-primary)!important;color:var(--crm-primary-ink)!important}}`;
      document.head.appendChild(sheet);
    }
    window.dispatchEvent(new Event(eventName));
  }
  function publish(value) {companyDesign=value;repaint();}
  const {read:readWorkspace,PersonalWorkspace,WorkspaceLauncher}=createWorkspaceTheme({React,client,useApp,readableInk,onChange:value=>{personalDesign=value;repaint();}});
  function ExperienceSync() {
    const {demoMode,profile,setLang}=useApp();
    React.useEffect(()=>{
      let active=true;
      personalDesign=null;publish(null);
      if(!demoMode&&!profile?.id)return;
      Promise.all([demoMode?Promise.resolve({data:{ui_design:demoDesign}}):client.functions.invoke('crm-experience',{method:'GET'}),readWorkspace(profile,demoMode).catch(()=>null)]).then(([{data,error},personal])=>{
        if(!active)return;
        personalDesign=personal?.value??null;
        try{publish(!error?data?.ui_design:null);}catch{publish(null);}
        if(!error&&data?.default_language){try{if(!localStorage.getItem('kc_language'))setLang(data.default_language);}catch{}}
      }).catch(()=>{if(active)publish(null);});
      return()=>{active=false;personalDesign=null;publish(null);};
    },[demoMode,profile?.id]);
    return null;
  }
  function SettingsHub({lang,onNavigate,categories,findItem,initialCategory=null}) {
    const [query,setQuery]=React.useState('');
    const [category,setCategory]=React.useState(()=>Number.isInteger(initialCategory)&&initialCategory>=0&&initialCategory<categories.length?initialCategory:null);
    const tr=(th,en)=>lang==='th'?th:en;
    const normalized=query.trim().toLowerCase();
    const groups=categories.map((group,index)=>({...group,index,items:group.items.map(findItem).filter(Boolean).filter(item=>!normalized||`${item.label.th} ${item.label.en} ${group.label.th} ${group.label.en}`.toLowerCase().includes(normalized))})).filter(group=>group.items.length&&(normalized||category===null||category===group.index));
    return h('section',{className:'crm-settings'},
      h('div',{className:'crm-intro'},h('h1',null,tr('ศูนย์ตั้งค่า','Settings center')),h('p',null,tr('ค้นหาและจัดการการตั้งค่าทั้งหมดในที่เดียว','Find and manage all settings in one place'))),
      h('input',{className:'crm-search',type:'search','aria-label':tr('ค้นหาเมนูตั้งค่า','Search settings'),placeholder:tr('ค้นหา เช่น ฟอนต์ บริษัท สิทธิ์ การเชื่อมต่อ','Search fonts, company, permissions, integrations'),value:query,onChange:e=>setQuery(e.target.value)}),
      h('div',{className:'crm-tabs'},h('button',{type:'button','aria-pressed':category===null,onClick:()=>setCategory(null)},tr('ทั้งหมด','All')),categories.map((group,index)=>h('button',{key:index,type:'button','aria-pressed':category===index,onClick:()=>{setCategory(index);setQuery('');}},group.label[lang]))),
      groups.length?groups.map(group=>h('section',{key:group.index},h('h2',null,group.label[lang]),h('div',{className:'crm-grid'},group.items.map(item=>h('button',{key:item.id,className:'crm-settings-card',onClick:()=>onNavigate(item.id.startsWith('opp-')?'opportunities':item.id.startsWith('asset-')?'assets':'settings',item.id)},h(item.icon,{size:22,'aria-hidden':true}),h('span',null,item.label[lang]),h('span',{'aria-hidden':true},'›')))))):h('p',{role:'status'},tr('ไม่พบเมนูที่ตรงกับคำค้นหา','No matching settings')));
  }
  function DesignPage({lang,scopeMode=false}) {
    const {demoMode,profile}=useApp();
    const tr=(th,en)=>lang==='th'?th:en;
    const initial=scopeMode?{account_tenant_id:'',account_company_id:'',eam_company_id:'',branch_code:''}:DEFAULT_DESIGN;
    const [value,setValue]=React.useState({...initial});
    const [saved,setSaved]=React.useState({...initial});
    const [version,setVersion]=React.useState(null);
    const [loading,setLoading]=React.useState(true);
    const [busy,setBusy]=React.useState(false);
    const [message,setMessage]=React.useState('');
    const [failed,setFailed]=React.useState(false);
    const canEdit=demoMode||profile?.role==='admin';
    const column=scopeMode?'ecosystem_scope':'ui_design';
    const load=React.useCallback(async()=>{
      setLoading(true);setMessage('');setFailed(false);
      try {
        if(demoMode){const next={...initial,...(scopeMode?demoScope:demoDesign)};setValue(next);setSaved(next);setVersion(0);return;}
        const {data,error}=await client.from('company_settings').select(`${column},experience_version`).eq('id',1).single();
        if(error)throw error;
        const next={...initial,...data[column]};setValue(next);setSaved(next);setVersion(data.experience_version);
      }catch(error){setFailed(true);setVersion(null);setMessage(tr('อ่านการตั้งค่าไม่สำเร็จ: ','Unable to load settings: ')+error.message);}
      finally{setLoading(false);}
    },[demoMode,column]);
    React.useEffect(()=>{load();},[load]);
    function update(key,next){setValue(old=>({...old,[key]:next}));setMessage('');}
    async function save() {
      if(!canEdit||version===null||busy)return;
      setBusy(true);setMessage('');setFailed(false);
      try {
        const next=scopeMode?validateScope(value):validateDesign(value);
        if(demoMode){if(scopeMode)demoScope=next;else{demoDesign=next;publish(next);}setSaved(next);setMessage(tr('บันทึกเฉพาะโหมดทดลอง ไม่ได้เขียนฐานข้อมูลจริง','Saved for this demo session only; production database unchanged'));return;}
        const {data,error}=await client.from('company_settings').update({[column]:next,experience_version:version+1,updated_at:new Date().toISOString()}).eq('id',1).eq('experience_version',version).select(column+',experience_version').maybeSingle();
        if(error)throw error;
        if(!data)throw Error(tr('มีผู้แก้ไขการตั้งค่าระหว่างนี้ หรือไม่มีสิทธิ์ กรุณาโหลดใหม่','Settings changed or access denied. Reload before saving.'));
        setVersion(data.experience_version);setValue(next);setSaved(next);if(!scopeMode)publish(next);
        setMessage(scopeMode?tr('บันทึกรหัสอ้างอิงแล้ว ยังไม่ได้ตรวจสอบหรือซิงค์ระบบปลายทาง','Reference IDs saved. Destination verification and synchronization are still pending.'):tr('บันทึก Design ลงฐานข้อมูลแล้ว','Design saved to database'));
      }catch(error){setFailed(true);setMessage(error.message);}
      finally{setBusy(false);}
    }
    const dirty=JSON.stringify(value)!==JSON.stringify(saved);
    const label=(text,control)=>h('label',{className:'crm-field',key:text},h('span',null,text),React.cloneElement(control,{'aria-label':text}));
    const select=(key,options)=>h('select',{value:value[key],disabled:!canEdit||busy,onChange:e=>update(key,e.target.value)},options.map(option=>h('option',{key:option,value:option},option)));
    return h('section',{className:'crm-settings'},
      h('div',{className:'crm-intro'},h('h1',null,scopeMode?tr('การเชื่อมโยง KC Ecosystem','KC Ecosystem references'):tr('Design, Font และ UX/UI','Design, Font & UX/UI')),h('p',null,scopeMode?tr('ระบุ UUID จริงจาก KC Account 360 และ KC EAM เพื่อเตรียมการจับคู่บริษัท ไม่ใช่การเปิดใช้ Sync','Use real KC Account 360 and KC EAM UUIDs to prepare company mapping. This does not enable sync.'):tr('ปรับสี ฟอนต์ ขนาด และระยะห่าง ตามแนวทาง KC Account 360','Customize colors, typography and spacing using the KC Account 360 design approach'))),
      !scopeMode&&h(PersonalWorkspace,{lang}),
      demoMode&&h('p',{className:'crm-notice'},tr('โหมดทดลอง • ไม่มีการบันทึกลงฐานข้อมูลจริง','Demo mode • No production database writes')),
      !canEdit&&h('p',{className:'crm-notice'},tr('อ่านอย่างเดียว ต้องเป็น Admin เพื่อแก้ไข','Read only. An admin is required to edit.')),
      loading?h('p',{role:'status'},tr('กำลังโหลด…','Loading…')):h(React.Fragment,null,
        h('div',{className:'crm-grid'},scopeMode?
          Object.keys(initial).map(key=>label(key,h('input',{key,value:value[key],maxLength:key==='branch_code'?30:36,disabled:!canEdit||busy,onChange:e=>update(key,e.target.value),placeholder:key==='branch_code'?'HQ':'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}))):
          h(React.Fragment,null,
            ['primary','sidebar','background'].map(key=>label(({primary:tr('สีหลัก','Primary color'),sidebar:tr('สีเมนูด้านข้าง','Sidebar color'),background:tr('สีพื้นหลัง','Background color')})[key],h('input',{type:'color',value:value[key],disabled:!canEdit||busy,onChange:e=>update(key,e.target.value)}))),
            label(tr('ฟอนต์','Font'),select('font',FONTS)),label(tr('ขนาดตัวอักษร','Font size'),select('fontSize',['14','16','18'])),label(tr('ความโค้งมุม','Corner radius'),select('radius',['8','12','16'])),label(tr('ระยะห่างแถว','Row spacing'),select('density',['comfortable','compact'])))),
        !scopeMode&&h('div',{className:'crm-preview',style:{background:value.background,borderRadius:value.radius+'px',fontFamily:value.font==='system'?'system-ui':value.font,fontSize:value.fontSize+'px'}},h('aside',{style:{background:value.sidebar,color:readableInk(value.sidebar)}},'KC KuTo',h('p',null,tr('ลูกค้า • โอกาสการขาย','Customers • Opportunities'))),h('div',null,h('h2',null,tr('ตัวอย่างหน้าตา','Appearance preview')),h('p',null,tr('ข้อมูลลูกค้าและโอกาสการขาย อ่านง่าย ใช้งานคล่อง','Clear customer and opportunity information')),h('span',{className:'crm-preview-action',style:{background:value.primary,color:readableInk(value.primary),padding:value.density==='compact'?'6px 12px':'12px 18px',borderRadius:value.radius+'px'}},tr('สร้างใบเสนอราคา','Create quotation')))),
        scopeMode&&h('div',{className:'crm-notice'},h('strong',null,tr('สถานะ: ยังไม่เชื่อมต่อ','Status: not connected')),h('p',null,tr('CRM ดูแลลูกค้าและโอกาสการขาย • Account 360 ดูแลบัญชี • EAM ดูแลวงจรสินทรัพย์ ต้องตรวจสอบ API และสิทธิ์ของแต่ละระบบก่อนเปิด Sync','CRM owns customers and opportunities; Account 360 owns accounting; EAM owns the asset lifecycle. Verify APIs and access before enabling synchronization.'))),
        message&&h('p',{role:failed?'alert':'status',className:failed?'crm-error':'crm-notice'},message),
        h('div',{className:'crm-actions'},h('button',{disabled:busy,onClick:load},tr('โหลดใหม่','Reload')),h('button',{disabled:!dirty||busy,onClick:()=>{setValue({...saved});setMessage('');}},tr('ยกเลิกการแก้ไข','Discard changes')),h('button',{className:'crm-save',disabled:!canEdit||version===null||busy||!dirty,onClick:save},busy?tr('กำลังบันทึก…','Saving…'):tr('บันทึก','Save')))));
  }
  return {DesignPage,ExperienceSync,SettingsHub,useThemeRefresh,WorkspaceLauncher};
}
