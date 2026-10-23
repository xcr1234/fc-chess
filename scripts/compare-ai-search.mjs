import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import fengari from 'fengari';
import {preloadModules} from './lua-test-loader.mjs';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
const baseline=execFileSync('git',['show',(process.argv[2] || '1fca382')+':src/game/ai.lua'],{encoding:'utf8'});
const program=`
local B=require('game.board');local A=require('game.ai')
local rows={}
for sample=1,6 do
 local b={} for i=1,90 do b[i]='' end
 b[5]='k';b[85]='K';b[20+sample]='c';b[38+sample]='p';b[65+sample]='N';b[74+sample]='R'
 local j=A.new(b,'black',false,{noBook=true,maxDepth=2,nodeBudget=100000})
 local frames=0
 while not j.done do A.step(j,0);frames=frames+1;assert(frames<10000) end
 assert(j.depth==2 and j.restored)
 rows[#rows+1]=j.move[1]..'-'..j.move[2]
end
return table.concat(rows,',')`;
function run(code){const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);const status=lauxlib.luaL_dostring(L,to_luastring(code));const result=to_jsstring(lua.lua_tostring(L,-1));lua.lua_close(L);if(status!==lua.LUA_OK)throw Error(result);return result;}
const shared=run(preloadModules(['game.ai'])+program);
const full=run(preloadModules(['game.ai'])+program.replace('noBook=true,maxDepth=2','noBook=true,pvs=false,maxDepth=2'));
if(shared!==full)throw Error(`PVS/reference mismatch: ${shared} vs ${full}`);
console.log('PASS PVS vs alpha-beta reference: six fixed depth-two positions '+shared);
// Same three initial boards and budgets; compare host timing, not device strength.
const perf=fs.readFileSync('tests/lua-performance.lua','utf8');
for(const variant of ['baseline','candidate']){
 console.log('VARIANT '+variant);
 run(preloadModules(['game.ai','app.log'],(name,s)=>name==='game.ai'&&variant==='baseline'?baseline:s)+ '\n'+perf+'\nreturn "ok"');
}
