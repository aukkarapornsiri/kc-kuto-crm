export function microsoftOptions(href) {
  const redirect = new URL(href);
  redirect.search = '';
  redirect.hash = '';
  return {provider:'azure', options:{redirectTo:redirect.href, scopes:'openid profile email', queryParams:{prompt:'select_account'}}};
}
export function MicrosoftLogin({React,client,lang='th'}) {
  const h=React.createElement;
  const [busy,setBusy]=React.useState(false);
  const [failed,setFailed]=React.useState(false);
  React.useEffect(()=>{
    const url=new URL(window.location.href);
    const hash=new URLSearchParams(url.hash.slice(1));
    if(url.searchParams.has('error')||hash.has('error')) setFailed(true);
  },[]);
  const th=lang==='th';
  async function login(){
    setBusy(true);setFailed(false);
    try {const {error}=await client.auth.signInWithOAuth(microsoftOptions(window.location.href)); if(error)throw error;}
    catch {setFailed(true);setBusy(false);}
  }
  return h('div',{style:{marginTop:16}},
    h('button',{type:'button',disabled:busy,onClick:login,style:{width:'100%',padding:'12px',border:'1px solid #cbd5e1',borderRadius:8,background:'#fff',color:'#0f172a',cursor:'pointer',fontWeight:600}},busy?(th?'กำลังเปิด Microsoft…':'Opening Microsoft…'):(th?'เข้าสู่ระบบด้วย Microsoft 365':'Sign in with Microsoft 365')),
    h('p',{style:{fontSize:12,color:'#64748b',marginTop:8}},th?'ใช้บัญชีองค์กรที่ผู้ดูแลเพิ่มใน CRM แล้ว':'Use an organization account already added to CRM.'),
    failed&&h('p',{role:'alert',style:{fontSize:13,color:'#b91c1c'}},th?'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ หากยังไม่ได้ให้ผู้ดูแลตรวจบัญชีและอีเมลใน CRM':'Sign-in failed. Try again or ask your administrator to check your CRM account and email.')
  );
}
