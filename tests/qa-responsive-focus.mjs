import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDesktopMenu} from './menu-helper.mjs';
const browser=await chromium.launch({headless:true}),results=[];
try{for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL);await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();await page.getByRole('button',{name:'เปลี่ยนเป็นภาษาอังกฤษ',exact:true}).click();
 if(width>=1024)await openDesktopMenu(page,'Tickets / Service Desk','Service Overview');
 else{await page.locator('button.lg\\:hidden').first().click();const drawer=page.locator('div.fixed.top-0.left-0.h-full.w-64.lg\\:hidden');if(!await drawer.getByText('Tickets / Service Desk',{exact:true}).isVisible())await drawer.getByRole('button',{name:'Service',exact:true}).click();if(!await drawer.getByText('Service Overview',{exact:true}).isVisible())await drawer.getByText('Tickets / Service Desk',{exact:true}).click();await drawer.getByText('Service Overview',{exact:true}).click();}
 const root=page.locator('[data-service-desk]').first(),create=root.getByRole('button',{name:'+ สร้างเคส / Create case',exact:true});await create.click();const dialog=page.getByRole('dialog');
 const box=await dialog.boundingBox();assert.ok(Math.abs(box.x+box.width/2-width/2)<3,'Horizontal center');assert.ok(Math.abs(box.y+box.height/2-height/2)<3,'Vertical center');assert.ok(box.width<=width&&box.height<=height,'Dialog fits viewport');
 await dialog.getByLabel('Subject',{exact:true}).focus();const style=await dialog.getByLabel('Subject',{exact:true}).evaluate(el=>{const s=getComputedStyle(el);return {shadow:s.boxShadow,outline:s.outlineStyle,offset:s.outlineOffset};});assert.equal(style.shadow,'none');assert.equal(style.outline,'solid');assert.equal(style.offset,'-2px');
 for(let n=0;n<30;n++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)),'Focus remains in dialog');}
 await page.screenshot({path:`test-artifacts/qa-case-${width}.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.ok(await create.evaluate(el=>el===document.activeElement),'Focus returns to launch button');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal page overflow');assert.deepEqual(errors,[]);
 results.push({width,height,status:'PASS',browser:browser.version(),engine:'Chromium',device:'emulation',checks:['center','viewport','single-focus-border','keyboard-focus-trap','escape','focus-return','overflow','runtime-errors']});await page.close();
}}finally{await browser.close();fs.writeFileSync('test-artifacts/qa-responsive.json',JSON.stringify(results,null,2));}
console.log('PASS four viewport case dialog and keyboard focus checks');
