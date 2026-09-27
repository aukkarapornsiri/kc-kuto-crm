import assert from 'node:assert/strict';
import test from 'node:test';
import {contextEntries,firstPage,railEntries} from '../src/context-navigation.mjs';

const label=en=>({en,th:en});
const page=(id,en,visibleInSidebar=true)=>({id,label:label(en),visibleInSidebar});
const fixture=[
  {id:'dashboard',label:label('Dashboard')},
  {id:'leads',label:label('Leads'),subs:[page('lead-list','Lead Inbox')]},
  {id:'contacts',label:label('Contacts'),subs:[page('contact-list','Contact List')]},
  {id:'customers',label:label('Customers'),subs:[page('customer-list','Customer List'),page('branches','Branches',false)]},
  {id:'opportunities',label:label('Opportunities'),subs:[page('pipeline','Pipeline Kanban'),page('opp-list','Opportunity List')]},
  {id:'quotations',label:label('Quotations'),subs:[page('quotes','Quotation List'),page('quot-pricebook','Price Book')]},
  {id:'contracts',label:label('Contracts & Renewal'),subs:[page('contracts','All Contracts')]},
  {id:'assets',label:label('Assets / Installed Base'),subs:[page('assets','All Assets')]},
  {id:'tickets',label:label('Tickets / Service Desk'),subs:[page('tickets','All Tickets')]},
  {id:'activities',label:label('Activities'),subs:[page('activities','My Activities')]},
  {id:'documents',label:label('Documents'),subs:[page('documents','All Documents')]},
  {id:'reports',label:label('Reports & Analytics')},
  {id:'ai',label:label('AI Insights'),subs:[page('ai','AI Customer Summary')]},
  {id:'settings',label:label('Settings'),subs:[page('settings','Settings center')]},
];

test('ten rail categories preserve routes to fourteen existing modules',()=>{
  const rail=railEntries(fixture);
  assert.deepEqual(rail.map(item=>item.id),['dashboard','leads','contacts','customers','sales','service','activities','documents','insights','settings']);
  assert.deepEqual(rail.flatMap(item=>item.moduleIds).sort(),fixture.map(item=>item.id).sort());
  assert.deepEqual(rail.find(item=>item.id==='sales').target,{moduleId:'opportunities',pageId:'opp-list'});
  assert.deepEqual(rail.find(item=>item.id==='dashboard').target,{moduleId:'dashboard',pageId:'dashboard'});
  assert.deepEqual(firstPage(fixture.at(-1)),{moduleId:'settings',pageId:'set-hub'});
});

test('context tabs expose grouped modules and direct module pages',()=>{
  assert.deepEqual(contextEntries(fixture,'quotations').items.map(item=>item.module.id),['leads','contacts','customers','opportunities','quotations','quotations','contracts','activities','reports']);
  assert.equal(contextEntries(fixture,'quotations').items[4].page.id,'quot-pricebook');
  const direct=contextEntries(fixture,'customers');
  assert.deepEqual(direct.items.map(item=>item.page.id),['customer-list']);
  assert.deepEqual(direct.extra.map(item=>item.id),['branches']);
});
