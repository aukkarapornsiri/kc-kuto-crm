import test from 'node:test';import assert from 'node:assert/strict';
import {SAMPLE_DEALS,SELLERS,summarize,PRODUCTS,STAGES} from '../src/executive-dashboard.mjs';
test('sample fixture reconciles all KPI and chart rollups for every quarter and team',()=>{
 for(const quarter of [2,3])for(const team of ['all','Enterprise','Commercial','Solutions']){
 const people=SELLERS.filter(p=>team==='all'||p[3]===team),rows=SAMPLE_DEALS.filter(r=>r.quarter===quarter&&people.some(p=>p[0]===r.seller)),m=summarize(rows,people.length);
 assert.equal(rows.length,people.length*12);assert.equal(m.target,people.length*2500000);
 assert.equal(m.revenue,PRODUCTS.reduce((n,p)=>n+rows.filter(r=>r.status==='Won'&&r.product===p).reduce((a,r)=>a+r.amount,0),0));
 assert.equal(m.pipeline,STAGES.reduce((n,p)=>n+rows.filter(r=>r.status==='Open'&&r.stage===p).reduce((a,r)=>a+r.amount,0),0));
 assert.equal(m.forecast,m.revenue+m.weighted);assert.equal(m.won+m.lost+m.open,rows.length);
 assert.equal(m.profit,rows.filter(r=>r.status==='Won').reduce((n,r)=>n+r.amount-r.cost,0));
 }
});
test('known Q3 totals and empty scope have defined values',()=>{const m=summarize(SAMPLE_DEALS.filter(r=>r.quarter===3),6);assert.equal(m.revenue,15435000);assert.equal(m.weighted,7374500);assert.equal(m.winRate,30/42);assert.equal(summarize([],0).attainment,0);assert.equal(summarize([],0).winRate,0);assert.equal(new Set(SAMPLE_DEALS.map(r=>r.id)).size,144);});
