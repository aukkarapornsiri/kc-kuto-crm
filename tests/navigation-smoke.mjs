import {chromium} from 'playwright';import assert from 'node:assert/strict';
import {openDesktopMenu,railLabels} from './menu-helper.mjs';
const modules=['Dashboard','Leads','Accounts','Contacts','Opportunities','Quotations','Contracts & Renewal','Assets / Installed Base','Tickets / Service Desk','Activities','Documents','Reports & Analytics','AI Insights','Settings'];
const entryPages={'Leads':'Lead Inbox','Accounts':'Account List','Contacts':'Contact List','Opportunities':'Pipeline Kanban','Quotations':'Quotation List','Contracts & Renewal':'All Contracts','Assets / Installed Base':'All Assets','Tickets / Service Desk':'All Tickets','Activities':'My Activities','Documents':'All Documents','AI Insights':'AI Customer Summary'};
const groupFor={Opportunities:'Sales',Quotations:'Sales','Contracts & Renewal':'Sales','Assets / Installed Base':'Service','Tickets / Service Desk':'Service','Reports & Analytics':'Analytics','AI Insights':'Analytics'};
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Breadcrumb',exact:true});let checked=0;
 const firstSidebar=page.locator(width<1024?'div.fixed.top-0.left-0.h-full.w-64.lg\\:hidden':'#crm-desktop-sidebar');
 if(width<1024)await page.locator('button.lg\\:hidden').first().click();
 assert.deepEqual(width<1024?await firstSidebar.locator('nav > div > button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')||node.querySelector('span')?.textContent?.trim())):await firstSidebar.getByRole('navigation',{name:'Primary navigation'}).getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))),width<1024?['Dashboard','Leads','Contacts','Accounts','Sales','Service','Activities','Documents','Analytics','Settings']:railLabels);
 if(width<1024)await page.mouse.click(width-5,500);
 for(const name of modules){
  if(width>=1024)await openDesktopMenu(page,name,entryPages[name]);
  else{
   await page.locator('button.lg\\:hidden').first().click();
   const sidebar=page.locator('div.fixed.top-0.left-0.h-full.w-64.lg\\:hidden').first();
   if(groupFor[name]&&!await sidebar.getByText(name,{exact:true}).isVisible())await sidebar.getByRole('button',{name:groupFor[name],exact:true}).click();
   await sidebar.getByText(name,{exact:true}).click();
   if(entryPages[name])await sidebar.getByText(entryPages[name],{exact:true}).click();
  }
  assert.equal(await nav.isVisible(),true);
  await nav.getByRole('button',{name:'Go to '+name,exact:true}).click();
  const initial=(await nav.locator('[aria-current="page"]').textContent()).trim();
  assert.ok(initial.length>0);
  assert.equal(await nav.locator('button[aria-current="page"], [aria-expanded], .crm-crumb-pages').count(),0);
  assert.equal(await nav.locator('[aria-current="page"]').evaluate(el=>el.tagName),'SPAN');
  checked++;
 }
 assert.equal(checked,modules.length);assert.deepEqual(errors,[]);
 console.log('PASS '+width+'px: all 14 modules accessible, duplicate dropdown absent, current page labels and module home links preserved');
 await page.screenshot({path:`test-artifacts/navigation-${width}.png`,fullPage:true});await page.close();
}}finally{await browser.close();}

