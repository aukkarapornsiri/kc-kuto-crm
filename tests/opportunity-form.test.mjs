import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord,summarizePipeline} from '../src/internal-model.mjs';
import {opportunityStagePatch} from '../src/opportunity-dialog.mjs';
const draft={name:'Server project',customer_id:'customer',contact_id:'contact',owner_id:'owner',close_date:'2026-10-31',amount:'120000.50',probability:'60',stage:'Proposal',status:'open',forecast_category:'Best Case',solution:'Description',next_action:'Customer review'};

test('required opportunity fields and numeric boundaries are enforced',()=>{
  for(const field of ['name','customer_id','owner_id','close_date','stage','forecast_category'])assert.throws(()=>validateRecord('opportunities',{...draft,[field]:''}),new RegExp(field));
  for(const probability of [-1,101,25.5,NaN])assert.throws(()=>validateRecord('opportunities',{...draft,probability}));
  for(const amount of [-1,1e15,Infinity])assert.throws(()=>validateRecord('opportunities',{...draft,amount}));
});

test('all screenshot fields persist through the payload and weighted pipeline agrees',()=>{
  const payload=validateRecord('opportunities',draft);
  for(const field of ['customer_id','contact_id','owner_id','close_date','forecast_category','solution','next_action'])assert.equal(payload[field],draft[field]);
  assert.equal(payload.weighted_amount,72000.3);
  assert.equal(summarizePipeline([payload]).weighted,72000.3);
});

test('won and lost stages keep status, probability, forecast and weighted amount consistent',()=>{
  const won=validateRecord('opportunities',{...draft,...opportunityStagePatch('Won')});
  assert.equal(won.status,'won');assert.equal(won.forecast_category,'Closed Won');assert.equal(won.probability,100);assert.equal(won.weighted_amount,120000.5);
  assert.throws(()=>validateRecord('opportunities',{...draft,...opportunityStagePatch('Lost')}),/Lost reason/);
  const lost=validateRecord('opportunities',{...draft,...opportunityStagePatch('Lost'),lost_reason:'Budget'});
  assert.equal(lost.status,'lost');assert.equal(lost.forecast_category,'Closed Lost');assert.equal(lost.weighted_amount,0);
  assert.deepEqual(opportunityStagePatch('Proposal'),{stage:'Proposal',status:'open'});
  assert.throws(()=>validateRecord('opportunities',{...draft,forecast_category:'Closed Won'}),/Open opportunity/);
});
