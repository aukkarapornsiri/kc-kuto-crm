import {profileNames,profileDisplayName} from './profile-names.mjs?v=20261002';
export const DOCUMENT_ENTITIES=['quotations','documents','contracts','tickets'];
export const PERSONAL_FIELDS=['first_name','last_name','company_name','phone','job_title','document_department','employee_code','contact_email','line_id'];
export const DOCUMENT_FIELDS=[['name','ผู้จัดทำ / ผู้ร้องขอ','Prepared by / Requester'],['company_name','บริษัท / องค์กร','Company / Organization'],['phone','เบอร์โทรศัพท์','Phone'],['job_title','ตำแหน่ง','Position'],['department','แผนก','Department'],['employee_code','รหัสพนักงาน','Employee code'],['email','อีเมลติดต่อ','Contact email'],['line_id','LINE ID','LINE ID']];
const clean=value=>String(value??'').trim();
export function validatePersonalProfile(input){
 const out=Object.fromEntries(PERSONAL_FIELDS.map(key=>[key,clean(input[key])]));
 if(!out.first_name||!out.last_name)throw Error('กรุณากรอกชื่อและนามสกุล / First and last name are required');
 if(Object.values(out).some(value=>value.length>150))throw Error('ข้อมูลยาวเกิน 150 ตัวอักษร / Maximum 150 characters');
 if(out.contact_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.contact_email))throw Error('อีเมลติดต่อไม่ถูกต้อง / Invalid contact email');
 return {...out,display_name:profileDisplayName(out.first_name,out.last_name)};
}
export function documentProfile(profile={}){
 const names=profileNames(profile);
 return {name:profileDisplayName(names.first_name,names.last_name)||profile.display_name||profile.email||'',first_name:names.first_name||'',last_name:names.last_name||'',company_name:clean(profile.company_name),phone:clean(profile.phone),job_title:clean(profile.job_title),department:clean(profile.document_department||profile.department_group),employee_code:clean(profile.employee_code),email:clean(profile.contact_email||profile.email),line_id:clean(profile.line_id)};
}
export function newDocumentDefaults(entity,profile,seed={}){
 if(!DOCUMENT_ENTITIES.includes(entity)||seed.id)return {...seed};
 const person=seed.document_profile??documentProfile(profile);
 return {...seed,...(entity==='quotations'?{prepared_by:seed.prepared_by||person.name,prepared_by_email:seed.prepared_by_email||person.email,prepared_by_phone:seed.prepared_by_phone||person.phone,project_name:seed.project_name||person.department}:{}),document_profile:{...person}};
}
export function validateDocumentProfile(input){
 if(input==null)return null;
 const result=Object.fromEntries(['first_name','last_name',...DOCUMENT_FIELDS.map(([key])=>key)].map(key=>[key,clean(input[key])]));
 if(Object.values(result).some(value=>value.length>300))throw Error('ข้อมูลผู้จัดทำยาวเกิน 300 ตัวอักษร');
 if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw Error('อีเมลผู้จัดทำไม่ถูกต้อง / Invalid contact email');
 return result;
}
export function createDocumentProfileFields(React){
 const h=React.createElement;
 return function DocumentProfileFields({value={},onChange,lang='th',busy=false,compact=false}){
  return h('section',{className:'crm-document-profile',style:{borderTop:'1px solid #dce6eb',paddingTop:16,marginTop:16}},h('h3',null,lang==='th'?'ข้อมูลผู้จัดทำเอกสาร':'Document preparer'),h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:14}},DOCUMENT_FIELDS.filter(([key])=>!compact||!['name','email','phone'].includes(key)).map(([key,th,en])=>h('label',{key,className:'crm-field'},h('span',null,lang==='th'?th:en),h('input',{'aria-label':(lang==='th'?'ผู้จัดทำ: ':'Preparer: ')+(lang==='th'?th:en),value:value?.[key]||'',type:key==='email'?'email':'text',maxLength:300,disabled:busy,onChange:e=>onChange({...value,[key]:e.target.value}),style:{width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8}})))));
 };
}
