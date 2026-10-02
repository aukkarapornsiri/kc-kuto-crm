import {test} from 'node:test';
import assert from 'node:assert/strict';
import {microsoftOptions} from '../src/microsoft-login.mjs';
test('Microsoft redirects to the CRM path without copying tokens or error parameters',()=>{
 const options=microsoftOptions('https://aukkarapornsiri.github.io/kc-kuto-crm/?error=test#access_token=private');
 assert.equal(options.provider,'azure');
 assert.equal(options.options.redirectTo,'https://aukkarapornsiri.github.io/kc-kuto-crm/');
 assert.equal(options.options.scopes,'openid profile email');
 assert.equal(options.options.queryParams.prompt,'select_account');
});
