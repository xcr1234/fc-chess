import { readGameScript } from './game-save-script.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const client=new Client({name:'check-audio-regression',version:'1.0.0'});
const report={runtime:'simulator-worker-audio',results:[]};let handle;
async function call(action,args={}){
 const r=await client.callTool({name:'qxqy_studio_play',arguments:{handle,action,args}},undefined,{timeout:120000});
 if(r.isError)throw new Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
}
try{
 const source=await readFile('dist/main.lua','utf8');report.luaSHA256=createHash('sha256').update(source).digest('hex');
 for(const file of ['fc-chess.save.json','tests/fc-chess.test.save.json']){
  const save=JSON.parse(await readFile(file,'utf8'));assert.equal(readGameScript(save),source);assert.equal(save.assets.scripts[0].path,'dist/main.lua');
 }
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 const opened=await client.callTool({name:'qxqy_project_open',arguments:{path:'tests/fc-chess.test.save.json'}});
 ({handle}=opened.structuredContent??JSON.parse(opened.content.find(c=>c.type==='text').text));
 await call('start',{canvasId:'pc-16-9'});
 const red=JSON.parse(await readFile('tests/cases/check-audio-red.json','utf8'));
 const undo={...red,name:'check-audio-undo',events:[...red.events,{t:1.8,source:'user',kind:'click',payload:{name:'UndoButton'}},{t:2,source:'user',kind:'click',payload:{name:'ConfirmYes'}}],asserts:[...red.asserts,{kind:'control',at:2.5,name:'MoveCount',field:'text',equals:'000手'}]};
 const muted={...red,name:'check-audio-muted',events:[...['SettingsButton','SfxToggle','SettingsBack'].map((name,i)=>({t:i*.1,source:'user',kind:'click',payload:{name}})),...red.events.map(e=>({...e,t:e.t+.4}))],asserts:red.asserts.map(a=>({...a,at:2}))};
 for(const canvasId of ['pc-16-9','mobile-16-9']){
  for(const [test,ids] of [
   [red,[50888]],
   [JSON.parse(await readFile('tests/cases/check-audio-discovered.json','utf8')),[50888]],
   [JSON.parse(await readFile('tests/cases/check-audio-black.json','utf8')),[50882,50888]],
   [undo,[50888]],
   [muted,[]]
  ]){
   const result=await call('runCase',{canvasId,case:test});assert.equal(result.passed,true,JSON.stringify(result));
   const before=await call('get');assert.equal(before.audio.sequence,ids.length);assert.deepEqual(before.audio.recent.map(v=>v.audioId),ids);
   await call('step',{dt:.2});const after=await call('get');assert.equal(after.audio.sequence,ids.length);
   report.results.push({canvasId,name:test.name,passed:true,assertions:result.results,audio:after.audio});console.log('PASS',test.name,canvasId,JSON.stringify(ids));
  }
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await call('stop').catch(()=>{});await client.close();await writeFile('records/check-audio-worker.json',JSON.stringify(report,null,2)+'\n');}
