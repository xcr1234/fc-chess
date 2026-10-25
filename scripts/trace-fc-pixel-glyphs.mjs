import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';

// Analyze the native reference as indexed-color cells; output code-native masks.
// No resampling, font substitution or screenshot image is used at runtime.
const reference='prototype/assets/original-screen.png';
const image=await loadImage(reference);assert.equal(image.width,256);assert.equal(image.height,224);
const canvas=createCanvas(256,224),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
const pixels=ctx.getImageData(0,0,256,224).data;
const colors={blue:[36,24,140],red:[216,40,0],white:[252,252,252]};
const is=(x,y,color)=>colors[color].every((v,k)=>pixels[(y*256+x)*4+k]===v);
const matrix=fn=>Array.from({length:16},(_,y)=>Array.from({length:16},(_,x)=>fn(x,y)?'#':'.').join(''));
// Red cannon cell has the same white disc and blue rim as black pieces.
// Its white/red interior separates black lettering from blue rim and board lines.
const inside=(x,y)=>is(64+x,152+y,'white')||is(64+x,152+y,'red');
const cells=[
 ['車',56,48,'blue'],['馬',72,48,'blue'],['象',88,48,'blue'],['士',104,48,'blue'],
 ['將',120,48,'blue'],['包',72,80,'blue'],['卒',56,96,'blue'],
 ['俥',56,192,'red'],['傌',72,192,'red'],['相',88,192,'red'],['仕',104,192,'red'],
 ['帥',120,192,'red'],['炮',72,160,'red'],['兵',56,144,'red']
];
const glyphs={},shadows={},provenance={};
for(const [name,cx,cy,color] of cells){
 glyphs[name]=matrix((x,y)=>is(cx-8+x,cy-8+y,color)&&(color==='red'||inside(x,y)));
 assert(glyphs[name].some(row=>row.includes('#')),name);
 provenance[name]={x:cx-8,y:cy-8,width:16,height:16,palette:color,discRimExcluded:color==='blue'};
}
for(const [name,left] of [['楚',72],['河',88],['漢',136],['界',152]]){
 // Rows 112/113 are board lines, not lettering. Preserve the native hard shadow.
 glyphs[name]=matrix((x,y)=>y>=2&&is(left+x,112+y,'blue'));
 shadows[name]=matrix((x,y)=>y>=2&&is(left+x,112+y,'white'));
 provenance[name]={x:left,y:112,width:16,height:16,excludedRows:[0,1],whiteShadow:true};
}
const disc={white:matrix(inside),rim:matrix((x,y)=>is(64+x,152+y,'blue'))};
const discs={};
for(const [name,cx,cy] of cells){
 const silhouette=(x,y)=>disc.white[y][x]==='#'||disc.rim[y][x]==='#';
 discs[name]={white:matrix((x,y)=>silhouette(x,y)&&(is(cx-8+x,cy-8+y,'white')||is(cx-8+x,cy-8+y,'red')||glyphs[name][y][x]==='#')),
  rim:matrix((x,y)=>silhouette(x,y)&&is(cx-8+x,cy-8+y,'blue')&&glyphs[name][y][x]!== '#')};
}
const output={version:3,size:16,inkInset:0,boardSize:16,paletteSize:12,riverSize:16,
 colors:{red:'d82800',black:'24188c',river:'24188c',shadow:'fcfcfc'},
 purpose:'Reference-traced 14 chess glyphs and four river glyphs, including native white river shadow',
 source:{path:reference,sha256:createHash('sha256').update(fs.readFileSync(reference)).digest('hex'),method:'Exact native palette mask; 16x16 cells; no guessed strokes',provenance,discCell:{x:64,y:152,width:16,height:16}},glyphs,shadows,disc,discs};
const checks=[];
for(const [name,cx,cy,color] of cells){let checked=0;
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const actual=glyphs[name][y][x]==='#'?color:discs[name].rim[y][x]==='#'?'blue':discs[name].white[y][x]==='#'?'white':null;
  if(actual){assert(is(cx-8+x,cy-8+y,actual),`${name}: source mismatch at ${x},${y}`);checked++;}
 }
 checks.push({glyph:name,matchingNativeColoredPixels:checked,passed:true});
}
fs.writeFileSync('assets/pixel-font/glyphs-16.json',JSON.stringify(output,null,2)+'\n');
fs.writeFileSync('assets/pixel-font/fc-trace-verification.json',JSON.stringify({source:output.source.path,sha256:output.source.sha256,cellSize:16,glyphs:checks,river:'Blue and white pixels extracted from native rows 114–127; board separator excluded'},null,2)+'\n');
console.log('Traced 18 native-reference glyphs and 4 white shadow masks.');
