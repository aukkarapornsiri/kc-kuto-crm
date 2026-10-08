// Presentation-only sentence casing shared by every native/custom select.
export function capitalizeSelectLabel(value){return String(value).replace(/^(\s*[^\p{L}]*)(\p{Ll})/u,(_,prefix,letter)=>prefix+letter.toLocaleUpperCase('en-US'));}
export function installSelectLabels(root=document){
 const selector='option,optgroup,[role="option"],button[role="combobox"],[role="combobox"] [data-slot="select-value"]';
 function apply(el){
  if(el.matches('option')){
   // An option without a value attribute derives its submitted value from text.
   const originalValue=el.value;
   const text=capitalizeSelectLabel(el.textContent);
   const label=el.hasAttribute('label')?capitalizeSelectLabel(el.getAttribute('label')):null;
   if(text!==el.textContent){if(!el.hasAttribute('value'))el.setAttribute('value',originalValue);for(const child of el.childNodes)if(child.nodeType===3){const next=capitalizeSelectLabel(child.data);if(next!==child.data)child.data=next;break;}}
   if(label!==null&&label!==el.getAttribute('label'))el.setAttribute('label',label);
  }else if(el.matches('optgroup')){const label=el.getAttribute('label');if(label!==null){const next=capitalizeSelectLabel(label);if(next!==label)el.setAttribute('label',next);}}
  else{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let text;while((text=walker.nextNode())){if(!text.data.trim()||text.parentElement.closest('svg,[aria-hidden="true"],small'))continue;const next=capitalizeSelectLabel(text.data);if(next!==text.data)text.data=next;break;}}
 }
 function scan(node){const el=node.nodeType===3?node.parentElement:node;if(!el?.querySelectorAll)return;if(el.matches?.(selector))apply(el);else{const owner=el.closest?.(selector);if(owner)apply(owner);}el.querySelectorAll(selector).forEach(apply);}
 scan(root);const observer=new MutationObserver(records=>{const pending=new Set();for(const r of records){pending.add(r.target);for(const n of r.addedNodes)pending.add(n);}for(const node of pending)if(node.isConnected)scan(node);});observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['label','role']});return()=>observer.disconnect();
}
if(typeof document!=='undefined')installSelectLabels();
