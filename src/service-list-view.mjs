export const SERVICE_VIEWS=Object.freeze([
  {id:'open',th:'เคสที่เปิดอยู่ทั้งหมด',en:'All Open Cases'},
  {id:'mine',th:'เคสของฉัน',en:'My Cases'},
  {id:'all',th:'เคสทั้งหมด',en:'All Cases'},
  {id:'urgent',th:'เคสเร่งด่วน',en:'Urgent Cases'},
  {id:'resolved',th:'เคสที่แก้ไขแล้ว',en:'Resolved Cases'},
]);

export function filterServiceView(rows,{view='open',assigneeId}={}){
  return rows.filter(row=>{
    if(view==='open')return !['resolved','closed','cancelled'].includes(row.status);
    if(view==='mine')return row.assigned_to_id===assigneeId;
    if(view==='urgent')return !['resolved','closed','cancelled'].includes(row.status)&&['high','critical','urgent'].includes(row.priority);
    if(view==='resolved')return ['resolved','closed'].includes(row.status);
    return true;
  });
}

export function sortServiceRows(rows,sort='case'){
  return [...rows].sort((a,b)=>sort==='newest'
    ?String(b.created_at||'').localeCompare(String(a.created_at||''))
    :String(a.code||a.id||'').localeCompare(String(b.code||b.id||''),undefined,{numeric:true}));
}
