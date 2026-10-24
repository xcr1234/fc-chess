import test from 'node:test';
import assert from 'node:assert/strict';
await import('../prototype/rules.js');
const {initialBoard, basicMove, movesFor, waitingSeconds, StepClock, formatStep} = globalThis.FCChessPreview;
const pos = (x,y) => y * 9 + x;
const board = entries => Object.assign(Array(90).fill(null), Object.fromEntries(entries.map(([x,y,p]) => [pos(x,y),p])));
test('capture king is legal; exposing own king and ignoring threats are allowed', () => {
 const b=board([[4,9,'K'],[4,0,'k'],[4,5,'R'],[0,3,'r'],[0,6,'P']]);
 assert.equal(basicMove(b,pos(4,5),pos(4,0)),true);
 assert.equal(basicMove(b,pos(4,5),pos(3,5)),true);
 assert.equal(basicMove(b,pos(0,6),pos(0,5)),true);
});
test('flying general captures only enemy king across an empty file', () => {
 const b=board([[4,9,'K'],[4,0,'k']]);
 assert.equal(basicMove(b,85,4),true);
 b[49]='P'; assert.equal(basicMove(b,85,4),false);
 assert.equal(basicMove(b,85,76),true); // ordinary palace step
 assert.equal(basicMove(b,85,58),false);
});
test('custom red advisor leaves palace and elephant crosses river; black stays standard', () => {
 const b=board([[0,6,'A'],[2,6,'E'],[0,3,'a'],[2,3,'e']]);
 assert.equal(basicMove(b,54,46,true),true);
 assert.equal(basicMove(b,54,46,false),false);
 assert.equal(basicMove(b,56,40,true),true);
 assert.equal(basicMove(b,56,40,false),false);
 b[pos(3,5)]='P'; assert.equal(basicMove(b,56,40,true),false);
 assert.equal(basicMove(b,27,37,true),false);
 assert.equal(basicMove(b,29,49,true),false);
});
test('horse leg, cannon screen, own pieces and board bounds still constrain moves', () => {
 const b=board([[0,5,'R'],[0,3,'p'],[2,5,'C'],[2,3,'p'],[2,1,'r'],[5,5,'N'],[6,5,'P']]);
 assert.equal(basicMove(b,45,9),false);
 assert.equal(basicMove(b,45,27),true);
 assert.equal(basicMove(b,47,11),true);
 assert.equal(basicMove(b,47,29),false);
 assert.equal(basicMove(b,50,43),false);
 assert.equal(basicMove(b,45,-1),false);
 assert.equal(basicMove(b,45,45),false);
});
test('all 15 rooks are represented and can generate moves', () => {
 const b=initialBoard().map(p => p && p===p.toUpperCase() && p!=='K' ? 'R' : p);
 assert.equal(b.filter(p=>p==='R').length,15);
 const moves=movesFor(b,'red',true);
 assert.ok(moves.length>0);
 assert.ok(moves.some(m=>m.from===54));
});
test('step clock resets the new mover, keeps only opposite previous step and stops at result', () => {
 const c=new StepClock(); c.reset(1000); c.start('black',6000); c.update(8000); c.update(12000);
 assert.equal(c.red,5000); assert.equal(c.black,6000);
 c.start('red',12000); c.update(15000);
 assert.equal(c.red,3000); assert.equal(c.black,6000);
 c.stop(15000); c.update(75000); assert.equal(c.red,3000);
 c.undo(2000,75000); c.update(76000); assert.equal(c.red,1000); assert.equal(c.black,2000);
 assert.equal(formatStep(59900),'00:59'); assert.equal(formatStep(60000),'01:00'); assert.equal(formatStep(6000000),'100:00');
});
test('complexity changes wait; fast adds zero; bounds and missing metrics are safe', () => {
 assert.equal(waitingSeconds({count:60,tactical:60,gap:0,instability:1},1),0);
 assert.equal(waitingSeconds({count:1,tactical:1,gap:0,instability:1},0),4);
 assert.equal(waitingSeconds({count:60,tactical:60,gap:0,instability:1},0),16);
 assert.equal(waitingSeconds({count:300,tactical:300,gap:0,instability:1},2),16);
 assert.ok(waitingSeconds({count:30,tactical:10,gap:10},0)>waitingSeconds({count:30,tactical:10,gap:150},0));
 const metrics={count:30,tactical:10}; assert.equal(waitingSeconds(metrics,0),waitingSeconds(metrics,2));
 assert.ok(waitingSeconds(metrics,0)>=4 && waitingSeconds(metrics,0)<=16);
});

