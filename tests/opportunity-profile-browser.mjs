import assert from 'node:assert/strict';

export async function fillOpportunityProfile(form,accountName) {
  const account=form.getByRole('combobox',{name:'Account Name',exact:true});
  await account.fill(accountName);
  await form.getByRole('option',{name:new RegExp(accountName)}).click();
  await form.getByLabel('Close Date',{exact:true}).fill('2026-10-31');
  await form.getByLabel('Amount',{exact:true}).fill('120000.50');
  await form.getByLabel('Description',{exact:true}).fill('Linked opportunity description');
  await form.getByLabel('Stage',{exact:true}).selectOption('Proposal');
  await form.getByLabel('Probability (%)',{exact:true}).fill('60');
  await form.getByLabel('Forecast Category',{exact:true}).selectOption('Best Case');
  await form.getByLabel('Next Step',{exact:true}).fill('Schedule customer review');
  assert.notEqual(await form.getByLabel('Opportunity Owner',{exact:true}).inputValue(),'');
}

export async function checkOpportunityProfile(form) {
  const values={'Close Date':'2026-10-31',Amount:'120000.50',Description:'Linked opportunity description',Stage:'Proposal','Probability (%)':'60','Forecast Category':'Best Case','Next Step':'Schedule customer review'};
  for(const [label,value] of Object.entries(values)){const actual=await form.getByLabel(label,{exact:true}).inputValue();assert.equal(['Amount','Probability (%)'].includes(label)?Number(actual.replaceAll(',','')):actual,['Amount','Probability (%)'].includes(label)?Number(value):value,label);}
  assert.equal(await form.getByRole('button',{name:'Save & New',exact:true}).count(),0);
}
