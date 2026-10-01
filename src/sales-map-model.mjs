import {THAI_PROVINCES} from './thailand-map-data.mjs';
const normalize=v=>String(v||'').toLowerCase().replace(/^จ\.\s*/,'').replace(/จังหวัด|province|metropolis|[\s.\-]/g,'');
const bangkok=new Set(['กรุงเทพ','กรุงเทพฯ','กทม','bangkok','bangkokmetropolis','กรุงเทพมหานคร'].map(normalize));
export function provinceOf(customer){
 if(!customer)return null;
 const country=String(customer.billing_country||'').trim().toLowerCase();if(country&&!['th','tha','thailand','ไทย','ประเทศไทย'].includes(country))return null;
 const explicit=normalize(customer.province);
 if(bangkok.has(explicit))return THAI_PROVINCES.find(p=>p.id==='TH-10');
 const exact=THAI_PROVINCES.find(p=>[normalize(p.th),normalize(p.en),normalize(p.id)].includes(explicit));if(exact)return exact;
 // An unknown explicit province is a data issue, never silently guessed from another field.
 if(explicit)return null;
 const address=String(customer.address||'');
 if(/กรุงเทพมหานคร|กรุงเทพฯ|(?:^|\s)กทม\.?|\bBangkok\b/i.test(address))return THAI_PROVINCES.find(p=>p.id==='TH-10');
 const matches=THAI_PROVINCES.filter(p=>new RegExp('(?:จังหวัด|จ\\.\\s*)'+p.th+'(?:\\s|\\d|$)').test(address)||new RegExp('\\b'+p.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(address));
 return matches.length===1?matches[0]:null;
}
export function bangkokOrderDate(value){
 const d=new Date(value);if(!value||!Number.isFinite(d.getTime()))return '';
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');
}
export function salesOrderRows(orders,customers){
 const accounts=new Map(customers.map(c=>[c.id,c])),unique=new Map(),rows=[];
 let excluded_currency_count=0,invalid_order_count=0,unallocated_order_count=0;
 for(const o of orders){const key=(o.source_system||'')+':'+(o.source_so_id||o.id);const old=unique.get(key);if(!old||(Date.parse(o.source_updated_at||o.synced_at||'')||0)>=(Date.parse(old.source_updated_at||old.synced_at||'')||0))unique.set(key,o);}
 for(const o of unique.values()){
  if(o.status!=='converted')continue;
  if(String(o.currency||'THB').toUpperCase()!=='THB'){excluded_currency_count++;continue;}
  const amount=Number(o.net_amount),order_date=bangkokOrderDate(o.converted_at);
  if(o.net_amount===null||o.net_amount===undefined||!Number.isFinite(amount)||amount<0||amount>100000000000||!order_date){invalid_order_count++;continue;}
  const total=Math.round(amount*100),customer=accounts.get(o.customer_id),province=provinceOf(customer),products=new Map();let sum=0,bad=false;
  if(!Array.isArray(o.product_lines)){invalid_order_count++;continue;}
  for(const line of o.product_lines){
   if(!line||typeof line!=='object'){bad=true;break;}
   const n=Number(line.net_amount),name=String(line.product||'').trim(),code=String(line.code||'').trim();
   if(line.net_amount===null||line.net_amount===undefined||line.net_amount===''||typeof line.net_amount==='boolean'||!Number.isFinite(n)||n<0||(!name&&!code)){bad=true;break;}
   const value=Math.round(n*100),key=code?'code:'+code:'name:'+name;sum+=value;
   const previous=products.get(key)||{product:key,product_name:name||code,product_code:code,cents:0};previous.cents+=value;products.set(key,previous);
  }
  if(bad||sum>total){invalid_order_count++;continue;}
  if(sum<total||!products.size){products.set('__unspecified',{product:'__unspecified',product_name:'',product_code:'',cents:total-sum});unallocated_order_count++;}
  for(const product of products.values())rows.push({id:o.id+':'+product.product,order_id:o.id,code:o.so_number,source_system:o.source_system,source_so_id:o.source_so_id,customer_id:o.customer_id,customer_name:customer?.name||o.customer_name||'',address:customer?[customer.address,customer.billing_city,customer.province,customer.billing_postal_code].filter(Boolean).join(' '):'',province_id:province?.id||'',province_th:province?.th||'',province_en:province?.en||'',amount:product.cents/100,order_amount:total/100,product:product.product,product_name:product.product_name,product_code:product.product_code,seller_id:String(o.sales_email||'').trim().toLowerCase()||'__unspecified',seller_name:o.sales_name||'',order_date,synced_at:o.synced_at||'',missing_reason:!customer?'missing_customer':!province?'unresolved_address':''});
 }
 return {rows,excluded_currency_count,invalid_order_count,unallocated_order_count};
}
export function filterSales(rows,{product='',seller='',from='',to='',minimum=0,maximum=null}={}){
 return rows.filter(r=>(!product||r.product===product)&&(!seller||r.seller_id===seller)&&(!from||(r.order_date&&r.order_date>=from))&&(!to||(r.order_date&&r.order_date<=to))&&r.order_amount>=Number(minimum||0)&&(maximum==null||maximum===''||r.order_amount<=Number(maximum)));
}
export function summarizeGeography(rows){
 const provinces=new Map(),customers=new Set(),orders=new Set(),unmappedOrders=new Set();let total=0,unmapped=0;
 for(const r of rows){const value=Math.round(r.amount*100);total+=value;orders.add(r.order_id);if(r.customer_id)customers.add(r.customer_id);if(!r.province_id){unmapped+=value;unmappedOrders.add(r.order_id);continue;}const p=provinces.get(r.province_id)||{id:r.province_id,th:r.province_th,en:r.province_en,amount:0,orders:new Set(),customers:new Set()};p.amount+=value;p.orders.add(r.order_id);if(r.customer_id)p.customers.add(r.customer_id);provinces.set(r.province_id,p);}
 return {total:total/100,mapped:(total-unmapped)/100,unmapped:unmapped/100,customer_count:customers.size,orders:orders.size,unmapped_count:unmappedOrders.size,provinces:[...provinces.values()].map(p=>({id:p.id,th:p.th,en:p.en,amount:p.amount/100,orders:p.orders.size,customer_count:p.customers.size})).sort((a,b)=>b.amount-a.amount)};
}
