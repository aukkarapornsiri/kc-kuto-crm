import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import fs from 'node:fs';
const module=fs.readFileSync(new URL('../src/quotation-print.mjs',import.meta.url),'utf8').replaceAll('export ','');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--single-process','--disable-dev-shm-usage']}: {})});
fs.mkdirSync('test-artifacts',{recursive:true});
const page=await browser.newPage();
try{for(const scenario of ['short','many','long-item','long-notes','no-code']){
 const count=scenario==='many'?75:scenario==='long-item'?1:3;
 await page.emulateMedia({media:'screen'});
 await page.setContent(`<article style="--document-accent:#0aada9"><header><div class="kc-quote-preview-company"><img class="kc-company-logo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='30'%3E%3Crect width='100' height='30' fill='teal'/%3E%3C/svg%3E"><strong>TEST COMPANY HEADER</strong><span>5 Huamak 9, Huamak, Bangkapi, Bangkok Thailand 10240</span><span>Tel 02 732 9100</span><span>sales@example.test</span><span>LINE @Kaicom</span><small>Tax ID 1234567890123</small></div><div class="kc-quote-preview-id"><h2>Quotation</h2><dl><div><dt>Document no.</dt><dd>SQ-TEST-001</dd></div><div><dt>Date</dt><dd>2026-10-07</dd></div></dl></div></header><div class="kc-quote-preview-party"><section><h3>Customer</h3><span>Sample Customer Ltd.</span><span>Bangkok address</span><span>Tax ID: 0123456789012</span><span>Contact: Customer Contact</span></section><section><h3>Prepared by</h3><span>Sales Person</span><span>sales@example.test</span><span>02 732 9100</span><span>LINE @Sales</span><span>Project delivery</span></section></div><div class="kc-quote-preview-line header"><span>#</span><span>Code</span><span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Amount</span></div>${Array.from({length:count},(_,i)=>`<div class="kc-quote-preview-line"><span>${i+1}</span><span>SKU-${i+1}</span><span><strong>ITEM-${String(i+1).padStart(3,'0')}</strong><small>${scenario==='long-item'?Array.from({length:160},(_,n)=>'LONG-'+String(n+1).padStart(3,'0')+' Full specification text').join('<br>'):'Specifications with a second line<br>Full description preserved'}</small></span><span>1</span><span>Unit</span><span>12,345.00</span><strong>12,345.00</strong></div>`).join('')}<div class="kc-quote-preview-summary"><div class="kc-quote-preview-terms"><strong>Notes</strong><p>${scenario==='long-notes'?Array.from({length:180},(_,n)=>'NOTE-'+String(n+1).padStart(3,'0')+' Payment condition').join('<br>'):'All notes remain visible.'}</p></div><dl><div><dt>Total</dt><dd>925,875.00</dd></div></dl></div><footer><div><i></i><span>Prepared signature</span></div><div><i></i><span>Reviewed signature</span></div><div><i></i><span>Approved signature</span></div></footer><p class="kc-quote-preview-footer">TEST FOOTER EVERY PAGE</p></article>`);
 if(scenario==='no-code')await page.locator('.kc-quote-preview-line').evaluateAll(rows=>rows.forEach(row=>row.children[1].remove()));
 await page.evaluate('(async()=>{'+module+';const source=document.querySelector("article");const style=document.createElement("style");style.textContent=quotationPrintCSS;document.head.append(style);const table=buildQuotationPrint(source,document);document.body.replaceChildren(table);await prepareQuotationPrint(table,document);})()');
 await page.emulateMedia({media:'print'});await page.pdf({path:`test-artifacts/quotation-print-${scenario}.pdf`,preferCSSPageSize:true,printBackground:true});
 const pages=await page.locator('.kc-print-page').count();
 if(scenario==='short')assert.equal(pages,1);else if(scenario!=='no-code')assert.ok(pages>1);
 const bounds=await page.locator('.kc-print-page').evaluateAll(pages=>pages.map(page=>{const body=page.querySelector('.kc-print-page-body'),footer=page.querySelector('.kc-print-page-footer');return {fits:body.scrollHeight<=body.clientHeight+1,last:body.lastElementChild?.getBoundingClientRect().bottom||0,footer:footer.getBoundingClientRect().top,width:page.scrollWidth<=page.clientWidth+1};}));
 for(const b of bounds){assert.ok(b.fits);assert.ok(b.width);assert.ok(b.last<=b.footer+1,'body does not overlap footer');}
 const text=execFileSync('pdftotext',['-layout',`test-artifacts/quotation-print-${scenario}.pdf`,'-'],{encoding:'utf8'});
 const sheets=text.split('\f').filter(s=>s.trim());assert.equal(sheets.length,pages,'one physical A4 sheet per page');
 for(const sheet of sheets){assert.ok(sheet.includes('TEST COMPANY HEADER'));assert.ok(sheet.includes('TEST FOOTER EVERY PAGE'));assert.ok(sheet.includes('Description'));}
 for(let i=1;i<=count;i++)assert.equal(text.split('ITEM-'+String(i).padStart(3,'0')).length-1,1,'each item prints exactly once');
 const prefix=scenario==='long-item'?'LONG-':scenario==='long-notes'?'NOTE-':null;
 if(prefix)for(let i=1;i<=(prefix==='LONG-'?160:180);i++)assert.equal(text.split(prefix+String(i).padStart(3,'0')).length-1,1,'every long text line retained');
 assert.equal(text.split('925,875.00').length-1,1,'total prints once');
 console.log('PASS',scenario,pages,'A4 pages, complete content and repeated header/footer');
}}finally{await browser.close();}
