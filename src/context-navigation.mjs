import {SIDEBAR_GROUPS,SIDEBAR_PRIMARY_ORDER} from './grouped-navigation.mjs?v=20260927-service';

const RAIL_LABELS={
  dashboard:{th:'หน้าหลัก',en:'Home'},leads:{th:'ลีด',en:'Leads'},
  contacts:{th:'ผู้ติดต่อ',en:'Contacts'},customers:{th:'ลูกค้า',en:'Accounts'},
  sales:{th:'การขาย',en:'Sales'},service:{th:'บริการ',en:'Service'},
  activities:{th:'กิจกรรม',en:'Activities'},documents:{th:'เอกสาร',en:'Documents'},
  insights:{th:'วิเคราะห์',en:'Analytics'},settings:{th:'ตั้งค่า',en:'Settings'},
};

export function firstPage(module){
  if(!module)return null;
  if(module.id==='settings')return {moduleId:'settings',pageId:'set-hub'};
  if(module.id==='opportunities'&&module.subs?.some(page=>page.id==='opp-list'))return {moduleId:'opportunities',pageId:'opp-list'};
  return {moduleId:module.id,pageId:module.subs?.find(page=>page.visibleInSidebar!==false)?.id||module.subs?.[0]?.id||module.id};
}

export function railEntries(modules){
  const byId=new Map(modules.map(module=>[module.id,module]));
  const groups=new Map(SIDEBAR_GROUPS.map(group=>[group.id,group]));
  return SIDEBAR_PRIMARY_ORDER.map(id=>{
    const group=groups.get(id), module=byId.get(group?.modules[0]||id);
    if(!module)return null;
    return {id,label:RAIL_LABELS[id],icon:byId.get(group?.icon)?.icon||module.icon,
      moduleIds:group?.modules||[id],target:firstPage(module)};
  }).filter(Boolean);
}

export function contextEntries(modules,activeModule){
  const byId=new Map(modules.map(module=>[module.id,module]));
  const group=SIDEBAR_GROUPS.find(item=>item.modules.includes(activeModule));
  const module=byId.get(activeModule);
  if(group){
    if(group.id==='sales'){
      const ids=['leads','contacts','customers','opportunities','quotations','quotations','contracts','activities','reports'];
      const items=ids.map((id,index)=>{
        const item=byId.get(id);
        if(!item)return null;
        const page=index===2?item.subs?.find(x=>x.id==='accounts'):index===4?item.subs?.find(x=>x.id==='quot-pricebook'):index===7?item.subs?.find(x=>x.id==='act-calendar'):null;
        return {module:item,page:page||null};
      }).filter(Boolean);
      return {title:group.label,items,extra:[]};
    }
    if(group.id==='service'){
      const ids=['tickets','contacts','customers','assets','tickets','reports','tickets'];
      const labels=[{th:'เคส',en:'Cases'},null,null,{th:'สินทรัพย์',en:'Assets'},null,{th:'การวิเคราะห์',en:'Analytics'},null];
      const items=ids.map((id,index)=>{
        const item=byId.get(id);
        if(!item)return null;
        const page=index===2?item.subs?.find(x=>x.id==='accounts'):index===4?item.subs?.find(x=>x.id==='tk-sla'):index===6?item.subs?.find(x=>x.id==='tk-kb'):null;
        return {module:item,page:page||null,label:labels[index]};
      }).filter(Boolean);
      return {title:group.label,items,extra:[]};
    }
    return {title:group.label,items:group.modules.map(id=>byId.get(id)).filter(Boolean).map(item=>({module:item,page:null})),extra:[]};
  }
  if(!module)return {title:null,items:[],extra:[]};
  const visible=(module.subs||[]).filter(page=>page.visibleInSidebar!==false);
  const extra=(module.subs||[]).filter(page=>page.visibleInSidebar===false);
  return {title:module.label,items:visible.length?visible.map(page=>({module,page})):[{module,page:null}],extra};
}

