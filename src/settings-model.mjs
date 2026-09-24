import {validateMaster} from './master-data.mjs';
export const MODULES=['dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings'];
export const ACTIONS=['view','create','edit','delete','export','approve','assign','import','manage_settings'];
export const COMPANY_FIELDS=['company_name','company_name_en','tax_id','phone','email','website','logo_url','default_language','timezone','currency','fiscal_year_start_month','date_format','time_format','company_details'];
export function validateCompany(input){
 const out=Object.fromEntries(COMPANY_FIELDS.map(k=>[k,input[k]]));
 for(const key of COMPANY_FIELDS.filter(k=>!['company_details','fiscal_year_start_month'].includes(k)))out[key]=String(out[key]??'').trim();
 if(!out.company_name||out.company_name.length>200)throw Error('กรอกชื่อบริษัท / Company name is required (max 200)');
 if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw Error('อีเมลไม่ถูกต้อง / Invalid email');
 if(out.tax_id&&!/^\d{13}$/.test(out.tax_id))throw Error('เลขภาษีต้องมี 13 หลัก / Tax ID must have 13 digits');
 if(out.website&&!/^https?:\/\//i.test(out.website))throw Error('Website must start with https:// or http://');
 if(out.logo_url&&!/^https:\/\/|^data:image\/(png|jpeg|webp);base64,/i.test(out.logo_url))throw Error('Logo must be HTTPS or PNG/JPEG/WebP');
 if(out.logo_url.length>360000)throw Error('Logo too large (maximum 250 KB)');
 if(!['th','en'].includes(out.default_language)||!['THB','USD','EUR','JPY'].includes(out.currency)||!['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'].includes(out.date_format)||!['12h','24h'].includes(out.time_format))throw Error('Invalid regional option');
 try{new Intl.DateTimeFormat('en',{timeZone:out.timezone});}catch{throw Error('Timezone ไม่ถูกต้อง / Invalid timezone');}
 out.fiscal_year_start_month=Number(out.fiscal_year_start_month);
 if(!Number.isInteger(out.fiscal_year_start_month)||out.fiscal_year_start_month<1||out.fiscal_year_start_month>12)throw Error('Fiscal month must be 1–12');
 out.company_details=Object.fromEntries(['address_th','address_en','branch_code','contact_name','contact_position','contact_phone','contact_email','facebook','line','linkedin'].map(k=>[k,String(input.company_details?.[k]??'').trim()]));
 for(const [k,v] of Object.entries(out.company_details)){if(v.length>2000)throw Error(`${k}: maximum 2000 characters`);if(['facebook','line','linkedin'].includes(k)&&v&&!/^https:\/\//i.test(v))throw Error(`${k}: HTTPS link required`);}
 return out;
}
export const IMPORTS={
 customers:['name','name_en','phone','email','tax_id','website','address','province'],
 contacts:['name','company','position','department','phone','email','line_id'],
 leads:['company_name','contact_name','position','phone','email','source','product_interest','note'],
 master_data_items:['category','code','name_th','name_en','sort_order','status']
};
export function csvCell(v){const s=String(v??'');return '"'+(/^[\s]*[=+@\-]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}
export function toCSV(rows,fields){return '\ufeff'+[fields.map(csvCell).join(','),...rows.map(row=>fields.map(k=>csvCell(row[k])).join(','))].join('\r\n');}
export function parseCSV(input){
 const text=input.replace(/^\ufeff/,'');let rows=[],row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else cell+=c;continue;}
 if(c==='"'){if(cell||closed)throw Error('Invalid CSV quotes');quoted=true;}
 else if(c===','){row.push(cell);cell='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;}
 else{if(closed)throw Error('Invalid CSV after closing quote');cell+=c;}}
 if(quoted)throw Error('Unclosed CSV quote');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;
}
export function validateImport(table,text){
 if(!IMPORTS[table])throw Error('Unsupported table');if(text.length>1000000)throw Error('Maximum file size 1 MB');
 const [headers,...rows]=parseCSV(text);if(!headers||!rows.length)throw Error('CSV has no records');if(rows.length>500)throw Error('Maximum 500 records');
 if(new Set(headers).size!==headers.length||headers.some(k=>!IMPORTS[table].includes(k)))throw Error('Unknown or duplicate columns; download the template');
 const keys=new Set();return rows.map((values,i)=>{if(values.length!==headers.length)throw Error(`Row ${i+2}: wrong number of columns`);const out=Object.fromEntries(headers.map((key,j)=>[key,values[j].trim()]));
 if(table==='master_data_items'){const data=validateMaster({...out,sort_order:out.sort_order||0,status:out.status||'active'});const key=data.category+':'+data.code;if(keys.has(key))throw Error(`Row ${i+2}: duplicate code`);keys.add(key);return data;}
 const required=table==='leads'?'company_name':'name';if(!out[required])throw Error(`Row ${i+2}: ${required} is required`);
 for(const [key,v] of Object.entries(out)){if(v.length>2000)throw Error(`Row ${i+2}: ${key} too long`);if(key==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error(`Row ${i+2}: invalid email`);}
 const fingerprint=JSON.stringify(out);if(keys.has(fingerprint))throw Error(`Row ${i+2}: duplicate record`);keys.add(fingerprint);return out;});
}
