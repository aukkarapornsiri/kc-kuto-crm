// Keep the existing module and page registry as the source of truth. This layer
// changes only how those modules are presented in the sidebar.
export const SIDEBAR_GROUPS = Object.freeze([
  {id:'sales', label:{th:'การขาย',en:'Sales'}, icon:'opportunities', modules:['opportunities','quotations','contracts']},
  {id:'service', label:{th:'งานบริการ',en:'Service'}, icon:'tickets', modules:['assets','tickets']},
  {id:'insights', label:{th:'วิเคราะห์ข้อมูล',en:'Analytics'}, icon:'reports', modules:['reports','ai']},
]);
export const SIDEBAR_PRIMARY_ORDER = Object.freeze([
  'dashboard','leads','contacts','customers','sales','service',
  'activities','documents','insights','settings',
]);

export function createGroupedNavigation({React}){
  const h=React.createElement;
  return function GroupedNavigation({lang,activeModule,modules,renderModule}){
    const [open,setOpen]=React.useState(()=>new Set(['sales']));
    React.useEffect(()=>{
      const active=SIDEBAR_GROUPS.find(group=>group.modules.includes(activeModule));
      if(active)setOpen(previous=>previous.has(active.id)?previous:new Set([...previous,active.id]));
    },[activeModule]);
    const byId=new Map(modules.map(module=>[module.id,module]));
    const grouped=new Set(SIDEBAR_GROUPS.flatMap(group=>group.modules));
    const renderGroup=group=>{
      const expanded=open.has(group.id), active=group.modules.includes(activeModule);
      const label=group.label[lang]||group.label.en;
      const Icon=byId.get(group.icon)?.icon;
      return h('div',{key:group.id,className:'crm-nav-group'},
        h('button',{type:'button',className:'crm-nav-group-button',title:label,
          'aria-label':label,'aria-expanded':expanded,'aria-controls':'crm-nav-'+group.id,
          'data-active':active,
          onClick:()=>setOpen(previous=>{const next=new Set(previous);if(document.documentElement.dataset.crmSidebarHidden==='true')next.add(group.id);else next.has(group.id)?next.delete(group.id):next.add(group.id);return next;})},
          Icon&&h(Icon,{size:17,className:'crm-nav-group-icon','aria-hidden':true}),
          h('span',{className:'crm-nav-group-label'},label),
          h('span',{className:'crm-nav-group-chevron','aria-hidden':true},expanded?'⌄':'›')),
        expanded&&h('div',{id:'crm-nav-'+group.id,className:'crm-nav-group-items',role:'group','aria-label':label},
          group.modules.map(id=>byId.get(id)).filter(Boolean).map(renderModule)));
    };
    const groupsById=new Map(SIDEBAR_GROUPS.map(group=>[group.id,group]));
    const primary=SIDEBAR_PRIMARY_ORDER.map(id=>groupsById.has(id)?renderGroup(groupsById.get(id)):
      byId.has(id)?renderModule(byId.get(id)):null).filter(Boolean);
    const unlisted=modules.filter(module=>!grouped.has(module.id)&&!SIDEBAR_PRIMARY_ORDER.includes(module.id));
    return h(React.Fragment,null,...primary,...unlisted.map(renderModule));
  };
}
