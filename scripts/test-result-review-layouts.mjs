import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import assert from 'node:assert/strict';
import { inputHarness } from './simulator-input-harness.mjs';
const client=new Client({name:'result-review-layouts',version:'1.0.0'});
const report={runtime:'simulator',results:[]};let handle;
async function call(action,args={}){
 const r=await client.callTool({name:'qxqy_studio_play',arguments:{handle,action,args}},undefined,{timeout:120000});
 if(r.isError)throw new Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
}
try{
 const source=await readFile('dist/main.lua','utf8');report.luaSHA256=createHash('sha256').update(source).digest('hex');
 const save=JSON.parse(await readFile('fc-chess.save.json','utf8'));assert.equal(save.assets.scripts[0].source,source);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 const opened=await client.callTool({name:'qxqy_project_open',arguments:{path:'fc-chess.save.json'}});
 ({handle}=opened.structuredContent??JSON.parse(opened.content.find(c=>c.type==='text').text));
 for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']){
  await call('start',{canvasId});
  const {canvasWidth:width,canvasHeight:height}=await call('get');
  for(const [kind,actions,checks] of [
   ['result',['ModeDifficult','Square_0_6','Square_0_5','ResignButton','ConfirmYes'],[['ResultTitle','您落敗了'],['ReturnBoardButtonLabel','返回棋盤']]],
   ['review',['ModeDifficult','Square_0_6','Square_0_5','ResignButton','ConfirmYes','ReturnBoardButton','Square_0_5','Square_0_4'],[['StatusText','本局已結束，悔棋後可繼續'],['MoveCount','001手']]],
   ['resume',['ModeDifficult','Square_0_6','Square_0_5','ResignButton','ConfirmYes','ReturnBoardButton','UndoButton','ConfirmYes'],[['StatusText','已悔棋'],['MoveCount','000手']]]
  ]){
   const h=await inputHarness({width,height,cssWidth:800,cssHeight:800*height/width});const events=[];
   for(const [i,name] of actions.entries()){
    const t=.1+i*.1;
    if(name==='ReturnBoardButton'){
     h.tap(...h.point(128,54));for(const [j,{light,...payload}] of h.pointer().entries())events.push({t:t+j*.02,source:'user',kind:'pointer',payload});
    }else events.push({t,source:'user',kind:'click',payload:{name}});
   }
   const test={format:'qxqy-autotest',version:1,name:kind+'-'+canvasId,dt:.1,events,asserts:checks.map(([name,equals])=>({kind:'control',at:1.1,name,field:'text',equals}))};
   const result=await call('runCase',{canvasId,case:test});assert.equal(result.passed,true,JSON.stringify(result));
   const before=await call('get');assert.equal(before.audio.sequence,2);if(kind==='result'||kind==='review'){
    await call('step',{dt:2});const after=await call('get');assert.equal(after.audio.sequence,before.audio.sequence);
    report.results.push({canvasId,kind,passed:true,assertions:result.results,audio:after.audio});
   }else report.results.push({canvasId,kind,passed:true,assertions:result.results,audio:before.audio});
   if(kind!=='resume'){
    const shot=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});
    const img=await loadImage(Buffer.from(shot.content.find(c=>c.type==='image').data,'base64'));
    const scale=Math.min(img.width/256,img.height/224),w=Math.round(256*scale),h=Math.round(224*scale),canvas=createCanvas(w,h);
    canvas.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,0,0,w,h);
    const path=`records/screenshots/result-${kind}-${canvasId}.png`;await writeFile(path,canvas.toBuffer('image/png'));report.results.at(-1).screenshot=path;
   }
   console.log('PASS',kind,canvasId);
  }
  await call('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await call('stop').catch(()=>{});await client.close();await writeFile('records/result-review-layouts.json',JSON.stringify(report,null,2)+'\n');}
