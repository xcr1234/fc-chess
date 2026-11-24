import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import assert from 'node:assert/strict';
import {readGameScript} from './game-save-script.mjs';
import {inputHarness} from './simulator-input-harness.mjs';
const client=new Client({name:'bulk-pieces-regression',version:'1.0.0'});
const report={runtime:'simulator',results:[]};let handle;
async function tool(name,args){const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);}
const play=(action,args={})=>tool('qxqy_studio_play',{handle,action,args});
const check=(at,name,equals,field='text')=>({kind:'control',at,name,field,equals});
const click=(t,name)=>({t,source:'user',kind:'click',payload:{name}});
async function run(canvasId,test){
 const r=await play('runCase',{canvasId,case:test});
 report.results.push({canvasId,name:r.name,passed:r.passed,assertions:r.results,...(!r.passed?{snapshot:r.snapshot}:{})});
 assert(r.passed,JSON.stringify(r));assert.equal(r.results.length,test.asserts.length);console.log('PASS',canvasId,test.name,r.results.length);
}
async function screenshot(canvasId,kind){
 const r=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});
 assert(!r.isError);const img=await loadImage(Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));
 const z=Math.min(img.width/256,img.height/224),w=Math.round(256*z),h=Math.round(224*z),canvas=createCanvas(w,h);
 canvas.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,0,0,w,h);
 const path=`records/screenshots/bulk-pieces-${kind}-${canvasId}.png`;await writeFile(path,canvas.toBuffer('image/png'));report.results.at(-1).screenshot=path;
}
try{
 const source=await readFile('dist/main.lua','utf8');report.sha256=createHash('sha256').update(source).digest('hex');
 for(const path of ['fc-chess.save.json','tests/fc-chess.test.save.json']){
  const s=JSON.parse(await readFile(path,'utf8'));assert.equal(readGameScript(s),source);assert.equal(s.assets.scripts[0].source,'');
 }
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()],env:{QXQY_PLAY_TIMEOUT_MS:'30000'}}));
 ({handle}=await tool('qxqy_project_open',{path:'tests/fc-chess.test.save.json'}));
 const canvases=['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3'];
 for(const canvasId of canvases){
  await play('start',{canvasId});
  for(const p of ['R','N','C','E','A','P']){
   const asserts=[check(.3,'PaletteTitle','全部改成哪种棋子？'),check(.3,'SceneState','custom-edit'),check(.3,'RedPieceCount','16'),
    ...['R','N','C','E','A','P'].map(q=>check(.3,'Choose_'+q+'Pixels',true,'visible')),
    check(.6,'SceneState','player-turn'),check(.6,'RedPieceCount','45'),check(.6,'MoveCount','000手'),check(.6,'Piece_4_0','k'),check(.6,'Piece_0_0','r'),check(.6,'Piece_0_4','')];
   for(let rank=5;rank<10;rank++)for(let file=0;file<9;file++)asserts.push(check(.6,`Piece_${file}_${rank}`,rank===9&&file===4?'K':p));
   await run(canvasId,{format:'qxqy-autotest',version:1,name:'bulk-all-'+p,dt:.05,events:[click(.1,'ModeCustom'),click(.2,'AllRooksButton'),click(.5,'Choose_'+p)],asserts});
  }
  for(const name of ['bulk-pieces-select','bulk-pieces-cancel','custom-empty-add','custom-empty-protect',...(['pc-16-9','mobile-16-9'].includes(canvasId)?['forty-four-rooks','custom-restart','draft-retained','search-undo-spam','search-resign','search-leave']:[])])await run(canvasId,JSON.parse(await readFile('tests/cases/'+name+'.json','utf8')));
  await play('stop');
 }
 ({handle}=await tool('qxqy_project_open',{path:'fc-chess.save.json'}));
 await mkdir('records/screenshots',{recursive:true});
 for(const canvasId of canvases){
  await play('start',{canvasId});const {canvasWidth:width,canvasHeight:height}=await play('get');
  for(const kind of ['palette','cannons']){
   const h=await inputHarness({width,height,cssWidth:800,cssHeight:800*height/width}),events=[];let cursor=0;
   for(const [t,x,y] of [[.1,131.5,46],[.3,227.5,93.5],...(kind==='cannons'?[[.6,173,120]]:[])]){
    h.tap(...h.point(x,y));const list=h.pointer();for(const [i,{light,...payload}]of list.slice(cursor).entries())events.push({t:t+i*.02,source:'user',kind:'pointer',payload});cursor=list.length;
   }
   const asserts=[check(.2,'AllRooksButtonLabel','全部改子'),check(.5,'PaletteTitle','全部改成哪种棋子？'),...['R','N','C','E','A','P'].map(p=>check(.5,'Choose_'+p+'Pixels',true,'visible'))];
   if(kind==='cannons')asserts.push(check(.8,'Glyph_46','炮'),check(.8,'PixelGlyph_46',true,'visible'),check(.8,'Glyph_86','帥'),check(.8,'StatusText','请走棋'),check(.8,'MoveCount','000手'));
   await run(canvasId,{format:'qxqy-autotest',version:1,name:'pointer-bulk-'+kind,dt:.02,events,asserts});
   const state=await play('get');assert(!state.mountError);assert(!state.logs.some(l=>l.level==='error'));
   if(['pc-16-9','mobile-16-9'].includes(canvasId))await screenshot(canvasId,kind);
  }
  await play('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await play('stop').catch(()=>{});await client.close();await writeFile('records/bulk-pieces-simulator.json',JSON.stringify(report,null,2)+'\n');}
