// Monetary amounts are THB; discount is an amount per line, before tax.
export function quotationTotals(items, taxRate=7, whtRate=0) {
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 taxRate=Number(taxRate);whtRate=Number(whtRate);
 if (![taxRate,whtRate].every(n=>Number.isFinite(n)&&n>=0&&n<=100)) throw Error('Invalid VAT or WHT rate');
 if (!Array.isArray(items)||!items.length||items.length>500) throw Error('At least one item required (maximum 500)');
 const clean=items.map(item=>{
  const x={name:String(item.name??'').trim(),desc:String(item.desc??''),unit:String(item.unit||'Unit'),qty:Number(item.qty),price:Number(item.price),discount:Number(item.discount||0)};
  if(!x.name||!Number.isFinite(x.qty)||x.qty<=0||x.qty>=1e12||![x.price,x.discount].every(n=>Number.isFinite(n)&&n>=0&&n<1e12)||x.discount>x.qty*x.price)throw Error('Invalid quotation item');
  x.total=round(x.qty*x.price-x.discount);return x;
 });
 const subtotal=round(clean.reduce((s,i)=>s+i.qty*i.price,0)),discount=round(clean.reduce((s,i)=>s+i.discount,0));
 const base=round(subtotal-discount),vat=round(base*taxRate/100),withholding_tax=round(base*whtRate/100),total=round(base+vat);
 return {items:clean,subtotal,discount,vat,total,withholding_tax,net_total:round(total-withholding_tax)};
}
export const QUOTE_FIELDS='issue_date:,valid_until:,customer_id@,contact_id@,opportunity_id@,owner_id@,project_name,payment_terms#,tax_rate#,wht_rate#,prepared_by,prepared_by_email,prepared_by_phone,counterparty_address~,counterparty_tax_id,payment_instructions~,document_language,note~';
export const QUOTE_LABELS={issue_date:['วันที่เอกสาร','Issue date'],valid_until:['วันหมดอายุ','Valid until'],customer_id:['ลูกค้า','Customer'],contact_id:['ผู้ติดต่อ','Contact'],opportunity_id:['โอกาสการขาย','Opportunity'],owner_id:['ผู้รับผิดชอบ','Owner'],project_name:['โครงการ','Project'],payment_terms:['เครดิต (วัน)','Credit term (days)'],tax_rate:['VAT (%)','VAT (%)'],wht_rate:['หัก ณ ที่จ่าย (%)','WHT (%)'],prepared_by:['ผู้จัดทำ','Prepared by'],prepared_by_email:['อีเมลผู้จัดทำ','Preparer email'],prepared_by_phone:['โทรศัพท์ผู้จัดทำ','Preparer phone'],counterparty_address:['ที่อยู่ลูกค้า','Customer address'],counterparty_tax_id:['เลขผู้เสียภาษีลูกค้า','Customer tax ID'],payment_instructions:['เงื่อนไขการชำระเงิน','Payment instructions'],document_language:['ภาษาเอกสาร','Document language'],note:['หมายเหตุ','Notes']};
export function quotationDefaults(profile={},lang='th') {const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return {issue_date:today,payment_terms:30,tax_rate:7,wht_rate:0,prepared_by:profile.display_name||profile.name||'',prepared_by_email:profile.email||'',document_language:lang,status:'draft',items:[{name:'',qty:1,price:0,discount:0,unit:'Unit'}]};}
export function quotationCustomer(customer={}) {return {counterparty_address:[customer.address,customer.billing_city,customer.province,customer.billing_postal_code,customer.billing_country].filter(Boolean).join(', '),counterparty_tax_id:customer.tax_id||''};}
// This reference release supports page=ar only; it does not consume CRM prefill.
export const ACCOUNT360_QUOTATIONS_URL='https://kc-account-360-preview.saelim-m.chatgpt.site/?page=ar';
