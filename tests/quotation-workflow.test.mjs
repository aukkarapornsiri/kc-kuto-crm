import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('quotation financial fields are approval-gated and contract handoff stays wired',async()=>{
  const [workspace,quotation]=await Promise.all([
    readFile(new URL('../src/internal-workspace.mjs',import.meta.url),'utf8'),
    readFile(new URL('../src/quotation-document.mjs',import.meta.url),'utf8')
  ]);
  assert.match(quotation,/canViewFinancials=false/);
  assert.match(quotation,/const showGP=!!canViewFinancials&&!!template\.show_gp/);
  assert.match(quotation,/showMargin=!!canViewFinancials&&!!template\.show_margin/);
  assert.match(workspace,/entity==='prices'&&\['create','edit','delete'\]\.includes\(action\)/);
  assert.match(workspace,/entity==='prices'&&f\.key==='cost'&&!can\('approve'\)/);
  assert.match(workspace,/client\.rpc\('crm_price_catalog'\)/);
  assert.match(workspace,/สร้างสัญญาจากใบเสนอราคา/);
  assert.match(workspace,/sourceQuotationId:selected\.id/);
  assert.match(workspace,/sourceOpportunityId:selected\.opportunity_id/);
  assert.match(workspace,/sourceCustomerId:selected\.customer_id/);
  assert.match(workspace,/sourceValue:Number\(selected\.total\|\|selected\.net_total\|\|0\)/);
  assert.match(workspace,/canViewFinancials:can\('approve'\)/);
});
