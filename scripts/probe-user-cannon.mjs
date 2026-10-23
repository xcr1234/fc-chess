import fs from 'node:fs';import {execFileSync} from 'node:child_process';import fengari from 'fengari';import {preloadModules} from './lua-test-loader.mjs';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
const luaProgram=`
local B=require('game.board');local A=require('game.ai');local b=B.standard()
for _,m in ipairs({{65,68},{2,21},{57,48},{34,43},{83,66},{8,25},{66,49}}) do b[m[2]]=b[m[1]];b[m[1]]='' end
local j=A.new(b,'black',false,{noBook=true,pvs=false,maxDepth=2,nodeBudget=100000})
while not j.done do A.step(j,0) end
print('BEST',j.move[1],j.move[2],j.score,j.nodes)
`;
const old=process.argv.includes('--baseline')?execFileSync('git',['show','1caf690:src/game/ai/search.lua'],{encoding:'utf8'}):null;
console.log('SOURCE',old?'1caf690':'working-tree','depth=2 full-root-windows');
const source=preloadModules(['game.ai'],(n,s)=>n==='game.ai.search'?(old||s).replace('score=-score\n  if f.trial',"score=-score\n  if parent.ply==0 then print('ROOT',f.move[1],f.move[2],score) end\n  if f.trial").replace('parent.alpha=math.max(parent.alpha,score)','if parent.ply>0 then parent.alpha=math.max(parent.alpha,score) end'):s);
const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);const status=lauxlib.luaL_dostring(L,to_luastring(source+'\n'+luaProgram));if(status!==lua.LUA_OK)throw Error(to_jsstring(lua.lua_tostring(L,-1)));
