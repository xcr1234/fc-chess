import test from 'node:test';
import assert from 'node:assert/strict';
import {boardFromFen,fenFromBoard,pinnedContext,createLuaEngine,safeMoves,judgeStandard,internalMove,chooseJS,chooseLua} from './ai-test-runtime.mjs';
const initial='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
test('benchmark FEN bridge retains every square, side and elephant notation',()=>{
 const board=boardFromFen(initial);assert.equal(board[2],'e');assert.equal(board[83],'E');
 assert.equal(fenFromBoard(board,'red'),initial);
 assert.equal(fenFromBoard(board,'black'),initial.replace(/ w$/,' b'));
});
test('benchmark bridge calls the real capture engine and restores its position',()=>{
 const engine=createLuaEngine();
 try{
  const board=Array(90).fill('');board[4]='k';board[85]='K';board[22]='R';board[76]='r';
  assert.equal(engine.start(board,'black',false,{noBook:true}),true);
  const result=engine.result();assert.deepEqual(result.move,[77,86]);assert.equal(result.reason,'capture');assert(result.restored);
  assert.deepEqual(board.filter(Boolean),['k','R','r','K']);
 }finally{engine.close();}
});
test('JS deadline keeps a legal completed iteration or safe fallback',()=>{
 const context=pinnedContext();const result=chooseJS(context,initial,30);
 const pos=new context.Position();pos.fromFen(initial);
 assert(safeMoves(context,pos).includes(internalMove(result.move)));assert(result.depth>=0 && result.elapsedMs>=0);
 assert.equal(context.RANDOMNESS,0);assert.equal(context.BOOK_DAT.length,0);
});
test('Lua wall-clock driver returns a safe restored standard-profile result',()=>{
 const engine=createLuaEngine();const context=pinnedContext();
 try{
  const result=chooseLua(engine,boardFromFen(initial),'red',30);
  const pos=new context.Position();pos.fromFen(initial);
  assert(safeMoves(context,pos).includes(internalMove(result.move)));assert(result.restored);
 }finally{engine.close();}
});
test('standard judge prioritizes no-move loss even at repetition/move-cap boundary',()=>{
 const context=pinnedContext();const terminal='3aka3/3aaa3/3aaa3/9/9/9/9/9/9/4K4 b';
 const result=judgeStandard(context,terminal,3);assert.equal(result.reason,'no-safe-move');assert.equal(result.loser,'black');assert.equal(result.draw,undefined);
});
test('standard benchmark repeats only on the third complete same-side position',()=>{
 const context=pinnedContext();assert.equal(judgeStandard(context,initial,2).reason,null);
 const result=judgeStandard(context,initial,3);assert.equal(result.reason,'benchmark-threefold');assert.equal(result.draw,true);
});
