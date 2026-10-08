import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {openThaiSettings} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true,...((process.env.CHROME_PATH||process.env.CHROMIUM_PATH)?{executablePath:(process.env.CHROME_PATH||process.env.CHROMIUM_PATH)}:{})});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
 await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 const open=async name=>{await openThaiSettings(page,width);await page.getByRole('searchbox',{name:'ค้นหาเมนูตั้งค่า'}).fill(name);await page.getByRole('button',{name,exact:true}).click();};
 await open('ข้อมูลบริษัท');
 if(width>=640){
  assert.equal(await page.locator('.crm-breadcrumb').count(),0);
  await openThaiSettings(page,width);
  await page.locator('.crm-category-card').getByText('องค์กร',{exact:true}).click();
  await page.getByRole('button',{name:'กลับไปหน้าตั้งค่าทั้งหมด',exact:true}).waitFor();
  assert.equal(await page.locator('.crm-settings-hub .crm-tabs').count(),0);
  assert.equal(await page.locator('.crm-settings').getByRole('button',{name:'ข้อมูลบริษัท',exact:true}).count(),1);
  assert.equal(await page.locator('.crm-settings').getByRole('button',{name:'ผู้ใช้งาน',exact:true}).count(),0);
  await page.getByRole('button',{name:'กลับไปหน้าตั้งค่าทั้งหมด',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('.crm-category-card').count(),8);
  await page.locator('.crm-category-card').getByText('องค์กร',{exact:true}).click();
  await page.locator('.crm-settings').getByRole('button',{name:'ข้อมูลบริษัท',exact:true}).click();
 }
 await page.getByLabel('ชื่อบริษัท',{exact:true}).fill('บริษัททดสอบ QA');
 await page.getByLabel('เว็บไซต์',{exact:true}).fill('www.kai-com.com');
 await page.getByRole('button',{name:'ที่อยู่บริษัท',exact:true}).click();
 await page.getByLabel('ที่อยู่ภาษาไทย',{exact:true}).fill('ที่อยู่ทดสอบ กรุงเทพ');
 await page.getByRole('button',{name:'บันทึก',exact:true}).click();
 await page.getByRole('status').filter({hasText:'บันทึกเฉพาะโหมดทดลอง'}).waitFor();
 await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();
 assert.equal(await page.getByLabel('ที่อยู่ภาษาไทย',{exact:true}).inputValue(),'ที่อยู่ทดสอบ กรุงเทพ');await page.getByRole('button',{name:'ข้อมูลทั่วไป',exact:true}).click();assert.equal(await page.getByLabel('เว็บไซต์',{exact:true}).inputValue(),'https://www.kai-com.com');
 await page.getByRole('button',{name:'ผู้ติดต่อ',exact:true}).filter({visible:true}).last().click();
 await page.getByLabel('ชื่อผู้ติดต่อ',{exact:true}).fill('QA Contact');
 await page.getByRole('button',{name:'บันทึก',exact:true}).click();
 await page.getByRole('status').filter({hasText:'บันทึกเฉพาะโหมดทดลอง'}).waitFor();
 await page.getByRole('button',{name:'โซเชียลมีเดีย',exact:true}).click();await page.getByLabel('LINE ID / ลิงก์',{exact:true}).fill('@kaicom');await page.getByRole('button',{name:'บันทึก',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกเฉพาะโหมดทดลอง'}).waitFor();await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();assert.equal(await page.getByLabel('LINE ID / ลิงก์',{exact:true}).inputValue(),'@kaicom');
 await page.getByRole('button',{name:'ติดต่อฝ่ายขาย',exact:true}).click();for(const [label,value] of [['ชื่อฝ่ายขาย','Sales QA'],['โทรศัพท์ฝ่ายขาย','021234567'],['อีเมลฝ่ายขาย','sales@example.test'],['LINE ฝ่ายขาย','@kaicom']])await page.getByLabel(label,{exact:true}).fill(value);await page.getByRole('button',{name:'บันทึก',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกเฉพาะโหมดทดลอง'}).waitFor();await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();assert.equal(await page.getByLabel('LINE ฝ่ายขาย',{exact:true}).inputValue(),'@kaicom');
 await open('ทีมงานและแผนก');await page.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();
 await page.getByLabel('ชื่อทีมภาษาไทย',{exact:true}).fill('ทีม QA');await page.getByLabel('ชื่อทีมภาษาอังกฤษ',{exact:true}).fill('QA Team');
 await page.getByLabel('แผนก',{exact:true}).fill('Sales');await page.getByRole('button',{name:'บันทึก',exact:true}).click();
 await page.getByRole('button',{name:'แก้ไข ทีม QA',exact:true}).click();await page.getByLabel('ใช้งานอยู่',{exact:true}).uncheck();await page.getByRole('button',{name:'บันทึก',exact:true}).click();
 await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();await page.getByRole('button',{name:'แก้ไข ทีม QA',exact:true}).click();assert.equal(await page.getByLabel('ใช้งานอยู่',{exact:true}).isChecked(),false);await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await open('บทบาทและสิทธิ์');assert.equal(await page.getByRole('tab').count(),5);await page.getByRole('tab',{name:'บทบาทและสิทธิ์',exact:true}).click();assert.equal(await page.getByLabel('customers view',{exact:true}).isEnabled(),true);await page.getByRole('button',{name:'+ สร้างบทบาท',exact:true}).click();
 await page.getByLabel('รหัสบทบาท',{exact:true}).fill('qa_role');await page.getByLabel('ชื่อภาษาไทย',{exact:true}).fill('บทบาท QA');await page.getByLabel('ชื่อภาษาอังกฤษ',{exact:true}).fill('QA role');await page.getByRole('button',{name:'บันทึก',exact:true}).click();
 await page.getByLabel('เลือกบทบาท',{exact:true}).selectOption('qa_role');await page.getByLabel('customers view',{exact:true}).check();await page.getByLabel('เลือกบทบาท',{exact:true}).selectOption('sales_user');await page.getByRole('alert').filter({hasText:'ยังไม่บันทึก'}).waitFor();await page.getByRole('button',{name:'แก้ไขต่อ',exact:true}).click();assert.equal(await page.getByLabel('เลือกบทบาท',{exact:true}).inputValue(),'qa_role');await page.getByRole('button',{name:'บันทึกสิทธิ์',exact:true}).click();await page.getByRole('button',{name:'โหลดสิทธิ์ใหม่',exact:true}).click();assert.equal(await page.getByLabel('customers view',{exact:true}).isChecked(),true);
 await page.getByRole('tab',{name:'การมองเห็นแดชบอร์ด',exact:true}).click();await page.getByRole('tabpanel').filter({visible:true}).getByLabel('เลือกบทบาท',{exact:true}).selectOption('qa_role');
 await page.getByLabel('my visible',{exact:true}).check();await page.getByLabel('my default',{exact:true}).check();await page.getByRole('button',{name:'บันทึกสิทธิ์แดชบอร์ด',exact:true}).click();await page.getByRole('button',{name:'โหลดแดชบอร์ดใหม่',exact:true}).click();assert.equal(await page.getByLabel('my default',{exact:true}).isChecked(),true);
 await open('การนำเข้า/ส่งออก');await page.getByLabel('เลือกไฟล์ CSV',{exact:true}).setInputFiles({name:'customers.csv',mimeType:'text/csv',buffer:Buffer.from('name,email\nQA Customer,qa@example.test')});await page.getByRole('button',{name:'ยืนยันนำเข้า',exact:true}).click();await page.getByRole('status').filter({hasText:'นำเข้าเฉพาะโหมดทดลอง 1'}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'ส่งออกข้อมูล CSV',exact:true}).click();const file=await download;assert.equal(file.suggestedFilename(),'customers.csv');
 await page.getByLabel('เลือกไฟล์ CSV',{exact:true}).setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('name,role\nQA,admin')});await page.getByRole('alert').filter({hasText:'Unknown or duplicate columns'}).waitFor();assert.equal(await page.getByRole('button',{name:'ยืนยันนำเข้า',exact:true}).count(),0);
 for(const menu of ['ผู้ใช้งาน','Workflow การอนุมัติ','การแจ้งเตือน','ประวัติการใช้งานระบบ','ความปลอดภัย','ตั้งค่า AI']){await open(menu);await page.getByRole('heading',{level:1}).waitFor();}
 await open('ตั้งค่าภาษา');await page.getByRole('button',{name:'ใช้ภาษาอังกฤษตอนนี้',exact:true}).click();await page.getByRole('button',{name:'Switch to Thai',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Switch to Thai',exact:true}).waitFor();await page.getByRole('button',{name:'Switch to Thai',exact:true}).click();await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).waitFor();
 const weights=await page.locator('body').evaluate(()=>Array.from(document.querySelectorAll('nav button')).filter(e=>!e.closest('.kc-primary-rail,.kc-context-bar')).map(e=>getComputedStyle(e).fontWeight));assert.ok(weights.every(x=>x==='400'));
 assert.deepEqual(errors,[]);await page.screenshot({path:`test-artifacts/settings-workspace-${width}.png`,fullPage:true});await page.close();
}console.log('PASS settings company/team/role persistence, import preview/export, validation, all rebuilt routes, language reload and globe, regular typography; desktop/mobile');}finally{await browser.close();}
