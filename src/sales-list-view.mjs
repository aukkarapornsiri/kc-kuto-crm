export const SALES_VIEWS=Object.freeze([
  {id:'open',th:'โอกาสที่เปิดอยู่ทั้งหมด',en:'All Open Opportunities'},
  {id:'mine',th:'โอกาสของฉัน',en:'My Opportunities'},
  {id:'all',th:'โอกาสทั้งหมด',en:'All Opportunities'},
  {id:'closing',th:'ปิดการขายเดือนนี้',en:'Closing This Month'},
  {id:'won',th:'ปิดการขายสำเร็จ',en:'Won Opportunities'},
]);

export function filterSalesView(rows,{view='open',ownerId,now=new Date()}={}){
  const currentMonth=new Date(now).toISOString().slice(0,7);
  return rows.filter(row=>{
    if(view==='open')return !['won','lost'].includes(row.status);
    if(view==='mine')return row.owner_id===ownerId;
    if(view==='closing')return !['won','lost'].includes(row.status)&&String(row.close_date||'').slice(0,7)===currentMonth;
    if(view==='won')return row.status==='won';
    return true;
  });
}
