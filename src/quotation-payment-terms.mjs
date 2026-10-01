export const PAYMENT_TERMS=Object.freeze([
 {code:'cash',days:0,th:'เงินสด',en:'Cash'},
 ...[7,15,30,45,60].map(days=>({code:'net-'+days,days,th:days+' วัน',en:days+' days'})),
 ...[7,15,30].map(days=>({code:'postdated-'+days,days,th:'เช็คลงวันที่ล่วงหน้า '+days+' วัน',en:'Postdated cheque '+days+' days'})),
 {code:'deposit-30',days:0,th:'มัดจำ 30% เครดิตส่วนที่เหลือ 70%',en:'30% deposit, 70% balance on credit'},
 {code:'deposit-50',days:0,th:'มัดจำ 50% เครดิตส่วนที่เหลือ 50%',en:'50% deposit, 50% balance on credit'},
 {code:'cheque-today',days:0,th:'เช็ควันนี้',en:'Cheque today'},
]);
export function resolvePaymentTerm(code,days=30){
 const known=PAYMENT_TERMS.find(term=>term.code===code);
 if(known)return known;
 if(code&&!/^legacy-\d{1,3}$/.test(code))throw Error('Invalid payment term');
 const n=code?Number(code.slice(7)):Number(days??30);
 if(!Number.isInteger(n)||n<0||n>365)throw Error('Invalid payment term days');
 return PAYMENT_TERMS.find(term=>term.code===(n===0?'cash':'net-'+n))||{code:'legacy-'+n,days:n,th:n+' วัน',en:n+' days'};
}
export function paymentTermOptions(code,days){
 const current=resolvePaymentTerm(code,days);
 return PAYMENT_TERMS.some(term=>term.code===current.code)?PAYMENT_TERMS:[...PAYMENT_TERMS,current];
}
