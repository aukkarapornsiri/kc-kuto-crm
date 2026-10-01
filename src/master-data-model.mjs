export const CATEGORIES = [
 ['customer_type','ประเภทลูกค้า','Customer Type'],['industry','ประเภทธุรกิจ','Industry'],
 ['lead_source','แหล่งที่มาของลูกค้า','Lead Source'],['sales_stage','ขั้นตอนการขาย','Sales Stage'],
 ['product_category','หมวดหมู่สินค้า','Product Category'],['region','ภูมิภาค','Region'],
 ['tier','ระดับ','Tier'],['unit','หน่วย','Unit'],['tag','แท็ก','Tag'],['loss_reason','เหตุผลที่แพ้','Loss Reason'],
 ['business_line','สายธุรกิจ','Business line'],['product_type','ประเภทสินค้าและบริการ','Product type'],['product_kind','ชนิดสินค้าและบริการ','Product kind'],['accounting_account','บัญชีลงรายการ','Accounting account'],
 ['asset_type','ประเภทสินทรัพย์','Asset type'],['asset_brand','ยี่ห้อสินทรัพย์','Asset brand'],['asset_model','รุ่นสินทรัพย์','Asset model'],['asset_status','สถานะสินทรัพย์','Asset status'],['warranty_status','สถานะประกัน','Warranty status'],['license_status','สถานะไลเซนส์','License status'],['asset_location','ที่ตั้งสินทรัพย์','Asset location']
];
export function validateMaster(input) {
 const out={category:String(input.category??''),code:String(input.code??'').trim().toUpperCase(),name_th:String(input.name_th??'').trim(),name_en:String(input.name_en??'').trim(),sort_order:Number(input.sort_order),status:input.status};
 if(!CATEGORIES.some(([id])=>id===out.category))throw Error('หมวดหมู่ไม่ถูกต้อง / Invalid category');
 if(!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(out.code))throw Error('Code: A–Z, 0–9, _ หรือ - ไม่เกิน 40 ตัว / Maximum 40 characters');
 if(!out.name_th||out.name_th.length>200||out.name_en.length>200)throw Error('กรอกชื่อไทยและอังกฤษ ไม่เกิน 200 ตัว / Name required, maximum 200 characters');
 if(String(input.sort_order).trim()===''||!Number.isInteger(out.sort_order)||out.sort_order<0||out.sort_order>9999)throw Error('ลำดับต้องเป็นจำนวนเต็ม 0–9999 / Order must be an integer from 0 to 9999');
 if(!['active','inactive'].includes(out.status))throw Error('สถานะไม่ถูกต้อง / Invalid status');
 out.name_en=out.name_en||out.name_th;
 out.description=String(input.description??'').trim();if(out.description.length>5000)throw Error('รายละเอียดไม่เกิน 5,000 ตัว / Description maximum 5,000 characters');
 for(const key of CATEGORY_LINKS){const value=input[key]||null;if(value&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))throw Error('Invalid master reference');out[key]=out.category==='product_category'?value:null;}
 return out;
}

export const CATEGORY_LINKS=['business_line_id','income_account_id','expense_account_id','inventory_account_id','asset_account_id','deferred_account_id'];
export const masterDemo={rows:[]};
const samples=[
 ['unit','UNIT','หน่วย','Unit'],['unit','SET','ชุด','Set'],['unit','LICENSE','ไลเซนส์','License'],['unit','MONTH','เดือน','Month'],
 ['product_type','HARDWARE','Hardware','Hardware'],['product_type','SERVICE','Service','Service'],
 ['product_kind','COMPUTER','คอมพิวเตอร์','Computer'],['product_kind','ACCESSORY','อุปกรณ์เสริมไอที','IT Accessories'],['product_kind','SUPPORT','บริการไอที','IT Service'],
 ['business_line','IT','สินค้าและโซลูชันไอที','IT Products & Solutions'],
 ['product_category','PC','คอมพิวเตอร์','Computers'],['product_category','ACC','อุปกรณ์เสริมไอที','IT Accessories'],
 ['asset_brand','DELL','Dell','Dell'],['asset_brand','KC-MOBILE','KC Mobile','KC Mobile'],['asset_brand','HP','HP','HP'],['asset_brand','LENOVO','Lenovo','Lenovo'],
 ['accounting_account','410100','410100 รายได้จากการขายสินค้า','410100 Product revenue'],['accounting_account','510100','510100 ต้นทุนขายสินค้า','510100 Cost of goods sold'],['accounting_account','115100','115100 สินค้าคงเหลือ','115100 Inventory'],['accounting_account','123100','123100 อุปกรณ์คอมพิวเตอร์','123100 Computer equipment'],['accounting_account','214100','214100 รายได้รับล่วงหน้า','214100 Deferred revenue']
];
export function ensureMasterSamples(){if(masterDemo.initialized)return;masterDemo.initialized=true;masterDemo.rows=samples.map(([category,code,name_th,name_en],i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),category,code,name_th,name_en,sort_order:i,status:'active',version:1,description:'ข้อมูลตัวอย่าง / Sample reference'}));const ref=code=>masterDemo.rows.find(r=>r.code===code).id;for(const row of masterDemo.rows.filter(r=>r.category==='product_category'))Object.assign(row,{business_line_id:ref('IT'),income_account_id:ref('410100'),expense_account_id:ref('510100'),inventory_account_id:ref('115100'),asset_account_id:ref('123100'),deferred_account_id:ref('214100')});}
export const SAMPLE_PRODUCTS=[
 {code:'ADA-01',name:'ADAPTER FOR DELL 5450',unit:'หน่วย',category:'อุปกรณ์เสริมไอที',brand:'Dell',product_type:'Hardware',product_kind:'อุปกรณ์เสริมไอที',stock_mode:'stock',price:1990,cost:1550,description:'ข้อมูลตัวอย่างจากภาพแนบ / Sample from reference image'},
 {code:'PRD-000001',name:'KC Industrial PC AIO Touch Screen 23.6Inc',unit:'หน่วย',category:'คอมพิวเตอร์',brand:'KC Mobile',product_type:'Hardware',product_kind:'คอมพิวเตอร์',stock_mode:'stock',price:28000,cost:22000,description:'Brand KC Mobile\nProduct Name KC Industrial PC AIO Touch Screen 23.6Inc RK3576 (KC-P236)\nDisplay 23.6Inc\nProcessor RK3576\nMemory 8GB\nStorage 128GB\nTouch Screen Touch\nOS Windows 11'}
];
