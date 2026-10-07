import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 for(const [width,height] of [[1736,800],[1440,720],[1280,650],[1024,650],[390,800]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
  await page.locator('.kc-login-shell').waitFor();
  const controls=[
   page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}),
   page.getByRole('button',{name:'เข้าสู่ระบบด้วย Microsoft 365',exact:true}),
   page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}),
   page.getByRole('button',{name:/เปลี่ยนเป็นภาษาอังกฤษ|Switch to Thai/})
  ];
  for(const control of controls)assert.equal(await control.isVisible(),true,'login control must remain visible');
  if(width>720){
   const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight,scrollH:document.documentElement.scrollHeight}));
   assert.ok(viewport.scrollH<=viewport.h+1,'desktop login must not require page-level vertical scroll');
   for(const control of controls){
    const b=await control.boundingBox();assert.ok(b,'control bounding box');
    assert.ok(b.y>=0&&b.y+b.height<=height+1,'control must fit viewport');
   }
   const shell=await page.locator('.kc-login-shell').boundingBox();
   assert.ok(shell&&shell.y>=0&&shell.y+shell.height<=height+1,'login shell must fit viewport');
  }else{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile login must not overflow horizontally');
  }
  assert.deepEqual(errors,[]);
  fs.mkdirSync('test-artifacts',{recursive:true});
  await page.screenshot({path:`test-artifacts/login-layout-${width}x${height}.png`,fullPage:true});
  await page.close();
 }
 console.log('PASS login layout: viewport auto-fit, desktop controls remain visible, mobile has no horizontal overflow');
}finally{await browser.close();}
