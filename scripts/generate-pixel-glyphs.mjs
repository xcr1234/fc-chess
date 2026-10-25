import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('assets/pixel-font/glyphs-16.json','utf8'));
for(const name of Array.from('車馬象士將包卒俥傌相仕帥炮兵楚河漢界'))assert(data.glyphs[name],`Missing required glyph ${name}`);
for(const name of Array.from('車馬象士將包卒俥傌相仕帥炮兵'))assert(data.discs?.[name]?.white&&data.discs[name].rim,`Missing disc layers ${name}`);
for(const name of Array.from('楚河漢界'))assert(data.shadows?.[name],`Missing river shadow ${name}`);
assert(!data.glyphs['砲'],'Red cannon uses 炮');
const metrics={boardSize:data.boardSize,paletteSize:data.paletteSize,riverSize:data.riverSize};
for(const size of Object.values(metrics))assert(Number.isFinite(size)&&size>0&&size<=16);
function encode(masks){const output={};for(const [name,rows] of Object.entries(masks)){
 assert.equal(rows.length,data.size);assert(rows.every(r=>r.length===data.size&&/^[.#]+$/.test(r)));
 if(data.inkInset)for(let y=0;y<data.size;y++)for(let x=0;x<data.size;x++)if(x<data.inkInset||y<data.inkInset||x>=data.size-data.inkInset||y>=data.size-data.inkInset)assert.equal(rows[y][x],'.',`${name}: inset`);
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
 assert.deepEqual(cells.map(r=>r.join('')),rows);output[name]=rects;
}return output;}
const glyphs=encode(data.glyphs),shadows=encode(data.shadows??{}),disc=encode(data.disc??{}),colors=data.colors;
const discs=Object.fromEntries(Object.entries(data.discs??{}).map(([name,layers])=>[name,encode(layers)]));
for(const color of Object.values(colors))assert(/^[0-9a-f]{6}$/.test(color));
const table=masks=>`{\n${Object.entries(masks).map(([n,rs])=>` ['${n}']={${rs.map(r=>`{${r.join(',')}}`).join(',')}},`).join('\n')}\n}`;
fs.writeFileSync('src/ui/pixel_glyph_data.lua',`-- Generated from assets/pixel-font/glyphs-16.json; edit that source.\nreturn {size=${data.size},boardSize=${metrics.boardSize},paletteSize=${metrics.paletteSize},riverSize=${metrics.riverSize},colors={${Object.entries(colors).map(([k,v])=>`${k}='${v}'`).join(',')}},glyphs=${table(glyphs)},shadows=${table(shadows)},disc=${table(disc)},discs={${Object.entries(discs).map(([name,layers])=>`['${name}']=${table(layers)}`).join(',')}}}\n`);
fs.writeFileSync('prototype/pixel-glyphs.js',`// Generated from assets/pixel-font/glyphs-16.json.\nglobalThis.FCChessPixelGlyphs=${JSON.stringify({size:data.size,...metrics,colors,glyphs,shadows,disc,discs})};\n`);
console.log('Pixel glyph rectangles: '+Object.entries(glyphs).map(([n,rs])=>`${n}=${rs.length}`).join(', '));
console.log('River shadow rectangles: '+Object.values(shadows).reduce((n,rs)=>n+rs.length,0));
console.log('Disc rectangles: '+Object.values(disc).reduce((n,rs)=>n+rs.length,0));
