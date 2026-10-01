import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('KC Account 360 quotation connector records only real remote identifiers and honors disabled state',async()=>{
  const [server,migration,workspace]=await Promise.all([
    readFile(new URL('../supabase/functions/server/index.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261001025510_quotation_account360_sync_state.sql',import.meta.url),'utf8'),
    readFile(new URL('../src/internal-workspace.mjs',import.meta.url),'utf8')
  ]);
  assert.match(server,/provider:"kc_account_360"/);
  assert.match(server,/account360_sync_status:"not_configured"/);
  assert.match(server,/KC Account 360 connector is disabled/);
  assert.match(server,/account360_sync_status:"syncing"/);
  assert.match(server,/account360_financial_record_id:financialRecordId/);
  assert.match(server,/account360_event_id:integrationEventId/);
  assert.match(server,/account360_sync_status:"synced"/);
  assert.match(server,/account360_sync_status:"error"/);
  assert.doesNotMatch(server,/const accountDocumentNo=/);
  assert.doesNotMatch(server,/account360_document_no:accountDocumentNo/);
  assert.match(migration,/account360_financial_record_id/);
  assert.match(migration,/account360_event_id/);
  assert.match(migration,/account360_sync_status/);
  assert.match(workspace,/account360_sync_status/);
  assert.match(workspace,/account360_financial_record_id/);
  assert.match(workspace,/account360_event_id/);
});
