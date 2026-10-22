import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const result=spawnSync(process.execPath,['scripts/run-lua-check.mjs','tests/lua-performance.lua'],{encoding:'utf8',timeout:240000});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
const samples=(result.stdout??'').split(/\r?\n/).filter(l=>l.startsWith('SAMPLE ')).map(l=>JSON.parse(l.slice(7)));
const report={runtime:'lua-fengari',scope:'isolated real search; no UI/device performance claim',timingSource:'Fengari 0.1.5 Node os.clock uses process.uptime: host elapsed time including GC/scheduling, not CPU time',sourceSHA256:createHash('sha256').update(readFileSync('dist/main.lua')).digest('hex'),samples,error:result.error?.message,exitCode:result.status};
writeFileSync(process.argv[2]??'records/lua-step6-performance.json',JSON.stringify(report,null,2)+'\n');
if(result.status!==0||samples.length!==12)process.exitCode=1;
