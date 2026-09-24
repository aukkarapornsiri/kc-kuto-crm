export const WORKSPACE_DEFAULTS=Object.freeze({enabled:false,primary:'#0AADA9',sidebar:'#172033',background:'#F7FAFA',surface:'#FFFFFF',border:'#DCE6E7',radius:'12',shadow:'soft'});
export const WORKSPACE_PRESETS=[
 ['KC Teal','#0AADA9','#172033','#F7FAFA','#FFFFFF','#DCE6E7'],
 ['Peach Powder','#D6A594','#4B352F','#FAF6F4','#FFFFFF','#E8C1B3'],
 ['Clear Sky','#6E9DBD','#243D4C','#F3F8FC','#FFFFFF','#BCD5E7'],
 ['Fuchsia Red','#B64182','#3C2435','#FCF5FA','#FFFFFF','#EAC2DC'],
 ['Tangelo','#FF8000','#402C19','#FFF8F0','#FFFFFF','#F8D2AA'],
 ['Grenoble Green','#00A883','#113D32','#F0FAF7','#FFFFFF','#B8E1D5'],
 ['Bitter Chocolate','#604242','#312323','#FAF6F6','#FFFFFF','#DECDCD'],
 ['Asphalt','#66696B','#252729','#F5F6F7','#FFFFFF','#D4D6D8'],
 ['Teal Glow','#168B87','#092A2C','#F0FAFA','#FFFFFF','#65C8C5'],
 ['Electric Blue','#2D599A','#101828','#F0F6FC','#FFFFFF','#A6C7E3'],
 ['Indigo','#6552B8','#292440','#F7F5FC','#FFFFFF','#E2DCF1']
].map(([name,primary,sidebar,background,surface,border])=>({name,primary,sidebar,background,surface,border}));
export const WORKSPACE_SHADOWS={none:'none',soft:'0 3px 12px rgba(15,23,42,0.08)',raised:'0 8px 24px rgba(15,23,42,0.16)'};
export function validateWorkspace(input){
 if(!input||typeof input!=='object'||typeof input.enabled!=='boolean')throw Error('Invalid workspace settings');
 const out=Object.fromEntries(Object.keys(WORKSPACE_DEFAULTS).map(k=>[k,input[k]]));
 for(const k of ['primary','sidebar','background','surface','border'])if(!/^#[0-9a-f]{6}$/i.test(out[k]))throw Error('Use a six-digit HEX color, for example #0AADA9');
 if(!['0','8','12','16','24'].includes(out.radius)||!Object.hasOwn(WORKSPACE_SHADOWS,out.shadow))throw Error('Invalid workspace dimensions');
 return out;
}
export function createWorkspaceTheme({React,client,useApp,onChange,readableInk}){
 const h=React.createElement,table='crm_workspace_preferences',demoKey='kc_crm_demo_workspace_v1';
 function readDemo(){try{const x=localStorage.getItem(demoKey);return x?validateWorkspace(JSON.parse(x)):{...WORKSPACE_DEFAULTS};}catch{return {...WORKSPACE_DEFAULTS};}}
 async function read(profile,demoMode){
  if(demoMode)return {value:readDemo(),version:null};
  if(!profile?.id)throw Error('Please sign in');
  const {data,error}=await client.from(table).select('*').eq('user_id',profile.id).maybeSingle();if(error)throw error;
  return {value:data?validateWorkspace(data):{...WORKSPACE_DEFAULTS},version:data?.version??null};
 }
 function PersonalWorkspace({lang}){
  const uid=React.useId();
  const {profile,demoMode}=useApp(),tr=(th,en)=>lang==='th'?th:en;
  const [value,setValue]=React.useState({...WORKSPACE_DEFAULTS}),[saved,setSaved]=React.useState({...WORKSPACE_DEFAULTS});
  const [version,setVersion]=React.useState(null),[loading,setLoading]=React.useState(true),[ready,setReady]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[message,setMessage]=React.useState('');
  const load=React.useCallback(async()=>{setLoading(true);setReady(false);setError('');setMessage('');try{const result=await read(profile,demoMode);setValue(result.value);setSaved(result.value);setVersion(result.version);setReady(true);}catch(e){setError(e.message);}finally{setLoading(false);}},[profile?.id,demoMode]);
  React.useEffect(()=>{load();},[load]);
  const update=(k,v)=>{setValue(old=>({...old,[k]:v}));setMessage('');setError('');};
  async function save(){
   if(!ready||busy)return;setBusy(true);setError('');setMessage('');
   try{const next=validateWorkspace(value);let nextVersion=version;
    if(demoMode)localStorage.setItem(demoKey,JSON.stringify(next));
    else {
     const operation=version===null?client.from(table).insert({...next,user_id:profile.id}):client.from(table).update(next).eq('user_id',profile.id).eq('version',version);
     const {data,error}=await operation.select('*').maybeSingle();if(error)throw error;if(!data)throw Error(tr('ข้อมูลเปลี่ยนไป กรุณาโหลดค่าส่วนตัวใหม่ก่อนบันทึก','Settings changed. Reload your preferences before saving.'));nextVersion=data.version;
    }
    setSaved(next);setValue(next);setVersion(nextVersion);onChange(next);
    setMessage(demoMode?tr('บันทึกสีส่วนตัวในเบราว์เซอร์โหมดทดลองแล้ว','Personal theme saved in this demo browser'):tr('บันทึกพื้นที่ทำงานส่วนตัวลงบัญชีแล้ว','Personal workspace saved to your account'));
   }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const dirty=JSON.stringify(value)!==JSON.stringify(saved),disabled=loading||busy||!ready;
  const field=(title,control)=>h('label',{className:'crm-field'},h('span',null,title),control);
  const colorLabels={primary:tr('สีหลักและปุ่ม','Primary and buttons'),sidebar:tr('แถบเมนู','Menu bar'),background:tr('พื้นหลัง','Workspace background'),surface:tr('พื้นกล่อง','Card surface'),border:tr('เส้นกรอบ','Borders')};
  let valid;try{valid=validateWorkspace(value);}catch{}
  return h('section',{className:'crm-personal-workspace','aria-label':tr('สีและมิติพื้นที่ทำงานของฉัน','My workspace colors and dimensions')},
   h('h2',null,tr('สีและมิติพื้นที่ทำงานของฉัน','My workspace colors and dimensions')),
   h('p',null,tr('ใช้เฉพาะบัญชีของคุณ สีโลโก้และรูปแบบเอกสารใช้การตั้งค่าเดิม','Only for your account. Logo colors and document layouts keep their existing settings.')),
   demoMode&&h('p',{className:'crm-notice'},tr('โหมดทดลอง • บันทึกบนเบราว์เซอร์นี้เท่านั้น','Demo mode • Saved only in this browser')),
   loading&&h('p',{role:'status'},tr('กำลังโหลดสีส่วนตัว…','Loading personal theme…')),
   h('label',{className:'crm-personal-enable'},h('input',{type:'checkbox',checked:value.enabled,disabled,onChange:e=>update('enabled',e.target.checked)}),tr('ใช้สีส่วนตัว','Use personal colors')),
   h('fieldset',{disabled:disabled||!value.enabled},h('legend',{className:'sr-only'},tr('ปรับแต่งพื้นที่ทำงาน','Customize workspace')),
    h('div',{className:'crm-preset-grid'},WORKSPACE_PRESETS.map(p=>h('button',{key:p.name,type:'button','aria-label':p.name,'aria-pressed':['primary','sidebar','background','surface','border'].every(k=>value[k].toUpperCase()===p[k]),onClick:()=>{const {name,...colors}=p;setValue(old=>({...old,...colors}));setError('');setMessage('');}},h('span',{className:'crm-preset-swatches','aria-hidden':true},['sidebar','primary','border','background'].map(k=>h('i',{key:k,style:{background:p[k]}}))),h('span',null,p.name)))),
    h('div',{className:'crm-grid'},Object.entries(colorLabels).map(([key,title])=>h('div',{key,className:'crm-field'},h('label',{htmlFor:uid+'-workspace-'+key},title),h('div',{className:'crm-color-control'},h('input',{type:'color','aria-label':tr('เลือกสี ','Pick ')+title,value:/^#[0-9a-f]{6}$/i.test(value[key])?value[key]:'#FFFFFF',onChange:e=>update(key,e.target.value)}),h('input',{id:uid+'-workspace-'+key,type:'text',maxLength:7,value:value[key],spellCheck:false,onChange:e=>update(key,e.target.value),'aria-invalid':!/^#[0-9a-f]{6}$/i.test(value[key])})))),
     field(tr('ความโค้งของกล่อง','Card corners'),h('select',{'aria-label':tr('ความโค้งของกล่อง','Card corners'),value:value.radius,onChange:e=>update('radius',e.target.value)},[['0','เหลี่ยม','Square'],['8','เล็กน้อย','Subtle'],['12','พอดี','Medium'],['16','โค้งมน','Rounded'],['24','โค้งมาก','Very rounded']].map(([v,th,en])=>h('option',{key:v,value:v},tr(th,en))))),
     field(tr('มิติและเงา','Depth and shadow'),h('select',{'aria-label':tr('มิติและเงา','Depth and shadow'),value:value.shadow,onChange:e=>update('shadow',e.target.value)},[['none','ไม่มีเงา','No shadow'],['soft','เงานุ่ม','Soft shadow'],['raised','เงาชัด','Raised shadow']].map(([v,th,en])=>h('option',{key:v,value:v},tr(th,en))))))),
   valid&&value.enabled&&h('div',{className:'crm-personal-preview',style:{background:valid.background,borderColor:valid.border,color:readableInk(valid.background)}},h('aside',{style:{background:valid.sidebar,color:readableInk(valid.sidebar)}},'KC KuTo'),h('div',{style:{background:valid.surface,color:readableInk(valid.surface),border:'1px solid '+valid.border,borderRadius:valid.radius+'px',boxShadow:WORKSPACE_SHADOWS[valid.shadow]}},h('h3',null,tr('ตัวอย่างพื้นที่ทำงาน','Workspace preview')),h('p',null,tr('สีและมิติตามที่คุณเลือก','Your selected colors and depth')),h('span',{style:{background:valid.primary,color:readableInk(valid.primary),borderRadius:valid.radius+'px'}},tr('ปุ่มตัวอย่าง','Sample button')))),
   !value.enabled&&h('p',null,tr('ใช้สีและมิติจากการตั้งค่าบริษัท','Using company colors and dimensions')),
   error&&h('p',{role:'alert',className:'crm-error'},error),message&&h('p',{role:'status',className:'crm-notice'},message),
   h('div',{className:'crm-actions'},h('button',{type:'button',disabled:busy||loading,onClick:load},tr('โหลดค่าส่วนตัวใหม่','Reload personal settings')),h('button',{type:'button',disabled:disabled||!dirty,onClick:()=>{setValue({...saved});setError('');setMessage('');}},tr('ยกเลิกสีส่วนตัวที่แก้ไข','Discard personal changes')),h('button',{type:'button',disabled, onClick:()=>{setValue({...WORKSPACE_DEFAULTS});setError('');setMessage('');}},tr('คืนค่าตามบริษัท','Restore company theme')),h('button',{type:'button',className:'crm-save',disabled:disabled||!dirty,onClick:save},busy?tr('กำลังบันทึก…','Saving…'):tr('บันทึกพื้นที่ทำงานส่วนตัว','Save personal workspace'))));
 }
 function WorkspaceLauncher(){
  const {lang}=useApp(),[open,setOpen]=React.useState(false),button=React.useRef(null),dialog=React.useRef(null);
  const tr=(th,en)=>lang==='th'?th:en;
  React.useEffect(()=>{if(open){dialog.current?.querySelector('button')?.focus();}return()=>{if(open)button.current?.focus();};},[open]);
  function keydown(e){if(e.key==='Escape'){e.stopPropagation();setOpen(false);}if(e.key==='Tab'){const nodes=Array.from(dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(n=>n.getClientRects().length&&!n.closest('fieldset:disabled'));if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  return h(React.Fragment,null,h('button',{ref:button,type:'button',className:'crm-language-toggle','aria-label':tr('ปรับพื้นที่ทำงานของฉัน','Customize my workspace'),title:tr('ปรับพื้นที่ทำงานของฉัน','Customize my workspace'),onClick:()=>setOpen(true)},h('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('path',{d:'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7c-.8-.5-.4-1.8.6-1.8H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z'}),[ [7,10],[10,7],[15,7],[18,10] ].map(([cx,cy])=>h('circle',{key:cx,cx,cy,r:1,fill:'currentColor'})))),open&&h('div',{className:'crm-workspace-overlay',onClick:e=>{if(e.target===e.currentTarget)setOpen(false);}},h('div',{ref:dialog,role:'dialog','aria-modal':true,'aria-label':tr('ปรับพื้นที่ทำงานของฉัน','Customize my workspace'),className:'crm-settings crm-workspace-dialog',onKeyDown:keydown},h('button',{type:'button',className:'crm-workspace-close',onClick:()=>setOpen(false)},tr('ปิด','Close')),h(PersonalWorkspace,{lang}))));
 }
 return {read,PersonalWorkspace,WorkspaceLauncher};
}
