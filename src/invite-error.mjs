export async function invitationError(data,error){
 let body=data;
 if(!body?.error&&error?.context?.json){try{body=await error.context.json();}catch{}}
 const message=body?.error||error?.message||'ส่งคำเชิญไม่สำเร็จ';
 if(body?.code==='over_email_send_rate_limit'||/email rate limit exceeded/i.test(message))return 'บริการส่งอีเมลถึงโควตาชั่วคราวแล้ว คำเชิญนี้ยังไม่ได้ส่ง กรุณารอให้โควตาคืนก่อนลองอีกครั้ง หรือติดต่อผู้ดูแลเพื่อตั้งค่า SMTP สำหรับใช้งานจริง';
 if(message==='Unauthorized')return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
 if(message==='Admin permission required')return 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเชิญผู้ใช้ได้';
 return message;
}
