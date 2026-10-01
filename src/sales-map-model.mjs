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
export function wonSales(opportunities,customers){
 const accounts=new Map(customers.map(c=>[c.id,c]));
 return opportunities.filter(o=>(String(o.status).toLowerCase()==='won'||['won','closed won'].includes(String(o.stage).toLowerCase()))&&String(o.status).toLowerCase()!=='lost').map(o=>{
  const customer=accounts.get(o.customer_id),province=provinceOf(customer),amount=Number(o.amount);
  return {id:o.id,code:o.code,name:o.name,customer_id:o.customer_id,customer_name:customer?.name||o.customer_name||'',address:customer?[customer.address,customer.billing_city,customer.province,customer.billing_postal_code].filter(Boolean).join(' '):'',province_id:province?.id||'',province_th:province?.th||'',province_en:province?.en||'',amount:Number.isFinite(amount)&&amount>=0?amount:0,invalid_amount:!Number.isFinite(amount)||amount<0,product:String(o.product||'').trim()||'__unspecified',seller_id:o.owner_id||'__unspecified',seller_name:o.owner_name||'',close_date:String(o.close_date||'').slice(0,10),missing_reason:!customer?'missing_customer':!province?'unresolved_address':''};
 });
}
export function filterSales(rows,{product='',seller='',from='',to='',minimum=0,maximum=null}={}){
 return rows.filter(r=>(!product||r.product===product)&&(!seller||r.seller_id===seller)&&(!from||(r.close_date&&r.close_date>=from))&&(!to||(r.close_date&&r.close_date<=to))&&r.amount>=Number(minimum||0)&&(maximum==null||maximum===''||r.amount<=Number(maximum)));
}
export function summarizeGeography(rows){
 const provinces=new Map();let total=0,unmapped=0;const customers=new Set();
 for(const r of rows){total+=r.amount;if(r.customer_id)customers.add(r.customer_id);if(!r.province_id){unmapped+=r.amount;continue;}const p=provinces.get(r.province_id)||{id:r.province_id,th:r.province_th,en:r.province_en,amount:0,deals:0,customers:new Set()};p.amount+=r.amount;p.deals++;if(r.customer_id)p.customers.add(r.customer_id);provinces.set(r.province_id,p);}
 return {total,mapped:total-unmapped,unmapped,customer_count:customers.size,deals:rows.length,unmapped_count:rows.filter(r=>!r.province_id).length,provinces:[...provinces.values()].map(p=>({...p,customer_count:p.customers.size})).sort((a,b)=>b.amount-a.amount)};
}
