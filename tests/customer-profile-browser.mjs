import assert from 'node:assert/strict';

const billing = {
  'Billing Country': 'Thailand', 'Billing Street': '11 Billing Street',
  'Billing City': 'Bangrak', 'Billing State / Province': 'Bangkok',
  'Billing Postal Code': '10500',
};
const shipping = {
  'Shipping Country': 'Japan', 'Shipping Street': '22 Shipping Street',
  'Shipping City': 'Chiyoda', 'Shipping State / Province': 'Tokyo',
  'Shipping Postal Code': '1000001',
};
const contact = {website:'https://example.test', Description:'Independent address regression',phone:'020000000',email:'qa@example.test'};
const field = (form, name) => form.getByLabel(name, {exact:true});
async function checkValues(form, values) {
  for (const [name, value] of Object.entries(values)) assert.equal(await field(form,name).inputValue(),value,name);
}
export async function fillCustomerProfile(form) {
  assert.equal(await field(form,'Account Name').getAttribute('required'),'');
  assert.notEqual(await field(form,'Account Owner').inputValue(),'','Default account owner is required');
  for (const [name,value] of Object.entries({...contact,...billing})) await field(form,name).fill(value);
  await form.getByRole('button',{name:'Copy billing to shipping',exact:true}).click();
  await checkValues(form,Object.fromEntries(Object.entries(billing).map(([name,value])=>[name.replace('Billing','Shipping'),value])));
  for (const [name,value] of Object.entries(shipping)) await field(form,name).fill(value);
  await checkValues(form,billing);
}
export async function checkCustomerProfile(form) {
  await checkValues(form,{...contact,...billing,...shipping});
  assert.equal(await form.getByRole('button',{name:'Save & New',exact:true}).count(),0,'Existing records must not offer Save & New');
}

// Creates a linked service case through the Service Desk, then checks every Customer 360 return link.
export async function checkCustomerWorkflow(page,open,width) {
  await open('Tickets / Service Desk','All Tickets');
  const service=page.locator('[data-service-desk]').first();await service.getByRole('button',{name:'+ สร้างเคส / Create case',exact:true}).click();
  const caseDialog=page.getByRole('dialog');await caseDialog.getByLabel('Subject',{exact:true}).fill('QA linked service ticket');await caseDialog.getByLabel('Customer',{exact:true}).selectOption({index:1});await caseDialog.getByLabel('Asset / Serial number',{exact:true}).selectOption({index:1});await caseDialog.getByRole('button',{name:'บันทึก / Save',exact:true}).click();await caseDialog.waitFor({state:'hidden'});
  await open('Accounts','Account List');
  const accounts=page.locator('[data-entity="customers"]');
  await accounts.getByRole('button',{name:/^Details /}).first().click();
  const detail=accounts.getByRole('region',{name:'Record details'});
  const accountCode=await detail.getByRole('heading',{level:2}).innerText();
  const linked=[['Leads','leads'],['Contacts','contacts'],['Customer branches','branches'],['Opportunities','opportunities'],['Quotations','quotations'],['Contracts and renewal','contracts'],['Customer assets','assets'],['Service tickets','tickets'],['Activities and follow-ups','activities'],['Documents','documents']];
  for(const [title,entity] of linked){
    const section=detail.getByRole('heading',{name:`${title} (1)`,exact:true}).locator('..');
    await section.getByRole('button').first().click();
    if(entity==='tickets'){await service.getByRole('button',{name:'Customer',exact:true}).click();await service.getByRole('button',{name:'เปิดบัญชีลูกค้า / Customer 360',exact:true}).click();await detail.getByRole('heading',{name:accountCode,exact:true}).waitFor();continue;}
    const linkedDetail=page.locator(`[data-entity="${entity}"]`).getByRole('region',{name:'Record details'});
    await linkedDetail.waitFor();
    await linkedDetail.getByRole('button',{name:'Open Account',exact:true}).click();
    await detail.getByRole('heading',{name:accountCode,exact:true}).waitFor();
  }
  await detail.getByRole('button',{name:'Close details',exact:true}).click();
  await accounts.getByRole('button',{name:'Create Account',exact:true}).click();
  const form=accounts.getByRole('form',{name:'Customer form'});
  await field(form,'Account Name').fill('QA batch child');
  await field(form,'Parent Account').selectOption({label:'QA customers updated'});
  await field(form,'Billing Street').fill('Batch billing');
  await form.getByRole('button',{name:'Copy billing to shipping',exact:true}).click();
  const owner=await field(form,'Account Owner').inputValue();
  await form.getByRole('button',{name:'Save & New',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('form[aria-label="Customer form"] input[aria-label="Account Name"]')?.value==='');
  await checkValues(form,{'Account Name':'','Billing Street':'','Shipping Street':'','Parent Account':'','Account Owner':owner});
  await form.getByRole('button',{name:'Cancel',exact:true}).click();
  await accounts.getByRole('status').filter({hasText:/^2 records/}).waitFor();
  await accounts.getByRole('button',{name:'Create Account',exact:true}).click();
  await field(form,'Account Name').fill('QA grandchild');
  await field(form,'Parent Account').selectOption({label:'QA batch child'});
  await form.getByRole('button',{name:'Save',exact:true}).click();
  await detail.getByRole('button',{name:'Open Parent Account',exact:true}).click();
  await detail.getByRole('button',{name:'Open Parent Account',exact:true}).click();
  await detail.getByRole('heading',{name:accountCode,exact:true}).waitFor();
  await detail.getByRole('button',{name:'Edit',exact:true}).click();
  const parentOptions=await field(form,'Parent Account').locator('option').allTextContents();
  for(const name of ['QA customers updated','QA batch child','QA grandchild']) assert.ok(!parentOptions.includes(name),`Cannot select self or descendant: ${name}`);
  await checkCustomerProfile(form);
  await page.screenshot({path:`test-artifacts/customer-profile-${width}.png`,fullPage:true});
  await form.getByRole('button',{name:'Cancel',exact:true}).click();
  await accounts.getByRole('button',{name:'Create Account',exact:true}).click();
  await field(form,'Account Name').fill('QA cancelled customer');
  await page.keyboard.press('Escape');
  await form.waitFor({state:'hidden'});
  await accounts.getByRole('status').filter({hasText:/^3 records/}).waitFor();
  console.log(`PASS customer workflow ${width}px: separate addresses, copy, persisted edit, Save & New reset, cancellation, parent hierarchy and 10 bidirectional related links; demo records only`);
}