import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function appHarness() {
 let now=0;
 const element=()=>({style:{},attributes:{},width:256,height:224,focus(){},addEventListener(){},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},replaceChildren(){},getBoundingClientRect(){return {left:0,top:0,width:256,height:224};}});
 const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const screen=element(); screen.getContext=()=>ctx;
 const live=element(),hotspots=element();
 const scope={performance:{now:()=>now},document:{querySelector:s=>({'#screen':screen,'#status':live,'#hotspots':hotspots}[s]),createElement:()=>({...element(),getContext:()=>ctx})},window:{devicePixelRatio:1,addEventListener(){}},ResizeObserver:class{observe(){}},Image:class{},requestAnimationFrame(){}};
 vm.createContext(scope);
 vm.runInContext(readFileSync(new URL('../prototype/rules.js',import.meta.url),'utf8'),scope);
 const app=readFileSync(new URL('../prototype/app.js',import.meta.url),'utf8');
 // Test-local access to the real controller, not a shipped fixture/debug API.
 vm.runInContext(app.replace(/\}\)\(\);\s*$/, 'globalThis.controller={state,clock,input,playSquare,frame,resetGame};})();'),scope);
 const c=scope.controller;
 return {...c,time(t){now=t;c.clock.update(t);},render(t){now=t;c.frame(t);},square(x,y){c.state.cursor={x,y};c.playSquare();}};
}
test('real preview controller: quick reply has no artificial delay',()=>{
 const h=appHarness();h.state.menu=1;h.input('ok');h.time(5000);h.square(0,6);h.square(0,5);
 assert.equal(h.state.moves,2);assert.equal(h.state.turn,'red');assert.equal(h.state.reply,null);assert.equal(h.clock.red,0);
});
test('real controller: confirmation keeps black clock running and applies ready reply once',()=>{
 const h=appHarness();h.input('ok');h.time(5000);h.square(0,6);h.square(0,5);
 const due=h.state.reply.due;h.state.modal={type:'resign',choice:1};h.render(due+2000);
 assert.equal(h.state.moves,1);assert.ok(h.clock.black>=6000);
 h.input('cancel');h.render(due+2100);assert.equal(h.state.moves,2);assert.equal(h.state.turn,'red');
 h.render(due+2200);assert.equal(h.state.moves,2);
});
test('real controller: undo invalidates waiting reply and resets only new red step',()=>{
 const h=appHarness();h.input('ok');h.square(0,6);h.square(0,5);const due=h.state.reply.due;
 h.state.zone='panel';h.state.sideIndex=0;h.input('ok');assert.equal(h.state.modal.type,'undo');assert.equal(h.state.moves,1);
 h.input('left');h.input('ok');h.render(due+1000);
 assert.equal(h.state.moves,0);assert.equal(h.state.turn,'red');assert.equal(h.state.reply,null);assert.equal(h.state.board[54],'P');assert.equal(h.clock.black,0);
});
test('real controller: declining undo preserves history and releases a ready AI reply once',()=>{
 const h=appHarness();h.input('ok');h.square(0,6);h.square(0,5);const due=h.state.reply.due;
 h.state.zone='panel';h.state.sideIndex=0;h.input('ok');assert.equal(h.state.modal.type,'undo');
 h.render(due+1000);assert.equal(h.state.moves,1);assert.equal(h.state.history.length,1);
 h.input('ok');h.render(due+1100);assert.equal(h.state.moves,2);assert.equal(h.state.modal,null);
 h.render(due+1200);assert.equal(h.state.moves,2);
});
test('real controller: confirming undo discards a ready AI reply',()=>{
 const h=appHarness();h.input('ok');h.square(0,6);h.square(0,5);const due=h.state.reply.due;
 h.state.zone='panel';h.state.sideIndex=0;h.input('ok');h.render(due+1000);
 assert.equal(h.state.moves,1);h.input('left');h.input('ok');h.render(due+1100);
 assert.equal(h.state.moves,0);assert.equal(h.state.history.length,0);assert.equal(h.state.reply,null);
});
test('real controller: capture ends game, decline capture does not; result clock stays stopped',()=>{
 const h=appHarness();h.resetGame(board([[4,9,'K'],[4,0,'k'],[4,5,'R'],[0,6,'P']]),0);
 h.square(0,6);h.square(0,5);assert.equal(h.state.scene,'game');
 h.state.zone='panel';h.state.sideIndex=0;h.input('ok');h.input('left');h.input('ok');
 h.square(4,5);h.square(4,0);assert.equal(h.state.scene,'result');assert.equal(h.state.resultTitle,'您獲勝了');assert.equal(h.state.board[4],'R');
 const times=[h.clock.red,h.clock.black];h.render(60000);assert.deepEqual([h.clock.red,h.clock.black],times);
});
test('real controller: custom draft and initial lineup survive return/restart',()=>{
 const h=appHarness();h.state.menu=2;h.input('ok');h.state.zone='panel';h.state.sideIndex=0;h.input('ok');
 h.state.sideIndex=3;h.input('ok');h.state.menu=2;h.input('ok');assert.equal(h.state.board.filter(p=>p==='R').length,15);
 h.state.zone='panel';h.state.sideIndex=2;h.input('ok');h.state.modal={type:'resign',choice:0};h.input('ok');h.input('ok');
 assert.equal(h.state.scene,'game');assert.equal(h.state.board.filter(p=>p==='R').length,15);assert.equal(h.state.moves,0);
});

test('real controller: identical positions may repeat without draw or perpetual-check result',()=>{
 const h=appHarness();h.resetGame(board([[4,9,'K'],[4,0,'k'],[0,5,'R'],[8,3,'r']]),0);
 for(let i=0;i<6;i++){
  const a=i%2===0?0:1,b=1-a;h.square(a,5);h.square(b,5);
  h.state.reply.move={from:pos(i%2===0?8:7,3),to:pos(i%2===0?7:8,3)};
  h.render(h.state.reply.due+1);
 }
 assert.equal(h.state.moves,12);assert.equal(h.state.scene,'game');assert.equal(h.state.turn,'red');assert.equal(h.state.board[pos(0,5)],'R');
});
test('real controller: exposed red king is captured and produces defeat',()=>{
 const h=appHarness();h.resetGame(board([[4,9,'K'],[0,0,'k'],[4,5,'r'],[0,6,'P']]),1);
 h.square(0,6);h.square(0,5);
 assert.equal(h.state.scene,'result');assert.equal(h.state.resultTitle,'您落敗了');assert.equal(h.state.resultReason,'紅帥被吃');assert.equal(h.state.moves,2);
});
