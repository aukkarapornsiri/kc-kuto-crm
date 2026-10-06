export function validatePersonalProfile(value) {
 const result={};
 for(const key of ['first_name','last_name','phone','job_title']) result[key]=String(value[key]||'').trim();
 if(!result.first_name||!result.last_name)throw Error('กรุณากรอกชื่อและนามสกุล');
 if(Object.values(result).some(v=>v.length>150))throw Error('ข้อมูลแต่ละช่องต้องไม่เกิน 150 ตัวอักษร');
 return result;
}
export function createAccountOnboarding({React,client,useApp}) {
 const h=React.createElement;
 return function AccountOnboarding({children}) {
  const {session,demoMode,syncProfile}=useApp();
  const [row,Row]=React.useState(null),[loaded,Loaded]=React.useState(false),[error,ErrorText]=React.useState(''),[busy,Busy]=React.useState(false),[values,Values]=React.useState({}),[password,Password]=React.useState(''),[confirm,Confirm]=React.useState('');
  const load=async()=>{Loaded(false);ErrorText('');try{const {data,error}=await client.from('crm_user_onboarding').select('*').eq('user_id',session.user.id).maybeSingle();if(error)throw error;Row(data);Values(data?.personal_details||{});Loaded(true);}catch(e){ErrorText(e.message);}};
  React.useEffect(()=>{if(demoMode){Loaded(true);return;}if(session?.user?.id)load();},[session?.user?.id,demoMode]);
  if(demoMode||loaded&&(!row||row.completed_at))return children;
  const save=async e=>{e.preventDefault();if(busy)return;Busy(true);ErrorText('');try{const details=validatePersonalProfile(values);if(row.requires_password){if(password.length<12||password!==confirm)throw Error('รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร และตรงกันทั้งสองช่อง');const {error}=await client.auth.updateUser({password});if(error)throw error;}const {error}=await client.rpc('crm_complete_onboarding',{p_details:details});if(error)throw error;const result=await client.from('profiles').select('*').eq('id',session.user.id).single();if(result.error)throw result.error;syncProfile?.(result.data);await load();}catch(e){ErrorText(e.message);}finally{Busy(false);}};
  return h('main',{style:{minHeight:'100vh',background:'#eff6fa',padding:'32px 16px',display:'grid',placeItems:'center'}},h('form',{onSubmit:save,style:{width:'100%',maxWidth:560,background:'white',padding:28,borderRadius:20,boxShadow:'0 12px 48px #1232'}},h('h1',null,'ยินดีต้อนรับสู่ KC CuTo CRM'),h('p',null,'ยืนยันบัญชีและกรอกประวัติส่วนตัวก่อนเริ่มใช้งาน'),h('p',null,session?.user?.email),error&&h('p',{role:'alert',style:{color:'#b91c1c'}},error),!loaded?h('button',{type:'button',onClick:load},error?'ลองใหม่':'กำลังตรวจสอบบัญชี…'):h(React.Fragment,null,...[['first_name','ชื่อ',true],['last_name','นามสกุล',true],['phone','โทรศัพท์',false],['job_title','ตำแหน่ง',false]].map(([key,label,required])=>h('label',{key,style:{display:'block',margin:'16px 0'}},label,h('input',{required,maxLength:150,value:values[key]||'',onChange:e=>Values({...values,[key]:e.target.value}),style:{display:'block',width:'100%',padding:12,border:'1px solid #cbd5e1',borderRadius:8}}))),row?.requires_password&&[['ตั้งรหัสผ่าน',password,Password],['ยืนยันรหัสผ่าน',confirm,Confirm]].map(([label,value,set])=>h('label',{key:label,style:{display:'block',margin:'16px 0'}},label,h('input',{type:'password',autoComplete:'new-password',required:true,minLength:12,value,onChange:e=>set(e.target.value),style:{display:'block',width:'100%',padding:12,border:'1px solid #cbd5e1',borderRadius:8}}))),h('button',{type:'submit',disabled:busy,style:{background:'#0d9488',color:'white',border:0,borderRadius:8,padding:14}},busy?'กำลังบันทึก…':'บันทึกและเริ่มใช้งาน')),h('button',{type:'button',disabled:busy,onClick:()=>client.auth.signOut(),style:{marginLeft:12}},'ออกจากระบบ')));
 };
}
