import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import assert from 'node:assert/strict';
import {inputHarness} from './simulator-input-harness.mjs';
const client=new Client({name:'pixel-glyph-regression',version:'1.0.0'});
const report={runtime:'simulator',results:[]};let handle;
async function tool(name,args){const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);}
const play=(action,args={})=>tool('qxqy_studio_play',{handle,action,args});
const control=(name,field,equals)=>({kind:'control',name,field,equals});
const tag=process.argv[2]??'fc-reference';assert(/^[a-z0-9-]+$/.test(tag));
await import('../prototype/rules.js');
const initial=globalThis.FCChessPreview.initialBoard();
const glyphs={r:'車',n:'馬',e:'象',a:'士',k:'將',c:'包',p:'卒',R:'俥',N:'傌',E:'相',A:'仕',K:'帥',C:'炮',P:'兵'};
const boardChecks=initial.flatMap((p,i)=>p?[control('PixelGlyph_'+(i+1),'visible',true),control('DiskArt_'+(i+1),'visible',true),control('Glyph_'+(i+1),'visible',false),control('Glyph_'+(i+1),'text',glyphs[p])]:[]);
try{
 const source=await readFile('dist/main.lua','utf8');report.sha256=createHash('sha256').update(source).digest('hex');
 for(const path of ['fc-chess.save.json','tests/fc-chess.test.save.json'])assert.equal(JSON.parse(await readFile(path,'utf8')).assets.scripts[0].source,source);
 await client.connect(new StdioClientTransport({command:process.execPath,args:['node_modules/beyond-simulator-mcp/dist/index.js','--workspace',process.cwd()]}));
 ({handle}=await tool('qxqy_project_open',{path:'fc-chess.save.json'}));
 for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']){
  await play('start',{canvasId});const {canvasWidth:width,canvasHeight:height}=await play('get');
  const cases=[
   ['board',['ModeFast'],[...boardChecks,control('RiverLeft','visible',false),control('RiverRight','visible',false),...['Chu','He','Han','Jie'].map(n=>control('RiverPixel'+n,'visible',true))],635],
   ['palette',['ModeCustom','Square_0_6'],['R','N','C','E','A','P'].flatMap(p=>[control('Choose_'+p+'Pixels','visible',true),control('Choose_'+p+'Label','visible',false)]),635],
   ['move',['ModeFast','Square_1_9','Square_2_7'],[control('PixelGlyph_66','visible',true),control('Glyph_66','text','傌'),control('Glyph_83','visible',false)],635],
   ['undo',['ModeFast','Square_1_9','Square_2_7','UndoButton','ConfirmYes'],[control('PixelGlyph_83','visible',true),control('Glyph_83','text','傌'),control('Glyph_66','visible',false),control('MoveCount','text','000手')],635],
   ['replace-back',['ModeCustom','Square_0_6','Choose_R','Square_0_6','Choose_P'],[control('PixelGlyph_55','visible',true),control('Glyph_55','visible',false),control('Glyph_55','text','兵')],635],
   ['fifteen-rooks',['ModeCustom','AllRooksButton'],[control('PixelGlyph_55','visible',true),control('Glyph_55','text','俥'),control('Glyph_55','visible',false)],647],
   ['reset',['ModeCustom','AllRooksButton','ResetCustomButton'],[control('PixelGlyph_55','visible',true),control('Glyph_55','visible',false),control('Glyph_55','text','兵')],635]
  ];
  for(const [scene,actions,checks,expectedRects] of cases){
   const h=await inputHarness({width,height,cssWidth:800,cssHeight:800*height/width}),events=[];let cursor=0;
   const points={ModeFast:[131.5,97],Square_1_9:[72,32],Square_2_7:[88,64],UndoButton:[227.5,93.5],ConfirmYes:[92,88]};
   for(const [i,name] of actions.entries()){
    const t=.1+i*.15;
    if(points[name]){h.tap(...h.point(...points[name]));const list=h.pointer();for(const [j,{light,...payload}] of list.slice(cursor).entries())events.push({t:t+j*.02,source:'user',kind:'pointer',payload});cursor=list.length;}
    else events.push({t,source:'user',kind:'click',payload:{name}});
   }
   const at=.1+actions.length*.15;
   const result=await play('runCase',{canvasId,case:{format:'qxqy-autotest',version:1,name:'pixel-'+scene+'-'+canvasId,dt:.05,events,asserts:checks.map(c=>({...c,at}))}});
   assert(result.passed,JSON.stringify(result.results));assert.equal(result.results.length,checks.length);
   const view=await play('get',{view:true});assert(!view.mountError);assert(!view.logs.some(l=>l.level==='error'));
   const rectangles=view.scene.nodes.filter(n=>/^PixelGlyph_\d+Run\d+$/.test(n.name));assert.equal(rectangles.length,expectedRects,scene+': stale or missing glyph rectangles');
   if(scene==='move')assert(!rectangles.some(n=>n.name.startsWith('PixelGlyph_83Run')));
   if(scene==='replace-back'||scene==='reset')assert.equal(rectangles.filter(n=>n.name.startsWith('PixelGlyph_55Run')).length,16);
   const river=view.scene.nodes.filter(n=>/^RiverPixel(?:Chu|He|Han|Jie)Run\d+$/.test(n.name));assert.equal(river.length,100);
   const shadow=view.scene.nodes.filter(n=>/^RiverPixel(?:Chu|He|Han|Jie)ShadowRun\d+$/.test(n.name));assert.equal(shadow.length,93);
   const palette=view.scene.nodes.filter(n=>/^Choose_\w+PixelsRun\d+$/.test(n.name));assert.equal(palette.length,scene==='palette'?135:0);
   const discs=view.scene.nodes.filter(n=>/^DiskArt_\d+(?:Rim|White)\d+$/.test(n.name));assert.equal(discs.length,scene==='fifteen-rooks'?640:655);
   if(scene==='move')assert(!discs.some(n=>n.name.startsWith('DiskArt_83')));
   assert(discs.every(n=>n.primitive==='rect'&&n.imageId===100001));
   assert(rectangles.every(n=>n.sourceWidth<=16&&n.sourceHeight<=16));
   assert.equal(rectangles.find(n=>n.name==='PixelGlyph_1Run1').imageColor>>>0,0xff24188c);
   assert.equal(shadow[0].imageColor>>>0,0xfffcfcfc);
   const row={canvasId,scene,passed:true,assertions:result.results,rectangles:rectangles.length,discRectangles:discs.length,riverRectangles:river.length,shadowRectangles:shadow.length,paletteRectangles:palette.length,renderedNodes:view.scene.count};
   if(['board','palette','fifteen-rooks'].includes(scene)&&['pc-16-9','mobile-16-9'].includes(canvasId)){
    const shot=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});assert(!shot.isError);
    const img=await loadImage(Buffer.from(shot.content.find(c=>c.type==='image').data,'base64')),z=Math.min(img.width/256,img.height/224),w=Math.round(256*z),height=Math.round(224*z),canvas=createCanvas(w,height);
    canvas.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-height)/2,w,height,0,0,w,height);
    row.screenshot=`records/screenshots/${tag}-${scene}-${canvasId}.png`;await writeFile(row.screenshot,canvas.toBuffer('image/png'));
   }
   // Idle redraws must not accumulate controls; no AI is active in custom edit.
   if(scene==='fifteen-rooks'){for(let frame=0;frame<10;frame++)await play('step',{dt:.1});const after=await play('get',{view:true});assert.equal(after.scene.count,view.scene.count);row.idleControlCountStable=true;row.idleFrames=10;}
   report.results.push(row);console.log('PASS',scene,canvasId,checks.length,'assertions',rectangles.length,'rectangles');
  }
  await play('stop');
 }
}catch(e){report.error=e.stack;console.error(e);process.exitCode=1;}
finally{if(handle)await play('stop').catch(()=>{});await client.close();await writeFile(`records/${tag}-layouts.json`,JSON.stringify(report,null,2)+'\n');}
