import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import assert from 'node:assert/strict';
import {readGameScript} from './game-save-script.mjs';
import {inputHarness} from './simulator-input-harness.mjs';
const client=new Client({name:'custom-empty-regression',version:'1.0.0'});
const report={runtime:'simulator',results:[]};let handle;
async function tool(name,args){const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);}
const play=(action,args={})=>tool('qxqy_studio_play',{handle,action,args});
const check=(at,name,field,equals)=>({kind:'control',at,name,field,equals});
async function run(canvasId,test){
 const result=await play('runCase',{canvasId,case:test});report.results.push({canvasId,...result});
 assert(result.passed,JSON.stringify(result));assert.equal(result.results.length,test.asserts.length);console.log('PASS',canvasId,test.name,result.results.length);
}
try{
 const source=await readFile('dist/main.lua','utf8');report.sha256=createHash('sha256').update(source).digest('hex');
 for(const path of ['fc-chess.save.json','tests/fc-chess.test.save.json']){
  const save=JSON.parse(await readFile(path,'utf8'));assert.equal(readGameScript(save),source);assert.equal(save.assets.scripts[0].source,'');
 }
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()],env:{QXQY_PLAY_TIMEOUT_MS:'30000'}}));
 ({handle}=await tool('qxqy_project_open',{path:'tests/fc-chess.test.save.json'}));
 const canvases=['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3'];
 for(const canvasId of canvases){
  await play('start',{canvasId});
  for(const name of ['custom-empty-add','custom-empty-protect','forty-four-rooks','custom-restart'])await run(canvasId,JSON.parse(await readFile('tests/cases/'+name+'.json','utf8')));
  await play('stop');
 }
 ({handle}=await tool('qxqy_project_open',{path:'fc-chess.save.json'}));
 await mkdir('records/screenshots',{recursive:true});
 for(const canvasId of canvases){
  await play('start',{canvasId});const {canvasWidth:width,canvasHeight:height}=await play('get');
  const h=await inputHarness({width,height,cssWidth:800,cssHeight:800*height/width}),events=[];let cursor=0;
  for(const [t,x,y] of [[.1,131.5,46],[.3,56,96],[.6,83,120]]){
   h.tap(...h.point(x,y));const list=h.pointer();for(const [i,{light,...payload}] of list.slice(cursor).entries())events.push({t:t+i*.02,source:'user',kind:'pointer',payload});cursor=list.length;
  }
  await run(canvasId,{format:'qxqy-autotest',version:1,name:'pointer-empty-add',dt:.02,events,asserts:[
   check(.5,'PaletteTitle','text','改成哪種棋子？'),...['R','N','C','E','A','P'].map(p=>check(.5,'Choose_'+p+'Pixels','visible',true)),
   check(.8,'Glyph_46','text','俥'),check(.8,'PixelGlyph_46','visible',true),check(.8,'DiskArt_46','visible',true),check(.8,'MoveCount','text','000手')
  ]});
  const state=await play('get');assert(!state.mountError);assert(!state.logs.some(l=>l.level==='error'));
  if(['pc-16-9','mobile-16-9'].includes(canvasId)){
   const r=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});
   const img=await loadImage(Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));
   const scale=Math.min(img.width/256,img.height/224),w=Math.round(256*scale),height=Math.round(224*scale),canvas=createCanvas(w,height);
   canvas.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-height)/2,w,height,0,0,w,height);
   const path='records/screenshots/custom-empty-'+canvasId+'.png';await writeFile(path,canvas.toBuffer('image/png'));report.results.at(-1).screenshot=path;
  }
  await play('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await play('stop').catch(()=>{});await client.close();await writeFile('records/custom-empty-simulator.json',JSON.stringify(report,null,2)+'\n');}
