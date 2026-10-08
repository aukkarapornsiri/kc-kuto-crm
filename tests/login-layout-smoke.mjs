import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GUEST_PORTAL_URL} from '../src/login-layout.mjs';
const baseURL = new URL(process.env.SITE_URL || 'http://127.0.0.1:4173/kc-kuto-crm/');
baseURL.searchParams.delete('demo');
const base = baseURL.href;
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const viewports = [[1779,864],[1920,1200],[1536,960],[1920,1080],[1736,800],[1440,900],[1440,720],[1366,768],[1280,650],[1024,650],[1024,768],[768,1024],[390,800],[320,568]];
fs.mkdirSync('test-artifacts',{recursive:true});
const results = [];
try {
  for (const [width,height] of viewports) {
    const page = await browser.newPage({viewport:{width,height}});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    // Deny all production data/auth traffic during these presentation checks.
    await page.route('**/*.supabase.co/**',route=>route.abort());
    await page.goto(base);
    await page.locator('.kc-login-shell').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.title(),'KC CuTo CRM');
    assert.equal(await page.locator('.kc-login-demo').count(),0,'Guest access must not be disguised demo');
    for (const selector of ['.kc-login-story>p','.kc-login-features','.kc-login-brand footer','.kc-login-access>footer','.kc-login-help','.kc-login-session-note','.kc-login-assurance','.kc-login-guest']) assert.equal(await page.locator(selector).isVisible(),true,`${selector} visible`);
    assert.equal(await page.locator('.kc-login-features>div').count(),3);
    assert.equal(await page.locator('.kc-login-microsoft-mark>i').count(),4);
    assert.equal(await page.locator('.kc-login-guest').getAttribute('href'),GUEST_PORTAL_URL);
    assert.equal(await page.locator('.kc-login-top>span').innerText(),'KC Digital Workplace · พื้นที่ทำงานดิจิทัล');
    const byText=page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true});
    assert.equal(await byText.isVisible(),true);
    assert.equal(await page.getByRole('button',{name:'เข้าสู่ระบบด้วย Microsoft 365',exact:true}).isVisible(),true);
    assert.equal(await page.locator('#login-email').inputValue(),'','Do not hardcode a personal email');
    assert.equal(await page.locator('#login-password').getAttribute('type'),'password');
    assert.equal(await page.locator('#login-password').getAttribute('autocomplete'),'current-password');
    assert.equal(await page.locator('#login-email').getAttribute('autocomplete'),'email');
    assert.equal(await page.locator('.kc-login-logo').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
    for (const lang of ['th','en']) {
      if(lang==='en') await page.locator('.kc-login-language').click();
      await page.getByRole('heading',{name:lang==='th'?'ยินดีต้อนรับกลับ':'Welcome back',exact:true}).waitFor();
      const metrics=await page.evaluate(()=>{
        const box=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scrollH:e.scrollHeight,clientH:e.clientHeight}};
        return {sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,shell:box('.kc-login-shell'),brand:box('.kc-login-brand'),access:box('.kc-login-access'),logo:box('.kc-login-logo'),badge:box('.kc-login-badge'),headline:box('.kc-login-story h1'),description:box('.kc-login-story>p'),cards:box('.kc-login-features'),brandFooter:box('.kc-login-brand>footer'),footer:box('.kc-login-access>footer')};
      });
      const upperSpace=metrics.logo.y-metrics.brand.y;
      const lowerSpace=metrics.brandFooter.y-metrics.cards.y-metrics.cards.height;
      results.push({width,height,lang,upperSpace,lowerSpace,...metrics});
      fs.writeFileSync('test-artifacts/login-layout-geometry.json',JSON.stringify(results,null,2));
      await page.screenshot({path:`test-artifacts/login-layout-${lang}-${width}x${height}.png`,fullPage:true});
      assert.ok(Math.abs(upperSpace-lowerSpace)<=1,`Balanced brand spacing: ${upperSpace}px above logo / ${lowerSpace}px below cards (${width}x${height} ${lang})`);
      assert.ok(upperSpace>=23&&lowerSpace>=23,'Minimum space above logo and before pinned footer');
      assert.ok(metrics.brandFooter.y+metrics.brandFooter.height<=metrics.brand.y+metrics.brand.height,'Brand footer stays inside panel');
      assert.ok(metrics.sw<=width+1,'No horizontal overflow');
      assert.ok(Math.abs(metrics.shell.x+metrics.shell.width/2-width/2)<=1,'Centered frame');
      for(const key of ['badge','headline','description','cards']) assert.ok(Math.abs(metrics[key].x-metrics.logo.x)<=1,`${key} and visible artwork must share left edge`);
      if(width>=1024){
        const ratio=metrics.brand.width/(metrics.brand.width+metrics.access.width);
        assert.ok(Math.abs(ratio-.5)<.001,'Exact 50/50 split');
        assert.ok(metrics.brand.scrollH<=metrics.brand.clientH+1,'No brand clipping');
        assert.ok(metrics.access.scrollH<=metrics.access.clientH+1,'No form clipping');
        assert.ok(metrics.footer.y+metrics.footer.height<=metrics.shell.y+metrics.shell.height,'Footer inside shell');
        if(metrics.shell.height<=height-32){
          assert.ok(Math.abs(metrics.shell.y+metrics.shell.height/2-height/2)<=1,'Vertically centered when content fits');
        }
      }else{
        assert.ok(metrics.access.y>=metrics.brand.y+metrics.brand.height-1,'Tablet/mobile stack');
      }

    }
    // Controlled values survive showing/hiding and switching languages.
    await page.locator('#login-email').fill('layout-check@example.invalid');
    await page.locator('#login-password').fill('local-only-test-value');
    await page.getByRole('button',{name:'Show password',exact:true}).click();
    assert.equal(await page.locator('#login-password').getAttribute('type'),'text');
    assert.equal(await page.locator('#login-password').inputValue(),'local-only-test-value');
    await page.getByRole('button',{name:'Hide password',exact:true}).click();
    await page.locator('.kc-login-language').click();
    assert.equal(await page.locator('#login-email').inputValue(),'layout-check@example.invalid');
    assert.equal(await page.locator('#login-password').inputValue(),'local-only-test-value');
    assert.equal(await page.locator('#login-password').getAttribute('type'),'password');
    await page.locator('#login-email').fill('');
    await page.locator('#login-password').fill('');
    await page.locator('#login-email').evaluate(e=>e.form.requestSubmit());
    assert.equal(await page.locator('#login-email').evaluate(e=>e.validity.valueMissing),true);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  // Verify the real form still submits its controlled values and handles a
  // rejected login. Interception prevents sending anything to a real account.
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  let submitted=null;
  await page.route('**/*.supabase.co/**',async route=>{
    const request=route.request();
    if(request.url().includes('/auth/v1/token?grant_type=password')){
      submitted=request.postDataJSON();
      return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials',msg:'Invalid login credentials'})});
    }
    return route.abort();
  });
  await page.goto(base);
  await page.locator('#login-email').fill('test@example.invalid');
  await page.locator('#login-password').fill('stubbed-only-not-a-real-password');
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
  await page.getByText('Invalid login credentials',{exact:true}).waitFor();
  assert.equal(submitted.email,'test@example.invalid');
  assert.equal(submitted.password,'stubbed-only-not-a-real-password');
  assert.equal(await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).isEnabled(),true);
  await page.route(GUEST_PORTAL_URL,route=>route.fulfill({contentType:'text/html',body:'<title>Guest navigation test</title>'}));
  await page.locator('.kc-login-guest').click();
  await page.waitForURL(GUEST_PORTAL_URL);
  assert.equal(await page.title(),'Guest navigation test');
  await page.close();
  // Demo is still explicitly available, but it is not part of the default UI.
  const demoURL=new URL(base);demoURL.searchParams.set('demo','1');
  const demo=await browser.newPage();
  await demo.goto(demoURL.href);
  assert.equal(await demo.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).isVisible(),true);
  await demo.close();
  fs.writeFileSync('test-artifacts/login-layout-geometry.json',JSON.stringify(results,null,2));
  console.log('PASS login 50/50: 14 viewports x Thai/English, equal space above logo and below cards, pinned footer, borderless left-aligned artwork and text, exact reference copy, password toggle, native validation, intercepted password rejection, real Guest URL navigation, explicit demo only, tab branding; no live credentials/data submitted.');
} finally {await browser.close();}
