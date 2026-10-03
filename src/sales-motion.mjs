export function motionMetrics(metrics,currentMonth){
 const rows=metrics.rows||[],past=rows.filter(r=>r.month<=currentMonth),closed=rows.filter(r=>r.month<currentMonth&&r.target>0);
 const target=past.some(r=>r.target!==null)?past.reduce((n,r)=>n+Number(r.target||0),0):null;
 const actual=past.reduce((n,r)=>n+Number(r.actual||0),0);
 const achieved=closed.filter(r=>r.actual>=r.target).length;
 let a=0,t=0;const cumulative=rows.map(r=>({month:r.month,actual:r.month<=currentMonth?(a+=Number(r.actual||0)):null,target:r.target===null?null:(t+=Number(r.target))}));
 const completed=rows.filter(r=>r.month<currentMonth),last=completed.at(-1),previous=completed.at(-2);
 const consecutive=last&&previous&&new Date(last.month+'-01')-new Date(previous.month+'-01')<=32*86400000;
 const growth=consecutive&&previous.actual>0?(last.actual/previous.actual-1)*100:null;
 return {cumulative,pace:target>0?actual/target*100:null,achieved,closed:closed.length,consistency:closed.length?achieved/closed.length*100:null,growth,lastMonth:last?.month};
}
export function createSalesMotion(React){
 const h=React.createElement;
 return function SalesMotion({metrics,lang,onMonth,onReset}){
  const th=lang==='th',tr=(a,b)=>th?a:b;
  const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit'}).format(new Date());
  const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const currentMonth=parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
  const m=motionMetrics(metrics,currentMonth),uid=React.useId().replace(/:/g,''),[paused,P]=React.useState(false),[replay,R]=React.useState(0),[hover,H]=React.useState(null);
  const number=n=>Number(n).toLocaleString(th?'th-TH':'en-US',{maximumFractionDigits:1}),cash=n=>n===null?'—':Math.abs(n)>=1e6?number(n/1e6)+'M':Math.abs(n)>=1e3?number(n/1e3)+'K':number(n);
  const pct=n=>n===null?'—':number(n)+'%',percent=metrics.attainment===null?null:metrics.attainment*100;
  const ring=(label,value,color,note)=>h('article',{className:'sm-kpi',style:{'--sm-color':color,'--sm-fill':`${Math.max(0,Math.min(100,value||0))} 100`}},h('div',{className:'sm-ring'},h('svg',{viewBox:'0 0 160 160','aria-hidden':true},h('circle',{cx:80,cy:80,r:66,className:'sm-track'}),h('circle',{cx:80,cy:80,r:66,className:'sm-progress',pathLength:100,strokeDasharray:`${Math.max(0,Math.min(100,value||0))} 100`})),h('strong',null,pct(value))),h('h3',null,label),h('p',null,note));
  const rows=m.cumulative,max=Math.max(1,...rows.flatMap(r=>[r.actual||0,r.target||0])),x=i=>64+i*800/Math.max(1,rows.length-1),y=v=>252-v/max*210;
  const line=key=>rows.map((r,i)=>r[key]===null?'':`${i===0||rows[i-1][key]===null?'M':'L'}${x(i)},${y(r[key])}`).join(' ');
  const visible=rows.filter(r=>r.actual!==null),actualPath=line('actual'),area=visible.length?actualPath+` L${x(visible.length-1)},252 L64,252 Z`:'';
  const chosen=hover===null?null:rows[hover],stamp=JSON.stringify(metrics)+replay;
  return h('section',{className:'sm-panel','data-paused':paused?'true':'false','aria-label':tr('ภาพรวมการเติบโตของยอดขาย','Sales growth overview')},
   h('header',{className:'sm-header'},h('div',null,h('span',{className:'sm-eyebrow'},'SALES MOMENTUM'),h('h3',null,tr('ทุกยอดขาย ขยับเข้าใกล้เป้าหมาย','Every sale moves you forward'))),h('div',{className:'sm-controls'},h('button',{type:'button',onClick:()=>P(v=>!v),'aria-pressed':paused},paused?tr('เล่นต่อ','Resume'):tr('หยุดภาพเคลื่อนไหว','Pause motion')),h('button',{type:'button',onClick:()=>R(v=>v+1)},tr('เล่นกราฟอีกครั้ง','Replay chart')))),
   h('div',{className:'sm-rings',key:stamp},ring(tr('ยอดขายเทียบเป้าที่เลือก','Selected target attainment'),percent,'#44e5c4',cash(metrics.actual)+' / '+cash(metrics.target)+' THB'),ring(tr('เทียบเป้าสะสมถึงเดือนนี้','Target pace through this month'),m.pace,'#56b9ff',tr('ใช้เป้าเต็มเดือนปัจจุบัน','Includes the full current-month target')),ring(tr('เดือนที่ทำถึงเป้า','Months meeting target'),m.consistency,'#c1ee56',tr('เดือนที่จบแล้ว ','Completed months ')+m.achieved+' / '+m.closed)),
   h('div',{className:'sm-chart-header'},h('div',null,h('h3',null,tr('ยอดขายสะสม · เป้าสะสม','Cumulative sales · Cumulative target')),h('p',null,tr('สุทธิไม่รวม VAT · บาท','Net of VAT · THB'))),m.growth!==null&&h('span',{className:'sm-growth','data-negative':m.growth<0},(m.growth>=0?'+':'')+pct(m.growth)+' · '+m.lastMonth+' '+tr('เทียบเดือนก่อน','vs prior month'))),
   h('div',{className:'sm-legend'},h('span',null,h('i',{style:{background:'#44e5c4'}}),tr('ยอดขายจริง','Actual sales')),h('span',null,h('i',{style:{background:'#71849f'}}),tr('เป้าหมาย','Target')),h('button',{type:'button',onClick:onReset},tr('แสดงช่วงทั้งหมด','Full period'))),
   h('svg',{className:'sm-chart',viewBox:'0 0 900 292',role:'img','aria-label':tr('กราฟยอดขายและเป้าสะสม ดูตัวเลขและเลือกเดือนได้ด้านล่าง','Cumulative actual and target chart; monthly values and controls follow')},
    h('defs',null,h('linearGradient',{id:uid+'-area',x1:0,y1:0,x2:0,y2:1},h('stop',{offset:'0%',stopColor:'#44e5c4',stopOpacity:.3}),h('stop',{offset:'100%',stopColor:'#44e5c4',stopOpacity:0})),h('clipPath',{id:uid+'-reveal'},h('rect',{key:stamp,className:'sm-reveal',x:0,y:0,width:900,height:292}))),
    [0,.25,.5,.75,1].map(n=>h('g',{key:n},h('line',{x1:64,x2:864,y1:y(n*max),y2:y(n*max),stroke:'#ffffff12'}),h('text',{x:54,y:y(n*max)+5,textAnchor:'end',fill:'#a7b7ca',fontSize:13},cash(n*max)))),
    h('path',{d:line('target'),fill:'none',stroke:'#71849f',strokeWidth:2,strokeDasharray:'6 7'}),
    h('g',{clipPath:`url(#${uid}-reveal)`},h('path',{d:area,fill:`url(#${uid}-area)`}),h('path',{d:actualPath,fill:'none',stroke:'#44e5c4',strokeWidth:3,strokeLinejoin:'round',strokeLinecap:'round'})),
    rows.map((r,i)=>h('g',{key:r.month},h('text',{x:x(i),y:282,textAnchor:'middle',fill:'#a7b7ca',fontSize:13},r.month.slice(5)),r.actual!==null&&h('circle',{cx:x(i),cy:y(r.actual),r:hover===i?6:3.5,fill:'#162832',stroke:'#44e5c4',strokeWidth:2}))),
    visible.length>0&&h('circle',{className:'sm-beacon',cx:x(visible.length-1),cy:y(visible.at(-1).actual),r:7,fill:'#44e5c4'})),
   h('div',{className:'sm-readout','aria-live':'polite'},chosen?`${chosen.month} · ${tr('ยอดสะสม','Cumulative actual')} ${cash(chosen.actual)} · ${tr('เป้าสะสม','Cumulative target')} ${cash(chosen.target)} THB`:tr('เลือกเดือนเพื่อดูรายละเอียด · ตัวเลขด้านล่างเป็นยอดรายเดือน','Select a month for details · Values below are monthly totals')),
   h('div',{className:'sm-months'},metrics.rows.map((r,i)=>h('button',{type:'button',key:r.month,onMouseEnter:()=>H(i),onMouseLeave:()=>H(null),onFocus:()=>H(i),onBlur:()=>H(null),onClick:()=>onMonth(r.month),'aria-label':r.month+' '+tr('ยอดขาย ','Actual ')+r.actual+' '+tr('เป้า ','Target ')+(r.target??'—')},h('span',null,r.month),h('strong',null,r.month>currentMonth?'—':cash(r.actual)),h('small',null,tr('เป้า ','Target ')+cash(r.target))))),
   h('footer',{className:'sm-footer'},h('span',null,tr('ยอดที่ยังขาดจากเป้า','Remaining to target')),h('strong',null,cash(metrics.remaining)+' THB'),h('span',null,tr('วงแหวนเต็มที่ 100% · ตัวเลขแสดงผลงานเกินเป้าได้','Ring fills at 100%; numeric attainment can exceed target'))));
 };
}
