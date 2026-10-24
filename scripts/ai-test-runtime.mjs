// Developer harness only: the real Lua engine, no replacement move generator.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import fengari from 'fengari';
import {preloadModules} from './lua-test-loader.mjs';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
export const digest=data=>createHash('sha256').update(data).digest('hex');
export function boardFromFen(fen){
 const board=[];
 for(const c of fen.split(' ')[0]){
  if(c==='/')continue;
  if(/[1-9]/.test(c))board.push(...Array(Number(c)).fill(''));
  else board.push(c==='B'?'E':c==='b'?'e':c);
 }
 assert.equal(board.length,90);return board;
}
export function fenFromBoard(board,side){
 const rows=[];
 for(let rank=0;rank<10;rank++){
  let row='',empty=0;
  for(const value of board.slice(rank*9,rank*9+9)){
   if(!value){empty++;continue;}
   if(empty){row+=empty;empty=0;}
   row+=value==='E'?'B':value==='e'?'b':value;
  }
  rows.push(row+(empty||''));
 }
 return rows.join('/')+(side==='red'?' w':' b');
}
export function pinnedContext(){
 const manifest=JSON.parse(fs.readFileSync('third_party/xqwlight/UPSTREAM.json','utf8'));
 assert.equal(manifest.commit,'6221733f1f79b3acb44cce6f83dc6100443cb2c9');
 const sources=['position.js','search.js'].map(file=>{
  const source=fs.readFileSync('third_party/xqwlight/'+file,'utf8').replaceAll('\r\n','\n');
  assert.equal(digest(source),manifest.sha256[file],file);return source;
 });
 const context=vm.createContext({});vm.runInContext(sources.join('\n'),context);
 context.RANDOMNESS=0;context.BOOK_DAT=[];return context;
}
function readValue(L,index){
 index=lua.lua_absindex(L,index);
 switch(lua.lua_type(L,index)){
  case lua.LUA_TNIL:return null;
  case lua.LUA_TBOOLEAN:return lua.lua_toboolean(L,index);
  case lua.LUA_TNUMBER:return lua.lua_tonumber(L,index);
  case lua.LUA_TSTRING:return to_jsstring(lua.lua_tostring(L,index));
  case lua.LUA_TTABLE:{
   const entries=[];lua.lua_pushnil(L);
   while(lua.lua_next(L,index)){
    entries.push([readValue(L,-2),readValue(L,-1)]);lua.lua_pop(L,1);
   }
   if(entries.length && entries.every(([key])=>Number.isInteger(key)&&key>=1&&key<=entries.length)){
    const array=[];for(const [key,value] of entries)array[key-1]=value;return array;
   }
   return Object.fromEntries(entries);
  }
  default:throw Error('Unexpected Lua return type');
 }
}
function pushValue(L,value){
 if(value===null||value===undefined)lua.lua_pushnil(L);
 else if(typeof value==='boolean')lua.lua_pushboolean(L,value);
 else if(typeof value==='number')lua.lua_pushnumber(L,value);
 else if(typeof value==='string')lua.lua_pushstring(L,to_luastring(value));
 else{
  lua.lua_createtable(L,Array.isArray(value)?value.length:0,Array.isArray(value)?0:Object.keys(value).length);
  for(const [key,item] of Object.entries(value)){
   pushValue(L,item);
   if(Array.isArray(value))lua.lua_rawseti(L,-2,Number(key)+1);
   else lua.lua_setfield(L,-2,to_luastring(key));
  }
 }
}
export function createLuaEngine(){
 const started=performance.now();const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
 const source=preloadModules(['game.ai','game.board'])+`
coroutine=nil
local A=require('game.ai');local B=require('game.board');local P=require('game.ai.position');local G=require('game.ai.movegen')
local job,root,side,custom
function __fc_start(b,s,c,options)
 A.cancel(job);root=B.copy(b);side=s;custom=c;job=A.new(b,s,c,options)
 return job.done
end
function __fc_step(dt) A.step(job,dt);return job.done end
function __fc_cancel() A.cancel(job);return job.done end
function __fc_result()
 assert(job.done and job.restored and #job.stack==0 and #job.pos.history==0,'search did not unwind')
 local clean=P.new(root,side,job.rules);local p=job.pos
 assert(p.key==clean.key and p.lock==clean.lock and p.side==clean.side and p.red==clean.red and p.black==clean.black and p.context==0 and p.contextLock==0,'incremental state differs')
 assert(p.kings[0]==clean.kings[0] and p.kings[1]==clean.kings[1],'king restoration failed')
 local exported=P.export(p)
 for i=1,90 do assert(exported[i]==root[i] and job.board[i]==root[i],'work/input board changed') end
 if job.move then
  assert(B.side(root[job.move[1]])==side and B.valid(root,job.move[1],job.move[2],custom),'illegal basic move')
  if job.rules.standard then assert(G.safe(clean,P.move(P.from90[job.move[1]],P.from90[job.move[2]])),'unsafe standard move') end
 end
 return {move=job.move,score=job.score,depth=job.depth,nodes=job.nodes,qnodes=job.qnodes,mainNodes=job.mainNodes,reason=job.reason,
 elapsed=job.elapsed,operations=job.operations or 0,ttEntries=job.transpositions.count,ttHits=job.transpositions.hits,restored=job.restored}
end
`;
 if(lauxlib.luaL_dostring(L,to_luastring(source))!==lua.LUA_OK){const message=to_jsstring(lua.lua_tostring(L,-1));lua.lua_close(L);throw Error(message);}
 function call(name,...args){
  lua.lua_getglobal(L,to_luastring(name));args.forEach(value=>pushValue(L,value));
  if(lua.lua_pcall(L,args.length,1,0)!==lua.LUA_OK){const message=to_jsstring(lua.lua_tostring(L,-1));lua.lua_pop(L,1);throw Error(message);}
  const result=readValue(L,-1);lua.lua_pop(L,1);return result;
 }
 return {loadMs:performance.now()-started,start:(...args)=>call('__fc_start',...args),step:dt=>call('__fc_step',dt),
  cancel:()=>call('__fc_cancel'),result:()=>call('__fc_result'),close:()=>lua.lua_close(L)};
}
export function safeMoves(context,pos){
 const moves=[];
 for(const move of pos.generateMoves(null)){
  if(!pos.makeMove(move))continue;pos.undoMakeMove();moves.push(move);
 }
 return moves.sort((a,b)=>a-b);
}
export function judgeStandard(context,fen,visits){
 const pos=new context.Position();pos.fromFen(fen);const legal=safeMoves(context,pos);
 if(!legal.length)return {legal,reason:'no-safe-move',loser:fen.endsWith(' w')?'red':'black'};
 if(visits>=3)return {legal,reason:'benchmark-threefold',draw:true};
 return {legal,reason:null};
}
export function externalMove(move){
 const from=move&255,to=move>>>8;
 const square=x=>(Math.floor(x/16)-3)*9+x%16-3+1;
 return [square(from),square(to)];
}
export function internalMove(move){
 const square=x=>(Math.floor((x-1)/9)+3)*16+(x-1)%9+3;
 return square(move[0])+square(move[1])*256;
}
export function chooseJS(context,fen,milliseconds){
 const started=performance.now();const deadline=started+milliseconds;
 const pos=new context.Position();pos.fromFen(fen);const fallback=safeMoves(context,pos)[0];
 if(!fallback)return {move:null,depth:0,nodes:0,elapsedMs:performance.now()-started,reason:'no-moves'};
 const search=new context.Search(pos,14);let completed=null;
 const abort=Symbol('deadline');let checks=0;
 for(const name of ['searchFull','searchQuiesc']){
  const original=search[name];search[name]=function(...args){
   if((checks++&63)===0 && performance.now()>=deadline)throw abort;
   return original.apply(this,args);
  };
 }
 const root=search.searchRoot;
 search.searchRoot=function(depth){const score=root.call(this,depth);completed={move:this.mvResult,score,depth,nodes:this.allNodes};return score;};
 let reason='complete';
 try{search.searchMain(64,milliseconds);}catch(error){if(error!==abort)throw error;reason='deadline';}
 const elapsedMs=performance.now()-started;
 return {move:externalMove(completed?.move??fallback),score:completed?.score??null,depth:completed?.depth??0,
  nodes:search.allNodes,elapsedMs,overrunMs:Math.max(0,elapsedMs-milliseconds),reason};
}
export function chooseLua(engine,board,side,milliseconds){
 const started=performance.now();let done=engine.start(board,side,false,{profile:'reference-standard-v1',noBook:true,timeLimit:Infinity});
 let frames=0;
 while(!done && performance.now()-started<milliseconds){done=engine.step(0);frames++;}
 if(!done)engine.cancel();
 const result=engine.result();const elapsedMs=performance.now()-started;
 return {...result,frames,elapsedMs,overrunMs:Math.max(0,elapsedMs-milliseconds)};
}
