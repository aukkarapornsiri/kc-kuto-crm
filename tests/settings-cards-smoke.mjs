import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{for(const width of [1555,820,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
 await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 if(width<1024)await page.locator('button.lg\\:hidden').first().click();
 await page.getByRole('button',{name:'ตั้งค่าระบบ',exact:true}).filter({visible:true}).click();
 const hub=page.locator('.crm-settings-hub');await hub.waitFor();
 assert.equal(await hub.locator('.crm-category-card').count(),6);
 assert.equal(await hub.locator('.crm-hub-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>1199?4:width>600?2:1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:`test-artifacts/settings-cards-${width}.png`,fullPage:true});
 for(const name of await hub.locator('.crm-category-title').allTextContents()){
  await hub.getByRole('button',{name,exact:true}).click();assert.ok(await hub.locator('.crm-settings-card').count()>0);
  await hub.getByRole('button',{name:'ทั้งหมด',exact:true}).click();
 }
 await hub.getByRole('searchbox').fill('บริษัท');await hub.getByRole('button',{name:'ข้อมูลบริษัท',exact:true}).click();
 await page.getByRole('heading',{name:'ข้อมูลบริษัท',exact:true}).waitFor();
 if(width>=640)await page.getByRole('navigation',{name:'เส้นทางนำทาง'}).getByRole('button',{name:'ไปที่ ตั้งค่าระบบ',exact:true}).click();
 else {await page.locator('button.lg\\:hidden').first().click();await page.getByRole('button',{name:'ตั้งค่าระบบ',exact:true}).filter({visible:true}).click();}
 await hub.getByRole('searchbox').fill('no-match-123');await hub.getByRole('status').filter({hasText:'ไม่พบเมนู'}).waitFor();await hub.getByRole('searchbox').fill('');
 await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();await hub.getByRole('heading',{name:'Settings',exact:true}).waitFor();
 assert.equal(await hub.locator('.crm-category-card').count(),6);await hub.getByRole('button',{name:'Organization',exact:true}).focus();await page.keyboard.press('Enter');
 await hub.getByRole('button',{name:'Company Profile',exact:true}).waitFor();
 assert.deepEqual(errors,[]);await page.close();
}console.log('PASS settings cards: category drill-down, search, no results, breadcrumbs, bilingual, keyboard, desktop/tablet/mobile');}finally{await browser.close();}
