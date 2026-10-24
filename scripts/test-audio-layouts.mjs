import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import assert from 'node:assert/strict';
const client=new Client({name:'audio-settings-layouts',version:'1.0.0'});
const report={runtime:'simulator',results:[]};let handle;
async function call(action,args={}){
 const r=await client.callTool({name:'qxqy_studio_play',arguments:{handle,action,args}},undefined,{timeout:120000});
 if(r.isError)throw new Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
}
try{
 const source=await readFile('dist/main.lua','utf8');report.luaSHA256=createHash('sha256').update(source).digest('hex');
 const save=JSON.parse(await readFile('fc-chess.save.json','utf8'));if(save.assets.scripts[0].source!==source)throw new Error('Stale save');
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 const opened=await client.callTool({name:'qxqy_project_open',arguments:{path:'fc-chess.save.json'}});
 ({handle}=opened.structuredContent??JSON.parse(opened.content.find(c=>c.type==='text').text));
 for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']){
  await call('start',{canvasId});
  for(const [kind,actions,name,equals] of [
   ['settings',['SettingsButton'],'BGMVolume','30%'],
   ['music',['SettingsButton','TitleMusicButton'],'MusicPage','1 / 38']]){
   const test={format:'qxqy-autotest',version:1,name:kind+'-'+canvasId,dt:.1,events:actions.map((name,i)=>({t:.1+i*.2,source:'user',kind:'click',payload:{name}})),asserts:[{kind:'control',at:1,name,field:'text',equals}]};
   const result=await call('runCase',{canvasId,case:test});if(!result.passed)throw new Error(JSON.stringify(result));
   const shot=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});
   const img=await loadImage(Buffer.from(shot.content.find(c=>c.type==='image').data,'base64'));
   const scale=Math.min(img.width/256,img.height/224),w=Math.round(256*scale),h=Math.round(224*scale),canvas=createCanvas(w,h);
   canvas.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,0,0,w,h);
   const path=`records/screenshots/audio-${kind}-${canvasId}.png`;await writeFile(path,canvas.toBuffer('image/png'));
   report.results.push({canvasId,kind,passed:true,screenshot:path,server:await call('serverGet')});console.log('PASS',kind,canvasId);
  }
  await call('stop');
 }
 await call('start',{canvasId:'pc-16-9'});
 for(const [name,actions,index,volume,enabled] of [
  ['board-route',['ModeFast'],10029,30,true],
  ['volume-change',['SettingsButton','VolumeUp'],10167,40,true],
  ['volume-zero',['SettingsButton','VolumeDown','VolumeDown','VolumeDown'],10167,0,false],
  ['title-off',['SettingsButton','TitleMusicButton','MusicOff'],0,30,false],
  ['board-off',['SettingsButton','BoardMusicButton','MusicOff','SettingsBack','ModeFast'],0,30,false]
 ]){
  const test={format:'qxqy-autotest',version:1,name,dt:.1,events:actions.map((name,i)=>({t:.1+i*.2,source:'user',kind:'click',payload:{name}})),asserts:[{kind:'control',at:2,name:'GameRoot',field:'visible',equals:true}]};
  const result=await call('runCase',{canvasId:'pc-16-9',case:test});if(!result.passed)throw new Error(JSON.stringify(result));
  const server=await call('serverGet');const vars=Object.fromEntries(server.vars.map(v=>[v.name,v.value]));
  assert.equal(vars.FCChessMusicIndex,index);assert.equal(vars.FCChessMusicVolume,volume);assert.equal(vars.FCChessMusicEnabled,enabled);
  report.results.push({kind:'signal',name,passed:true,server});console.log('PASS signal',name);
 }
 await call('stop');
 const testOpened=await client.callTool({name:'qxqy_project_open',arguments:{path:'tests/fc-chess.test.save.json'}});
 ({handle}=testOpened.structuredContent??JSON.parse(testOpened.content.find(c=>c.type==='text').text));await call('start',{canvasId:'pc-16-9'});
 for(const [name,actions,expected] of [
  ['both-moves',['TestSetup_ai-move-feedback','Square_0_6','Square_0_5'],2],
  ['selection-invalid',['TestSetup_ai-move-feedback','Square_0_6','Square_0_7'],0],
  ['sound-disabled',['SettingsButton','SfxToggle','SettingsBack','TestSetup_ai-move-feedback','Square_0_6','Square_0_5'],0]
 ]){
  const test={format:'qxqy-autotest',version:1,name,dt:.1,events:actions.map((name,i)=>({t:.1+i*.2,source:'user',kind:'click',payload:{name}})),asserts:[{kind:'control',at:5,name:'TurnText',field:'text',equals:'紅方'}]};
  const result=await call('runCase',{canvasId:'pc-16-9',case:test});if(!result.passed)throw new Error(JSON.stringify(result));
  const state=await call('get');assert.equal(state.audio.sequence,expected);if(expected){assert.equal(state.audio.recent.length,expected);assert.ok(state.audio.recent.every(voice=>voice.audioId===50882));}
  report.results.push({kind:'sound',name,passed:true,audio:state.audio});console.log('PASS sound',name);
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await call('stop').catch(()=>{});await client.close();await writeFile('records/audio-layouts.json',JSON.stringify(report,null,2)+'\n');}
