import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
  await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
  const openSettings=async()=>{
   if(width<1024)await page.locator('button.lg\\:hidden').first().click();
   await page.getByRole('button',{name:'ตั้งค่าระบบ',exact:true}).filter({visible:true}).click();
  };
  await openSettings();
  assert.equal(await page.locator('.crm-hub-categories').getByRole('button').count(),6);
  const columns=await page.locator('.crm-hub-categories').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns,width===1440?4:1);
  await page.screenshot({path:`test-artifacts/settings-hub-${width}.png`,fullPage:true});
  const groupNames=await page.locator('.crm-hub-categories').getByRole('button').allTextContents();
  for(let index=0;index<groupNames.length;index++){
   await page.locator('.crm-hub-categories').getByRole('button').nth(index).click();
   assert.equal(await page.locator('.crm-settings-hub').getAttribute('data-category'),String(index));
   assert.ok(await page.locator('.crm-settings-card').count()>0);
   await page.getByRole('button',{name:'‹ การตั้งค่าทั้งหมด',exact:true}).click();
  }
  await page.getByRole('searchbox',{name:'ค้นหาเมนูตั้งค่า'}).fill('font');
  await page.getByRole('button',{name:'Design, Font และ UX/UI',exact:false}).click();
  await page.screenshot({path:`test-artifacts/design-${width}.png`,fullPage:true});
  await page.getByLabel('ขนาดตัวอักษร',{exact:true}).selectOption('18');
  await page.getByRole('button',{name:'บันทึก',exact:true}).click();
  await page.getByRole('status').filter({hasText:'บันทึกเฉพาะโหมดทดลอง'}).waitFor();
  assert.equal(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--crm-font-size')),'18px');
  await openSettings();
  await page.getByRole('searchbox',{name:'ค้นหาเมนูตั้งค่า'}).fill('font');
  await page.getByRole('button',{name:'Design, Font และ UX/UI',exact:false}).click();
  assert.equal(await page.getByLabel('ขนาดตัวอักษร',{exact:true}).inputValue(),'18');
  await page.getByLabel('ขนาดตัวอักษร',{exact:true}).selectOption('14');
  await page.getByRole('button',{name:'ยกเลิกการแก้ไข',exact:true}).click();
  assert.equal(await page.getByLabel('ขนาดตัวอักษร',{exact:true}).inputValue(),'18');
  await openSettings();
  await page.getByRole('searchbox',{name:'ค้นหาเมนูตั้งค่า'}).fill('ecosystem');
  await page.getByRole('button',{name:'การเชื่อมโยง KC Ecosystem',exact:false}).click();
  await page.getByLabel('account_tenant_id',{exact:true}).fill('invalid');
  await page.getByRole('button',{name:'บันทึก',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'UUID required'}).waitFor();
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-artifacts/settings-${width}.png`,fullPage:true});
  await page.close();
 }
 console.log('Settings search, design persistence in demo, discard, validation, desktop and mobile passed.');
}finally{await browser.close();}
