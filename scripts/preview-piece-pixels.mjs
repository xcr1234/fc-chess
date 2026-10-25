import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';

// Code-native pixel artwork: JSON is the editable source, SVGs preserve each cell.
const dir='assets/pixel-font';
const source=JSON.parse(fs.readFileSync(`${dir}/glyphs-16.json`,'utf8'));
const {size,glyphs}=source;
const names=Object.keys(glyphs);
const previous=JSON.parse(fs.readFileSync(`${dir}/previous-draft.json`,'utf8'));
for(const [name,rows] of Object.entries(glyphs)){
 assert.equal(rows.length,size,`${name}: rows`);
 assert(rows.every(r=>r.length===size&&/^[.#]+$/.test(r)),`${name}: cells`);
 const rects=rows.flatMap((row,y)=>Array.from(row,(p,x)=>p==='#'?`<rect x="${x}" y="${y}" width="1" height="1"/>`:'').filter(Boolean)).join('');
 const shadow=(source.shadows[name]??[]).flatMap((row,y)=>Array.from(row,(p,x)=>p==='#'?`<rect x="${x}" y="${y}" width="1" height="1"/>`:'').filter(Boolean)).join('');
 fs.writeFileSync(`${dir}/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><g fill="#${source.colors.shadow}">${shadow}</g><g fill="currentColor">${rects}</g></svg>\n`);
 const png=createCanvas(size,size);paintNew(png.getContext('2d'),name,0,0,1,source.shadows[name]?'#'+source.colors.river:'#ffffff');
 fs.writeFileSync(`${dir}/${name}.png`,png.toBuffer('image/png'));
}
function paint(ctx,name,x,y,scale,color,masks=glyphs){
 ctx.fillStyle=color;
 masks[name].forEach((row,j)=>Array.from(row).forEach((p,i)=>{if(p==='#')ctx.fillRect(x+i*scale,y+j*scale,scale,scale);}));
}
function paintNew(ctx,name,x,y,scale,color){
 if(source.shadows[name])paint(ctx,name,x,y,scale,'#'+source.colors.shadow,source.shadows);
 paint(ctx,name,x,y,scale,color);
}
function disc(ctx,name,x,y,scale){
 const masks=source.discs[name];
 paint(ctx,'rim',x,y,scale,'#'+source.colors.black,masks);
 paint(ctx,'white',x,y,scale,'#'+source.colors.shadow,masks);
}
const columns=6,rows=Math.ceil(names.length/columns);
const red=new Set(Array.from('俥傌相仕帥炮兵'));
const colorOf=name=>'#'+(red.has(name)?source.colors.red:source.colors.black);
const comparison=createCanvas(columns*128,rows*256),ctx=comparison.getContext('2d');
ctx.fillStyle='#193b57';ctx.fillRect(0,0,comparison.width,comparison.height);
names.forEach((name,i)=>{
 const x=64+(i%columns)*128,top=Math.floor(i/columns)*256,color=colorOf(name);
 ctx.fillStyle='#fffdef';ctx.beginPath();ctx.arc(x,top+64,48,0,Math.PI*2);ctx.fill();
 const oldSize=(source.discs[name]?previous.boardSize:previous.riverSize)*6;
 paint(ctx,name,x-oldSize/2,top+64-oldSize/2,oldSize/16,red.has(name)?'#f33d43':'#2818a0',previous.glyphs);
 if(source.discs[name])disc(ctx,name,x-48,top+144,6);
 paintNew(ctx,name,x-48,top+144,6,color);
});
fs.writeFileSync(`${dir}/comparison.png`,comparison.toBuffer('image/png'));
const grid=createCanvas(columns*208,rows*208),g=grid.getContext('2d');g.fillStyle='#193b57';g.fillRect(0,0,grid.width,grid.height);
names.forEach((name,i)=>{
 const x=8+(i%columns)*208,y=8+Math.floor(i/columns)*208;paint(g,name,x,y,12,'#fffced');
 g.lineWidth=1;g.strokeStyle='#557185';g.beginPath();for(let j=0;j<=size;j++){g.moveTo(x+j*12+.5,y+.5);g.lineTo(x+j*12+.5,y+192+.5);g.moveTo(x+.5,y+j*12+.5);g.lineTo(x+192+.5,y+j*12+.5);}g.stroke();
});
fs.writeFileSync(`${dir}/grid.png`,grid.toBuffer('image/png'));
// A game-only board crop, constructed from primitives, compares both sizes.
const strip=createCanvas(896,256),s=strip.getContext('2d');s.fillStyle='#bdc7c8';s.fillRect(0,0,896,256);
s.strokeStyle='#352599';s.lineWidth=3;s.beginPath();for(let i=0;i<7;i++){s.moveTo(64+i*128,0);s.lineTo(64+i*128,256);}for(const y of [64,192]){s.moveTo(0,y);s.lineTo(896,y);}s.stroke();
names.slice(0,14).forEach((name,i)=>{const x=(i%7)*128,y=Math.floor(i/7)*128;disc(s,name,x,y,8);paintNew(s,name,x,y,8,colorOf(name));});
fs.writeFileSync(`${dir}/board-strip.png`,strip.toBuffer('image/png'));
console.log(`Rendered ${names.join(' / ')}: editable 16×16 grids, SVG, transparent PNG, and preview sheets.`);
