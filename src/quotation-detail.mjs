import {quoteTotals} from './internal-model.mjs?v=20261001-service';
const number=x=>Number.isFinite(Number(x))&&x!==null&&x!==undefined;
export function financialSnapshot(row,financial){
 const net=Number(row.subtotal)-Number(row.discount||0);
 if(!financial||!['cost_total','gp_amount','gp_margin'].every(k=>number(financial[k])))return null;
 const gp=Number(financial.gp_amount),margin=net?gp/net*100:0;
 if(Math.abs(net-Number(financial.cost_total)-gp)>.02||Math.abs(margin-Number(financial.gp_margin))>.02)return null;
 const lines=financial.line_financials;
 return {...financial,line_financials:Array.isArray(lines)&&lines.length===row.items.length?lines:null};
}
export function createQuotationDetail({React,client}){
 const h=React.createElement,money=x=>Number(x||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 return function QuotationDetail({row,lang,canViewFinancials,demoMode}){
  const [state,setState]=React.useState({}),t=(th,en)=>lang==='th'?th:en;
  React.useEffect(()=>{let active=true;setState({});if(!canViewFinancials)return;
   if(demoMode){if(row.items.every(x=>number(x.cost))){const totals=quoteTotals(row.items,{taxRate:row.tax_rate??7,withholdingRate:row.wht_rate??0,documentDiscount:row.document_discount??0});setState({id:row.id,data:{cost_total:totals.cost_total,gp_amount:totals.gp_amount,gp_margin:totals.gp_margin,line_financials:totals.items.map(x=>({gp:x.gp,margin:x.margin}))}});}else setState({id:row.id,data:null});return;}
   client.from('crm_quotation_financials').select('cost_total,gp_amount,gp_margin,line_financials').eq('quotation_id',row.id).maybeSingle().then(({data,error})=>{if(active)setState({id:row.id,data,error:!!error});}).catch(()=>{if(active)setState({id:row.id,error:true});});return()=>{active=false;};
  },[row,canViewFinancials,demoMode]);
  const financial=state.id===row.id?financialSnapshot(row,state.data):null,lines=financial?.line_financials;
  const cell=(value,key)=>h('td',{key,className:'crm-internal-financial'},number(value)?money(value):'—');
  return h('div',{id:'crm-quotation-print'},h('h2',null,t('ใบเสนอราคา ','Quotation ')+row.code),h('p',null,row.customer_name),
   h('div',{className:'crm-quotation-detail-table'},h('table',{className:'crm-master-table'},
    h('thead',null,h('tr',null,...[t('รายการ','Description'),t('จำนวน','Qty'),t('หน่วย','Unit'),t('ราคาต่อหน่วย','Unit price'),t('ราคารวม','Amount')].map(x=>h('th',{key:x},x)),canViewFinancials&&h('th',{className:'crm-internal-financial'},'GP (THB)'),canViewFinancials&&h('th',{className:'crm-internal-financial'},'Margin (%)'))),
    h('tbody',null,row.items.map((x,i)=>h('tr',{key:i},h('td',null,x.name+' '+(x.desc||'')),h('td',null,x.qty),h('td',null,x.unit),h('td',null,money(x.price)),h('td',null,money(x.total)),canViewFinancials&&cell(lines?.[i]?.gp,'gp'),canViewFinancials&&cell(lines?.[i]?.margin,'margin')))),
    h('tfoot',null,h('tr',null,h('th',{colSpan:4},t('รวมหลังส่วนลด ก่อน VAT','Total after discounts, before VAT')),h('th',null,money(Number(row.subtotal)-Number(row.discount||0))),canViewFinancials&&cell(financial?.gp_amount,'gp'),canViewFinancials&&cell(financial?.gp_margin,'margin'))))),
   canViewFinancials&&h('p',{className:'crm-internal-financial crm-financial-note'},state.id!==row.id?t('กำลังโหลด GP และ Margin…','Loading GP and Margin…'):state.error?t('โหลดข้อมูล GP และ Margin ไม่สำเร็จ กรุณาเปิดรายละเอียดอีกครั้ง','Unable to load GP and Margin. Please reopen details.'):!lines?t('ข้อมูลต้นทุนรายสินค้าเดิมไม่ครบ จึงแสดง — แทนตัวเลขที่ยังตรวจสอบไม่ได้','Historical item costs are incomplete. Unverified figures are shown as —.'):t('GP รายการ = ยอดหลังส่วนลดรายการ − ต้นทุน • GP รวมหักส่วนลดท้ายบิลแล้ว • Margin รวม = GP รวม ÷ ยอดก่อน VAT × 100','Item GP = line net − cost. Total GP includes document discount. Total Margin = total GP ÷ net before VAT × 100.')),
   h('p',null,t('ยอดก่อนส่วนลด: ','Subtotal: ')+money(row.subtotal)+' • '+t('ส่วนลด: ','Discount: ')+money(row.discount)+' • VAT: '+money(row.vat)),h('h3',null,t('ราคารวม: ','Total: ')+money(row.total)+' THB'),h('p',null,row.note));
 };
}
