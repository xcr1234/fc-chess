import { readGameScript } from './game-save-script.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import assert from 'node:assert/strict';
const client=new Client({name:'move-animation',version:'1.0.0'});
const report={runtime:'simulator',results:[]};let handle;
async function tool(name,args){const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);}
const play=(action,args={})=>tool('qxqy_studio_play',{handle,action,args});
async function view(){const v=await play('get',{view:true});assert(!v.mountError);assert(!v.logs.some(l=>l.level==='error'));assert(!v.scene.nodes.some(n=>/^Selection|^AILast/.test(n.name)));return v;}
const node=(v,name)=>assertNode(v.scene.nodes.find(n=>n.name===name),name);
function assertNode(n,name){assert(n,'Missing '+name);return n;}
async function shot(label){const r=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});assert(!r.isError);const img=await loadImage(Buffer.from(r.content.find(c=>c.type==='image').data,'base64')),z=Math.min(img.width/256,img.height/224),w=Math.round(256*z),h=Math.round(224*z),c=createCanvas(w,h);c.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,0,0,w,h);const path=`records/screenshots/move-animation-${label}.png`;await writeFile(path,c.toBuffer('image/png'));return path;}
try{
 const source=await readFile('dist/main.lua','utf8');report.sha256=createHash('sha256').update(source).digest('hex');
 for(const p of ['fc-chess.save.json','tests/fc-chess.test.save.json'])assert.equal(readGameScript(JSON.parse(await readFile(p,'utf8'))),source);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 ({handle}=await tool('qxqy_project_open',{path:'fc-chess.save.json'}));
 for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']){
  await play('start',{canvasId});await play('click',{name:'ModeDifficult'});
  const row={canvasId,checks:[],screenshots:[]};
  const dimensions=await play('get'),scale=Math.min(dimensions.canvasWidth/256,dimensions.canvasHeight/224);
  await play('pointer',{type:'click',x:(dimensions.canvasWidth-256*scale)/2+56*scale,y:(dimensions.canvasHeight-224*scale)/2+80*scale});
  let v=await view();assert.equal(node(v,'DiskArt_55White1').imageColor>>>0,0xffb4b4b4);row.checks.push('pointer selects dark background, no frames');
  if(['pc-16-9','mobile-16-9'].includes(canvasId))row.screenshots.push(await shot('selected-'+canvasId));
  await play('click',{name:'Square_0_6'});v=await view();assert.equal(node(v,'DiskArt_55White1').imageColor>>>0,0xfffcfcfc);row.checks.push('deselect restores white');
  await play('click',{name:'Square_0_6'});await play('click',{name:'Square_0_5'});
  await play('step',{dt:.08});v=await view();
  const moving=node(v,'MovingPiece');row.midpoint=moving;
  // Check native control properties as well as the renderer's composed transform.
  const check=await play('runCase',{canvasId,case:{format:'qxqy-autotest',version:1,name:'midpoint-'+canvasId,dt:.02,
   events:[{t:0,source:'user',kind:'click',payload:{name:'ModeDifficult'}},{t:.1,source:'user',kind:'click',payload:{name:'Square_0_6'}},{t:.2,source:'user',kind:'click',payload:{name:'Square_0_5'}},{t:.24,source:'user',kind:'click',payload:{name:'Square_2_6'}}],
   asserts:[{kind:'control',at:.28,name:'MovingPiece',field:'visible',equals:true},{kind:'control',at:.28,name:'MovingPiece',field:'anchoredPositionY',equals:-24},{kind:'control',at:.28,name:'MoveCount',field:'text',equals:'001手'},{kind:'control',at:.28,name:'Glyph_46',field:'text',equals:''}]}});
  assert(check.passed,JSON.stringify(check.results));row.checks.push('midpoint y=-24; rapid click ignored; landing not painted');
  if(['pc-16-9','mobile-16-9'].includes(canvasId))row.screenshots.push(await shot('midpoint-'+canvasId));
  await play('click',{name:'UndoButton'});await play('click',{name:'ConfirmYes'});await play('step',{dt:1});v=await view();assert.equal(node(v,'DiskArt_55White1').imageColor>>>0,0xfffcfcfc);assert(!v.scene.nodes.some(n=>n.name==='MovingDisc'));row.checks.push('undo during movement cancels old artwork');
  const count=v.scene.count;for(let i=0;i<10;i++)await play('step',{dt:.02});v=await view();assert.equal(v.scene.count,count);row.checks.push('10 idle redraws keep control count');row.passed=true;report.results.push(row);console.log('PASS motion',canvasId);
 }
 await play('stop');
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await play('stop').catch(()=>{});await client.close();await writeFile('records/move-animation-layouts.json',JSON.stringify(report,null,2)+'\n');}
