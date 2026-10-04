import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const roles=['ของฉัน','ฝ่ายขาย','ผู้จัดการ','งานบริการ','ต่ออายุสัญญา','ผู้ดูแลระบบ','AI'];
const browser=await chromium.launch({headless:true,...((process.env.CHROME_PATH||process.env.CHROMIUM_PATH)?{executablePath:(process.env.CHROME_PATH||process.env.CHROMIUM_PATH)}:{})});
fs.mkdirSync('test-artifacts',{recursive:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');
  await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();
  await page.getByRole('button',{name:'แดชบอร์ดผู้บริหาร',exact:true}).click();
  const executive=await page.locator('.exec-kpi').first().evaluate(el=>({padding:getComputedStyle(el).padding,borderRadius:getComputedStyle(el).borderRadius}));
  const heading=await page.locator('.dash-hero h1').evaluate(el=>getComputedStyle(el).fontSize);
  await page.getByRole('button',{name:'หยุดการเคลื่อนไหว',exact:true}).click();
  for(const [index,role] of roles.entries()){
   await page.getByRole('button',{name:'แดชบอร์ด'+(role==='AI'?' ':'')+role,exact:true}).click();
   const root=page.locator('.kc-role-dashboard');await page.locator('.dash-hero h1').waitFor();
   assert.equal(await page.locator('.kc-dashboard-studio').getAttribute('data-motion'),'off');
   assert.equal(await page.locator(role==='AI'?'.dash-mascot-robot':'.dash-growth-spark').first().evaluate(el=>getComputedStyle(el).animationName),'none');
   if(role==='AI')assert.ok(await page.locator('.dash-mascot-robot').evaluate(el=>el.querySelectorAll('image').length===2),'robot layers present');
   assert.ok(await page.locator('.kc-ai-wave-hand').evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none')),'all robot instances respect pause');
   assert.equal(await root.count(),1,role);
   assert.equal(await page.locator('.dash-hero h1').evaluate(el=>getComputedStyle(el).fontSize),heading,role+' heading');
   const cards=root.locator('.kc-dash-kpis>div');assert.ok(await cards.count()>=6,role+' preserves KPIs');
   const cardStyle=await cards.first().evaluate(el=>({padding:getComputedStyle(el).padding,borderRadius:getComputedStyle(el).borderRadius}));
   assert.deepEqual(cardStyle,executive,role+' executive card style');
   assert.equal(await root.locator('.kc-dash-kpis').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width===1440?3:2,role+' columns');
   assert.ok(await root.locator('select').count()>0,role+' filters retained');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+' horizontal overflow');
   await page.screenshot({path:`test-artifacts/dashboard-${index}-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'แดชบอร์ดงานบริการ',exact:true}).click();
  await page.getByRole('button',{name:'ภาระงานวิศวกร',exact:true}).click();
  await page.locator('.kc-role-dashboard table').waitFor();
  await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();
  await page.getByRole('heading',{name:'Service Dashboard',exact:true}).waitFor();
  await page.getByRole('button',{name:'Enable motion',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.dash-growth-spark').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS all dashboard roles share executive layout, retain KPIs/filters and service tabs; desktop/mobile and language switch');
}finally{await browser.close();}
