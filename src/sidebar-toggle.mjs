export function createSidebarToggle({React}){
 const h=React.createElement,key='kc-crm-sidebar-hidden';
 return function SidebarToggle({lang}){
  const [hidden,S]=React.useState(()=>{try{return localStorage.getItem(key)==='true';}catch{return false;}});
  React.useEffect(()=>{document.documentElement.dataset.crmSidebarHidden=String(hidden);try{localStorage.setItem(key,String(hidden));}catch{}return()=>{delete document.documentElement.dataset.crmSidebarHidden;};},[hidden]);
  const label=lang==='th'?(hidden?'แสดงแถบเมนู':'ซ่อนแถบเมนู'):(hidden?'Show sidebar':'Hide sidebar');
  return h('button',{type:'button',className:'crm-sidebar-toggle','aria-label':label,'aria-expanded':!hidden,'aria-controls':'crm-desktop-sidebar',title:label,onClick:()=>S(v=>!v)},h('svg',{width:21,height:21,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('rect',{x:3,y:4,width:18,height:16,rx:3}),h('path',{d:'M9 4v16'}),h('path',{d:hidden?'m13 9 3 3-3 3':'m16 9-3 3 3 3'})));
 };
}
