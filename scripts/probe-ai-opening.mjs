import fs from 'node:fs';
import {createHash} from 'node:crypto';
// In-memory parameter experiments only: production files and saves are unchanged.
console.log('SCOPE runtime=lua-fengari fixed-dt=1/60 maxDepth=5 no-device-or-full-simulator-claim');
console.log('SOURCE ai='+createHash('sha256').update(fs.readFileSync('src/game/ai.lua')).digest('hex'));
console.log('SOURCE board='+createHash('sha256').update(fs.readFileSync('src/game/board.lua')).digest('hex'));
import fengari from 'fengari';
import {preloadModules} from './lua-test-loader.mjs';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
const modules=['game.board','game.ai'];
const configs=[{name:'baseline',budget:1600,threat:3000,q:2,seconds:4},{name:'budget3200',budget:3200,threat:3000,q:2,seconds:4},{name:'threat150',budget:1600,threat:150,q:2,seconds:4},{name:'q4',budget:1600,threat:3000,q:4,seconds:4},{name:'combined',budget:3200,threat:150,q:4,seconds:4},{name:'extended',budget:6400,threat:150,q:4,seconds:8}];
for(const c of configs){
 const state=lauxlib.luaL_newstate();lualib.luaL_openlibs(state);
 let code=preloadModules(modules,(n,source)=>{
 if(n==='game.ai'){
 for(const token of ['and 3000 or 0','job.elapsed>=4','2000000,1,2)']){if(source.split(token).length!==2)throw new Error('Probe source anchor changed: '+token);}
 source=source.replace('and 3000 or 0',`and ${c.threat} or 0`).replace('job.elapsed>=4',`job.elapsed>=${c.seconds}`).replace('2000000,1,2)',`2000000,1,${c.q})`);
 }
 return source;
 });
 code+=`\nNODE_BUDGET=${c.budget}\nDEPTH=5\n`+fs.readFileSync('tests/lua-ai-opening-probe.lua','utf8');
 console.log('CONFIG '+JSON.stringify(c));
 const status=lauxlib.luaL_dostring(state,to_luastring(code));
 if(status!==lua.LUA_OK){console.error(to_jsstring(lua.lua_tostring(state,-1)));process.exitCode=1;}
 lua.lua_close(state);
}
