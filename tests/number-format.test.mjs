import test from 'node:test';
import assert from 'node:assert/strict';
import {groupDecimal,ungroupDecimal,formatNumericField,shouldGroupInput,numericValidity,createNumberPresentation} from '../src/number-format.mjs';
test('grouping preserves signs, fractional precision and editable decimal drafts',()=>{
 for(const [raw,formatted] of [['1234567.50','1,234,567.50'],['-12345.0001','-12,345.0001'],['0','0'],['',''],['-','-'],['1000.','1,000.'],['.50','.50']]){assert.equal(groupDecimal(raw),formatted);assert.equal(ungroupDecimal(formatted),raw);}
});
test('identifiers and calendar years are excluded but numeric fields and amounts are grouped',()=>{
 for(const key of ['phone','tax_id','barcode','postal_code','year','serial_number'])assert.equal(formatNumericField(key,'1234567'),'1234567');
 assert.equal(formatNumericField('amount','1234567.50'),'1,234,567.50');assert.equal(formatNumericField('quantity',12345),'12,345');
 assert.equal(shouldGroupInput({type:'number','aria-label':'ปีเป้าหมาย (ค.ศ.)'}),false);
 assert.equal(shouldGroupInput({type:'number','aria-label':'Target year (CE)'}),false);
 assert.equal(shouldGroupInput({type:'number','aria-label':'Amount'}),true);
 assert.equal(shouldGroupInput({type:'month'}),false);
});
test('formatted text inputs retain required, bounds and decimal increment validation',()=>{
 assert.equal(numericValidity('12345.50',{min:0,step:'.01'}),'');
 for(const [value,props] of [['',{required:true}],['-1',{min:0}],['101',{max:100}],['1.005',{step:'.01'}],['1e309',{}],['-',{}]])assert.ok(numericValidity(value,props));
 assert.equal(numericValidity('0.12345',{step:'any'}),'');
});
test('both JSX and factory rendering group numeric values without touching attributes or identifiers',()=>{
 const React={createElement:(type,props)=>({type,props}),forwardRef:fn=>fn};
 const ui=createNumberPresentation(React),jsx=ui.wrapJSX((type,props,key)=>({type,props,key}));
 const rendered=jsx('td',{children:[12345,'0100123456789'],title:12345},'row');
 assert.deepEqual(rendered.props.children,['12,345','0100123456789']);assert.equal(rendered.props.title,12345);assert.equal(rendered.key,'row');
 assert.equal(ui.React.createElement('strong',null,12345.5).props.children,'12,345.5');
 assert.equal(jsx('option',{value:2026,children:2026}).props.children,2026);
 assert.equal(jsx('input',{type:'number','aria-label':'Year'}).type,'input');
 assert.equal(typeof jsx('input',{type:'number','aria-label':'Amount'}).type,'function');
});
