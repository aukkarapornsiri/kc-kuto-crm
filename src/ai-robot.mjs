export function createAIRobot(React){
 const h=React.createElement,source=new URL('../assets/ai-robot.png',import.meta.url).href;
 const readMotion=()=>{try{return localStorage.getItem('kc-dashboard-motion')!=='off';}catch{return true;}};
 return function AIRobot({size=28,className='',style,label,...props}){
  const id=React.useId().replace(/:/g,''),[motion,setMotion]=React.useState(readMotion);
  React.useEffect(()=>{const update=()=>setMotion(readMotion());window.addEventListener('kc-dashboard-motion',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('kc-dashboard-motion',update);window.removeEventListener('storage',update);};},[]);
  const hand='180 540 360 540 414 668 445 719 409 789 300 809 208 740 165 644';
  const picture=()=>h('image',{href:source,width:1322,height:1190});
  return h('svg',{...props,className:'kc-ai-robot '+className,width:Math.max(28,Number(size)||28),height:Math.max(28,Number(size)||28),viewBox:'150 135 1060 960',style,role:label?'img':undefined,'aria-label':label,'aria-hidden':label?undefined:true,'data-robot-motion':motion?'on':'off',focusable:false},
   h('defs',null,h('clipPath',{id:id+'-hand'},h('polygon',{points:hand})),h('mask',{id:id+'-body',maskUnits:'userSpaceOnUse',x:0,y:0,width:1322,height:1190},h('rect',{width:1322,height:1190,fill:'white'}),h('polygon',{points:hand,fill:'black'}))),
   h('g',{mask:`url(#${id}-body)`},picture()),
   h('g',{className:'kc-ai-wave-hand'},h('g',{clipPath:`url(#${id}-hand)`},picture())));
 };
}
