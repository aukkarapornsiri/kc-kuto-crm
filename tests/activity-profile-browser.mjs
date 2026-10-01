import assert from 'node:assert/strict';

const values={
 'scheduled at':'2026-10-15T10:30', 'reminder at':'2026-10-15T10:00',
 Description:'Activity popup read-back', 'next action':'Send meeting notes',
 'meeting url':'https://example.test/meeting',
};
const field=(form,name)=>form.getByLabel(name,{exact:true});
export async function fillActivityProfile(form,page,width){
 const dialog=form.locator('..');
 assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true,'Activity must open as a native modal');
 assert.equal(await field(form,'subject').getAttribute('required'),'');
 assert.equal(await field(form,'scheduled at').getAttribute('required'),'');
 assert.notEqual(await field(form,'owner id').inputValue(),'','Activity defaults to signed-in owner');
 await field(form,'type').selectOption('Online Meeting');
 await field(form,'priority').selectOption('high');
 await field(form,'contact id').selectOption({label:'QA contacts updated'});
 for(const [name,value] of Object.entries(values))await field(form,name).fill(value);
 await field(form,'subject').focus();
 const box=await dialog.boundingBox();
 assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=1001,'Popup fits the viewport');
 assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'No horizontal modal overflow');
 await page.screenshot({path:`test-artifacts/activity-popup-${width}.png`,fullPage:true});
}
export async function checkActivityProfile(form){
 for(const [name,value] of Object.entries(values))assert.equal(await field(form,name).inputValue(),value,name);
 assert.equal(await field(form,'type').inputValue(),'Online Meeting');
 assert.equal(await field(form,'priority').inputValue(),'high');
 assert.equal(await field(form,'contact id').locator('option:checked').innerText(),'QA contacts updated');
 assert.equal(await form.getByRole('button',{name:'Save & New',exact:true}).count(),0);
}
export async function checkActivityWorkflow(page,open,width){
 await open('Activities','My Activities');
 const root=page.locator('[data-entity=activities]');
 await root.getByRole('button',{name:/^Details /}).first().click();
 const detail=root.getByRole('region',{name:'Record details'});
 assert.equal(await detail.getByRole('button',{name:'Open Contact',exact:true}).count(),1,'Activity links to its contact');
 await detail.getByRole('button',{name:'Edit',exact:true}).click();
 const form=root.getByRole('form',{name:'Record form'});
 await field(form,'customer id').selectOption({label:'QA batch child'});
 assert.equal(await field(form,'contact id').inputValue(),'','Changing customer clears contact');
 assert.deepEqual(await field(form,'contact id').locator('option').allTextContents(),['—'],'Only the selected customer contacts are offered');
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 await root.getByRole('button',{name:'Add record',exact:true}).click();
 const owner=await field(form,'owner id').inputValue();
 await field(form,'subject').fill('QA activity Save & New');
 await form.getByRole('button',{name:'Save & New',exact:true}).click();
 assert.equal(await field(form,'scheduled at').evaluate(el=>el.validity.valueMissing),true,'Required schedule prevents saving');
 await field(form,'scheduled at').fill('2026-10-16T09:00');
 await form.getByRole('button',{name:'Save & New',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.crm-activity-dialog input[aria-label=subject]')?.value==='');
 assert.equal(await field(form,'scheduled at').inputValue(),'');
 assert.equal(await field(form,'customer id').inputValue(),'');
 assert.equal(await field(form,'owner id').inputValue(),owner);
 await field(form,'subject').fill('QA cancelled activity');
 await page.keyboard.press('Escape');
 await form.waitFor({state:'hidden'});
 await root.getByRole('status').filter({hasText:/^2 records/}).waitFor();
 await root.getByRole('button',{name:'Add record',exact:true}).click();
 await form.getByRole('button',{name:'Close form',exact:true}).click();
 await form.waitFor({state:'hidden'});
 console.log(`PASS activity popup ${width}px: modal, dates and fields round-trip, customer/contact isolation, required schedule, Save & New, Escape and close cancellation`);
}
