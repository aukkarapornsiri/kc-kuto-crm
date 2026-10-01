export const EMAIL_LAYOUTS=[
 ['sales','การขาย','Sales','ข้อเสนอพิเศษสำหรับคุณ','Special offer for you'],
 ['announcement','ประกาศ','Announcement','ข่าวสารจากเรา','An announcement from us'],
 ['newsletter','จดหมายข่าว','Newsletter','ข่าวสารประจำเดือน','Monthly newsletter'],
 ['plain','ข้อความธรรมดา','Plain text','สวัสดีจากเรา','Hello from us'],
 ['html','HTML','HTML','อีเมล HTML','HTML email'],
 ['blank','กำหนดเอง','Blank','อีเมลใหม่','New email']
];
export const emailAddress=v=>String(v||'').trim().toLowerCase();
export const validEmail=v=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(emailAddress(v))&&emailAddress(v).length<=254;
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const marketable=c=>!['inactive','blacklist'].includes(String(c?.status||'').toLowerCase());
export function audience(customers,contacts){
 const accounts=new Map(customers.map(c=>[c.id,c]));
 return [...customers.filter(c=>marketable(c)).map(c=>({id:'customers:'+c.id,source_type:'customers',source_id:c.id,name:c.name,email:emailAddress(c.email),customer_name:c.name,tier:c.tier||'',industry:c.industry||''})),...contacts.filter(c=>marketable(c)&&marketable(accounts.get(c.customer_id))).map(c=>({id:'contacts:'+c.id,source_type:'contacts',source_id:c.id,name:c.name,email:emailAddress(c.email),customer_name:accounts.get(c.customer_id)?.name||'',tier:accounts.get(c.customer_id)?.tier||'',industry:accounts.get(c.customer_id)?.industry||''}))].filter(c=>validEmail(c.email));
}
export function uniqueRecipients(rows){const result=new Map();for(const row of rows){const email=emailAddress(row.email);if(validEmail(email)&&!result.has(email))result.set(email,{...row,email});}return [...result.values()];}
export function emailBodyHTML(layout,text,subject){
 if(layout==='plain')return '';
 const body=String(text||'').split(/\n\s*\n/).map(p=>'<p style="line-height:1.7">'+escapeHTML(p).replaceAll('\n','<br>')+'</p>').join('');
 return '<div style="background:#f6f4f3;padding:24px;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;background:white;padding:32px;border-top:6px solid #a34347"><h1>'+escapeHTML(subject)+'</h1>'+body+'</div></div>';
}
export function starterEmail(layout,lang='th'){
 const l=EMAIL_LAYOUTS.find(x=>x[0]===layout)||EMAIL_LAYOUTS[0],th=lang==='th',title=l[th?3:4],greeting=th?'เรียน {{name}}':'Hello {{name}}';
 const text=greeting+'\n\n'+title+'\n\n'+(th?'เพิ่มข้อความของคุณที่นี่':'Add your message here');
 const blocks=layout==='newsletter'?'<h2>01 / '+(th?'อัปเดตล่าสุด':'Latest updates')+'</h2><p>'+(th?'เพิ่มเรื่องราวและข่าวสาร':'Add your stories and news')+'</p><hr><h2>02 / '+(th?'แนะนำสินค้า':'Product highlights')+'</h2>':'';
 const html=layout==='plain'?'':`<div style="background:#f6f4f3;padding:24px;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;background:white;padding:32px;border-top:6px solid #a34347"><p>${greeting}</p><h1>${escapeHTML(title)}</h1><p>${th?'เพิ่มข้อความของคุณที่นี่':'Add your message here'}</p>${blocks}<p style="color:#777">${th?'ขอบคุณที่ไว้วางใจเรา':'Thank you for choosing us'}</p></div></div>`;
 return {title,subject:title,preview_text:'',html:layout==='blank'?'':html,text,layout:l[0],group_ids:[]};
}
export function validateCampaign(value){if(!String(value.title||'').trim())throw Error('กรุณาระบุชื่ออีเมล / Email name is required');if(!String(value.subject||'').trim()||String(value.subject).length>200||/[\r\n]/.test(value.subject))throw Error('กรุณาระบุหัวข้ออีเมล (ไม่เกิน 200 ตัวอักษร) / Invalid subject');if(!String(value.html||value.text||'').trim())throw Error('กรุณาระบุเนื้อหาอีเมล / Email content is required');if(String(value.html||'').length>200000||String(value.text||'').length>200000)throw Error('เนื้อหาอีเมลยาวเกินไป / Email is too large');return {...value,title:value.title.trim(),subject:value.subject.trim()};}
export function bangkokToUTC(value,now=Date.now()){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('กรุณาระบุวันเวลาส่ง / Choose a date and time');const time=new Date(value+':00+07:00').getTime();if(!Number.isFinite(time)||time<now+60000)throw Error('เลือกเวลาล่วงหน้าอย่างน้อย 1 นาที / Schedule at least one minute ahead');return new Date(time).toISOString();}
export const EMAIL_STATUSES={draft:['ฉบับร่าง','Draft'],scheduled:['ตั้งเวลาส่ง','Scheduled'],queued:['รอส่ง','Queued'],sending:['กำลังส่ง','Sending'],sent:['ส่งให้ผู้ให้บริการแล้ว','Accepted by provider'],partial:['ส่งสำเร็จบางส่วน','Partially sent'],failed:['ส่งไม่สำเร็จ','Failed'],cancelled:['ยกเลิกแล้ว','Cancelled']};
