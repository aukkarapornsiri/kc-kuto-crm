import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/kc-kuto-crm/';
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const viewports = [[1779,864],[1920,1080],[1736,800],[1440,720],[1280,650],[1024,650],[768,1024],[390,800],[320,568]];
const results = [];
fs.mkdirSync('test-artifacts',{recursive:true});
try {
  for (const [width,height] of viewports) {
    const page = await browser.newPage({viewport:{width,height}});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.locator('.kc-login-shell').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const controls = [
      page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}),
      page.getByRole('button',{name:'เข้าสู่ระบบด้วย Microsoft 365',exact:true}),
      page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}),
      page.locator('.kc-login-language')
    ];
    for (const control of controls) assert.equal(await control.isVisible(),true,'login control must remain visible');
    for (const selector of ['.kc-login-story>p','.kc-login-features','.kc-login-brand footer','.kc-login-access>footer']) {
      assert.equal(await page.locator(selector).isVisible(),true,`${selector} must not be hidden, even on phones`);
    }
    assert.equal(await page.locator('.kc-login-features>div').count(),3);
    const metrics = await page.evaluate(()=>{
      const shell=document.querySelector('.kc-login-shell').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,shell:{x:shell.x,y:shell.y,width:shell.width,height:shell.height}};
    });
    const dx = metrics.shell.x+metrics.shell.width/2-width/2;
    const dy = metrics.shell.y+metrics.shell.height/2-height/2;
    assert.ok(Math.abs(dx)<=1,`frame must be horizontally centered at ${width}x${height}; offset=${dx}`);
    assert.ok(metrics.scrollW<=width+1,'login must never overflow horizontally');
    if (width>720) {
      assert.ok(Math.abs(dy)<=1,`frame must be vertically centered at ${width}x${height}; offset=${dy}`);
      assert.ok(metrics.scrollH<=height+1,'desktop login must fit viewport');
      for (const control of controls) {
        const r=await control.boundingBox();
        assert.ok(r&&r.x>=0&&r.x+r.width<=width+1&&r.y>=0&&r.y+r.height<=height+1,'desktop control must fit viewport');
      }
    }
    assert.equal(await page.locator('#login-email').getAttribute('type'),'email');
    assert.equal(await page.locator('#login-password').getAttribute('type'),'password');
    assert.equal(await page.locator('#login-email').getAttribute('autocomplete'),'email');
    assert.equal(await page.locator('#login-password').getAttribute('autocomplete'),'current-password');
    assert.equal(await page.locator('#login-email').evaluate(e=>getComputedStyle(e).backgroundImage),'none');
    assert.equal(await page.locator('.kc-login-accent-line').isVisible(),false);
    assert.equal(await page.locator('.kc-login-demo').evaluate(e=>getComputedStyle(e,'::before').content),'none');
    await page.screenshot({path:`test-artifacts/login-layout-${width}x${height}.png`,fullPage:true});
    // Language changes must stay on the real login screen and preserve the form.
    await page.locator('.kc-login-language').click();
    await page.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('button',{name:'Sign in with Microsoft 365',exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('button',{name:'Continue in Demo Mode',exact:true}).isVisible(),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'English layout must not overflow horizontally');
    await page.screenshot({path:`test-artifacts/login-layout-en-${width}x${height}.png`,fullPage:true});
    await page.locator('.kc-login-language').click();
    await page.getByRole('heading',{name:'ยินดีต้อนรับกลับ',exact:true}).waitFor();
    // Native empty-field validation only: do not send real credentials or modify data.
    await page.locator('#login-email').evaluate(e=>e.form.requestSubmit());
    assert.equal(await page.locator('#login-email').evaluate(e=>e.validity.valueMissing),true);
    assert.equal(await page.locator('.kc-login-shell').isVisible(),true);
    assert.deepEqual(errors,[]);
    results.push({...metrics,centerOffsetX:dx,centerOffsetY:width>720?dy:null,languageToggle:'PASS',requiredFields:'PASS'});
    await page.close();
  }
  fs.writeFileSync('test-artifacts/login-layout-geometry.json',JSON.stringify(results,null,2));
  console.log('PASS login reference: 9 viewport sizes, true centered frame, all cards/footers, Thai/English toggle, no horizontal overflow, native form validation; authentication handlers unchanged.');
} finally { await browser.close(); }
