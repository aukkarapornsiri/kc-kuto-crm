import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {openDesktopMenu} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4189/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/เข้าใช้งานโหมดทดลอง|Continue in Demo Mode/i}).click();
 const en=page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true});if(await en.count())await en.click();
 await page.evaluate(async()=>{const {DEMO_RECORDS}=await import('/src/internal-workspace.mjs?v=20261007-contact-popup');DEMO_RECORDS.contacts.push({id:'test-contact',name:'Popup Test Contact',last_name:'Contact',company:'Test Company',phone:'020000000',email:'popup@example.test',status:'active',description:'Test contact note',mailing_city:'Bangkok'});});
 await openDesktopMenu(page,'Contacts','Contact List');
 const details=page.locator('[data-entity="contacts"]').getByRole('button',{name:/^Details/});
 await details.first().click();
 const modal=page.getByRole('dialog',{name:'Contact Detail',exact:true});await modal.waitFor();
 assert.ok((await modal.innerText()).includes('Contact Information'));
 assert.equal(await modal.locator('.kc-lead-info-field').count(),23);
 const box=await modal.boundingBox();assert.ok(Math.abs(box.x+box.width/2-720)<2);
 await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
 await details.first().click();await modal.getByRole('button',{name:'Edit',exact:true}).click();await modal.waitFor({state:'hidden'});
 assert.ok(await page.getByRole('dialog').count());
 await page.getByRole('dialog').getByRole('button',{name:/Cancel/}).click();
 await details.first().click();await modal.waitFor();
 await page.setViewportSize({width:390,height:844});const mobile=await modal.boundingBox();assert.ok(mobile.width<=390);assert.ok(mobile.x>=0);
 await modal.getByRole('button',{name:'Close detail',exact:true}).click();await modal.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log('PASS: contact detail opens, data renders, centered, Escape/close, edit, mobile; no runtime errors');
}finally{await browser.close();}
