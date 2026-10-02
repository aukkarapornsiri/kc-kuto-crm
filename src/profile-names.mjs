// Legacy names are suggested in the editor only; opening a form never writes them.
export function profileNames(row={}){
 if(row.first_name!=null||row.last_name!=null)return {first_name:row.first_name??'',last_name:row.last_name??''};
 const [first_name='',...rest]=String(row.display_name||'').trim().split(/\s+/u);
 return {first_name,last_name:rest.join(' ')};
}
export function profileDisplayName(first,last){return [first,last].map(v=>String(v??'').trim()).filter(Boolean).join(' ');}
