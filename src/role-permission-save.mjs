export const permissionSignature=rows=>JSON.stringify([...rows].sort((a,b)=>a.module.localeCompare(b.module)).map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>k==='module'||k.startsWith('can_')).sort(([a],[b])=>a.localeCompare(b)))));
export async function saveRolePermissions(client,role,rows,expected){
 const {data,error}=await client.rpc('crm_set_role_permissions',{p_role:role,p_rows:rows,p_expected:expected});
 if(error){if(error.code==='40001')throw Error('สิทธิ์ถูกแก้ไขโดยผู้อื่น กรุณาโหลดสิทธิ์ใหม่ / Permissions changed. Reload before saving.');throw error;}
 if(!Array.isArray(data)||permissionSignature(data)!==permissionSignature(rows))throw Error('ไม่สามารถยืนยันสิทธิ์ที่บันทึก กรุณาโหลดใหม่ / Saved permissions could not be verified. Reload.');
 return rows.map(row=>data.find(saved=>saved.module===row.module));
}
