export function createHeaderAIChat({React,Robot,generate,useApp}) {
 const h=React.createElement;
 return function HeaderAIChat({lang='th'}) {
  const {demoMode,session}=useApp(),th=lang==='th',t=(a,b)=>th?a:b;
  const [draft,setDraft]=React.useState(''),[messages,setMessages]=React.useState([]),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const dialog=React.useRef(null),input=React.useRef(null),launcher=React.useRef(null),log=React.useRef(null),pending=React.useRef(false),epoch=React.useRef(0);
  React.useEffect(()=>{epoch.current++;setMessages([]);setDraft('');setError('');setBusy(false);pending.current=false;dialog.current?.close();return()=>{epoch.current++;};},[session?.user?.id,demoMode]);
  React.useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,busy,error]);
  const open=()=>{if(!dialog.current.open)dialog.current.showModal();input.current?.focus();};
  const send=async(event)=>{
   event?.preventDefault();open();const question=draft.trim();if(!question||pending.current)return;
   if(demoMode){setError(t('กรุณาเข้าสู่ระบบจริงเพื่อส่งคำถาม โหมดทดลองจะไม่เรียก AI','Sign in to send a question. Demo mode does not call AI.'));return;}
   const version=epoch.current;pending.current=true;setBusy(true);setError('');setDraft('');setMessages(v=>[...v,{role:'user',text:question}]);
   try{const answer=await generate(question,{maxTokens:1200});if(version!==epoch.current)return;if(!String(answer).trim())throw Error('empty');setMessages(v=>[...v,{role:'assistant',text:answer}]);}
   catch{if(version===epoch.current){setError(t('ส่งคำถามไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่อและสิทธิ์ใช้งาน AI แล้วลองอีกครั้ง','Unable to send. Check your connection and AI access, then try again.'));setDraft(question);}}
   finally{if(version===epoch.current){pending.current=false;setBusy(false);input.current?.focus();}}
  };
  const field=(inDialog)=>h('form',{className:inDialog?'kc-chat-compose':'kc-header-ai',onSubmit:send},
   !inDialog&&h('button',{type:'button',className:'kc-chat-launch',onClick:open,ref:launcher,'aria-label':t('เปิดแชท AI','Open AI chat'),'aria-haspopup':'dialog'},h(Robot,{size:30}),h('span',null,t('คุยกับ AI','Chat with AI'))),
   h('input',{ref:inDialog?input:undefined,value:draft,onChange:e=>setDraft(e.target.value),placeholder:t('พิมพ์คำถามได้เลย...','Ask a question...'),'aria-label':t('คำถามสำหรับ AI','Question for AI'),maxLength:4000,disabled:busy,autoComplete:'off'}),
   h('button',{type:'submit',className:'kc-chat-send',disabled:busy||!draft.trim(),'aria-label':t('ส่งคำถาม','Send question')},h('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},h('path',{d:'m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13'}))));
  return h(React.Fragment,null,field(false),h('dialog',{ref:dialog,className:'kc-chat-dialog','aria-labelledby':'kc-chat-title',onClose:()=>launcher.current?.focus(),onClick:e=>{if(e.target===dialog.current){const b=dialog.current.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.current.close();}}},
   h('header',null,h(Robot,{size:36}),h('h2',{id:'kc-chat-title'},t('คุยกับ AI','Chat with AI')),h('button',{type:'button',onClick:()=>dialog.current.close(),'aria-label':t('ปิดแชท','Close chat')},'×')),
   h('p',{className:'kc-chat-note'},t('ขณะนี้ใช้ AI Insight แบบกฎสำเร็จรูป ยังไม่เชื่อมโมเดลสนทนา และไม่อ่านหรือแก้ไขข้อมูล CRM จากแชท','Currently uses rule-based AI Insight, not a conversational model. Chat does not read or modify CRM records.')),
   h('div',{className:'kc-chat-log',ref:log,role:'log','aria-live':'polite'},messages.length?messages.map((m,i)=>h('div',{key:i,className:'kc-chat-message','data-role':m.role},h('small',null,m.role==='user'?t('คุณ','You'):'AI Insight'),h('p',null,m.text))):h('p',{className:'kc-chat-empty'},t('พิมพ์คำถามเพื่อเริ่มสนทนา','Type a question to start')),busy&&h('p',{role:'status'},t('กำลังตอบ...','Preparing a response...'))),
   error&&h('p',{role:'alert',className:'kc-chat-error'},error),field(true)));
 };
}
