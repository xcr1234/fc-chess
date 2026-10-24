// Serial, isolated regression processes. A failure never hides later suites.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=file=>fs.readFileSync(path.join(root,file));
const files=[
 'tests/lua-ai-repetition.lua',
 'tests/lua-ai-rules.lua','tests/lua-ai-custom-light.lua','tests/lua-ai-generation.lua','tests/lua-ai-threats.lua','tests/lua-regression.lua',
 'tests/lua-ai-tactics.lua','tests/lua-ai-user-cannon.lua','tests/lua-ai-pvs.lua',
 'tests/lua-opening-book.lua','tests/lua-wait-extension.lua','tests/lua-feedback.lua'
];
const tasks=files.map(file=>({file,args:['scripts/run-lua-check.mjs',file]}));
if(!process.argv.includes('--rules-only')) tasks.push({file:'scripts/verify-ai-core.mjs',args:['scripts/verify-ai-core.mjs']});
const sourceFiles=fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(file=>file.endsWith('.lua')).sort();
const sourceHashes=Object.fromEntries(sourceFiles.map(file=>['src/'+file.replaceAll('\\','/'),hash(read('src/'+file))]));
const report={runtime:'Fengari 0.1.5 / Node '+process.version,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 scope:'Rule/engine regressions, not a strength tournament or device result',sourceHashes,sourceFingerprint:hash(JSON.stringify(sourceHashes)),
 bundleSHA256:hash(read('dist/main.lua')),results:[]};
const outputIndex=process.argv.indexOf('--output');
const output=outputIndex<0?'ai-rule-regression.json':process.argv[outputIndex+1];
if(!output || !/^[a-z0-9-]+\.json$/.test(output)) throw Error('--output requires a report filename inside records/');
for(const save of ['fc-chess.save.json','tests/fc-chess.test.save.json']){
 const script=JSON.parse(read(save)).assets.scripts[0];
 if(script.path!=='dist/main.lua' || hash(script.source)!==report.bundleSHA256) throw Error('Rebuild/sync before testing: '+save);
}
function execute(task){
 return new Promise(resolve=>{
  const child=spawn(process.execPath,task.args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',timedOut=false,spawnError;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},300000);
  child.stdout.on('data',data=>{stdout+=data;process.stdout.write(data);});
  child.stderr.on('data',data=>{stderr+=data;process.stderr.write(data);});
  child.on('error',error=>{spawnError=error.message;});
  child.on('close',(exitCode,signal)=>{
   clearTimeout(timer);resolve({file:task.file,testSHA256:hash(read(task.file)),exitCode,signal,timedOut,spawnError,
    passed:exitCode===0&&!timedOut&&!spawnError,passGroups:(stdout.match(/^PASS /gm)||[]).length,stdout,stderr});
  });
 });
}
try{
 for(const task of tasks){
  console.log('RUN '+task.file);const result=await execute(task);report.results.push(result);
  if(!result.passed) process.exitCode=1;
 }
 report.passed=report.results.every(result=>result.passed);
 report.summary={suites:report.results.length,passed:report.results.filter(result=>result.passed).length,
  luaPassGroups:report.results.filter(result=>result.file.startsWith('tests/')).reduce((n,result)=>n+result.passGroups,0)};
 console.log('REGRESSION SUMMARY '+JSON.stringify(report.summary));
}finally{
 fs.writeFileSync(path.join(root,'records',output),JSON.stringify(report,null,2)+'\n');
}
