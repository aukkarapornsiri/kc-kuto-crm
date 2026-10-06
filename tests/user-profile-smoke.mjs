import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 const logo=page.locator('.kc-rail-brand img');await logo.evaluate(img=>img.decode());assert(await logo.evaluate(img=>img.naturalWidth>0));
 await page.getByRole('button',{name:'โปรไฟล์ผู้ใช้',exact:true}).click();await page.getByRole('button',{name:'แก้ไขโปรไฟล์',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'โปรไฟล์ของฉัน'});await dialog.getByLabel('ชื่อ',{exact:true}).fill('Profile');await dialog.getByLabel('นามสกุล',{exact:true}).fill('Test');await dialog.getByLabel('โทรศัพท์',{exact:true}).fill('0123456789');
 await dialog.getByLabel('เพิ่มรูปโปรไฟล์',{exact:true}).setInputFiles('kc-cuto-logo.png');await dialog.getByRole('img',{name:'รูปโปรไฟล์'}).evaluate(img=>img.decode());
 await page.screenshot({path:`test-artifacts/profile-${width}.png`,fullPage:true});await dialog.getByRole('button',{name:'บันทึก',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'โปรไฟล์ผู้ใช้',exact:true}).click();await page.getByRole('strong').count().catch(()=>0);assert(await page.getByText('Profile Test',{exact:true}).count()>0);
 await page.getByRole('button',{name:'แก้ไขโปรไฟล์',exact:true}).click();assert.equal(await dialog.getByLabel('โทรศัพท์',{exact:true}).inputValue(),'0123456789');await dialog.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.getByRole('button',{name:'โปรไฟล์ผู้ใช้',exact:true}).click();await page.getByRole('region',{name:'เมนูโปรไฟล์'}).getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await page.getByRole('heading',{name:'ยินดีต้อนรับกลับ'}).waitFor();assert.deepEqual(errors,[]);await page.close();
}console.log('App logo, profile edit/photo, reopen and sign-out passed on desktop/mobile (demo).');}finally{await browser.close();}
