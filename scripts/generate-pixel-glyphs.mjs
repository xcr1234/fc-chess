import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('assets/pixel-font/glyphs-16.json','utf8'));
for(const name of Array.from('車馬象士將包卒俥傌相仕帥炮兵楚河漢界'))assert(data.glyphs[name],`Missing required glyph ${name}`);
assert(!data.glyphs['砲'],'Red cannon uses 炮');
const metrics={boardSize:data.boardSize,paletteSize:data.paletteSize,riverSize:data.riverSize};
for(const size of Object.values(metrics))assert(Number.isFinite(size)&&size>0&&size<=16);
const glyphs={};
for(const [name,rows] of Object.entries(data.glyphs)){
 assert.equal(rows.length,data.size);assert(rows.every(r=>r.length===data.size&&/^[.#]+$/.test(r)));
 assert(rows[0]==='.'.repeat(data.size)&&rows.at(-1)==='.'.repeat(data.size),`${name}: vertical inset`);
 assert(rows.every(row=>row[0]==='.'&&row.at(-1)==='.'),`${name}: horizontal inset`);
 const rects=[],active=new Map();
 rows.forEach((row,y)=>{
  const next=new Map();
  for(const m of row.matchAll(/#+/g)){
   const x=m.index,w=m[0].length,key=`${x}:${w}`;
   const r=active.get(key)??[x,y,w,0];if(!active.has(key))rects.push(r);r[3]++;next.set(key,r);
  }
  active.clear();for(const [key,r] of next)active.set(key,r);
 });
 // Independently rasterize the merged geometry to reject missing/extra cells.
 const cells=Array.from({length:data.size},()=>Array(data.size).fill('.'));
 for(const [x,y,w,h] of rects)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){assert.equal(cells[j][i],'.');cells[j][i]='#';}
 assert.deepEqual(cells.map(r=>r.join('')),rows);glyphs[name]=rects;
}
fs.writeFileSync('src/ui/pixel_glyph_data.lua',`-- Generated from assets/pixel-font/glyphs-16.json; edit that source.\nreturn {size=${data.size},boardSize=${metrics.boardSize},paletteSize=${metrics.paletteSize},riverSize=${metrics.riverSize},glyphs={\n${Object.entries(glyphs).map(([n,rs])=>` ['${n}']={${rs.map(r=>`{${r.join(',')}}`).join(',')}},`).join('\n')}\n}}\n`);
fs.writeFileSync('prototype/pixel-glyphs.js',`// Generated from assets/pixel-font/glyphs-16.json.\nglobalThis.FCChessPixelGlyphs=${JSON.stringify({size:data.size,...metrics,glyphs})};\n`);
console.log('Pixel glyph rectangles: '+Object.entries(glyphs).map(([n,rs])=>`${n}=${rs.length}`).join(', '));
