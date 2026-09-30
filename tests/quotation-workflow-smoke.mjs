import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {openDesktopMenu} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
 await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();
 const open=async(parent,child)=>{if(width>=1024)return openDesktopMenu(page,parent,child);await page.locator('button.lg\\:hidden').first().click();const nav=page.locator('div.fixed.top-0.left-0.h-full.w-64.lg\\:hidden');if(!await nav.getByText(parent,{exact:true}).isVisible())await nav.getByRole('button',{name:'Sales',exact:true}).click();if(!await nav.getByText(child,{exact:true}).isVisible())await nav.getByText(parent,{exact:true}).click();await nav.getByText(child,{exact:true}).click();};
 const root=entity=>page.locator(`[data-entity="${entity}"]`),detail=entity=>root(entity).getByRole('region',{name:'Record details'});
 for(const [entity,parent,child,name,label] of [['customers','Accounts','Account List','QA/E2E Account','Account Name'],['contacts','Contacts','Contact List','QA/E2E Contact','Last Name'],['opportunities','Opportunities','Pipeline Kanban','QA/E2E Opportunity','name']]){
  await open(parent,child);await root(entity).getByRole('button',{name:entity==='customers'?'Create Account':entity==='contacts'?'Create Contact':'Add record',exact:true}).click();
  const form=root(entity).getByRole('form',{name:entity==='customers'?'Customer form':'Record form'});await form.getByLabel(label,{exact:true}).fill(name);
  if(entity==='customers'){await form.getByLabel('Billing Street',{exact:true}).fill('QA/E2E Bangkok address');}
  else await form.getByLabel(entity==='contacts'?'Account':'customer id',{exact:true}).selectOption({label:'QA/E2E Account'});
  if(entity==='opportunities')await form.getByLabel('contact id',{exact:true}).selectOption({label:'QA/E2E Contact'});
  await form.getByRole('button',{name:'Save',exact:true}).click();await detail(entity).waitFor();
 }
 await open('Quotations','Quotation List');await root('quotations').getByRole('button',{name:'Add record',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Quotation',exact:true}),form=dialog.getByRole('form',{name:'Record form'});
 await dialog.waitFor();assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
 await form.getByLabel('Customer',{exact:true}).selectOption({label:'QA/E2E Account'});
 assert.equal(await form.getByLabel('Customer address',{exact:true}).inputValue(),'QA/E2E Bangkok address');
 await form.getByLabel('Contact',{exact:true}).selectOption({label:'QA/E2E Contact'});
 await form.getByLabel('Opportunity',{exact:true}).selectOption({label:'QA/E2E Opportunity'});
 await form.getByLabel('name 1',{exact:true}).fill('QA/E2E service');await form.getByLabel('qty 1',{exact:true}).fill('2');await form.getByLabel('price 1',{exact:true}).fill('100');await form.getByLabel('discount 1',{exact:true}).fill('10');
 await form.getByLabel('VAT (%)',{exact:true}).fill('10');await form.getByLabel('WHT (%)',{exact:true}).fill('3');
 await form.getByLabel('Notes',{exact:true}).fill('QA/E2E quotation terms');
 await form.getByLabel('Prepared by',{exact:true}).fill('QA/E2E Sales');
 await form.getByLabel('Credit term (days)',{exact:true}).fill('45');
 assert.ok((await dialog.innerText()).includes('203.30 THB'));
 await dialog.screenshot({path:`test-artifacts/quotation-popup-${width}.png`});
 assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog must not overflow horizontally');
 await form.getByRole('button',{name:'Save',exact:true}).click();await detail('quotations').waitFor();
 const print=page.locator('#crm-quotation-print');assert.ok((await print.innerText()).includes('203.30 THB'));
 for(const [button,entity] of [['Open Contact','contacts'],['Open Opportunity','opportunities'],['Open Account','customers']]){
  await detail('quotations').getByRole('button',{name:button,exact:true}).click();await detail(entity).waitFor();
  const linked=detail(entity).getByRole('heading',{name:'Quotations (1)',exact:true}).locator('..');await linked.getByRole('button').click();await detail('quotations').waitFor();
 }
 await detail('quotations').getByRole('button',{name:'Edit',exact:true}).click();assert.equal(await form.getByLabel('WHT (%)',{exact:true}).inputValue(),'3');
 await form.getByLabel('WHT (%)',{exact:true}).fill('5');await form.getByRole('button',{name:'Save',exact:true}).click();
 await root('quotations').getByRole('button',{name:'Reload',exact:true}).click();assert.ok((await print.innerText()).includes('199.50 THB'));
 assert.equal(await detail('quotations').getByRole('link',{name:'Open quotations in KC Account 360'}).getAttribute('href'),'https://kc-account-360-preview.saelim-m.chatgpt.site/?page=ar');
 await print.screenshot({path:`test-artifacts/quotation-preview-${width}.png`});
 if(width===1440)await page.pdf({path:'test-artifacts/QA-E2E-quotation.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
 await detail('quotations').getByRole('button',{name:'Edit',exact:true}).click();await form.getByLabel('Notes',{exact:true}).fill('UNSAVED');await page.keyboard.press('Escape');await detail('quotations').waitFor({state:'hidden'}).catch(()=>{});
 await root('quotations').getByRole('button',{name:/^Details /}).first().click();assert.ok(!(await print.innerText()).includes('UNSAVED'));
 assert.deepEqual(errors,[]);console.log(`PASS ${width}px: QA/E2E customer-contact-opportunity-quotation links, modal, VAT/WHT, edit/readback, preview/PDF, cancel and Account 360 route (demo UI; database verified separately)`);await page.close();
}}finally{await browser.close();}
