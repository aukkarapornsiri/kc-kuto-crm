import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openThaiSettings} from './menu-helper.mjs';
const fixture={service:'kc-account360-inventory',version:1,fetchedAt:new Date().toISOString(),canSeeCost:false,settings:{enabled:true},catalog:[{id:'source-1',category:'PRODUCT',code:'SRC-01',name:'Account Product',description:'Source specification',status:'Active',metadata:{unit:'ชิ้น',salePrice:123,vatMode:'exclusive'}},{id:'unit-1',category:'PRODUCT_UNIT',code:'PC',name:'ชิ้น',metadata:{}}],warehouses:[{code:'HQ',name:'Source Warehouse',active:true}],balances:[{warehouse:'HQ',code:'SRC-01',quantity:0,minimum:2}]};
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];let fail=false;
 page.on('pageerror',e=>errors.push(e.message));
 // Inject a fake session only into the isolated test module. Never contact or write production data.
 await page.route('**/src/inventory.mjs?*',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('src/inventory.mjs','utf8').replace('Account=createAccountInventory(deps)','Account=createAccountInventory({...deps,client:{auth:{getSession:async()=>({data:{session:{access_token:"qa-only"}}})}}})').replace('demoMode?Local:Account','Account')}));
 await page.route('https://kc-account-360-preview.saelim-m.chatgpt.site/api/integrations/cuto/inventory',route=>route.fulfill({status:fail?502:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization','access-control-allow-methods':'GET, OPTIONS'},json:fail?{error:'Source unavailable'}:fixture}));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:4173/kc-kuto-crm/');await page.getByRole('button',{name:'เข้าใช้งานโหมดทดลอง',exact:true}).click();await openThaiSettings(page,width);
 await page.locator('.crm-settings-hub').getByRole('button',{name:'สินค้าและคลัง',exact:true}).click();
 await page.getByRole('button',{name:'Account Product',exact:true}).click();await page.getByRole('dialog').getByText('Source specification',{exact:true}).waitFor();await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('columnheader',{name:'ราคาซื้อ',exact:true}).count(),0);
 await page.getByRole('button',{name:'ยอดคงเหลือและจุดแจ้งเตือน',exact:true}).click();await page.getByRole('cell',{name:'0',exact:true}).waitFor();await page.getByRole('cell',{name:'ควรเติมสินค้า',exact:true}).waitFor();
 await page.getByRole('combobox',{name:'กรองคลัง'}).selectOption('HQ');
 await page.screenshot({path:`test-artifacts/account360-inventory-${width}.png`,fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow');
 fail=true;await page.getByRole('button',{name:'รีเฟรชข้อมูล',exact:true}).click();await page.getByRole('alert').filter({hasText:'Source unavailable'}).waitFor();await page.getByRole('cell',{name:'SRC-01',exact:true}).waitFor();
 assert.deepEqual(errors,[]);await page.close();
}}finally{await browser.close();}
console.log('PASS Account 360 source inventory desktop/mobile, details, costs, zero stock, filters and refresh errors.');
