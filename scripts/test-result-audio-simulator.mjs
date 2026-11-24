import { readGameScript } from './game-save-script.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const client=new Client({name:'result-audio',version:'1.0.0'});
const report={runtime:'simulator-worker-audio',results:[]};let handle;
async function call(action,args={}){
 const r=await client.callTool({name:'qxqy_studio_play',arguments:{handle,action,args}},undefined,{timeout:120000});
 if(r.isError)throw new Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
}
try{
 const lua=await readFile('dist/main.lua','utf8');report.luaSHA256=createHash('sha256').update(lua).digest('hex');
 for(const path of ['fc-chess.save.json','tests/fc-chess.test.save.json'])assert.equal(readGameScript(JSON.parse(await readFile(path,'utf8'))),lua);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 const opened=await client.callTool({name:'qxqy_project_open',arguments:{path:'tests/fc-chess.test.save.json'}});({handle}=opened.structuredContent??JSON.parse(opened.content.find(c=>c.type==='text').text));
 for(const canvasId of ['pc-16-9','mobile-16-9']){
  await call('start',{canvasId});
  for(const [name,actions,control,equals,ids] of [
   ['victory',['TestSetup_result-review-win','Square_4_5','Square_4_0'],'ResultTitle','您获胜了',[50882,50228]],
   ['defeat',['TestSetup_result-review-defeat-undo','Square_0_6','Square_0_5'],'ResultTitle','您落败了',[50882,50882,50265]],
   ['resign',['ModeFast','ResignButton','ConfirmYes'],'ResultTitle','您落败了',[50265]],
   ['cancel-resign',['ModeFast','ResignButton','ConfirmNo'],'MoveCount','000手',[]],
   ['muted',['SettingsButton','SfxToggle','SettingsBack','TestSetup_result-review-win','Square_4_5','Square_4_0'],'ResultTitle','您获胜了',[]],
   ['second-game',['ModeFast','ResignButton','ConfirmYes','RestartButton','ResignButton','ConfirmYes'],'ResultTitle','您落败了',[50265,50265]]
  ]){
   const test={format:'qxqy-autotest',version:1,name:'result-audio-'+name,dt:.1,events:actions.map((name,i)=>({t:.1+i*.2,source:'user',kind:'click',payload:{name}})),asserts:[{kind:'control',at:2,name:control,field:'text',equals}]};
   const result=await call('runCase',{canvasId,case:test});assert.equal(result.passed,true,JSON.stringify(result));
   const before=await call('get');assert.deepEqual(before.audio.recent.map(v=>v.audioId),ids);assert.equal(before.audio.sequence,ids.length);
   await call('step',{dt:.2});const after=await call('get');assert.equal(after.audio.sequence,ids.length);
   assert.ok(!after.logs.some(l=>l.level==='error'||/unknown audio/i.test(l.text)));
   report.results.push({canvasId,name,passed:true,assertions:result.results,audio:after.audio});console.log('PASS',name,canvasId,JSON.stringify(ids));
  }
  await call('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await call('stop').catch(()=>{});await client.close();await writeFile('records/result-audio-worker.json',JSON.stringify(report,null,2)+'\n');}
