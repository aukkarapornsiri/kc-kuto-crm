import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 const open=async()=>{await page.getByRole('button',{name:'ปรับพื้นที่ทำงานของฉัน',exact:true}).click();await page.getByRole('button',{name:'โหลดค่าส่วนตัวใหม่',exact:true}).waitFor();await page.getByLabel('ใช้สีส่วนตัว',{exact:true}).waitFor();};
 await open();await page.getByLabel('ใช้สีส่วนตัว',{exact:true}).check();assert.equal(await page.locator('.crm-preset-grid button').count(),11);
 await page.getByRole('button',{name:'Clear Sky',exact:true}).click();
 await page.getByLabel('พื้นกล่อง',{exact:true}).fill('#FFF4E8');await page.getByLabel('เส้นกรอบ',{exact:true}).fill('#CC8844');
 await page.getByLabel('ความโค้งของกล่อง',{exact:true}).selectOption('24');await page.getByLabel('มิติและเงา',{exact:true}).selectOption('raised');
 await page.getByRole('button',{name:'บันทึกพื้นที่ทำงานส่วนตัว',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกสีส่วนตัว'}).waitFor();
 const snapshot=()=>page.locator('html').evaluate(el=>Object.fromEntries(['primary','surface','border','radius','shadow'].map(k=>[k,el.style.getPropertyValue('--crm-'+k)])));
 const saved=await snapshot();assert.equal(saved.primary,'#6E9DBD');assert.equal(saved.surface,'#FFF4E8');assert.equal(saved.border,'#CC8844');assert.equal(saved.radius,'24px');assert.match(saved.shadow,/24px/);
 const card=await page.locator('.crm-personal-workspace').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderRadius,shadow:getComputedStyle(el).boxShadow}));assert.equal(card.bg,'rgb(255, 244, 232)');assert.equal(card.radius,'24px');assert.notEqual(card.shadow,'none');
 await page.getByRole('button',{name:'Indigo',exact:true}).click();await page.getByRole('button',{name:'ยกเลิกสีส่วนตัวที่แก้ไข',exact:true}).click();assert.equal(await page.getByLabel('สีหลักและปุ่ม',{exact:true}).inputValue(),'#6E9DBD');
 await page.getByLabel('เส้นกรอบ',{exact:true}).fill('bad');await page.getByRole('button',{name:'บันทึกพื้นที่ทำงานส่วนตัว',exact:true}).click();await page.getByRole('alert').waitFor();assert.deepEqual(await snapshot(),saved);
 await page.getByRole('button',{name:'ยกเลิกสีส่วนตัวที่แก้ไข',exact:true}).click();await page.screenshot({path:`test-artifacts/workspace-theme-${width}.png`,fullPage:true});
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.getByRole('dialog').count(),0);
 await page.reload();await open();assert.equal(await page.getByLabel('ใช้สีส่วนตัว',{exact:true}).isChecked(),true);assert.equal(await page.getByLabel('พื้นกล่อง',{exact:true}).inputValue(),'#FFF4E8');assert.deepEqual(await snapshot(),saved);
 await page.getByRole('button',{name:'คืนค่าตามบริษัท',exact:true}).click();await page.getByRole('button',{name:'บันทึกพื้นที่ทำงานส่วนตัว',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกสีส่วนตัว'}).waitFor();assert.equal(await page.locator('html').getAttribute('data-crm-personal'),null);
 await page.reload();await open();assert.equal(await page.getByLabel('ใช้สีส่วนตัว',{exact:true}).isChecked(),false);assert.equal(await page.locator('html').getAttribute('data-crm-personal'),null);
 assert.deepEqual(errors,[]);await page.close();
}console.log('PASS personal themes: 11 presets, custom colors, radius/shadow, rendered styles, discard, invalid input, reload persistence, restore company, desktop/mobile');}finally{await browser.close();}
