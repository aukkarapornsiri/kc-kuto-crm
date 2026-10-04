import {spawnSync} from 'node:child_process';
import {readdirSync,writeFileSync,mkdirSync} from 'node:fs';
const suites=['quick-create-smoke','customer360-smoke','customer360-create-smoke','header-ai-chat-smoke','quotation-layout-smoke','quotation-details-smoke','sales-targets-smoke','sales-attainment-ring-smoke','dashboard-layout-smoke','internal-workspace-smoke','opportunity-dialog-smoke','navigation-smoke','smoke','settings-cards-smoke','settings-smoke','master-data-smoke','settings-workspace-smoke','workspace-theme-smoke','executive-smoke','marketing-map-smoke','service-desk-smoke','inventory-smoke'];
const results=[],started=new Date().toISOString();mkdirSync('test-artifacts/full-test',{recursive:true});
function run(name,args){const start=Date.now(),r=spawnSync(process.execPath,args,{encoding:'utf8',timeout:360000,env:process.env,maxBuffer:12*1024*1024});const log=(r.stdout||'')+(r.stderr||'')+(r.error?.message||'');writeFileSync('test-artifacts/full-test/'+name+'.log',log);results.push({name,passed:r.status===0,seconds:Math.round((Date.now()-start)/1000),exitCode:r.status});writeFileSync('test-artifacts/full-test/results.json',JSON.stringify({started,updated:new Date().toISOString(),results},null,2));console.log((r.status===0?'PASS ':'FAIL ')+name+' '+results.at(-1).seconds+'s');if(r.status!==0)console.log(log.slice(-2500));}
run('unit',['--test',...readdirSync('tests').filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x)]);
run('integration-contract',['tests/integration-contract.mjs']);
for(const suite of suites)run(suite,['tests/'+suite+'.mjs']);
console.log('FULL TEST '+results.filter(x=>x.passed).length+'/'+results.length+' passed');process.exitCode=results.some(x=>!x.passed)?1:0;
