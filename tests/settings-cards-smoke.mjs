import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {openThaiSettings} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{for(const width of [1555,820,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
 await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 await openThaiSettings(page,width);
 const hub=page.locator('.crm-settings-hub');await hub.waitFor();
 assert.equal(await hub.locator('.crm-category-card').count(),8);
 assert.equal(await hub.locator('.crm-hub-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>1199?4:width>600?2:1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:`test-artifacts/settings-cards-${width}.png`,fullPage:true});
 for(const name of await hub.locator('.crm-category-title').allTextContents()){
  await hub.getByRole('button',{name,exact:true}).click();
  if(name==='สินค้าและคลัง'){await page.locator('.crm-inventory').waitFor();assert.equal(await hub.count(),0);await page.screenshot({path:`test-artifacts/settings-inventory-${width}.png`,fullPage:true});}
  else {assert.ok(await hub.locator('.crm-settings-card').count()>0);assert.equal(await hub.getByRole('searchbox').count(),0);assert.equal(await hub.locator('.crm-tabs').count(),0);assert.equal(await hub.getByText('จัดการข้อมูลธุรกิจและการใช้งานของคุณ',{exact:true}).count(),0);if(name==='องค์กร')await page.screenshot({path:`test-artifacts/settings-category-${width}.png`,fullPage:true});}
  await page.getByRole('button',{name:'กลับไปหน้าตั้งค่าทั้งหมด',exact:true}).click();await hub.waitFor();
 }
 await hub.getByRole('searchbox').fill('ใบเสนอราคา');await hub.getByRole('button',{name:'ตั้งค่าใบเสนอราคา',exact:true}).click();
 const quoteSettings=page.getByRole('dialog',{name:'ตั้งค่าแม่แบบใบเสนอราคา'});await quoteSettings.waitFor();await quoteSettings.getByRole('button',{name:'ปิด',exact:true}).click();await quoteSettings.waitFor({state:'hidden'});
 await openThaiSettings(page,width);await hub.waitFor();
 await hub.getByRole('searchbox').fill('บริษัท');await hub.getByRole('button',{name:'ข้อมูลบริษัท',exact:true}).click();
 await page.getByRole('heading',{name:'ข้อมูลบริษัท',exact:true}).waitFor();
 await page.getByRole('button',{name:'กลับไปหน้าตั้งค่าทั้งหมด',exact:true}).waitFor();
 await openThaiSettings(page,width);
 await hub.getByRole('searchbox').fill('no-match-123');await hub.getByRole('status').filter({hasText:'ไม่พบเมนู'}).waitFor();await hub.getByRole('searchbox').fill('');
 await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();await hub.getByRole('heading',{name:'Settings',exact:true}).waitFor();
 assert.equal(await hub.locator('.crm-category-card').count(),8);await hub.getByRole('button',{name:'Organization',exact:true}).focus();await page.keyboard.press('Enter');
 await hub.getByRole('button',{name:'Company Profile',exact:true}).waitFor();
 assert.deepEqual(errors,[]);await page.close();
}console.log('PASS settings cards: category drill-down, search, no results, return navigation, bilingual, keyboard, desktop/tablet/mobile');}finally{await browser.close();}
