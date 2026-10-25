import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import assert from 'node:assert/strict';
const client=new Client({name:'screen-shell',version:'1.0.0'});
const report={runtime:'simulator',scope:'full viewport pixels and client input; simulator has no native 3D movement or HUD',results:[]};let handle;
async function call(action,args={}){
 const r=await client.callTool({name:'qxqy_studio_play',arguments:{handle,action,args}},undefined,{timeout:120000});
 if(r.isError)throw new Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
}
try{
 const lua=await readFile('dist/main.lua','utf8');report.luaSHA256=createHash('sha256').update(lua).digest('hex');
 for(const file of ['fc-chess.save.json','tests/fc-chess.test.save.json'])assert.equal(JSON.parse(await readFile(file,'utf8')).assets.scripts[0].source,lua);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 const opened=await client.callTool({name:'qxqy_project_open',arguments:{path:'fc-chess.save.json'}});({handle}=opened.structuredContent??JSON.parse(opened.content.find(c=>c.type==='text').text));
 for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']){
  await call('start',{canvasId});
  for(const [scene,actions,target,equals,color] of [
   ['menu',[],'Title','中國象棋',[104,64,250,255]],
   ['board',['ModeFast'],'MoveCount','000手',[25,59,87,255]],
   ['settings',['ModeFast','SettingsButton'],'BGMVolume','50%',[25,59,87,255]]
  ]){
   const events=actions.map((name,i)=>({t:.1+i*.15,source:'user',kind:'click',payload:{name}}));let t=.5;
   for(const direction of ['Forward','Backward','Left','Right'])for(const phase of ['Down','Up'])events.push({t:t+=.05,source:'user',kind:'key',payload:{typeName:'KeyboardMove'+direction+'Key'+phase}});
   // Click in the viewport margin; it must not activate any chess control.
   events.push({t:1,source:'user',kind:'pointer',payload:{type:'down',x:2,y:2}},{t:1.05,source:'user',kind:'pointer',payload:{type:'up',x:2,y:2}});
   const result=await call('runCase',{canvasId,case:{format:'qxqy-autotest',version:1,name:'screen-'+scene+'-'+canvasId,dt:.05,events,asserts:[{kind:'control',at:1.2,name:target,field:'text',equals}]}});
   assert.equal(result.passed,true,JSON.stringify(result));assert.ok(!result.snapshot.logs.some(l=>l.level==='error'));
   const shot=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});
   const img=await loadImage(Buffer.from(shot.content.find(c=>c.type==='image').data,'base64')),canvas=createCanvas(img.width,img.height),ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
   for(const [x,y]of [[1,1],[img.width-2,1],[1,img.height-2],[img.width-2,img.height-2]])assert.deepEqual([...ctx.getImageData(x,y,1,1).data],color,'uncovered viewport corner: '+scene+' '+canvasId);
   const row={canvasId,scene,passed:true,wasdEvents:8,opaqueCorners:4,assertions:result.results};
   if(['pc-16-9','pc-21-9','mobile-16-9'].includes(canvasId)){
    row.screenshot=`records/screenshots/screen-shell-full-${scene}-${canvasId}.png`;await writeFile(row.screenshot,canvas.toBuffer('image/png'));
   }
   report.results.push(row);console.log('PASS viewport/input',scene,canvasId);
  }
  await call('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await call('stop').catch(()=>{});await client.close();await writeFile('records/screen-shell-viewport.json',JSON.stringify(report,null,2)+'\n');}
