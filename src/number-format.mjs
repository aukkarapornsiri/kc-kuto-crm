// Presentation only: never put grouping separators into application state or API payloads.
export function groupDecimal(value) {
 const s=String(value??'');
 if(!/^-?\d*(?:\.\d*)?$/.test(s))return s;
 const [whole,fraction]=s.split('.');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);
}
export const ungroupDecimal=value=>String(value??'').replaceAll(',','');
export const isDecimalDraft=value=>/^-?\d*(?:\.\d*)?$/.test(value);
export function formatNumber(value){return typeof value==='number'&&Number.isFinite(value)?groupDecimal(value):value;}
const identifier=/^(?:id|.*_id|code|.*_code|phone|.*_phone|mobile|fax|postal_code|zip|tax_id|barcode|serial_number|part_number|year|.*_year)$/i;
const measure=/(?:^|_)(?:amount|price|cost|total|subtotal|discount|quantity|qty|value|budget|revenue|profit|balance|count|limit|target|score|probability|margin|rate|point|bytes|hours|minutes|days|order)(?:_|$)/i;
export function formatNumericField(key,value){
 if(value===null||value===undefined)return '—';
 if(identifier.test(key))return String(value);
 return typeof value==='number'||measure.test(key)&&/^-?\d+(?:\.\d+)?$/.test(String(value))?groupDecimal(value):String(value);
}
export function shouldGroupInput(props){
 return props.type==='number'&&props['data-number-format']!=='plain'&&!/(?:year|ปี|postal|zip|phone|telephone|serial|barcode|tax.?id)/i.test([props.name,props.id,props['aria-label']].filter(Boolean).join(' '));
}
export function numericValidity(raw,{min,max,step='1',required}={}){
 if(raw==='')return required?'กรุณากรอกตัวเลข / Enter a number':'';
 if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)||!Number.isFinite(Number(raw)))return 'กรอกตัวเลขให้ถูกต้อง / Enter a valid number';
 const n=Number(raw);
 if(min!==undefined&&n<Number(min)||max!==undefined&&n>Number(max))return 'ตัวเลขอยู่นอกช่วงที่กำหนด / Number is outside the allowed range';
 if(step!=='any'&&Number(step)>0){const q=(n-Number(min??0))/Number(step);if(Math.abs(q-Math.round(q))>1e-7)return 'จำนวนทศนิยมไม่ตรงตามที่กำหนด / Use the allowed increment';}
 return '';
}
export function createNumberPresentation(React){
 const rawCreate=React.createElement;
 const NumericInput=React.forwardRef(function NumericInput(props,forwardedRef){
  const {value,defaultValue,onChange,onInput,onBlur,onKeyDown,type,...rest}=props;
  const [draft,Draft]=React.useState(()=>ungroupDecimal(value??defaultValue??''));
  const input=React.useRef(null),focused=React.useRef(false),lastSent=React.useRef(null),caret=React.useRef(null);
  React.useEffect(()=>{if(value===undefined)return;const next=ungroupDecimal(value);if(focused.current&&lastSent.current!==null&&Number(next)===Number(lastSent.current))return;Draft(next);},[value]);
  React.useLayoutEffect(()=>{
   const el=input.current;if(!el)return;el.setCustomValidity(numericValidity(draft,props));
   if(caret.current!==null&&document.activeElement===el){const wanted=caret.current;let pos=0,n=0;while(pos<el.value.length&&n<wanted){if(el.value[pos]!==',')n++;pos++;}el.setSelectionRange(pos,pos);caret.current=null;}
  },[draft,props.min,props.max,props.step,props.required]);
  const ref=React.useCallback(el=>{input.current=el;if(typeof forwardedRef==='function')forwardedRef(el);else if(forwardedRef)forwardedRef.current=el;},[forwardedRef]);
  function eventWithRaw(event,raw){
   const target=new Proxy(event.target,{get:(el,key)=>key==='value'?raw:key==='valueAsNumber'?(raw===''?NaN:Number(raw)):typeof el[key]==='function'?el[key].bind(el):el[key]});
   return new Proxy(event,{get:(e,key)=>key==='target'||key==='currentTarget'?target:typeof e[key]==='function'?e[key].bind(e):e[key]});
  }
  function change(event){
   const text=event.target.value,raw=ungroupDecimal(text);
   if(!isDecimalDraft(raw)){event.target.setCustomValidity('กรอกเฉพาะตัวเลข / Enter numbers only');return;}
   caret.current=ungroupDecimal(text.slice(0,event.target.selectionStart??text.length)).length;
   Draft(raw);event.target.setCustomValidity(numericValidity(raw,props));
   if(raw===''||Number.isFinite(Number(raw))&&raw!=='-'&&raw!=='.'&&raw!=='-.'){lastSent.current=raw;onChange?.(eventWithRaw(event,raw));}
  }
  return rawCreate('input',{...rest,ref,type:'text',inputMode:'decimal',role:'spinbutton','data-grouped-number':'true',
   'aria-valuemin':props.min,'aria-valuemax':props.max,'aria-valuenow':draft!==''&&Number.isFinite(Number(draft))?Number(draft):undefined,
   value:groupDecimal(draft),onChange:change,onInput:onInput?e=>onInput(eventWithRaw(e,ungroupDecimal(e.target.value))):undefined,
   onFocus:e=>{focused.current=true;props.onFocus?.(e);},onBlur:e=>{focused.current=false;lastSent.current=null;onBlur?.(eventWithRaw(e,draft));},
   onKeyDown:e=>{onKeyDown?.(e);if(e.defaultPrevented||props.readOnly||props.disabled||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=props.step==='any'?1:Number(props.step||1);let next=Number(draft||0)+(e.key==='ArrowUp'?step:-step);if(props.min!==undefined)next=Math.max(next,Number(props.min));if(props.max!==undefined)next=Math.min(next,Number(props.max));const raw=String(Number(next.toFixed(12)));Draft(raw);lastSent.current=raw;onChange?.(eventWithRaw(e,raw));}
  });
 });
 const textTags=new Set(['span','div','p','strong','b','small','td','th','li','h1','h2','h3','h4','button','label','summary','dd','dt','a']);
 const children=value=>Array.isArray(value)?value.map(children):formatNumber(value);
 function present(type,props){
  if(type==='input'&&shouldGroupInput(props||{}))return [NumericInput,props];
  if(textTags.has(type)&&props?.['data-number-format']!=='plain')return [type,{...props,children:children(props?.children)}];
  return [type,props];
 }
 return {React:{...React,createElement(type,props,...kids){const [tag,next]=present(type,kids.length?{...props,children:kids.length===1?kids[0]:kids}:props);return rawCreate(tag,next);}},wrapJSX:original=>(type,props,key)=>{const [tag,next]=present(type,props);return original(tag,next,key);}};
}
