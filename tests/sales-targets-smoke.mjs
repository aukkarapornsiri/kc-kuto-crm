import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {openThaiSettings} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true});
try { for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
 await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 await openThaiSettings(page,width);
 await page.getByRole('searchbox',{name:'ค้นหาเมนูตั้งค่า'}).fill('เป้ายอดขาย');
 await page.getByRole('button',{name:'เป้ายอดขาย',exact:true}).click();
 await page.getByLabel('ปีเป้าหมาย (ค.ศ.)',{exact:true}).fill('2026');
 await page.getByRole('button',{name:'โหลดปีที่เลือก',exact:true}).click();
 await page.getByLabel('เดือนเริ่มเป้าบริษัท',{exact:true}).fill('2026-04');
 await page.getByLabel('เดือนสิ้นสุดเป้าบริษัท',{exact:true}).fill('2027-03');
 await page.getByLabel('เป้าบริษัทรวม (บาท)',{exact:true}).fill('1200.01');
 await page.getByLabel('เป้ารวม Demo User',{exact:true}).fill('300.01');
 await page.getByLabel('เดือนสิ้นสุด Demo User',{exact:true}).fill('2026-06');
 await page.getByRole('button',{name:'บันทึกเป้ายอดขาย',exact:true}).click();
 await page.getByRole('status').filter({hasText:'บันทึกในโหมดทดลองแล้ว'}).waitFor();
 await page.getByRole('button',{name:'โหลดปีที่เลือก',exact:true}).click();
 assert.equal(await page.getByLabel('เดือนสิ้นสุดเป้าบริษัท',{exact:true}).inputValue(),'2027-03');
 assert.equal(await page.getByLabel('เป้ารวม Demo User',{exact:true}).inputValue(),'300.01');
 await page.screenshot({path:`test-artifacts/sales-target-settings-${width}.png`,fullPage:true});
 if(width>=1024) {
  await page.getByRole('navigation',{name:'หมวดหลัก'}).getByRole('button',{name:'หน้าหลัก',exact:true}).click();
  await page.locator('.crm-target-kpis article').first().getByText('300.01',{exact:true}).waitFor();
  await page.getByRole('navigation',{name:'หมวดหลัก'}).getByRole('button',{name:'วิเคราะห์',exact:true}).click();
 } else {
  await page.locator('button.lg\\:hidden').first().click();
  await page.getByRole('button',{name:'รายงานและการวิเคราะห์',exact:true}).filter({visible:true}).click();
 }
 await page.getByRole('button',{name:'รายงานเป้ายอดขาย',exact:true}).click();
 await page.getByLabel('ปีเป้าหมาย (ค.ศ.)',{exact:true}).fill('2026');
 await page.locator('.crm-target-kpis article').first().getByText('1,200.01',{exact:true}).waitFor();
 await page.getByLabel('ตั้งแต่เดือน',{exact:true}).fill('2027-03');
 await page.locator('.crm-target-kpis article').first().getByText('100.01',{exact:true}).waitFor();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'ส่งออกเป้าและยอดจริง CSV',exact:true}).click();
 assert.match((await download).suggestedFilename(),/^sales-target-2026-company\.csv$/);
 assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1));
 assert.deepEqual(errors,[]);
 await page.screenshot({path:`test-artifacts/sales-target-report-${width}.png`,fullPage:true});
 await page.close();
 } console.log('PASS sales target save/readback, cross-year months, Dashboard/report integration, monthly rounding, CSV, desktop/mobile');
} finally { await browser.close(); }
