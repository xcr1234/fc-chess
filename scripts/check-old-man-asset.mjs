import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import fengari from 'fengari';
const {lua,lauxlib,to_luastring,to_jsstring}=fengari;
const jsonBytes=await readFile('assets/old-man.json'),luaBytes=await readFile('assets/old-man.lua');
const scene=JSON.parse(jsonBytes),source=luaBytes.toString('utf8');
// Compile only. Do not execute the supplied drawing script or lifecycle callbacks.
const L=lauxlib.luaL_newstate();
try {assert.equal(lauxlib.luaL_loadbuffer(L,luaBytes,luaBytes.length,to_luastring('@assets/old-man.lua')),lua.LUA_OK,to_jsstring(lua.lua_tostring(L,-1)??to_luastring('syntax ok')));}finally{lua.lua_close(L);}
const paletteBlock=source.match(/local PALETTE\s*=\s*\{([\s\S]*?)\n\}/)?.[1];
const elementsBlock=source.match(/local ELEMENTS\s*=\s*\{([\s\S]*?)\n\}/)?.[1];
assert.ok(paletteBlock && elementsBlock,'Expected numeric exporter tables');
const palette=new Map([...paletteBlock.matchAll(/\[(\d+)\]\s*=\s*\{([^{}]+)\}/g)].map(m=>[Number(m[1]),m[2].split(',').map(Number)]));
const elements=[...elementsBlock.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1].split(',').map(s=>Number(s.trim())));
assert.equal(scene.canvas.width,79);assert.equal(scene.canvas.height,80);assert.equal(elements.length,scene.elements.length);
let maxGeometryDelta=0, roundedFields=0;
const close=(a,b)=>{const delta=Math.abs(a-b);maxGeometryDelta=Math.max(maxGeometryDelta,delta);if(delta>1e-8)roundedFields++;assert.ok(delta<=.0101,`${a} != ${b}`);};
let crossing=0;
for(let i=0;i<elements.length;i++){
 const e=scene.elements[i],r=elements[i];assert.equal(e.type,'ellipse');assert.equal(r[0],1);assert.ok(r.every(Number.isFinite));assert.equal(e.zIndex,i);
 close(r[1],e.x);close(r[2],-e.y);close(r[3],e.width);close(r[4],e.height);close(r[5],e.rotation);
 assert.equal('#'+palette.get(r[6]).map(n=>n.toString(16).padStart(2,'0')).join(''),e.color.toLowerCase());assert.equal(r[7],Math.round(e.opacity*255));
 const rad=e.rotation*Math.PI/180,ex=Math.hypot(e.width/2*Math.cos(rad),e.height/2*Math.sin(rad)),ey=Math.hypot(e.width/2*Math.sin(rad),e.height/2*Math.cos(rad));
 if(e.x-ex<0||e.x+ex>79||e.y-ey<0||e.y+ey>80)crossing++;
}
function render(background='#ffffff',mask=false){
 const c=createCanvas(316,320),ctx=c.getContext('2d');ctx.scale(4,4);ctx.fillStyle=background;ctx.fillRect(0,0,79,80);ctx.save();
 if(mask){const b=scene.shaper.mask.bbox_px;ctx.beginPath();ctx.rect(b.x,b.y,b.width,b.height);ctx.clip();ctx.fillStyle=scene.canvas.background;ctx.fillRect(0,0,79,80);}
 for(const e of scene.elements){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(-e.rotation*Math.PI/180);ctx.globalAlpha=e.opacity;ctx.fillStyle=e.color;ctx.beginPath();ctx.ellipse(0,0,e.width/2,e.height/2,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 ctx.restore();return c;
}
const full=render(scene.canvas.background),masked=render('#f5a4cf',true);
await writeFile('assets/previews/old-man-json.png',full.toBuffer('image/png'));
await writeFile('assets/previews/old-man-masked.png',masked.toBuffer('image/png'));
for(const size of [32,35]){const c=createCanvas(size,size);c.getContext('2d').drawImage(masked,0,0,size,size);await writeFile(`assets/previews/old-man-${size}.png`,c.toBuffer('image/png'));}
const sheet=createCanvas(948,360),ctx=sheet.getContext('2d');ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#111';ctx.font='16px sans-serif';
ctx.fillText('SOURCE CROP',10,24);ctx.fillText('JSON / WHITE VIEW',326,24);ctx.fillText('RECT MASK / PINK VIEW',642,24);
ctx.imageSmoothingEnabled=false;ctx.drawImage(await loadImage('assets/fitting-inputs/old-man.png'),0,40,316,320);ctx.drawImage(full,316,40);ctx.drawImage(masked,632,40);
await writeFile('assets/previews/old-man-comparison.png',sheet.toBuffer('image/png'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={date:'2026-10-22',runtime:'static-asset-review',jsonSha256:hash(jsonBytes),luaSha256:hash(luaBytes),canvas:scene.canvas,elementCount:elements.length,kinds:{ellipse:elements.length},jsonLuaCorrespondence:{sameElementOrderTypesColorsAndAlpha:true,geometryTolerance:.0101,maxGeometryDelta,roundedFields},luaSyntaxOnly:true,luaExecuted:false,ellipsesCrossingCanvas:crossing,mask:scene.shaper.mask,imagePrefabId:Number(source.match(/local IMAGE_PREFAB_ID\s*=\s*(\d+)/)?.[1]),menuImageInstances:elements.length*3,gameImageInstances:elements.length,integrationNotes:[
 'Raw Lua uses item[3] - IMG_HEIGHT/2, but item[3] is already negative source y. Center-relative y must use item[3] - shaper.origin.y (origin.y=-40); current raw y is 80*scale too low.',
 'JSON shaper rectangle mask and out-of-canvas ellipses need clipping in final UI; raw Lua does not apply the exported mask.',
 'JSON canvas background is a white viewing/background-composition hint, not an opaque background primitive. Final underlay/alpha must match the reviewed appearance.',
 'IMAGE_PREFAB_ID=0 is a placeholder; source lifecycle callbacks and scale settings must be adapted into a module in step 5, not concatenated into main.lua.'
 ],status:'reference asset received and statically checked; platform integration/device rendering not verified'};
await writeFile('assets/previews/old-man-review.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({elements:elements.length,matchingWithinExportRounding:true,maxGeometryDelta,roundedFields,luaSyntax:true,ellipsesCrossingCanvas:crossing,imagePrefabId:report.imagePrefabId,jsonSha256:report.jsonSha256,luaSha256:report.luaSha256},null,2));
