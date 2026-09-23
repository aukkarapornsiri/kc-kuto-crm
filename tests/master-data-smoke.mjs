import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
  await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
  if(width<1024)await page.locator('button.lg\\:hidden').first().click();
  await page.getByRole('button',{name:'ตั้งค่าระบบ',exact:true}).filter({visible:true}).click();
  await page.getByRole('searchbox',{name:'ค้นหาเมนูตั้งค่า'}).fill('ข้อมูลหลัก');
  await page.getByRole('button',{name:'ข้อมูลหลัก',exact:false}).filter({visible:true}).click();
  const categories=['ประเภทลูกค้า','ประเภทธุรกิจ','แหล่งที่มาของลูกค้า','ขั้นตอนการขาย','หมวดหมู่สินค้า','ภูมิภาค','ระดับ','หน่วย','แท็ก','เหตุผลที่แพ้'];
  for(const [index,category] of categories.entries()){
   await page.getByRole('button',{name:category,exact:true}).click();
   await page.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();
   const form=page.getByRole('form',{name:'แบบฟอร์มข้อมูลหลัก'});
   const code='QA_'+index;
   await form.getByLabel('Code',{exact:true}).fill(code.toLowerCase());
   await form.getByLabel('ชื่อ (ไทย)',{exact:true}).fill('รายการทดสอบ '+index);
   await form.getByLabel('ชื่อ (EN)',{exact:true}).fill('Test item '+index);
   await form.getByRole('button',{name:'บันทึก',exact:true}).click();
   await page.getByRole('status').filter({hasText:'บันทึกเฉพาะโหมดทดลอง'}).waitFor();
   const row=page.getByRole('row').filter({hasText:code});await row.waitFor();
   await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();await row.waitFor();
   assert.equal(await page.locator('tbody tr').count(),1,'category isolation');
   await page.getByRole('button',{name:'แก้ไข '+code,exact:true}).click();
   await form.getByLabel('ชื่อ (EN)',{exact:true}).fill('Updated item '+index);
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
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-artifacts/master-data-${width}.png`,fullPage:true});
  await page.close();
 }
 console.log('PASS: ten categories × desktop/mobile: create, canonical code, reload, category isolation, edit, inactive, duplicate rejection, cancel, search; demo data only.');
}finally{await browser.close();}
