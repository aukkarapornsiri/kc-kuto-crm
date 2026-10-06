// Server-only. Credentials must be configured in Edge Function secrets.
export const INVITE_SENDER='CuToCRM@kai-com.com';
export async function createMicrosoftMailer({tenant,clientId,clientSecret,fetcher=fetch}){
 if(!tenant||!clientId||!clientSecret)throw Error('Microsoft 365 sender is not configured');
 if(!/^[a-f\d-]{36}$/i.test(tenant)||!/^[a-f\d-]{36}$/i.test(clientId))throw Error('Invalid Microsoft application configuration');
 const response=await fetcher(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(15000)});
 const auth=await response.json().catch(()=>({}));
 if(!response.ok||!auth.access_token)throw Error('Microsoft 365 authentication failed; check application credentials');
 return async function sendInvitation(email,actionLink){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid recipient');
  const link=new URL(actionLink);
  if(link.origin!=='https://tocsxnprspiogawignib.supabase.co'||link.pathname!=='/auth/v1/verify'||link.username||link.password)throw Error('Invalid invitation link');
  let sent;
  try{sent=await fetcher(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(INVITE_SENDER)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:'คำเชิญเข้าใช้งาน KC CuTo CRM',body:{contentType:'Text',content:'คุณได้รับคำเชิญเข้าใช้งาน KC CuTo CRM\n\nกดลิงก์เพื่อยืนยันบัญชีและกรอกประวัติส่วนตัว:\n'+link.href+'\n\nลิงก์นี้เป็นข้อมูลส่วนตัว กรุณาอย่าส่งต่อให้ผู้อื่น\nหากลิงก์หมดอายุ กรุณาติดต่อผู้ดูแลเพื่อส่งคำเชิญใหม่'},toRecipients:[{emailAddress:{address:email}}]},saveToSentItems:true}),signal:AbortSignal.timeout(15000)});}catch{throw Error('ไม่ทราบผลการส่ง กรุณาตรวจ Sent Items ของ CuToCRM@kai-com.com ก่อนส่งซ้ำ');}
  if(sent.status!==202)throw Error(sent.status===403?'Microsoft 365 ยังไม่อนุญาตให้แอปส่งจาก CuToCRM@kai-com.com':sent.status===429?'Microsoft 365 จำกัดการส่งชั่วคราว กรุณารอก่อนส่งใหม่':`Microsoft 365 ไม่รับคำขอส่งอีเมล (${sent.status})`);
  // Accepted is not proof of delivery to the recipient's inbox.
  return {accepted:true,provider:'microsoft_graph',sender:INVITE_SENDER};
 };
}
