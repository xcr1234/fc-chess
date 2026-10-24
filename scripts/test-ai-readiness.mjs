// Current-engine host readiness only. No legacy comparison or device claims.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createLuaEngine,boardFromFen,fenFromBoard,digest} from './ai-test-runtime.mjs';
import {preloadModules} from './lua-test-loader.mjs';
const initial='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
const names=['standard','fifteen-rooks','free-pieces'];
function army(name){
 const board=boardFromFen(initial);
 if(name==='fifteen-rooks')for(let i=0;i<90;i++)if(board[i] && board[i]===board[i].toUpperCase() && board[i]!=='K')board[i]='R';
 if(name==='free-pieces')for(const [square,piece] of [[55,'A'],[57,'E'],[59,'A'],[61,'E'],[63,'A']])board[square-1]=piece;
 return board;
}
function afterPlayerMove(name){
 const board=army(name);const [from,to]=name==='free-pieces'?[55,47]:[55,46];
 board[to-1]=board[from-1];board[from-1]='';return board;
}
const meta={runtime:'Fengari 0.1.5 / Node '+process.version,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 bundleSHA256:digest(fs.readFileSync('dist/main.lua')),engineModulesSHA256:digest(preloadModules(['game.ai']))};
for(const file of ['fc-chess.save.json','tests/fc-chess.test.save.json']){
 const script=JSON.parse(fs.readFileSync(file)).assets.scripts[0];assert.equal(digest(script.source),meta.bundleSHA256);assert.equal(script.path,'dist/main.lua');
}
const engine=createLuaEngine();
const quantile=(samples,q)=>{const values=[...samples].sort((a,b)=>a-b);return values[Math.max(0,Math.ceil(values.length*q)-1)]??0;};
const save=(file,report)=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
try{
 if(!process.argv.includes('--soak-only')){
  const report={...meta,loadMs:engine.loadMs,scope:'Engine-only host elapsed timings including A.new and cooperative guards; module loading separately measured. dt simulates FPS without waiting. Not device frame/latency or equal-time strength.',rows:[]};
  for(let repeat=1;repeat<=2;repeat++)for(const profile of names)for(const fps of [30,60])for(const seconds of [1,2,4,8]){
   const board=afterPlayerMove(profile);const original=JSON.stringify(board);const started=performance.now();
   const init=performance.now();let done=engine.start(board,'black',profile!=='standard',{noBook:true,timeLimit:seconds});const initMs=performance.now()-init;
   const samples=[];let frames=0;
   while(!done){const start=performance.now();done=engine.step(1/fps);samples.push(performance.now()-start);frames++;assert(frames<=seconds*fps+2,'deadline failed');}
   const result=engine.result();assert.equal(JSON.stringify(board),original);
   const row={profile,repeat,fps,requestedSeconds:seconds,initMs,computeMs:performance.now()-started,frames,
    stepP50Ms:quantile(samples,.5),stepP95Ms:quantile(samples,.95),stepMaxMs:Math.max(0,...samples),...result};
   report.rows.push(row);save('records/ai-readiness-performance.json',report);
   console.log('PERF '+JSON.stringify({profile,repeat,fps,seconds,depth:result.depth,nodes:result.nodes,p95Ms:+row.stepP95Ms.toFixed(3),maxMs:+row.stepMaxMs.toFixed(3),reason:result.reason}));
  }
  report.completed=true;save('records/ai-readiness-performance.json',report);
 }
 if(!process.argv.includes('--performance-only')){
  const report={...meta,scope:'Real engine on both sides, production 4-second logical/60 FPS budgets; no book or fixture replies. Capture rules do not adjudicate repetition. 80-ply cap is unresolved, not a win/draw.',games:[]};
  for(const profile of names){
   const board=army(profile);const game={profile,initial:fenFromBoard(board,'red'),plies:[],passes:[],repeatedPositions:0,outcome:'unresolved',maxStepMs:0,firstIterationFallbacks:0};
   const seen=new Map();let side='red',consecutivePasses=0;const started=performance.now();
   for(let ply=0;ply<80;){
    const key=fenFromBoard(board,side);const visits=(seen.get(key)??0)+1;seen.set(key,visits);if(visits>1)game.repeatedPositions++;
    const before=JSON.stringify(board);const t=performance.now();let done=engine.start(board,side,profile!=='standard',{noBook:true});
    let frames=0;
    while(!done){const step=performance.now();done=engine.step(1/60);game.maxStepMs=Math.max(game.maxStepMs,performance.now()-step);frames++;assert(frames<=242,'turn did not finish');}
    const result=engine.result();assert.equal(JSON.stringify(board),before);
    if(!result.move){consecutivePasses++;game.passes.push({ply,side,reason:result.reason});if(consecutivePasses===2){game.outcome='unable-to-continue';break;}side=side==='red'?'black':'red';continue;}
    consecutivePasses=0;const [from,to]=result.move;const captured=board[to-1];
    if(result.depth===0 && result.reason!=='capture')game.firstIterationFallbacks++;
    game.plies.push({ply:++ply,side,...result,captured,frames,hostMs:performance.now()-t});
    board[to-1]=board[from-1];board[from-1]='';
    if(captured==='K'||captured==='k'){game.outcome=side+'-win';break;}
    side=side==='red'?'black':'red';
    if(ply%10===0)console.log('SOAK '+profile+' plies='+ply+' repeats='+game.repeatedPositions);
   }
   game.hostMs=performance.now()-started;game.final=fenFromBoard(board,side);game.stateChecksPassed=true;
   report.games.push(game);save('records/ai-readiness-soak.json',report);
   console.log('SOAK RESULT '+JSON.stringify({profile,plies:game.plies.length,outcome:game.outcome,repeats:game.repeatedPositions,firstIterationFallbacks:game.firstIterationFallbacks,maxStepMs:game.maxStepMs}));
  }
  report.completed=true;save('records/ai-readiness-soak.json',report);
 }
}finally{engine.close();}
