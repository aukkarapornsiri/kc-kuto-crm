import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {openDesktopMenu} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--single-process']}: {})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4175/');await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();
 await page.getByRole('button',{name:'User profile',exact:true}).click();await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'My profile',exact:true});
 for(const [label,value] of Object.entries({'First name':'Profile','Last name':'Tester','Company / Organization':'QA Company','Phone':'021234567','Position':'Director','Employee code':'06001','Contact email':'contact@example.test','LINE ID':'qa-line'}))await dialog.getByLabel(label,{exact:true}).fill(value);
 await dialog.getByLabel('Department',{exact:true}).selectOption('ฝ่ายบริหาร');assert.ok(await dialog.getByLabel('Account email',{exact:true}).getAttribute('readonly')!==null);
 if(process.env.PROFILE_SCREENSHOT)await dialog.screenshot({path:process.env.PROFILE_SCREENSHOT});
 await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'User profile',exact:true}).click();await page.getByRole('button',{name:'Edit profile',exact:true}).click();assert.equal(await dialog.getByLabel('Employee code',{exact:true}).inputValue(),'06001');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await openDesktopMenu(page,'Quotations','Quotation List');await page.getByRole('button',{name:'Add record',exact:true}).click();
 const form=page.getByRole('form',{name:'Quotation form',exact:true});await page.waitForFunction(()=>document.querySelector('input[aria-label="Prepared by"]')?.value==='Profile Tester');
 assert.equal(await form.getByLabel('Prepared email',{exact:true}).inputValue(),'contact@example.test');assert.equal(await form.getByLabel('Prepared phone',{exact:true}).inputValue(),'021234567');assert.equal(await form.getByLabel('Preparer: Employee code',{exact:true}).inputValue(),'06001');assert.equal(await form.getByLabel('Preparer: Company / Organization',{exact:true}).inputValue(),'QA Company');assert.equal(await form.getByLabel('Sales LINE',{exact:true}).inputValue(),'qa-line');
 await form.getByRole('button',{name:'Preview',exact:true}).click();assert.match(await form.locator('.kc-quotation-preview').innerText(),/contact@example.test/);assert.match(await form.locator('.kc-quotation-preview').innerText(),/06001/);assert.match(await form.locator('.kc-quotation-preview').innerText(),/qa-line/);
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 for(const parent of ['Documents','Contracts & Renewal']){await openDesktopMenu(page,parent);await page.getByRole('button',{name:'Add record',exact:true}).click();const record=page.getByRole('form',{name:'Record form',exact:true});assert.equal(await record.getByLabel('Preparer: Contact email',{exact:true}).inputValue(),'contact@example.test');await record.getByRole('button',{name:'Cancel',exact:true}).click();}
 await openDesktopMenu(page,'Tickets / Service Desk','Service Overview');await page.getByRole('button',{name:'+ สร้างเคส / Create case',exact:true}).click();const ticket=page.getByRole('dialog',{name:'สร้างเคส / Create case',exact:true});assert.equal(await ticket.getByLabel('Preparer: Employee code',{exact:true}).inputValue(),'06001');assert.equal(await ticket.getByLabel('Preparer: Contact email',{exact:true}).inputValue(),'contact@example.test');
 await ticket.getByLabel('Subject',{exact:true}).fill('Profile defaults service check');await ticket.getByLabel('Customer',{exact:true}).selectOption('demo-service-customer-1');await ticket.getByRole('button',{name:'บันทึก / Save',exact:true}).click();await ticket.waitFor({state:'hidden'});
 const saved=await page.evaluate(async()=>{const {DEMO_RECORDS}=await import('/src/internal-workspace.mjs?v=20261007-profile');return DEMO_RECORDS.tickets.find(row=>row.subject==='Profile defaults service check');});assert.equal(saved.document_profile.email,'contact@example.test');assert.equal(saved.document_profile.employee_code,'06001');
 assert.deepEqual(errors,[]);console.log('PASS profile editing, reopen, quotation defaults and preview; no browser errors');
}finally{await browser.close();}