export function createContextNavigation({React,logo,useApp}){
  const h=React.createElement;
  const localized=(label,lang)=>label?.[lang]||label?.en||'';

  function PrimaryRail({lang,activeModule,modules,onNavigate,onSignOut,demoMode}){
    const {profile}=useApp();
    const [section,setSection]=React.useState(null);
    React.useEffect(()=>{const select=event=>setSection(['sales','service'].includes(event.detail)?event.detail:null);window.addEventListener('kc-crm-section',select);return()=>window.removeEventListener('kc-crm-section',select);},[]);
    const name=profile?.display_name||profile?.email||(lang==='th'?'ผู้ใช้งาน':'User');
    const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    return h('div',{className:'kc-sidebar kc-primary-rail'},
      h('div',{className:'kc-rail-brand'},h('img',{src:logo,alt:'KC CuTo CRM'})),
      h('nav',{'aria-label':lang==='th'?'หมวดหลัก':'Primary navigation'},
        railEntries(modules).map(item=>{
          const Icon=item.icon, label=localized(item.label,lang), active=section?item.id===section:item.moduleIds.includes(activeModule);
          return h('button',{key:item.id,type:'button',className:'kc-rail-item',title:label,
            'aria-label':label,'aria-current':active?'page':undefined,'data-active':active,'data-section':item.id,
            onClick:()=>{window.dispatchEvent(new CustomEvent('kc-crm-section',{detail:item.id}));onNavigate(item.target.moduleId,item.target.pageId);}},
            Icon&&h('span',{className:'kc-rail-icon','aria-hidden':true},h(Icon,{size:21})),h('span',null,label));
        })),
      h('div',{className:'kc-rail-profile'},
        h('span',{className:'kc-rail-avatar','aria-hidden':true},initials||'?'),
        h('span',{className:'kc-rail-user'},name,demoMode&&h('small',null,lang==='th'?'โหมดทดลอง':'DEMO')),
        h('button',{type:'button',onClick:onSignOut,title:lang==='th'?'ออกจากระบบ':'Sign out',
          'aria-label':lang==='th'?'ออกจากระบบ':'Sign out'},'↪')));
  }

  function ContextNav({lang,activeModule,activeSub,modules,onNavigate}){
    const [open,setOpen]=React.useState(null);
    const [section,setSection]=React.useState(null);
    const root=React.useRef(null);
    React.useEffect(()=>{const select=event=>setSection(['sales','service'].includes(event.detail)?event.detail:null);window.addEventListener('kc-crm-section',select);return()=>window.removeEventListener('kc-crm-section',select);},[]);
    React.useEffect(()=>{
      if(!open)return;
      const close=event=>{if(event.type==='keydown'&&event.key==='Escape')setOpen(null);
        if(event.type==='pointerdown'&&!root.current?.contains(event.target))setOpen(null);};
      document.addEventListener('keydown',close);document.addEventListener('pointerdown',close);
      return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',close);};
    },[open]);
    React.useEffect(()=>setOpen(null),[activeModule,activeSub]);
    const contextModule=section==='service'?'tickets':section==='sales'?'opportunities':activeModule;
    const {title,items,extra}=contextEntries(modules,contextModule);
    if(!title)return null;
    const go=(module,page)=>{const target=page?{moduleId:module.id,pageId:page.id}:firstPage(module);
      if(!section){const group=SIDEBAR_GROUPS.find(item=>['sales','service'].includes(item.id)&&item.modules.includes(activeModule));if(group){setSection(group.id);window.dispatchEvent(new CustomEvent('kc-crm-section',{detail:group.id}));}}
      setOpen(null);onNavigate(target.moduleId,target.pageId);};
    const toggle=(id,event)=>{const rect=event.currentTarget.getBoundingClientRect();
      setOpen(previous=>previous?.id===id?null:{id,left:Math.max(8,Math.min(rect.left,window.innerWidth-238)),top:rect.bottom+4});};
    const menu=(id,module,pages)=>open?.id===id&&h('div',{className:'kc-context-menu',role:'menu',
      style:{left:open.left,top:open.top},
      'aria-label':localized(module.label,lang)},pages.map(page=>h('button',{key:page.id,
        type:'button',role:'menuitem',onClick:()=>go(module,page)},localized(page.label,lang))));
    return h('div',{ref:root,className:'kc-context-bar'},
      h('strong',{className:'kc-context-heading'},localized(title,lang)),
      h('nav',{'aria-label':lang==='th'?'เมนูของหมวด':'Section navigation',className:'kc-context-tabs'},
        items.map(({module,page,label:tabLabel})=>{
          const id=module.id, label=localized(tabLabel||page?.label||module.label,lang), selected=activeModule===id&&(!page?!(id==='quotations'&&activeSub==='quot-pricebook')&&!(id==='tickets'&&['tk-sla','tk-kb'].includes(activeSub)):activeSub===page.id);
          const pages=!page?(module.subs||[]):[];
          return h('div',{key:page?.id||id,className:'kc-context-tab-wrap'},
            h('button',{type:'button',className:'kc-context-tab','aria-current':selected?'page':undefined,
              'data-active':selected,onClick:()=>go(module,page)},label),
            pages.length>1&&h('button',{type:'button',className:'kc-context-more',
              'aria-label':(lang==='th'?'หน้าใน ':'Pages in ')+localized(module.label,lang),
              'aria-expanded':open?.id===id,onClick:event=>toggle(id,event)},'⌄'),
            menu(id,module,pages));
        }),
        extra.length>0&&h('div',{className:'kc-context-tab-wrap'},
          h('button',{type:'button',className:'kc-context-tab kc-context-extra',
            'aria-expanded':open?.id==='extra',onClick:event=>toggle('extra',event)},
            lang==='th'?'เพิ่มเติม':'More',' ⌄'),
          menu('extra',items[0].module,extra))));
  }

  return {PrimaryRail,ContextNav};
}

