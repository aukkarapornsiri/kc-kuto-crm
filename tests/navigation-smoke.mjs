import {chromium} from 'playwright';import assert from 'node:assert/strict';
const modules=['Dashboard','Leads','Customers','Contacts','Opportunities','Quotations','Contracts & Renewal','Assets / Installed Base','Tickets / Service Desk','Activities','Documents','Reports & Analytics','AI Insights','Settings'];
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Breadcrumb',exact:true});let checked=0;
 for(const name of modules){
  if(width<1024)await page.locator('button.lg\\:hidden').first().click();
  const sidebar=page.locator(width<1024?'div.fixed.top-0.left-0.h-full.w-64.lg\\:hidden':'div.hidden.lg\\:flex.w-64').first();
  await sidebar.getByText(name,{exact:true}).click();
  assert.equal(await nav.isVisible(),true);
  await nav.getByRole('button',{name:'Go to '+name,exact:true}).click();
  const initial=(await nav.locator('[aria-current="page"]').textContent()).trim();
  if(await nav.getByRole('button',{name:'Choose page: '+initial,exact:true}).count()){
   await nav.getByRole('button',{name:'Choose page: '+initial,exact:true}).click();
   const choices=await page.getByRole('group',{name:'Pages in this module',exact:true}).getByRole('button').allTextContents();
   await page.keyboard.press('Escape');await page.getByRole('group',{name:'Pages in this module',exact:true}).waitFor({state:'hidden'});
   for(const target of choices.filter(x=>x!=='Settings center')){
    await nav.getByRole('button',{name:'Choose page: '+initial,exact:true}).click();
    await page.getByRole('group',{name:'Pages in this module',exact:true}).getByRole('button',{name:target,exact:true}).click();
    assert.equal((await nav.locator('[aria-current="page"]').textContent()).trim(),target);
    const parent=nav.getByRole('button',{name:/^Go to category /});
    if(await parent.count()){await parent.click();if(name==='Settings')assert.equal(await page.locator('.crm-tabs button[aria-pressed="true"]').count(),1);}
    await nav.getByRole('button',{name:'Go to '+name,exact:true}).click();
    assert.equal((await nav.locator('[aria-current="page"]').textContent()).trim(),initial);checked++;
   }
  }
 }
 assert.ok(checked>100,`Expected full registered navigation coverage, got ${checked}`);assert.deepEqual(errors,[]);
 console.log(`PASS ${width}px: ${modules.length} modules and ${checked} page choices, parent links, category links, Escape, return to module home`);
 await page.screenshot({path:`test-artifacts/navigation-${width}.png`,fullPage:true});await page.close();
}}finally{await browser.close();}
