export const ACCESS_CHANGED='crm-access-changed';
export function effectiveRole(profile){return profile?.is_active===true&&!profile.deleted_at&&!profile.deletion_requested_at&&profile.access_active!==false?(profile.role==='custom'?profile.custom_role_key:profile.role):null;}
export function canAccess(profile,rows,module,action='view'){
 if(!effectiveRole(profile))return false;
 if(module==='access')return profile.is_super_admin===true;
 if(profile.is_super_admin===true)return true;
 return rows.some(row=>row.module===module&&row['can_'+action]===true);
}
export function pageAction(page=''){
 if(page.startsWith('import-'))return 'import';
 if(['opp-new','quot-create','lead-create','new-lead','customer-create','contact-create','tk-create'].includes(page))return 'create';
 if(page==='quot-approval')return 'approve';
 return 'view';
}
export function permitsPage(access,module,page){
 if(!effectiveRole(access.profile))return false;
 if(['set-users','set-roles','set-permissions','set-dashboard-access'].includes(page))return access.profile.is_super_admin===true;
 if(page==='set-inventory'||page==='quot-pricebook')return access.can('inventory','view');
 if(page==='set-sales-targets')return access.can('reports','view');
 if(['set-ai','set-api','set-package'].includes(page))return access.can('settings','manage_settings');
 if(page==='set-import-export')return ['customers','contacts','leads','settings'].some(m=>access.can(m,'import')||access.can(m,'export'));
 if(module==='settings'&&page==='set-notifications')return !!effectiveRole(access.profile);
 if(!access.can(module,'view')||!access.can(module,pageAction(page)))return false;
 if(module==='dashboard'&&page?.startsWith('dash-')&&access.profile?.is_super_admin!==true)return access.dashboards.some(row=>row.dashboard_type===page.slice(5)&&row.visible);
 return true;
}
export function filterModules(modules,access){return modules.map(m=>({...m,...(m.subs?{subs:m.subs.filter(p=>permitsPage(access,m.id,p.id))}:{})})).filter(m=>access.can(m.id,'view')||m.subs?.length>0||(m.id==='settings'&&access.profile?.is_super_admin===true));}
export function notifyAccessChanged(){globalThis.window?.dispatchEvent(new Event(ACCESS_CHANGED));}
export function createRoleAccess({React,client,useApp}){
 const h=React.createElement,empty={profile:null,rows:[],dashboards:[],loading:true,error:'',can:()=>false};
 const Context=React.createContext(empty);
 function Provider({children}){
  const {session,demoMode,profile:appProfile,syncProfile}=useApp();
  const [state,setState]=React.useState(empty),[revision,setRevision]=React.useState(0);
  React.useEffect(()=>{const refresh=()=>setRevision(n=>n+1);const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener(ACCESS_CHANGED,refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener(ACCESS_CHANGED,refresh);};},[]);
  React.useEffect(()=>{
   let active=true;
   if(demoMode){setState({profile:appProfile,rows:[],dashboards:[],loading:false,error:''});return;}
   if(!session?.user?.id){setState(empty);return;}
   (async()=>{try{
    const {data:profile,error}=await client.from('profiles').select('*').eq('id',session.user.id).single();if(error)throw error;
    const {data:context,error:contextError}=await client.rpc('crm_access_context');if(contextError)throw contextError;profile.access_active=context?.active===true;
    const role=effectiveRole(profile);if(!role)throw Error('บัญชีไม่มีสิทธิ์ใช้งาน / Account access is disabled');
    const [permissions,dashboards]=await Promise.all([client.from('role_permissions').select('*').eq('role_key',role).order('module'),client.from('dashboard_type_access').select('*').eq('role_key',role).order('dashboard_type')]);
    if(permissions.error||dashboards.error)throw permissions.error||dashboards.error;
    if(active){syncProfile?.(profile);setState({profile,rows:permissions.data||[],dashboards:dashboards.data||[],loading:false,error:''});}
   }catch(error){if(active){syncProfile?.(null);setState({...empty,loading:false,error:error.message||String(error)});}}})();
   return()=>{active=false;};
  },[session?.user?.id,demoMode,revision]);
  const value={...state,can:(module,action='view')=>demoMode||canAccess(state.profile,state.rows,module,action),refresh:()=>setRevision(n=>n+1)};
  return h(Context.Provider,{value},children);
 }
 const useAccess=()=>React.useContext(Context);
 function Gate({module,page,render}){
  const access=useAccess(),{lang,demoMode,navParams}=useApp();
  if(demoMode)return render();
  if(access.loading)return h('p',{role:'status'},lang==='th'?'กำลังตรวจสอบสิทธิ์…':'Checking access…');
  if(access.error||!permitsPage(access,module,page)||(navParams?.create&&!access.can(module,'create')))return h('section',{className:'crm-settings'},h('h2',null,lang==='th'?'ไม่มีสิทธิ์เข้าถึงหน้านี้':'Access denied'),h('p',null,access.error||(lang==='th'?'กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์':'Contact your administrator to request access')),h('button',{onClick:access.refresh},lang==='th'?'ตรวจสอบสิทธิ์อีกครั้ง':'Check access again'));
  return h(React.Fragment,{key:JSON.stringify([effectiveRole(access.profile),access.rows,access.dashboards])},render());
 }
 return {Provider,Gate,useAccess};
}
