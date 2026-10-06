import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:'b96243b3-7853-4160-a581-0ce877adb410',email:'qa@example.invalid',app_metadata:{provider:'email'},user_metadata:{}};
 const jwt='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.qa';
 let completed=false,passwordUpdated=false,details;
 await page.addInitScript(({user,jwt})=>localStorage.setItem('sb-tocsxnprspiogawignib-auth-token',JSON.stringify({access_token:jwt,refresh_token:'qa',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,jwt});
 await page.route('https://tocsxnprspiogawignib.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data=[];
  if(url.pathname.endsWith('/auth/v1/user')){if(req.method()==='PUT')passwordUpdated=true;data=user;}
  else if(url.pathname.endsWith('/profiles'))data={id:user.id,email:user.email,display_name:'QA',role:'sales_user',is_active:true};
  else if(url.pathname.endsWith('/crm_user_onboarding'))data={user_id:user.id,requires_password:true,completed_at:completed?'2026-10-06T00:00:00Z':null,personal_details:details||{}};
  else if(url.pathname.endsWith('/rpc/crm_complete_onboarding')){assert.equal(passwordUpdated,true);details=req.postDataJSON().p_details;completed=true;data=null;}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
 await page.getByRole('heading',{name:'ยินดีต้อนรับสู่ KC CuTo CRM'}).waitFor();
 await page.getByLabel('ชื่อ',{exact:true}).fill('ทดสอบ');await page.getByLabel('นามสกุล',{exact:true}).fill('ระบบ');
 await page.getByLabel('โทรศัพท์',{exact:true}).fill('0123456789');
 await page.getByLabel('ตั้งรหัสผ่าน',{exact:true}).fill('test-only-password');await page.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).fill('wrong-password');
 await page.getByRole('button',{name:'บันทึกและเริ่มใช้งาน'}).click();await page.getByRole('alert').waitFor();assert.equal(completed,false);
 await page.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).fill('test-only-password');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`test-artifacts/onboarding-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'บันทึกและเริ่มใช้งาน'}).click();
 await page.getByRole('heading',{name:'ยินดีต้อนรับสู่ KC CuTo CRM'}).waitFor({state:'hidden'});
 assert.equal(details.phone,'0123456789');await page.reload();await page.getByRole('button',{name:'บันทึกและเริ่มใช้งาน'}).waitFor({state:'hidden'});assert.deepEqual(errors,[]);await page.close();
}console.log('Onboarding form, password mismatch, save, reload, desktop/mobile passed (mock Auth; DB tested separately).');}finally{await browser.close();}
