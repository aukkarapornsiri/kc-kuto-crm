export const CONTACT_VIEWS=Object.freeze([
  {id:'recent',th:'ที่ดูล่าสุด',en:'Recently Viewed'},
  {id:'mine',th:'ผู้ติดต่อของฉัน',en:'My Contacts'},
  {id:'all',th:'ผู้ติดต่อทั้งหมด',en:'All Contacts'},
  {id:'week',th:'สร้างใหม่ในสัปดาห์นี้',en:'Created This Week'},
  {id:'primary',th:'ผู้ติดต่อหลัก',en:'Primary Contacts'},
]);

export function filterContactView(rows,{view='all',ownerId,recentIds=[],now=new Date()}={}){
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7));
  const byRecent=new Map(recentIds.map((id,index)=>[id,index]));
  const result=rows.filter(row=>{
    if(view==='mine')return !!ownerId&&row.owner_id===ownerId;
    if(view==='recent')return byRecent.has(row.id);
    if(view==='week')return !!row.created_at&&new Date(row.created_at)>=monday&&new Date(row.created_at)<=now;
    if(view==='primary')return row.is_primary===true;
    return true;
  });
  return result.sort(view==='recent'?(a,b)=>byRecent.get(a.id)-byRecent.get(b.id):
    (a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
}

export function addRecentContact(ids,id){return [id,...ids.filter(value=>value!==id)].slice(0,50);}
