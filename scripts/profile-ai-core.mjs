// Host-only engine budgets and TT capacity probes. Does not open/sync a game save.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fengari from 'fengari';
import {preloadModules} from './lua-test-loader.mjs';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
const baseline=execFileSync('git',['rev-parse',process.argv[2]??'fe8a53aee485de2ec007b244bc736a8785735939'],{encoding:'utf8'}).trim();
const original=new Map(['game.ai','game.ai.search','game.ai.book'].map(name=>[name,execFileSync('git',['show',baseline+':src/'+name.replaceAll('.','/')+'.lua'],{encoding:'utf8'})]));
const program=`
local B=require('game.board');local A=require('game.ai');local out={}
for _,profile in ipairs({'standard','fifteen-rooks','free-pieces'}) do
 local b=B.standard();local custom=profile~='standard'
 if profile=='fifteen-rooks' then for i,p in ipairs(b) do if B.red(p) and p~='K' then b[i]='R' end end end
 if profile=='free-pieces' then b[55]='A';b[57]='E';b[59]='A';b[61]='E';b[63]='A' end
 for _,seconds in ipairs(BUDGETS) do
  local start=os.clock();local j=A.new(b,'red',custom,{noBook=true,timeLimit=seconds});local init=os.clock()-start
  local samples={};local total=init
  while not j.done do local t=os.clock();A.step(j,1/60);local elapsed=os.clock()-t;samples[#samples+1]=elapsed*1000;total=total+elapsed end
  assert(j.restored);table.sort(samples)
  out[#out+1]=string.format('{"profile":"%s","requestedSeconds":%d,"logicalSeconds":%.3f,"computeMs":%.3f,"initMs":%.3f,"p95Ms":%.3f,"maxMs":%.3f,"depth":%d,"nodes":%d,"qnodes":%d,"ttEntries":%d,"ttHits":%d,"reason":"%s"}',profile,seconds,j.elapsed,total*1000,init*1000,samples[math.max(1,math.ceil(#samples*.95))] or 0,samples[#samples] or 0,j.depth,j.nodes,j.qnodes or 0,j.ttCount or 0,j.transpositions and j.transpositions.hits or 0,j.reason or 'legacy')
 end
end
return '['..table.concat(out,',')..']'
`;
const rows=[];
for(const variant of ['baseline','candidate']){
 const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
 const source=preloadModules(['game.ai'],(name,s)=>variant==='baseline'?(original.get(name)??s):s)+'\nlocal BUDGETS='+ (variant==='baseline'?'{4}':'{1,2,4,8}')+'\n'+program;
 const status=lauxlib.luaL_dostring(L,to_luastring(source));
 const output=to_jsstring(lua.lua_tostring(L,-1));lua.lua_close(L);
 if(status!==lua.LUA_OK)throw Error(output);
 for(const row of JSON.parse(output)){rows.push({variant,...row});console.log(JSON.stringify(rows.at(-1)));}
}
const report={runtime:'Fengari 0.1.5 / Node '+process.version,baselineCommit:baseline,sourceSHA256:createHash('sha256').update(fs.readFileSync('dist/main.lua')).digest('hex'),scope:'Engine only; module loading, bundle compilation, book and UI excluded. initMs times A.new. Logical dt deadlines simulate 60 FPS; computeMs is host elapsed work including GC, not device latency or equal-compute strength. No wall-clock sleep between slices.',rows};
fs.writeFileSync('records/ai-core-performance.json',JSON.stringify(report,null,2)+'\n');
