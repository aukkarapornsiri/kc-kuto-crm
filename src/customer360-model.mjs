import {bangkokOrderDate} from './sales-map-model.mjs';
export const SOURCES={contacts:['ผู้ติดต่อ','Contacts','contact-list'],branches:['สาขา','Branches','branches'],leads:['ลูกค้าเป้าหมาย','Leads','lead-inbox'],opportunities:['โอกาสการขาย','Opportunities','opp-all'],quotations:['ใบเสนอราคา','Quotations','quot-list'],contracts:['สัญญา','Contracts','con-all'],assets:['สินทรัพย์','Assets','asset-all'],tickets:['งานบริการ','Service cases','tk-all'],activities:['กิจกรรม','Activities','act-my'],documents:['เอกสาร','Documents','doc-all'],orders:['คำสั่งขาย SO','Sales orders','']};
export const clean=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const digits=v=>String(v??'').replace(/\D/g,'');
export function duplicateReasons(a,b){
 const out=[];if(a.id===b.id)return out;
 const tax=digits(a.tax_id);if(tax.length===13&&tax===digits(b.tax_id))out.push('tax_id');
 const email=clean(a.email);if(email.includes('@')&&email===clean(b.email))out.push('email');
 const phone=digits(a.phone);if(phone.length>=9&&phone===digits(b.phone))out.push('phone');
 const name=clean(a.name);if(name.length>=3&&name===clean(b.name))out.push('name');
 return out;
}
export function identityGroup(id,links=[]){const root=links.find(x=>x.customer_id===id)?.canonical_id||id;return {root,ids:[root,...links.filter(x=>x.canonical_id===root).map(x=>x.customer_id)]};}
const status=r=>clean(r.status);
const cents=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Math.round(Number(v)*100):null;
export function overview(data,today=bangkokOrderDate(new Date())){
 const available=k=>Array.isArray(data[k]);
 const orders=new Map();for(const row of data.orders||[]){const key=JSON.stringify([row.source_system||'',row.source_so_id||row.id]);const prev=orders.get(key);if(!prev||String(row.source_updated_at||row.synced_at||'')>=String(prev.source_updated_at||prev.synced_at||''))orders.set(key,row);}
 const valid=[...orders.values()].filter(r=>status(r)==='converted'&&String(r.currency||'THB').toUpperCase()==='THB'&&cents(r.net_amount)!==null&&cents(r.net_amount)>=0&&bangkokOrderDate(r.converted_at)&&bangkokOrderDate(r.converted_at)<=today);
 const ytd=valid.filter(r=>bangkokOrderDate(r.converted_at)>=today.slice(0,4)+'-01-01');
 const pipeline=(data.opportunities||[]).filter(r=>!['won','lost','closed won','closed lost','closed-won','closed-lost'].includes(clean(r.stage))&&status(r)==='open');
 const quotes=(data.quotations||[]).filter(r=>['draft','sent','pending','approved'].includes(status(r)));
 const cases=(data.tickets||[]).filter(r=>!['resolved','closed','cancelled'].includes(status(r)));
 const end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+90);const until=end.toISOString().slice(0,10);
 const renewal=(data.contracts||[]).filter(r=>status(r)==='active'&&r.end_date>=today&&r.end_date<=until);
 const metrics=[{key:'sales',source:'orders',rows:ytd,value:available('orders')?ytd.reduce((n,r)=>n+cents(r.net_amount),0)/100:null,money:true},{key:'pipeline',source:'opportunities',rows:pipeline,value:available('opportunities')&&pipeline.every(r=>cents(r.amount)!==null)?pipeline.reduce((n,r)=>n+cents(r.amount),0)/100:null,money:true},{key:'quotes',source:'quotations',rows:quotes,value:available('quotations')?quotes.length:null},{key:'cases',source:'tickets',rows:cases,value:available('tickets')?cases.length:null},{key:'renewal',source:'contracts',rows:renewal,value:available('contracts')?renewal.length:null}];
 return {metrics,lastPurchase:available('orders')?valid.map(r=>bangkokOrderDate(r.converted_at)).sort().at(-1)||'':null,excludedOrders:[...orders.values()].filter(r=>status(r)==='converted'&&!valid.includes(r)).length};
}
export function timeline(data,events=[]){
 const out=[];for(const [source,rows] of Object.entries(data)){if(!SOURCES[source]||!Array.isArray(rows))continue;for(const r of rows){const title=r.code||r.so_number||r.name||r.subject||r.company_name||r.id;for(const [field,action] of [['created_at','created'],['updated_at','last_updated'],['scheduled_at','scheduled'],['converted_at','converted'],['resolved_at','resolved']]){if((field==='created_at'||field==='updated_at')&&events.some(e=>(e.module==='crm_branches'?'branches':e.module)===source&&e.record_id===r.id&&e.action===(field==='created_at'?'INSERT':'UPDATE')))continue;if(!r[field]||!Number.isFinite(Date.parse(r[field]))||(field==='updated_at'&&r.updated_at===r.created_at))continue;out.push({id:`${source}:${r.id}:${field}`,source,record_id:r.id,customer_id:r.customer_id,title,action,at:r[field],derived:true});}}}
 for(const e of events)out.push({...e,source:e.module==='crm_branches'?'branches':e.module,at:e.created_at,derived:false});
 return out.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||String(a.id).localeCompare(String(b.id)));
}
