import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const client=new Client({name:'audio-animation',version:'1.0.0'});
const report={runtime:'simulator-worker-audio',results:[]};let handle;
async function tool(name,args){const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);}
const play=(action,args={})=>tool('qxqy_studio_play',{handle,action,args});
const click=name=>play('click',{name});
async function snapshot(){const v=await play('get');assert(!v.mountError);assert(!v.logs.some(l=>l.level==='error'));return v.audio;}
const ids=a=>a.recent.map(v=>v.audioId);
async function setup(canvasId,fixture='check-audio-black'){await play('start',{canvasId});await click('TestSetup_'+fixture);await click(fixture==='capture-king'?'Square_4_5':'Square_0_6');await click(fixture==='capture-king'?'Square_4_0':'Square_0_5');assert.equal((await snapshot()).sequence,0);}
try{
 const source=await readFile('dist/main.lua','utf8');report.sha256=createHash('sha256').update(source).digest('hex');
 for(const p of ['fc-chess.save.json','tests/fc-chess.test.save.json'])assert.equal(JSON.parse(await readFile(p,'utf8')).assets.scripts[0].source,source);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 ({handle}=await tool('qxqy_project_open',{path:'tests/fc-chess.test.save.json'}));
 for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']){
  await setup(canvasId);await play('step',{dt:.1});assert.equal((await snapshot()).sequence,0);
  await play('step',{dt:.07});let a=await snapshot();assert.deepEqual(ids(a),[50882]);
  await play('step',{dt:.38});a=await snapshot();assert.deepEqual(ids(a),[50882,50888]);assert(a.recent[1].startedAt>a.recent[0].startedAt);
  report.results.push({canvasId,name:'normal then check at distinct landings',passed:true,audio:a});
  await click('Square_0_5');await click('Square_0_4');await play('step',{dt:.17});a=await snapshot();assert.deepEqual(ids(a),[50882,50888]);assert(a.active.some(v=>v.audioId===50888));
  report.results.push({canvasId,name:'ordinary move yields during active check',passed:true,audio:a});
  await setup(canvasId);await play('step',{dt:.1});await play('step',{dt:2});a=await snapshot();assert.deepEqual(ids(a),[50888]);
  report.results.push({canvasId,name:'large frame prioritizes checking landing',passed:true,audio:a});
  await setup(canvasId);await click('UndoButton');await click('ConfirmYes');await play('step',{dt:1});a=await snapshot();assert.equal(a.sequence,0);
  report.results.push({canvasId,name:'undo before landing discards pending sound',passed:true,audio:a});
  await setup(canvasId);await click('SettingsButton');await click('SfxToggle');await click('SfxToggle');await click('SettingsBack');await play('step',{dt:.1});a=await snapshot();assert.equal(a.sequence,0);
  report.results.push({canvasId,name:'settings and mute never replay interrupted sound',passed:true,audio:a});
  await setup(canvasId,'capture-king');await play('step',{dt:.2});assert.equal((await snapshot()).sequence,0);await play('step',{dt:.3});a=await snapshot();assert.deepEqual(ids(a),[50882,50228]);assert(a.recent[0].stopped);assert(a.active.some(v=>v.audioId===50228));
  report.results.push({canvasId,name:'victory follows final landing and stops movement tail',passed:true,audio:a});
  console.log('PASS audio animation',canvasId,'6 flows');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await play('stop').catch(()=>{});await client.close();await writeFile('records/audio-animation-simulator.json',JSON.stringify(report,null,2)+'\n');}
