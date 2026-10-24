// Engine implementation probes, independent of the product rule acceptance suite.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fengari from 'fengari';
import {preloadModules} from './lua-test-loader.mjs';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('third_party/xqwlight/position.js','utf8')+'\n'+fs.readFileSync('third_party/xqwlight/search.js','utf8'),context);
function luaValue(value){
 if(Array.isArray(value))return '{'+value.map(luaValue).join(',')+'}';
 if(typeof value==='object')return '{'+Object.entries(value).map(([k,v])=>'['+luaValue(k)+']='+luaValue(v)).join(',')+'}';
 return JSON.stringify(value);
}
function run(source){
 const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
 const status=lauxlib.luaL_dostring(L,to_luastring(preloadModules(['game.ai'])+'\ncoroutine=nil\n'+source));
 if(status!==lua.LUA_OK){const error=to_jsstring(lua.lua_tostring(L,-1));lua.lua_close(L);throw Error(error);}
 lua.lua_close(L);
}
const fen='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
const pos=new context.Position();pos.fromFen(fen);
const samples=[];let seed=113;
function board(p){return Array.from({length:90},(_,i)=>'        KAENRCP kaenrcp '[p.squares[(Math.floor(i/9)+3)*16+i%9+3]]?.trim()??'');}
for(let i=0;i<32;i++){
 const moves=pos.generateMoves(null).filter(m=>{if(!pos.makeMove(m))return false;pos.undoMakeMove();return true;}).sort((a,b)=>a-b);
 samples.push({board:board(pos),side:pos.sdPlayer===0?'red':'black',score:pos.evaluate(),key:pos.zobristKey&0x7fffffff,lock:pos.zobristLock&0x7fffffff,moves});
 seed=(seed*16807)%2147483647;pos.makeMove(moves[seed%moves.length]);pos.setIrrev();
}
run(`
local P=require('game.ai.position');local G=require('game.ai.movegen');local R=require('game.ai.rules');local E=require('game.ai.evaluate');local B=require('game.board')
local samples=${luaValue(samples)}
for n,s in ipairs(samples) do
 local p=P.new(s.board,s.side,R.get(false,'reference-standard-v1'));local moves={};local u={}
 assert(p.key==s.key and p.lock==s.lock,'JS/Lua hash mismatch '..n)
 assert(E.score(p,0)==s.score,'JS/Lua evaluation mismatch '..n)
 for _,m in ipairs(G.generate(p)) do
  local key,lock,red,black=p.key,p.lock,p.red,p.black
  P.make(p,m,u,'move')
  local rebuilt=P.new(P.export(p),p.side==0 and 'red' or 'black',p.rules)
  assert(p.key==rebuilt.key and p.lock==rebuilt.lock and p.red==rebuilt.red and p.black==rebuilt.black,'incremental mismatch')
  if not G.danger(p,1-p.side) then moves[#moves+1]=m end
  P.undo(p,u);assert(p.key==key and p.lock==lock and p.red==red and p.black==black and #p.history==0)
 end
 table.sort(moves);assert(#moves==#s.moves,'JS/Lua move count '..n)
 for i,m in ipairs(moves) do assert(m==s.moves[i],'JS/Lua move mismatch '..n) end
end
print('PASS 32 pinned-JS positions: safe moves, evaluation, 31-bit hash lanes, incremental make/undo')
math.randomseed(311)
for sample=1,40 do
 local b={} for i=1,90 do b[i]='' end
 local pieces={'R','N','C','A','E','P','r','n','c','a','e','p'}
 for i=1,24 do b[math.random(1,90)]=pieces[math.random(1,#pieces)] end;b[5]='k';b[85]='K'
 if sample==1 then for i=10,24 do b[i]='R' end end
 for _,custom in ipairs({false,true}) do for _,side in ipairs({'red','black'}) do
  local p=P.new(b,side,R.get(custom));local expected={};local actual={}
  for _,m in ipairs(B.moves(b,side,custom)) do expected[m[1]*100+m[2]]=true end
  for _,m in ipairs(G.generate(p)) do local ext=P.external(m);local key=ext[1]*100+ext[2];assert(expected[key] and not actual[key],'capture move mismatch');actual[key]=true end
  for k in pairs(expected) do assert(actual[k],'missing move') end
  for _,targetSide in ipairs({'red','black'}) do
   local king=targetSide=='red' and 85 or 5;local danger=false
   for i=1,90 do if B.side(b[i]) and B.side(b[i])~=targetSide and B.valid(b,i,king,custom) then danger=true end end
   assert(G.danger(p,targetSide=='red' and 0 or 1)==danger,'attack mismatch '..sample)
  end
 end end
end
print('PASS 160 arbitrary-army capture profiles: generation and king attacks vs game geometry')
`);
// Deterministic upstream full-window oracle: preserve upstream position and
// quiescence, turn off TT/null/randomness; use the same bounded extension count.
vm.runInContext(`
function oracle(pos,depth,ext,ply,alpha,beta) {
 if(ply>=60)throw Error('oracle protection reached');
 var best=-11000,moves;
 if(depth<=0){
  if(!pos.inCheck()){best=pos.evaluate();if(best>=beta)return best;alpha=Math.max(alpha,best);var ranks=[];moves=pos.generateMoves(ranks).filter((m,i)=>ranks[i]>=10 && !(ranks[i]<20 && HOME_HALF(DST(m),pos.sdPlayer)));}
  else moves=pos.generateMoves(null);
 }else moves=pos.generateMoves(null);
 var legal=moves.filter(m=>{if(!pos.makeMove(m))return false;pos.undoMakeMove();return true;});
 var single=depth>0 && pos.inCheck() && legal.length===1;
 for(var m of legal){pos.makeMove(m);var extend=depth>0 && ext>0 && (pos.inCheck() || single);
  var value=-oracle(pos,depth<=0?depth-1:depth-1+(extend?1:0),ext-(extend?1:0),ply+1,-beta,-alpha);pos.undoMakeMove();
  best=Math.max(best,value);if(best>=beta)break;alpha=Math.max(alpha,best);
 }
 return best===-11000?pos.mateValue():best;
}
`,context);
const refs=[];
for(const index of [0,4,8,12,16,20]){
 const s=samples[index];const p=new context.Position();p.clearBoard();
 for(let i=0;i<90;i++){const c=s.board[i];if(!c)continue;const side=c===c.toUpperCase()?8:16;const kind='KAENRCP'.indexOf(c.toUpperCase());p.addPiece((Math.floor(i/9)+3)*16+i%9+3,side+kind);}
 if(s.side==='black')p.changeSide();p.setIrrev();
 const score=context.oracle(p,2,0,0,-11000,11000),bestMoves=[];
 for(const m of p.generateMoves(null)){
  if(!p.makeMove(m))continue;
  const value=-context.oracle(p,1,0,1,-11000,11000);p.undoMakeMove();
  if(value===score)bestMoves.push(m);
 }
 refs.push({...s,score,bestMoves});
}
run(`
local A=require('game.ai');local TT=require('game.ai.tt');local P=require('game.ai.position');local R=require('game.ai.rules');local G=require('game.ai.movegen');local B=require('game.board')
local refs=${luaValue(refs)}
for n,s in ipairs(refs) do
 for _,pvs in ipairs({false,true}) do
  local j=A.new(s.board,s.side,false,{noBook=true,profile='reference-standard-v1',maxDepth=2,extensions=0,qDepth=64,nodeBudget=2000000,pvs=pvs,clock=false})
  while not j.done do A.step(j,0) end
  assert(j.reason=='complete' and j.score==s.score,'oracle mismatch '..n..' '..tostring(j.score)..'/'..s.score..' '..j.reason)
  local best=false;for _,m in ipairs(s.bestMoves) do if m==j.bestInternal then best=true end end;assert(best,'root move outside independent optimal set')
 end
end
print('PASS six fixed-depth JS/Lua full-window/PVS root scores and independent optimal-move sets')
local p=P.new(B.standard(),'red',R.get(false));local t=TT.new(1)
local f={depth=3,ext=2,q=8,ply=4,noNull=false,originalAlpha=-11000,alpha=-11000,beta=11000}
TT.store(t,p,f,9994,123,1);local encoded=t.slots[0].score
for i=1,10 do assert(TT.probe(t,p,f)==9994 and t.slots[0].score==encoded,'TT read drift') end
f.ext=1;assert(TT.probe(t,p,f)==nil);f.ext=2
p.context=123;assert(TT.probe(t,p,f)==nil);p.context=0
p.lock=p.lock ~ 1;assert(TT.probe(t,p,f)==nil);p.lock=p.lock ~ 1
f.originalAlpha=50;f.alpha=50;f.beta=100;TT.store(t,p,f,40,123,2);assert(TT.probe(t,p,f)==40)
f.alpha=30;assert(TT.probe(t,p,f)==nil)
f.originalAlpha=0;f.alpha=0;TT.store(t,p,f,120,123,3);assert(TT.probe(t,p,f)==120)
f.beta=130;assert(TT.probe(t,p,f)==nil)
assert(t.count==1)
print('PASS TT immutable mate distances, bounds, collisions, capacity, extension/history isolation')
local positions={}
for i=1,6 do local b={} for n=1,90 do b[n]='' end;b[5]='k';b[85]='K';b[20+i]='c';b[38+i]='p';b[65+i]='N';b[74+i]='R';positions[i]=b end
for n,b in ipairs(positions) do
 local score
 for _,pvs in ipairs({false,true}) do for _,tt in ipairs({false,true}) do for _,quota in ipairs({1,512}) do
  local j=A.new(b,'black',false,{noBook=true,maxDepth=3,nodeBudget=200000,operationsPerStep=quota,pvs=pvs,tt=tt,clock=false})
  while not j.done do A.step(j,0) end
  assert(j.reason=='complete' and j.restored)
  score=score or j.score;assert(score==j.score,'PVS/TT/slice disagreement '..n)
 end end end
end
print('PASS 48 fixed-depth runs: full-window/PVS x TT off/on x one-work-unit/512 slices')
for cut=1,140 do
 local j=A.new(positions[2],'black',false,{noBook=true,maxDepth=5,nodeBudget=100000,operationsPerStep=1,clock=false})
 for i=1,cut do A.step(j,0) end;A.cancel(j)
 assert(j.restored and #j.pos.history==0 and j.pos.red-j.pos.black==j.initialEval and #j.stack==0)
 local back=P.export(j.pos);for i=1,90 do assert(back[i]==positions[2][i]) end
end
print('PASS 140 cancellation boundaries restore board, kings, side, evaluation, hash, history and stack')
for _,limit in ipairs({150,1500,5000}) do
 local first
 for _,quota in ipairs({1,31,128,512}) do
  local j=A.new(positions[2],'black',false,{noBook=true,maxDepth=5,nodeBudget=100000,workBudget=limit,operationsPerStep=quota,clock=false})
  while not j.done do A.step(j,0) end
  assert(j.reason=='work' and j.operations==limit and j.restored)
  local result=tostring(j.score)..':'..j.depth..':'..j.nodes..':'..j.move[1]..'-'..j.move[2]
  first=first or result;assert(first==result,'work budget depends on slicing')
 end
end
print('PASS 12 work-budget aborts preserve identical completed iterations across four slice sizes')
for _,phase in ipairs({'null','verify','research'}) do
 local b=B.standard();b[46]=b[55];b[55]=''
 local j=A.new(b,'black',false,{noBook=true,maxDepth=5,nodeBudget=100000,operationsPerStep=1,clock=false,nullMove=true,extensions=0})
 local seen=false
 while not j.done do
  A.step(j,0)
  for _,f in ipairs(j.stack) do if f.phase==phase then seen=true end end
  if seen then break end
 end
 assert(seen,'probe missed phase '..phase);A.cancel(j);assert(j.restored and #j.stack==0 and #j.pos.history==0)
 print('PASS cancellation inside '..phase..' nodes='..j.nodes)
end
local b={} for i=1,90 do b[i]='' end;b[5]='k';b[85]='K';b[23]='R';b[40]='p'
local j=A.new(b,'black',false,{noBook=true,qDepth=0,extensions=0,maxDepth=1,nodeBudget=10000,clock=false})
while not j.done do A.step(j,0) end
-- A root danger must be answered even when the requested quiet horizon is zero.
assert(j.restored and j.move and G.safe(P.new(b,'black',R.get(false)),P.move(P.from90[j.move[1]],P.from90[j.move[2]])))
print('PASS zero-quiescence budget never submits an exposed-king fallback')
local b={} for i=1,90 do b[i]='' end;b[5]='k';b[86]='K';b[23]='R';b[77]='r'
local j=A.new(b,'black',false,{noBook=true});assert(j.done and j.move[1]==77 and j.move[2]==86 and j.score==9999)
print('PASS counter-capture of enemy king wins before own-king danger')
local b=B.standard();local p=P.new(b,'red',R.get(false,'reference-standard-v1'));local path={}
for _,m in ipairs({{83,66},{2,21},{66,83},{21,2}}) do
 local u={};P.make(p,P.move(P.from90[m[1]],P.from90[m[2]]),u,'move');u.checked=G.danger(p,p.side);path[#path+1]=u
end
assert(P.repetition(p,4)==-20,'standard repeat value differs from upstream')
for i=#path,1,-1 do P.undo(p,path[i]) end
assert(#p.history==0 and p.context==0)
local b={} for i=1,90 do b[i]='' end;b[6]='k';b[85]='K';b[41]='r'
local j=A.new(b,'black',false,{noBook=true,qDepth=0,extensions=0,maxDepth=2,clock=false})
while not j.done do A.step(j,0) end
assert(j.reason=='danger-limit' and j.restored and not j.partialExact,'danger cap fabricated a score')
print('PASS repetition scoring/undo and dangerous-leaf abort propagation')
for _,size in ipairs({16384,32768,65536}) do
 local start=os.clock();local j=A.new(positions[2],'black',false,{noBook=true,maxDepth=4,ttSize=size,nodeBudget=100000,clock=false})
 while not j.done do A.step(j,0) end
 assert(j.restored and j.reason=='complete' and j.transpositions.count<=size)
 print('TT capacity='..size..' entries='..j.transpositions.count..' hits='..j.transpositions.hits..' nodes='..j.nodes..' hostMs='..math.floor((os.clock()-start)*1000))
end
`);
// Two historical "must save cannon" fixtures are simultaneous horse/cannon
// forks. Preserve the tests, and report the pinned engine's actual choice.
for(const rank of ['3N5','5N3']){
 const p=new context.Position();p.fromFen('rnbakabnr/'+rank+'/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b');
 p.nullOkay=()=>false;const search=new context.Search(p,14);context.RANDOMNESS=0;
 const move=search.searchMain(3,100000);
 const external=sq=>(sq%16-3)+(Math.floor(sq/16)-3)*9+1;
 console.log('JS fork diagnostic: '+external(move&255)+'-'+external(move>>8)+' nodes='+search.allNodes);
}
assert(refs.length===6);
