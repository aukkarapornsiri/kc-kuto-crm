import assert from 'node:assert/strict';
import {financialSnapshot} from '../src/quotation-detail.mjs';
const row={subtotal:1000,discount:100,items:[{},{}]};
assert.equal(financialSnapshot(row,null),null);
assert.equal(financialSnapshot(row,{cost_total:900,gp_amount:0,gp_margin:24}),null);
assert.equal(financialSnapshot(row,{cost_total:700,gp_amount:200,gp_margin:22.22,line_financials:[{},{}]}).gp_margin,22.22);
assert.equal(financialSnapshot(row,{cost_total:900,gp_amount:0,gp_margin:0}).gp_amount,0);
assert.equal(financialSnapshot({...row,subtotal:100,discount:100},{cost_total:10,gp_amount:-10,gp_margin:0}).gp_amount,-10);
console.log('PASS historical missing/inconsistent data, weighted total margin, true zero GP and zero revenue');
