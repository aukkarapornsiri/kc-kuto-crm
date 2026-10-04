import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
fs.mkdirSync('test-artifacts',{recursive:true});
try {
 for(const width of [1440,820,390,320]) {
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
  await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
  const header=page.locator('.kc-header-ai');await header.waitFor();
  assert.equal(await page.getByPlaceholder('ค้นหาทั่วระบบ...').count(),0);
  assert.ok(await header.locator('.kc-ai-robot').isVisible());
  assert.ok(await header.getByRole('button',{name:'ส่งคำถาม',exact:true}).isDisabled());
  await header.locator('input').fill('สรุป Pipeline ให้หน่อย');
  const inputStyle=await header.locator('input').evaluate(el=>({outline:getComputedStyle(el).outlineStyle,border:getComputedStyle(el).borderWidth}));
  assert.equal(inputStyle.outline,'none','Focus stays on the outer chat field');
  assert.equal(inputStyle.border,'0px','No nested input border');
  if(width===1440)assert.ok(await header.evaluate(el=>el.getBoundingClientRect().width>=450),'Desktop chat field is wider');
  await header.locator('input').press('Enter');
  await page.getByRole('dialog').waitFor();
  await page.getByRole('alert').filter({hasText:'กรุณาเข้าสู่ระบบจริง'}).waitFor();
  assert.equal(await page.locator('.kc-chat-compose input').inputValue(),'สรุป Pipeline ให้หน่อย');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`test-artifacts/header-ai-chat-open-${width}.png`});
  await page.keyboard.press('Escape');
  assert.ok(await page.getByRole('dialog').isHidden());
  await page.screenshot({path:`test-artifacts/header-ai-chat-${width}.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
 // Exercise the actual component with a controlled API adapter: success, duplicate prevention and retry.
 const page=await browser.newPage();
 await page.route('**/app-C2ITSffc.js*',async route=>{
  const response=await route.fetch();const source=(await response.text()).replace('generate:(...args)=>y2.generate(...args),useApp:Dr','generate:async(question)=>{window.chatCalls=(window.chatCalls||0)+1;await new Promise(resolve=>setTimeout(resolve,200));if(window.chatFail)throw Error("test failure");return "Reply: "+question},useApp:()=>({demoMode:false,session:{user:{id:"test-user"}}})');
  await route.fulfill({response,body:source});
 });
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
 await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
 await page.locator('.kc-header-ai input').fill('Hello');await page.locator('.kc-header-ai input').press('Enter');
 await page.getByText('Reply: Hello',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.chatCalls),1);
 await page.evaluate(()=>window.chatFail=true);await page.locator('.kc-chat-compose input').fill('Retry me');await page.locator('.kc-chat-compose input').press('Enter');
 await page.getByRole('alert').waitFor();assert.equal(await page.locator('.kc-chat-compose input').inputValue(),'Retry me');
 await page.evaluate(()=>window.chatFail=false);await page.locator('.kc-chat-compose input').press('Enter');await page.getByText('Reply: Retry me',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.chatCalls),3);
 await page.close();
 console.log('PASS AI header: desktop/tablet/mobile, demo guard, keyboard, modal and no overflow');
} finally {await browser.close();}
