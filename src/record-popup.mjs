export function createRecordPopup(React){
 const h=React.createElement;
 return function RecordPopup({title,busy,error,message,onClose,lang,children}){
  const ref=React.useRef(null);
  React.useEffect(()=>{const opener=document.activeElement,dialog=ref.current;dialog.showModal();return()=>{if(dialog.open)dialog.close();if(opener?.isConnected)opener.focus();};},[]);
  return h('dialog',{ref,className:'crm-record-popup','aria-label':title,onCancel:e=>{e.preventDefault();if(!busy)onClose();}},h('header',{className:'crm-record-popup-head'},h('h2',null,title),h('button',{type:'button',disabled:busy,onClick:onClose,'aria-label':lang==='th'?'ปิดฟอร์ม':'Close form'},'×')),h('div',{className:'crm-record-popup-body'},error&&h('p',{role:'alert'},error),message&&h('p',{role:'status'},message),children));
 };
}
