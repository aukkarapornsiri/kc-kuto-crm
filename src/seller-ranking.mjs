import {bangkokOrderDate} from './sales-map-model.mjs?v=20261001-so';
export function sellerRanking(rows,today=bangkokOrderDate(new Date())){
 const start=today.slice(0,4)+'-01-01',people=new Map();
 for(const r of rows){if(r.order_date<start||r.order_date>today||!r.order_date)continue;const key=r.seller_id||'__unspecified',p=people.get(key)||{id:key,name:r.seller_name||'',cents:0,orders:new Set()};p.cents+=Math.round(r.amount*100);p.orders.add(r.order_id);people.set(key,p);}
 return [...people.values()].map(p=>({id:p.id,name:p.name,amount:p.cents/100,orders:p.orders.size})).sort((a,b)=>a.amount-b.amount||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
export function createSellerRanking(React){
 const h=React.createElement;
 return function SellerRanking({rows,lang,busy,error,asOf,onRefresh}){
  const th=lang==='th',t=(a,b)=>th?a:b,[paused,Pause]=React.useState(false),today=bangkokOrderDate(new Date()),rank=sellerRanking(rows,today),total=rank.reduce((n,p)=>n+Math.round(p.amount*100),0)/100,max=Math.max(1,...rank.map(p=>p.amount));
  const cash=v=>new Intl.NumberFormat(th?'th-TH':'en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
  return h('section',{className:'seller-ranking','data-paused':paused,'aria-label':t('ยอดขายสะสมรายพนักงาน','Sales by salesperson year to date')},
   h('header',null,h('div',null,h('p',{className:'seller-eyebrow'},'SALES · YEAR TO DATE'),h('h2',null,t('ยอดขายสะสมราย Sales ','Sales by salesperson ')+today.slice(0,4)),h('p',null,t('1 ม.ค. – ','Jan 1 – ')+today+' · '+t('น้อย → มาก · ยอด SO สุทธิก่อน VAT · บาท','Low → high · Net SO sales before VAT · THB'))),h('div',{className:'seller-tools'},h('div',null,h('small',null,t('รวมตามสิทธิ์ที่มองเห็น','Total within your access')),h('strong',{'data-seller-total':true},error?'—':cash(total))),h('button',{type:'button','aria-pressed':paused,onClick:()=>Pause(v=>!v),'aria-label':t(paused?'เล่นกราฟยอดขายรายคน':'หยุดกราฟยอดขายรายคน',paused?'Play seller chart':'Pause seller chart')},paused?'▶':'Ⅱ'),h('button',{type:'button',disabled:busy,onClick:onRefresh,'aria-label':t('โหลดกราฟยอดขายรายคนใหม่','Refresh seller chart')},'↻'))),
   error?h('p',{role:'alert'},t('โหลดข้อมูลยอดขายไม่ได้ กรุณาลองใหม่','Unable to load sales. Please retry.')):busy&&!rank.length?h('p',{role:'status'},t('กำลังโหลดข้อมูล…','Loading…')):!rank.length?h('p',null,t('ยังไม่มียอดขายตั้งแต่ต้นปีในข้อมูลที่คุณมีสิทธิ์เห็น','No year-to-date sales within your access')):
   h('ol',{className:'seller-bars'},rank.map((p,index)=>h('li',{key:p.id,'data-seller-amount':p.amount},h('div',{className:'seller-label'},h('span',{className:'seller-number'},index+1),h('span',null,p.name||t('ไม่ระบุพนักงานขาย','Unassigned seller')),h('small',null,p.orders+' SO')),h('div',{className:'seller-track','aria-hidden':true},h('div',{className:'seller-fill',style:{width:(p.amount/max*100)+'%','--seller-delay':index*.07+'s'}})),h('strong',null,cash(p.amount))))),
   h('footer',null,t('เฉพาะ SO เปิดสำเร็จสกุลเงินบาท · ข้อมูลตามสิทธิ์ · รีเฟรชทุก 30 วินาที','Converted THB Sales Orders only · Access scoped · Refreshes every 30 seconds'),asOf&&' · '+t('อัปเดต ','Updated ')+new Intl.DateTimeFormat(th?'th-TH':'en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}).format(new Date(asOf))));
 };
}
