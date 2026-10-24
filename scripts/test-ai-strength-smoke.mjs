// Standard-profile short-time diagnostic, not the formal strength acceptance.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pinnedContext,createLuaEngine,safeMoves,judgeStandard,externalMove,internalMove,boardFromFen,fenFromBoard,chooseJS,chooseLua,digest} from './ai-test-runtime.mjs';
import {preloadModules} from './lua-test-loader.mjs';
const milliseconds=100,maxPlies=100;
const initial='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
const context=pinnedContext();let seed=113;
const next=limit=>{seed=seed*16807%2147483647;return seed%limit;};
const pos=new context.Position();pos.fromFen(initial);
const starts=[];const used=new Set();
for(let ply=0;ply<500 && starts.length<8;ply++){
 const legal=safeMoves(context,pos);
 if(!legal.length){pos.fromFen(initial);continue;}
 assert(pos.makeMove(legal[next(legal.length)]));pos.setIrrev();
 if(ply<15 || (ply+1)%8!==0 || Math.abs(pos.evaluate())>100)continue;
 const fen=pos.toFen().split(' ').slice(0,2).join(' ');
 if(used.has(fen))continue;used.add(fen);starts.push({id:'js-seed113-'+(ply+1),fen,sourcePly:ply+1,staticScore:pos.evaluate()});
}
assert.equal(starts.length,8,'not enough diagnostic starts');
const meta={runtime:'Node '+process.version+' / Fengari 0.1.5',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 bundleSHA256:digest(fs.readFileSync('dist/main.lua')),engineModulesSHA256:digest(preloadModules(['game.ai'])),
 upstream:JSON.parse(fs.readFileSync('third_party/xqwlight/UPSTREAM.json')),milliseconds,maxPlies,starts,
 scope:'16 paired standard-rule diagnostic games, no book/randomness, cold root history/TT for both engines. JS source unmodified except cooperative deadline wrappers. Lua wall-clock includes FFI and A.new. Third repetition is a benchmark draw; cap is unresolved. Not capture/custom/device or the 400-game target.',
 samplingCaveat:'The eight starts are snapshots of one seeded JS legal-move trajectory, not independent games or a held-out strength corpus. The paired bootstrap is descriptive of this set, not a population confidence claim.',
 deadlineNote:'Lua reason=cancelled means the harness reached its wall limit and preserved the last complete iteration; it is not a player cancellation.',games:[]};
const save=()=>fs.writeFileSync('records/ai-strength-smoke.json',JSON.stringify(meta,null,2)+'\n');
const engine=createLuaEngine();
try{
 for(const start of starts)for(const luaSide of ['red','black']){
  const board=boardFromFen(start.fen);let side=start.fen.endsWith(' w')?'red':'black';
  const game={start:start.id,luaSide,plies:[],outcome:'U',reason:'ply-cap'};const repetitions=new Map();
  function adjudicate(fen,visits){
   const result=judgeStandard(context,fen,visits);
   if(result.reason){game.reason=result.reason;game.outcome=result.draw?'D':result.loser===luaSide?'L':'W';}
   return result.legal;
  }
  for(let ply=0;ply<maxPlies;ply++){
   const fen=fenFromBoard(board,side);const judge=new context.Position();judge.fromFen(fen);
   const visits=(repetitions.get(fen)??0)+1;repetitions.set(fen,visits);
   const legal=adjudicate(fen,visits);if(game.outcome!=='U')break;
   const luaTurn=side===luaSide;
   const result=luaTurn?chooseLua(engine,board,side,milliseconds):chooseJS(context,fen,milliseconds);
   assert(result.move && legal.includes(internalMove(result.move)),(luaTurn?'Lua':'JS')+' illegal/unsafe reply '+JSON.stringify(result));
   const [from,to]=result.move;const captured=board[to-1];
   game.plies.push({ply:ply+1,engine:luaTurn?'Lua':'JS',side,...result,captured});
   assert(judge.makeMove(internalMove(result.move)));assert.deepEqual(externalMove(internalMove(result.move)),result.move);
   board[to-1]=board[from-1];board[from-1]='';side=side==='red'?'black':'red';
  }
  // A mating/third-repetition position on the very last permitted move must
  // be judged before applying the move cap. Current smoke games hit no cap.
  if(game.outcome==='U'){
   const finalFen=fenFromBoard(board,side);adjudicate(finalFen,(repetitions.get(finalFen)??0)+1);
  }
  game.final=fenFromBoard(board,side);meta.games.push(game);save();
  console.log('MATCH '+JSON.stringify({start:start.id,luaSide,outcome:game.outcome,reason:game.reason,plies:game.plies.length}));
 }
 const totals={W:0,L:0,D:0,U:0};for(const game of meta.games)totals[game.outcome]++;
 const n=meta.games.length,points=totals.W+.5*totals.D;
 const pairScores=starts.map(start=>meta.games.filter(game=>game.start===start.id).reduce((sum,game)=>sum+(game.outcome==='W'?1:game.outcome==='D'?.5:0),0)/2);
 let bootstrapSeed=997;const distribution=[];
 for(let sample=0;sample<5000;sample++){
  let sum=0;for(let pair=0;pair<pairScores.length;pair++){bootstrapSeed=bootstrapSeed*16807%2147483647;sum+=pairScores[bootstrapSeed%pairScores.length];}
  distribution.push(sum/pairScores.length);
 }
 distribution.sort((a,b)=>a-b);
 const turns=meta.games.flatMap(game=>game.plies);
 meta.summary={...totals,games:n,conservativeScore:points/n,possibleScore:(points+totals.U)/n,
  singleMovePairs:starts.filter(start=>meta.games.filter(game=>game.start===start.id).every(game=>game.plies.length===1)).length,
  conservativePaired95:[distribution[125],distribution[4874]],
  engines:Object.fromEntries(['Lua','JS'].map(name=>{
   const rows=turns.filter(row=>row.engine===name),times=rows.map(row=>row.elapsedMs).sort((a,b)=>a-b);
   return [name,{moves:rows.length,medianDepth:rows.map(row=>row.depth).sort((a,b)=>a-b)[Math.floor(rows.length/2)],
    firstIterationFallbacks:rows.filter(row=>row.depth===0).length,timeP95Ms:times[Math.ceil(times.length*.95)-1],
    maxOverrunMs:Math.max(0,...rows.map(row=>row.overrunMs)),overrunsAbove5ms:rows.filter(row=>row.overrunMs>5).length}];
  }))};
 meta.completed=true;save();console.log('SMOKE SUMMARY '+JSON.stringify(meta.summary));
}catch(error){meta.error=error.stack;save();throw error;}
finally{engine.close();}
