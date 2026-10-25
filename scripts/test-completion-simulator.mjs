import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const client=new Client({name:'completion-signal-regression',version:'1.0.0'});
const report={runtime:'simulator',nativeExitState:'not modeled; receiver only records requests',results:[]};let handle;
const output=process.argv[2]??'completion-simple-simulator.json';
async function tool(name,args){const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);}
const play=(action,args={})=>tool('qxqy_studio_play',{handle,action,args});
const win=['TestSetup_result-review-win','Square_4_5','Square_4_0'];
try{
 const source=await readFile('dist/main.lua','utf8');report.sha256=createHash('sha256').update(source).digest('hex');
 for(const path of ['fc-chess.save.json','tests/fc-chess.test.save.json'])assert.equal(JSON.parse(await readFile(path,'utf8')).assets.scripts[0].source,source);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()],env:{QXQY_PLAY_TIMEOUT_MS:'30000'}}));
 ({handle}=await tool('qxqy_project_open',{path:'tests/fc-chess.test.save.json'}));
 for(const canvasId of ['pc-16-9','mobile-16-9']){
  await play('start',{canvasId});
  for(const [scene,actions,completed,outcome,name,equals,signals] of [
   ['initial',[],false,0,'ModeCustomTitle','自定義模式',0],
   ['unfinished',['ModeFast','Square_0_6','Square_0_5','ModeButton','ConfirmYes'],false,0,'ModeCustomTitle','自定義模式',0],
   ['win',win,true,1,'ResultTitle','您獲勝了',1],
   ['defeat',['TestSetup_result-review-defeat-undo','Square_0_6','Square_0_5'],true,2,'ResultTitle','您落敗了',1],
   ['resign-cancel',['ModeFast','ResignButton','ConfirmNo'],false,0,'SceneState','player-turn',0],
   ['resign',['ModeFast','ResignButton','ConfirmYes'],true,2,'ResultTitle','您落敗了',1],
   ['review-undo',[...win,'ReturnBoardButton','UndoButton','ConfirmYes'],true,1,'SceneState','player-turn',1],
   ['restart',[...win,'RestartButton'],true,1,'SceneState','player-turn',1],
   ['menu',[...win,'ModeButton'],true,1,'ModeCustomTitle','自定義模式',1],
   ['win-then-lose',[...win,'RestartButton','ResignButton','ConfirmYes'],true,2,'ResultTitle','您落敗了',2]
  ]){
   const at=Math.max(1,.2+actions.length*.2);
   const result=await play('runCase',{canvasId,case:{format:'qxqy-autotest',version:1,name:'completion-'+scene+'-'+canvasId,dt:.05,
    events:actions.map((name,i)=>({t:.1+i*.2,source:'user',kind:'click',payload:{name}})),asserts:[{kind:'control',at,name,field:'text',equals}]}});
   assert(result.passed,JSON.stringify(result.results));assert.equal(result.results.length,1);
   const server=await play('serverGet'),vars=Object.fromEntries(server.vars.map(v=>[v.name,v.value]));
   assert.equal(vars.FCChessCompletionFlag,completed?true:undefined,scene);assert.equal(vars.FCChessCompletionOutcome,completed?outcome:undefined,scene);
   const before=await play('get');assert(before.running&&!before.mountError);
   const count=s=>s.logs.filter(l=>l.text.includes('[completion-request]')).length;
   assert.equal(count(before),signals,scene+': duplicate/missing completion request');
   await play('step',{dt:1});const after=await play('get');assert(after.running);assert.equal(count(after),signals);
   assert(!after.logs.some(l=>l.level==='error'),JSON.stringify(after.logs));
   report.results.push({canvasId,scene,passed:true,completed,outcome,signals,workerStillRunning:true,assertions:result.results,
    completionLogs:after.logs.filter(l=>l.text.includes('completion-request')),requestVars:{completed:vars.FCChessCompletionFlag,outcome:vars.FCChessCompletionOutcome}});
   console.log('PASS',scene,canvasId,'completed='+completed,'outcome='+outcome,'signals='+signals);
  }
  await play('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await play('stop').catch(()=>{});await client.close();await writeFile('records/'+output,JSON.stringify(report,null,2)+'\n');}
