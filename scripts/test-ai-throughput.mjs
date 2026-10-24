// Fixed before/after source snapshots; production 4-second/3ms slice defaults.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {createLuaEngine,boardFromFen,fenFromBoard,digest} from './ai-test-runtime.mjs';
import {preloadModules} from './lua-test-loader.mjs';
const baseline='f6e89ed';
const prior=new Map(['game.ai.position','game.ai.movegen','game.ai.search'].map(name=>[name,
 execFileSync('git',['show',baseline+':src/'+name.replaceAll('.','/')+'.lua'],{encoding:'utf8'})]));
const transform=(name,source)=>prior.get(name)??source;
const g=JSON.parse(fs.readFileSync('records/ai-readiness-soak.json')).games.find(x=>x.profile==='standard');
const starts=[];const b=boardFromFen(g.initial);
for(const ply of g.plies){
 if([20,26,32,38,44,50].includes(ply.ply))starts.push({id:'soak-before-'+ply.ply,fen:fenFromBoard(b,ply.side)});
 const [a,z]=ply.move;b[z-1]=b[a-1];b[a-1]='';
}
starts.push({id:'out-of-book',fen:'rnbakabnr/9/1c5c1/p1p1p1p1p/9/P8/2P1P1P1P/1C5C1/9/RNBAKABNR b'});
starts.push({id:'late-rook-pawn',fen:'5k3/9/1n7/9/4r4/4P4/P8/9/9/3K5 b'});
const report={runtime:'Fengari 0.1.5 / Node '+process.version,baseline,starts,
 baselineModulesSHA256:digest(preloadModules(['game.ai'],transform)),candidateModulesSHA256:digest(preloadModules(['game.ai'])),
 scope:'Serial engine-only before/after at identical production 4-second logical/30 or 60 FPS defaults, no book. Both VMs warmed with 1200 nodes; order alternates by start. Includes FFI/A.new; no frame sleeps/UI/device. Late starts are correlated diagnostic samples, not a strength set.',rows:[]};
const save=()=>fs.writeFileSync('records/ai-throughput-runtime.json',JSON.stringify(report,null,2)+'\n');
try{
 const engines={baseline:createLuaEngine(transform),candidate:createLuaEngine()};
 try{
  for(const engine of Object.values(engines)){
   let done=engine.start(boardFromFen(starts[6].fen),'black',false,{noBook:true,clock:false,nodeBudget:1200,timeLimit:Infinity});
   while(!done)done=engine.step(0);engine.result();
  }
  for(const [index,start] of starts.entries())for(const fps of [30,60]){
   for(const variant of index%2?['candidate','baseline']:['baseline','candidate']){
    const engine=engines[variant];
    const board=boardFromFen(start.fen),side=start.fen.endsWith(' w')?'red':'black',started=performance.now();
    let done=engine.start(board,side,false,{noBook:true});let frames=0,maxStepMs=0;
    while(!done){const t=performance.now();done=engine.step(1/fps);maxStepMs=Math.max(maxStepMs,performance.now()-t);assert(++frames<=4*fps+2);}
    const result=engine.result();const row={variant,start:start.id,fps,...result,frames,computeMs:performance.now()-started,maxStepMs};
    report.rows.push(row);save();console.log(JSON.stringify({variant,start:start.id,fps,depth:result.depth,nodes:result.nodes,reason:result.reason,computeMs:row.computeMs}));
   }
  }
 }finally{for(const engine of Object.values(engines))engine.close();}
 report.completed=true;save();
}catch(error){report.error=error.stack;save();throw error;}
