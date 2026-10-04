import assert from 'node:assert/strict';
import {applyCompanyQuotationDefaults} from '../src/quotation-company.mjs';
const template={logo_url:'ribbon.png',company_phone:'old'};
const company={logo_url:'company.png',company_name:'Company',company_details:{sales_name:'Sales Team',sales_phone:'021234567',sales_email:'sales@example.com',sales_line:'@kaicom'}};
const next=applyCompanyQuotationDefaults(template,company);
assert.equal(next.company_logo_url,'company.png');assert.equal(next.logo_url,'ribbon.png');assert.equal(next.sales_name,'Sales Team');assert.equal(next.company_phone,'021234567');assert.equal(next.company_email,'sales@example.com');assert.equal(next.sales_line,'@kaicom');assert.equal(template.company_phone,'old');assert.equal(JSON.parse(JSON.stringify(next)).sales_line,'@kaicom');
console.log('PASS company branding, sales contact and immutable quotation snapshot');
