export async function removeUser(client,userId){
 const {data,error}=await client.functions.invoke('crm-user-admin',{body:{user_id:userId,confirm:true}});
 if(error||!data?.ok){
  let code=data?.error;
  if(!code&&error?.context?.json)try{code=(await error.context.json()).error;}catch{}
  throw Error(code||'unavailable_retry');
 }
}
export function createDeleteUserDialog(React){
 const h=React.createElement;
 return function DeleteUserDialog({row,lang,onDelete,onCancel}){
  const ref=React.useRef(null),busyRef=React.useRef(false);
  const [busy,B]=React.useState(false),[error,E]=React.useState('');
  const tr=(th,en)=>lang==='th'?th:en;
  React.useEffect(()=>{ref.current.showModal();return()=>ref.current?.close();},[]);
  const submit=async()=>{
   if(busyRef.current)return;busyRef.current=true;B(true);E('');
   try{await onDelete(row);}catch(e){
    E(e.message==='disabled_retry_delete'
     ?tr('ระงับสิทธิ์ CRM แล้ว แต่การลบยังไม่ครบ กรุณากดยืนยันอีกครั้ง','CRM access is disabled, but removal is incomplete. Please retry.')
     :e.message==='cannot_delete_self'?tr('ไม่สามารถลบบัญชีตนเองได้','You cannot remove your own account')
     :tr('ลบไม่สำเร็จ กรุณาโหลดรายชื่อใหม่แล้วลองอีกครั้ง หากยังมีปัญหาให้ติดต่อผู้ดูแลระบบ','Removal failed. Reload the list and retry, or contact your administrator.'));
   }finally{busyRef.current=false;B(false);}
  };
  return h('dialog',{ref,'aria-labelledby':'crm-delete-user-title','aria-describedby':'crm-delete-user-description',onCancel:e=>{e.preventDefault();if(!busyRef.current)onCancel();},style:{border:'1px solid #cbd5e1',borderRadius:'12px',padding:'24px',maxWidth:'480px',width:'calc(100% - 40px)',boxSizing:'border-box',color:'#172554'}},
   h('h2',{id:'crm-delete-user-title'},tr('ยืนยันลบผู้ใช้','Confirm user removal')),
   h('p',null,h('strong',null,row.display_name||row.email)),h('p',{style:{overflowWrap:'anywhere'}},row.email),
   h('p',{id:'crm-delete-user-description'},tr('ผู้ใช้นี้จะหายจากรายชื่อและไม่สามารถเข้าสู่ CRM ได้ ประวัติงานและเอกสารเดิมจะยังคงอยู่ การดำเนินการนี้ไม่ได้ลบบัญชี Microsoft หรือ Google ขององค์กร','This user will be removed from the list and blocked from CRM. Work history and documents are retained. The organization’s Microsoft or Google account is not deleted.')),
   error&&h('p',{role:'alert',style:{color:'#b91c1c'}},error),
   h('div',{className:'crm-actions'},
    h('button',{type:'button',autoFocus:true,disabled:busy,onClick:onCancel},tr('ยกเลิก','Cancel')),
    h('button',{type:'button',disabled:busy,onClick:submit,style:{background:'#b91c1c',color:'#fff',borderColor:'#b91c1c'}},tr(busy?'กำลังลบ…':'ยืนยันลบผู้ใช้',busy?'Removing…':'Confirm removal'))));
 };
}
