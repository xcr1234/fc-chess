// Custom entertainment policy: production defaults, serial host samples/soak.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createLuaEngine,boardFromFen,fenFromBoard,digest} from './ai-test-runtime.mjs';
import {preloadModules} from './lua-test-loader.mjs';
const initial='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
function army(profile){
 const b=boardFromFen(initial);
 if(profile==='fifteen-rooks')for(let i=0;i<90;i++)if(b[i]&&b[i]===b[i].toUpperCase()&&b[i]!=='K')b[i]='R';
 if(profile==='free-pieces')for(const [square,piece] of [[55,'A'],[57,'E'],[59,'A'],[61,'E'],[63,'A']])b[square-1]=piece;
 return b;
}
const old=JSON.parse(fs.readFileSync('records/ai-readiness-soak.json'));
const oldGame=old.games.find(game=>game.profile==='fifteen-rooks');
const board=boardFromFen(oldGame.initial);const starts=[];
for(const turn of oldGame.plies){
 if(turn.side==='black')starts.push({id:'recorded-fifteen-ply-'+turn.ply,fen:fenFromBoard(board,'black')});
 const [a,z]=turn.move;board[z-1]=board[a-1];board[a-1]='';if(starts.length===6)break;
}
for(const profile of ['free-pieces','standard-army']){
 const b=army(profile),[a,z]=profile==='free-pieces'?[55,47]:[55,46];b[z-1]=b[a-1];b[a-1]='';
 starts.push({id:profile+'-opening',fen:fenFromBoard(b,'black')});
}
const bundleSHA256=digest(fs.readFileSync('dist/main.lua'));
for(const file of ['fc-chess.save.json','tests/fc-chess.test.save.json']){
 const script=JSON.parse(fs.readFileSync(file)).assets.scripts[0];assert.equal(digest(script.source),bundleSHA256);assert.equal(script.path,'dist/main.lua');
}
const report={runtime:'Fengari 0.1.5 / Node '+process.version,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 bundleSHA256,engineModulesSHA256:digest(preloadModules(['game.ai'])),starts,
 baselineRecordSHA256:digest(fs.readFileSync('records/ai-readiness-soak.json')),
 scope:'Custom entertainment defaults only: max depth 2, static horizon, no extensions/TT/book, 1.5-second logical deadline and 2000 nodes. Serial host samples at 30/60 FPS without wall waits; not device timings or a strength comparison. 100-ply soak cap is unresolved, never a draw.',rows:[],games:[]};
const save=()=>fs.writeFileSync('records/ai-custom-light-runtime.json',JSON.stringify(report,null,2)+'\n');
const percentile=(rows,q)=>{const sorted=[...rows].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]??0;};
const engine=createLuaEngine();report.loadMs=engine.loadMs;
function search(b,side,fps){
 const original=JSON.stringify(b),started=performance.now();let done=engine.start(b,side,true,{noBook:true});
 const initMs=performance.now()-started,slices=[];let frames=0;
 while(!done){const t=performance.now();done=engine.step(1/fps);slices.push(performance.now()-t);assert(++frames<=Math.ceil(1.5*fps)+2,'custom deadline exceeded');}
 const result=engine.result();assert.equal(JSON.stringify(b),original);assert(result.lightweight&&result.depth<=2&&result.qnodes===0);
 assert.notEqual(result.reason,'danger-limit');
 return {...result,initMs,frames,computeMs:performance.now()-started,stepP95Ms:percentile(slices,.95),stepMaxMs:Math.max(0,...slices)};
}
try{
 for(let repeat=1;repeat<=2;repeat++)for(const start of starts)for(const fps of [30,60]){
  const result=search(boardFromFen(start.fen),'black',fps);
  assert(result.depth>=1||result.reason==='capture','first iteration still unfinished: '+start.id);
  report.rows.push({start:start.id,repeat,fps,...result});save();
 }
 console.log('CUSTOM SAMPLES '+JSON.stringify({count:report.rows.length,firstIterationFallbacks:report.rows.filter(r=>r.depth===0&&r.reason!=='capture').length,
  depths:[...new Set(report.rows.map(r=>r.depth))],computeP95Ms:percentile(report.rows.map(r=>r.computeMs),.95)}));
 for(const profile of ['fifteen-rooks','free-pieces','standard-army']){
  const b=army(profile);let side='red',passes=0;const seen=new Map();
  const game={profile,initial:fenFromBoard(b,side),plies:[],passes:[],repeatedPositions:0,outcome:'unresolved'};
  for(let ply=0;ply<100;){
   const fen=fenFromBoard(b,side),count=(seen.get(fen)??0)+1;seen.set(fen,count);if(count>1)game.repeatedPositions++;
   const result=search(b,side,60);
   if(!result.move){game.passes.push({ply,side,reason:result.reason});if(++passes===2){game.outcome='unable-to-continue';break;}side=side==='red'?'black':'red';continue;}
   passes=0;const [a,z]=result.move,captured=b[z-1];game.plies.push({ply:++ply,side,...result,captured});b[z-1]=b[a-1];b[a-1]='';
   if(captured==='K'||captured==='k'){game.outcome=side+'-win';break;}side=side==='red'?'black':'red';
  }
  game.final=fenFromBoard(b,side);game.firstIterationFallbacks=game.plies.filter(r=>r.depth===0&&r.reason!=='capture').length;
  game.maxStepMs=Math.max(0,...game.plies.map(r=>r.stepMaxMs));report.games.push(game);save();
  console.log('CUSTOM SOAK '+JSON.stringify({profile,plies:game.plies.length,outcome:game.outcome,firstIterationFallbacks:game.firstIterationFallbacks,maxStepMs:game.maxStepMs}));
 }
 report.completed=true;save();
}catch(error){report.error=error.stack;save();throw error;}finally{engine.close();}
