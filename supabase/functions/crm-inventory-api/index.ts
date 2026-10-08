import {createClient} from 'npm:@supabase/supabase-js@2.115.0';
import {mapItem} from './model.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!token)return json({error:'Unauthorized'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:user,error:authError}=await client.auth.getUser(token);
 if(authError||!user.user)return json({error:'Unauthorized'},401);
 const {data:access,error:accessError}=await client.rpc('crm_account360_inventory_access');
 if(accessError||!access?.allowed)return json({error:'Inventory access required'},403);
 const url=new URL(req.url),resource=url.searchParams.get('resource')||'items',offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||100);
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>500)return json({error:'Invalid pagination'},400);
 try{
  let rows:any[];
  if(resource==='items'){
   const result=await client.rpc('crm_price_catalog').order('id').range(offset,offset+limit);if(result.error)throw result.error;
   const items=result.data||[],ids=items.map((x:any)=>x.id);
   const details=ids.length?await client.from('crm_item_details').select('*').in('id',ids):{data:[],error:null};if(details.error)throw details.error;
   rows=items.map((item:any)=>mapItem(item,details.data?.find((x:any)=>x.id===item.id)||{},access.can_see_cost));
  }else if(resource==='warehouses'||resource==='balances'){
   const table=resource==='warehouses'?'crm_warehouses':'crm_stock_balances';
   const columns=resource==='warehouses'?'id,code,name,address,active,updated_at':'id,item_id,warehouse_id,quantity,serial_number';
   const result=await client.from(table).select(columns).order('id').range(offset,offset+limit);if(result.error)throw result.error;rows=result.data||[];
  }else return json({error:'Unsupported resource'},400);
  const more=rows.length>limit;
  return json({service:'kc-cuto-inventory',version:1,resource,source:'KC CuTo CRM',mode:'read-only',items:rows.slice(0,limit),nextOffset:more?offset+limit:null,canSeeCost:!!access.can_see_cost,fetchedAt:new Date().toISOString()});
 }catch{return json({error:'Inventory data unavailable'},502);}
});
