import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {openThaiSettings} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
  await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
  await openThaiSettings(page,width);
  await page.getByRole('searchbox',{name:'ค้นหาเมนูตั้งค่า'}).fill('ข้อมูลหลัก');
  await page.getByRole('button',{name:'ข้อมูลหลัก',exact:false}).filter({visible:true}).click();
  const categories=['ประเภทลูกค้า','ประเภทธุรกิจ','แหล่งที่มาของลูกค้า','ขั้นตอนการขาย','หมวดหมู่สินค้า','ภูมิภาค','ระดับ','หน่วย','แท็ก','เหตุผลที่แพ้','ประเภทสินทรัพย์','ยี่ห้อสินทรัพย์','รุ่นสินทรัพย์','สถานะสินทรัพย์','สถานะประกัน','สถานะไลเซนส์','ที่ตั้งสินทรัพย์'];
  for(const [index,category] of categories.entries()){
   await page.getByRole('button',{name:category,exact:true}).click();
   await page.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();
   const form=page.getByRole('form',{name:'แบบฟอร์มข้อมูลหลัก'});await page.getByRole('dialog',{name:'จัดการข้อมูลหลัก'}).waitFor();assert.ok(await page.locator('.crm-master-dialog').evaluate(el=>el.open));
   const code='QA_'+index;
   await form.getByLabel('Code',{exact:true}).fill(code.toLowerCase());
   await form.getByLabel('ชื่อ (ไทย)',{exact:true}).fill('รายการทดสอบ '+index);
   await form.getByLabel('ชื่อ (EN)',{exact:true}).fill('Test item '+index);await form.getByLabel('รายละเอียด',{exact:true}).fill('รายละเอียด '+index);if(index===4||index===11)await page.screenshot({path:`test-artifacts/master-popup-${index}-${width}.png`,fullPage:true});
   await form.getByRole('button',{name:'บันทึก',exact:true}).click();
   await page.getByRole('status').filter({hasText:'บันทึกเฉพาะโหมดทดลอง'}).waitFor();
   const row=page.getByRole('row').filter({hasText:code});await row.waitFor();
   await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();await row.waitFor();
   assert.equal(await page.getByRole('row').filter({hasText:/QA_/}).count(),1,'category isolation');
   await page.getByRole('button',{name:'แก้ไข '+code,exact:true}).click();
   assert.equal(await form.getByLabel('รายละเอียด',{exact:true}).inputValue(),'รายละเอียด '+index);await form.getByLabel('ชื่อ (EN)',{exact:true}).fill('Updated item '+index);
   await form.getByLabel('สถานะ',{exact:true}).selectOption('inactive');
   await form.getByRole('button',{name:'บันทึก',exact:true}).click();
   await row.filter({hasText:'Updated item '+index}).waitFor();
   await row.filter({hasText:'ปิดใช้งาน'}).waitFor();
   await page.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();
   await form.getByLabel('Code',{exact:true}).fill(code);
   await form.getByLabel('ชื่อ (ไทย)',{exact:true}).fill('ซ้ำ');await form.getByLabel('ชื่อ (EN)',{exact:true}).fill('Duplicate');
   await form.getByRole('button',{name:'บันทึก',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Code ซ้ำ'}).waitFor();
   await form.getByRole('button',{name:'ยกเลิก',exact:true}).click();
   await page.getByRole('searchbox',{name:'ค้นหาข้อมูลหลัก'}).fill('not-found');
   await page.getByRole('cell',{name:'ไม่พบรายการ',exact:true}).waitFor();
   await page.getByRole('searchbox',{name:'ค้นหาข้อมูลหลัก'}).fill('');
  }
  await page.getByRole('button',{name:'หมวดหมู่สินค้า',exact:true}).click();await page.getByRole('button',{name:'แก้ไข PC',exact:true}).click();const categoryForm=page.getByRole('form',{name:'แบบฟอร์มข้อมูลหลัก'});assert.ok(await categoryForm.getByLabel('บัญชีรายได้',{exact:true}).inputValue());await categoryForm.getByLabel('รายละเอียด',{exact:true}).fill('ข้อมูลหมวดตามภาพ');await categoryForm.getByRole('button',{name:'บันทึก',exact:true}).click();await page.getByRole('button',{name:'แก้ไข PC',exact:true}).click();assert.equal(await categoryForm.getByLabel('รายละเอียด',{exact:true}).inputValue(),'ข้อมูลหมวดตามภาพ');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('button',{name:'ยี่ห้อสินทรัพย์',exact:true}).click();await page.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();await categoryForm.getByLabel('ชื่อ (ไทย)',{exact:true}).fill('แบรนด์ตัวอย่างใหม่');await categoryForm.getByRole('button',{name:'บันทึก',exact:true}).click();await page.getByRole('row').filter({hasText:'แบรนด์ตัวอย่างใหม่'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-artifacts/master-data-${width}.png`,fullPage:true});
  await page.close();
 }
 console.log('PASS: master popup, auto code, optional English, descriptions, category account links, Escape and reference categories × desktop/mobile: create, canonical code, reload, category isolation, edit, inactive, duplicate rejection, cancel, search; demo data only.');
}finally{await browser.close();}
