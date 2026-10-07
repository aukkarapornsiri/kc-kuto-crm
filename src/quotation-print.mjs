/** Isolated A4 print document: no dialog clipping or mobile layout rules. */
export const quotationPrintCSS=`
@page{size:A4 portrait;margin:10mm 10mm 10mm}
*{box-sizing:border-box}html,body{width:190mm;margin:0;padding:0;background:white;color:#182b3b;font-family:Tahoma,Arial,sans-serif;font-size:10pt;line-height:1.4;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.kc-print-document{font-family:var(--document-font,Tahoma,Arial,sans-serif);width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tfoot{display:table-footer-group}tbody{display:table-row-group}td{padding:0;vertical-align:top}tr{break-inside:avoid}tr.long-content{break-inside:auto}
.kc-print-header{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:6mm;padding-bottom:3mm;border-bottom:0.5mm solid var(--document-accent,#0aada9)}
.kc-quote-preview-company{display:flex;flex-direction:column;gap:.5mm;font-size:8pt;overflow-wrap:anywhere}.kc-quote-preview-company strong{font-size:11pt}.kc-company-logo{width:auto;max-width:38mm;height:13mm;object-fit:contain;object-position:left;margin-bottom:1mm}
.kc-quote-preview-id h2{font-size:19pt;text-align:right;margin:1mm 0 2mm}.kc-quote-preview-id dl{margin:0}.kc-quote-preview-id dl>div{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:8pt}.kc-quote-preview-id dd{margin:0;text-align:right}.kc-quote-brand-ribbon{height:13mm;display:flex;justify-content:flex-end;margin-bottom:1mm}.kc-quote-brand-ribbon img{max-width:37mm;height:13mm;object-fit:contain}.kc-quote-brand-stripe{display:none}
.kc-quote-preview-party{display:grid;grid-template-columns:1.3fr 1fr;gap:5mm;padding:3mm 0}.kc-quote-preview-party section{display:flex;flex-direction:column;gap:.8mm;font-size:9pt;overflow-wrap:anywhere}.kc-quote-preview-party h3{margin:0 0 1mm;font-size:10pt}
/* User Profile defaults remain available in CRM, but internal employment fields must not appear on customer-facing printed quotations. Keep salesperson name/email/phone and the final project line. */
.kc-print-header .kc-quote-preview-party>section:nth-child(2)>span:nth-of-type(n+4):not(:last-of-type){display:none!important}
.kc-quote-preview-line{display:grid;grid-template-columns:var(--print-columns);gap:2mm;padding:2.2mm 1mm;border-bottom:.2mm solid #dce4e7;font-size:9pt;align-items:start;overflow-wrap:anywhere}.kc-quote-preview-line>*{min-width:0}.kc-quote-preview-line small{display:block;white-space:pre-wrap;font-size:8pt;font-weight:normal}.kc-quote-preview-line.header{background:var(--document-accent,#0aada9);color:white;font-weight:bold;font-size:8pt;margin-top:2mm;padding:2mm 1mm}.kc-quote-preview-line>:nth-last-child(-n+4){text-align:right}.kc-quote-preview-line strong{font-weight:600}
.kc-quote-preview-summary{display:grid;grid-template-columns:minmax(0,1fr) 65mm;gap:7mm;padding:4mm 0;font-size:9pt;overflow-wrap:anywhere}.kc-quote-preview-terms p{white-space:pre-wrap;margin:1mm 0 3mm}.kc-quote-preview-summary dl{margin:0;break-inside:avoid}.kc-quote-preview-summary dl>div{display:flex;justify-content:space-between;gap:3mm;padding:1.5mm 0}.kc-quote-preview-summary dd{margin:0;text-align:right}.kc-quote-preview-summary .net{font-size:12pt;font-weight:bold;border-top:.5mm solid}
.kc-print-footer{padding-top:3mm;border-top:.3mm solid var(--document-accent,#0aada9);margin-top:3mm}.kc-print-footer footer{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6mm;text-align:center;font-size:8pt}.kc-print-footer footer>div{position:relative;padding-top:14mm}.kc-print-footer i{display:block;border-top:.2mm solid;margin:0 2mm 1mm}.kc-print-footer span,.kc-print-footer small{display:block}.kc-quote-seller-signature{position:absolute;top:0;left:50%;transform:translateX(-50%);max-width:40mm;height:13mm;object-fit:contain}.kc-quote-preview-footer{font-size:8pt;text-align:center;white-space:pre-wrap;margin:2mm 0 0}.kc-print-reference{text-align:right;font-size:7pt;color:#536471;margin:2mm 0 0}
[data-design-prepared=false] .kc-quote-preview-party>section:nth-child(2),[data-design-signatures=false] .kc-print-footer footer,[data-design-notes=false] .kc-quote-preview-terms,[data-design-address=false] .kc-quote-preview-company>span:first-of-type,[data-design-contact=false] .kc-quote-preview-company>span:not(:first-of-type),[data-design-tax=false] .kc-quote-preview-company>small{display:none}
thead,tfoot{break-inside:avoid}
.kc-print-root{font-family:var(--document-font,Tahoma,Arial,sans-serif)}.kc-print-page{width:190mm;height:277mm;display:flex;flex-direction:column;break-after:page}.kc-print-page:last-child{break-after:auto}.kc-print-page-header,.kc-print-page-footer{flex:none}.kc-print-page-header{padding-bottom:2mm}.kc-print-page-body{flex:1;min-height:0}.kc-print-page-footer{margin-top:2mm}.kc-print-long-text{white-space:pre-wrap;font-size:9pt;line-height:1.4;overflow-wrap:anywhere}.kc-print-measure{position:absolute;left:-10000px;width:190mm}
.kc-print-root[data-watermark]:not([data-watermark=""]):before{content:attr(data-watermark);position:fixed;top:40%;left:0;right:0;text-align:center;transform:rotate(-28deg);font-size:48pt;opacity:.075;color:var(--document-accent);pointer-events:none}
[data-design-prepared=false] .kc-quote-preview-party{grid-template-columns:1fr}
@media screen{body{width:190mm;margin:10mm auto}}
`;
export function buildQuotationPrint(source,doc){
 const table=doc.createElement('table');table.className='kc-print-document';
 for(const a of source.attributes)if(a.name.startsWith('data-')||a.name==='style')table.setAttribute(a.name,a.value);
 const rows=[...source.querySelectorAll('.kc-quote-preview-line')];const hasCode=rows[0]?.children.length===7;
 table.style.setProperty('--print-columns',hasCode?'6mm 19mm minmax(0,1fr) 12mm 12mm 24mm 27mm':'6mm minmax(0,1fr) 12mm 12mm 24mm 27mm');
 const add=(section,node,long=false)=>{if(!node)return;const row=section.insertRow();if(long)row.className='long-content';row.insertCell().append(node);};
 const clone=selector=>source.querySelector(selector)?.cloneNode(true);
 const head=doc.createElement('div'),header=clone(':scope > header');head.className='kc-print-fixed-header';if(header){header.className='kc-print-header';head.append(header);}const party=clone('.kc-quote-preview-party');if(party)head.append(party);if(rows[0])head.append(rows[0].cloneNode(true));
 const tbody=table.createTBody();
 for(const row of rows.slice(1))add(tbody,row.cloneNode(true),row.textContent.length>1400);
 add(tbody,clone('.kc-quote-preview-summary'),true);
 const foot=doc.createElement('div');foot.className='kc-print-footer';for(const selector of [':scope > footer','.kc-quote-preview-footer']){const n=clone(selector);if(n)foot.append(n);}
 const reference=doc.createElement('p');reference.className='kc-print-reference';reference.textContent=source.querySelector('.kc-quote-preview-id h2')?.textContent+' · '+(source.querySelector('.kc-quote-preview-id dd')?.textContent||'');foot.append(reference);foot.classList.add('kc-print-fixed-footer');
 const root=doc.createElement('div');root.className='kc-print-root';for(const a of source.attributes)if(a.name.startsWith('data-')||a.name==='style')root.setAttribute(a.name,a.value);
 root.style.setProperty('--print-columns',table.style.getPropertyValue('--print-columns'));root.append(head,table,foot);return root;
}
/** Paginate measured blocks rather than relying on browser table-header heuristics. */
export async function prepareQuotationPrint(root,doc){
 await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));await doc.fonts.ready;
 const header=root.querySelector('.kc-print-fixed-header'),footer=root.querySelector('.kc-print-fixed-footer');
 const blocks=[...root.querySelectorAll('tbody > tr > td')].map(cell=>cell.firstElementChild);
 root.replaceChildren();
 let body;
 const newPage=()=>{
  const page=doc.createElement('section');page.className='kc-print-page';
  const head=header.cloneNode(true),foot=footer.cloneNode(true);head.className='kc-print-page-header';foot.classList.remove('kc-print-fixed-footer');foot.classList.add('kc-print-page-footer');
  body=doc.createElement('div');body.className='kc-print-page-body';page.append(head,body,foot);root.append(page);
  if(body.clientHeight<80)throw Error('หัวและท้ายเอกสารยาวเกินพื้นที่ A4 กรุณาย่อข้อมูลในแม่แบบ');
 };
 const fits=()=>body.scrollHeight<=body.clientHeight+1;
 const splitText=(block,target,text)=>{
  const characters=Array.from(text);let offset=0;
  while(offset<characters.length){
   if(body.childElementCount)newPage();
   const part=block.cloneNode(true),cell=target(part);cell.replaceChildren();cell.classList.add('kc-print-long-text');body.append(part);
   // Repeat only the text continuation; quantities and amounts stay on the first part.
   if(offset&&part.classList.contains('kc-quote-preview-line'))for(const child of part.children)if(child!==cell)child.textContent='';
   let low=0,high=characters.length-offset;
   while(low<high){const mid=Math.ceil((low+high)/2);cell.textContent=characters.slice(offset,offset+mid).join('');if(fits())low=mid;else high=mid-1;}
   if(!low)throw Error('ไม่สามารถจัดรายละเอียดลงกระดาษ A4 ได้ กรุณาตรวจสอบแม่แบบ');
   // Prefer a word/line boundary without dropping any characters.
   let end=low;if(low<characters.length-offset){for(let i=low-1;i>low*.8;i--)if(/\s/.test(characters[offset+i])){end=i+1;break;}}
   cell.textContent=characters.slice(offset,offset+end).join('');offset+=end;
  }
 };
 const append=block=>{
  body.append(block);if(fits())return;block.remove();
  if(body.childElementCount){newPage();body.append(block);if(fits())return;block.remove();}
  if(block.classList.contains('kc-quote-preview-line')){
   const index=block.children.length===7?2:1,cell=block.children[index];
   const text=[...cell.children].map(node=>node.textContent).join('\n')||cell.textContent;
   splitText(block,part=>part.children[index],text);return;
  }
  if(block.classList.contains('kc-quote-preview-summary')){
   const terms=block.querySelector('.kc-quote-preview-terms');
   if(terms?.textContent){
    const note=doc.createElement('div');note.className='kc-quote-preview-terms kc-print-long-text';
    const text=[...terms.children].map(node=>node.textContent).join('\n');
    if(root.dataset.designNotes!=='false')splitText(note,part=>part,text);
   }
   if(!terms?.textContent)throw Error('ยอดรวมยาวเกินพื้นที่พิมพ์ A4');
   const totals=block.cloneNode(true);totals.querySelector('.kc-quote-preview-terms')?.replaceChildren();append(totals);return;
  }
  throw Error('เนื้อหาบางส่วนยาวเกินพื้นที่พิมพ์ A4');
 };
 newPage();for(const block of blocks)append(block);
 const pages=[...root.children];pages.forEach((page,index)=>{const label=page.querySelector('.kc-print-reference');label.textContent+=` · ${index+1} / ${pages.length}`;});
}
export async function printQuotation(source){
 if(!source)throw Error('ไม่พบใบเสนอราคาสำหรับพิมพ์');
 const frame=document.createElement('iframe');frame.title='Quotation A4 print';frame.style.cssText='position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0';document.body.append(frame);
 try{const doc=frame.contentDocument;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Quotation</title></head><body></body></html>');doc.close();
 for(const face of document.fonts)doc.fonts.add(face);
 const style=doc.createElement('style');style.textContent=quotationPrintCSS;doc.head.append(style);const root=buildQuotationPrint(source,doc);doc.body.append(root);await prepareQuotationPrint(root,doc);
 await new Promise(resolve=>frame.contentWindow.requestAnimationFrame(()=>frame.contentWindow.requestAnimationFrame(resolve)));
 const cleanup=()=>frame.remove();frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});frame.contentWindow.focus();frame.contentWindow.print();setTimeout(cleanup,300000);
 }catch(error){frame.remove();throw error;}
}
