import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';

// Code-native pixel artwork: JSON is the editable source, SVGs preserve each cell.
const dir='assets/pixel-font';
const source=JSON.parse(fs.readFileSync(`${dir}/glyphs-16.json`,'utf8'));
const {size,glyphs}=source;
const names=Object.keys(glyphs);
for(const [name,rows] of Object.entries(glyphs)){
 assert.equal(rows.length,size,`${name}: rows`);
 assert(rows.every(r=>r.length===size&&/^[.#]+$/.test(r)),`${name}: cells`);
 const rects=rows.flatMap((row,y)=>Array.from(row,(p,x)=>p==='#'?`<rect x="${x}" y="${y}" width="1" height="1"/>`:'').filter(Boolean)).join('');
 fs.writeFileSync(`${dir}/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><g fill="currentColor">${rects}</g></svg>\n`);
 const png=createCanvas(size,size);paint(png.getContext('2d'),name,0,0,1,'#ffffff');
 fs.writeFileSync(`${dir}/${name}.png`,png.toBuffer('image/png'));
}
function paint(ctx,name,x,y,scale,color){
 ctx.fillStyle=color;
 glyphs[name].forEach((row,j)=>Array.from(row).forEach((p,i)=>{if(p==='#')ctx.fillRect(x+i*scale,y+j*scale,scale,scale);}));
}
const comparison=createCanvas(640,320),ctx=comparison.getContext('2d');
ctx.fillStyle='#193b57';ctx.fillRect(0,0,640,320);
names.forEach((name,i)=>{
 const x=80+i*160,color=['#2818a0','#e24d08','#e24d08','#2818a0'][i];
 for(const y of [80,240]){ctx.fillStyle='#fffced';ctx.beginPath();ctx.arc(x,y,56,0,Math.PI*2);ctx.fill();}
 ctx.font='bold 78px "Noto Sans SC"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(name,x,77);
 paint(ctx,name,x-40,200,5,color);
});
fs.writeFileSync(`${dir}/comparison.png`,comparison.toBuffer('image/png'));
const grid=createCanvas(848,208),g=grid.getContext('2d');g.fillStyle='#193b57';g.fillRect(0,0,848,208);
names.forEach((name,i)=>{
 const x=8+i*212,y=8;paint(g,name,x,y,12,'#fffced');
 g.lineWidth=1;g.strokeStyle='#557185';g.beginPath();for(let j=0;j<=size;j++){g.moveTo(x+j*12+.5,y+.5);g.lineTo(x+j*12+.5,y+192+.5);g.moveTo(x+.5,y+j*12+.5);g.lineTo(x+192+.5,y+j*12+.5);}g.stroke();
});
fs.writeFileSync(`${dir}/grid.png`,grid.toBuffer('image/png'));
// A game-only board crop, constructed from primitives, compares both sizes.
const strip=createCanvas(512,160),s=strip.getContext('2d');s.fillStyle='#bdc7c8';s.fillRect(0,0,512,160);
s.strokeStyle='#352599';s.lineWidth=3;s.beginPath();for(let i=0;i<4;i++){s.moveTo(64+i*128,0);s.lineTo(64+i*128,160);}s.moveTo(0,80);s.lineTo(512,80);s.stroke();
names.forEach((name,i)=>{const x=64+i*128;s.fillStyle='#fffced';s.beginPath();s.arc(x,80,48,0,Math.PI*2);s.fill();paint(s,name,x-32,48,4,i===1||i===2?'#e24d08':'#2818a0');});
fs.writeFileSync(`${dir}/board-strip.png`,strip.toBuffer('image/png'));
console.log(`Rendered ${names.join(' / ')}: editable 16×16 grids, SVG, transparent PNG, and preview sheets.`);
