import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import assert from 'node:assert/strict';
import {inputHarness} from './simulator-input-harness.mjs';
const tag=process.argv[2]??'native-text';if(!/^[a-z0-9-]+$/.test(tag))throw new Error('Invalid report tag');
const client=new Client({name:'native-text-compatibility',version:'1.0.0'});
const report={runtime:'simulator',results:[]};let handle;
async function call(action,args={}){const r=await client.callTool({name:'qxqy_studio_play',arguments:{handle,action,args}},undefined,{timeout:120000});if(r.isError)throw new Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);}
try{
 const lua=await readFile('dist/main.lua','utf8');report.luaSHA256=createHash('sha256').update(lua).digest('hex');
 assert.equal(JSON.parse(await readFile('fc-chess.save.json','utf8')).assets.scripts[0].source,lua);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 const opened=await client.callTool({name:'qxqy_project_open',arguments:{path:'fc-chess.save.json'}});({handle}=opened.structuredContent??JSON.parse(opened.content.find(c=>c.type==='text').text));
 const scenes=[
  ['menu',[],'ModeDifficultTitle','困難'],['board',['ModeDifficult'],'Glyph_55','兵'],
  ['confirm',['ModeDifficult','ModeButton'],'ConfirmHint','選擇後無法恢復對局'],
  ['settings',['SettingsButton','VolumeUp'],'BGMVolume','40%'],
  ['music',['SettingsButton','TitleMusicButton'],'MusicPage','1 / 38'],
  ['palette',['ModeCustom','Square_0_6'],'PaletteTitle','改成哪種棋子？'],
  ['result',['ModeFast','ResignButton','ConfirmYes'],'ReturnBoardButtonLabel','返回棋盤'],
  ['undo',['ModeDifficult','Square_0_6','Square_0_5','UndoButton','ConfirmYes'],'MoveCount','000手']
 ];
 for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']){
  await call('start',{canvasId});
  const {canvasWidth:width,canvasHeight:height}=await call('get');
  for(const [kind,actions,name,equals] of scenes){
   const h=await inputHarness({width,height,cssWidth:800,cssHeight:800*height/width});let cursor=0;const events=[];
   const points={ModeDifficult:[131.5,148],Square_0_6:[56,80],Square_0_5:[56,96],UndoButton:[227.5,93.5],ConfirmYes:[92,88]};
   for(const [i,name] of actions.entries()){
    const t=.1+i*.2;if(points[name]){
     h.tap(...h.point(...points[name]));const list=h.pointer();for(const [j,{light,...payload}] of list.slice(cursor).entries())events.push({t:t+j*.02,source:'user',kind:'pointer',payload});cursor=list.length;
    }else events.push({t,source:'user',kind:'click',payload:{name}});
   }
   const test={format:'qxqy-autotest',version:1,name:kind+'-'+canvasId,dt:.1,events,asserts:[{kind:'control',at:1.1,name,field:'text',equals},{kind:'control',at:1.1,name,field:'fontSize',equals:25}]};
   const result=await call('runCase',{canvasId,case:test});assert.equal(result.passed,true,JSON.stringify(result));
   assert.ok(!result.snapshot.logs.some(x=>/字号超出限制/.test(x.text)));const row={canvasId,kind,passed:true,assertions:result.results};
   if(['menu','board'].includes(kind)||['pc-16-9','mobile-16-9'].includes(canvasId)){
    const shot=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});const img=await loadImage(Buffer.from(shot.content.find(c=>c.type==='image').data,'base64'));
    const z=Math.min(img.width/256,img.height/224),w=Math.round(256*z),h=Math.round(224*z),canvas=createCanvas(w,h);canvas.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,0,0,w,h);
    row.screenshot=`records/screenshots/${tag}-${kind}-${canvasId}.png`;await writeFile(row.screenshot,canvas.toBuffer('image/png'));
   }
   report.results.push(row);console.log('PASS',kind,canvasId);
  }
  await call('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await call('stop').catch(()=>{});await client.close();await writeFile(`records/${tag}-layouts.json`,JSON.stringify(report,null,2)+'\n');}
