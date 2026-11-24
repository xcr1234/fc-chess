-- Product-rule acceptance for the JS 1.0 rewrite. Hand-authored geometry is
-- the oracle; production search is exercised without book or host-clock luck.
local B=require('game.board')
local A=require('game.ai')
local S=require('game.session')
local P=require('game.ai.position')
local G=require('game.ai.movegen')
local R=require('game.ai.rules')
local E=require('game.ai.evaluate')
local TT=require('game.ai.tt')
require('app.log').enabled=false
local failures,total=0,0
local function check(id,fn)
 total=total+1;local ok,err=pcall(fn)
 print((ok and 'PASS ' or 'FAIL ')..id..(ok and '' or ': '..tostring(err)))
 if not ok then failures=failures+1 end
end
local function empty() local b={} for i=1,90 do b[i]='' end return b end
local function at(f,r) return B.index(f,r) end
local function move(a,z) return P.move(P.from90[a],P.from90[z]) end
local function position(b,side,custom) return P.new(b,side,R.get(custom)) end
local function state(p)
 return table.concat({B.key(P.export(p),p.side==0 and 'red' or 'black',p.rules.freeRed),p.key,p.lock,p.red,p.black,p.side,p.kings[0] or -1,p.kings[1] or -1,p.context,p.contextLock,#p.history},'|')
end
local function restored(j,b,side,custom)
 assert(j.restored and #j.stack==0 and #j.pos.history==0,'task did not unwind')
 assert(state(j.pos)==state(position(b,side,custom)),'position state differs after unwind')
 assert(B.key(j.board,side,custom)==B.key(b,side,custom),'visible board changed')
end
local function run(b,side,custom,options)
 local opts={noBook=true,clock=false,maxDepth=2,extensions=0,qDepth=8,nodeBudget=100000,operationsPerStep=512,nodesPerStep=512}
 for k,v in pairs(options or {}) do opts[k]=v end
 local original=B.key(b,side,custom);local j=A.new(b,side,custom,opts);local steps=0
 while not j.done do A.step(j,0);steps=steps+1;assert(steps<20000,'unbounded search') end
 assert(B.key(b,side,custom)==original,'input board mutated');restored(j,b,side,custom)
 if j.move then assert(B.side(b[j.move[1]])==side and B.valid(b,j.move[1],j.move[2],custom),'illegal reply') end
 return j
end

-- rows: piece, source file/rank, destination file/rank, custom, permitted,
-- optional blockers. Enemy pawn at the destination also tests target attacks.
local geometry={
 {'R',0,5,0,1,false,true},
 {'R',0,5,0,1,false,false,{{0,3,'P'}}},
 {'R',0,5,1,4,false,false},
 {'N',4,5,6,4,false,true},
 {'N',4,5,6,4,false,false,{{5,5,'P'}}},
 {'N',4,5,5,3,false,false,{{4,4,'p'}}},
 {'C',0,5,0,1,false,false},
 {'C',0,5,0,1,false,true,{{0,3,'P'}}},
 {'C',0,5,0,1,false,true,{{0,3,'p'}}},
 {'C',0,5,0,1,false,false,{{0,3,'P'},{0,2,'p'}}},
 {'A',1,1,0,0,false,false},
 {'A',1,1,0,0,true,true},
 {'A',4,8,3,7,false,true},
 {'a',3,2,2,3,true,false},
 {'a',4,1,3,2,true,true},
 {'E',2,5,4,3,false,false},
 {'E',2,5,4,3,true,true},
 {'E',2,5,4,3,true,false,{{3,4,'p'}}},
 {'e',2,4,4,6,true,false},
 {'e',2,0,4,2,true,true},
 {'P',4,5,4,4,false,true},
 {'P',4,5,3,5,false,false},
 {'P',4,4,3,4,false,true},
 {'P',4,4,4,5,false,false},
 {'p',4,4,4,5,true,true},
 {'p',4,4,3,4,true,false},
 {'p',4,5,3,5,true,true},
 {'p',4,5,4,4,true,false},
 {'K',3,9,2,9,true,false},
 {'K',4,9,4,8,true,true},
 {'k',4,0,4,1,true,true},
 {'k',3,0,2,0,true,false}
}
for n,c in ipairs(geometry) do check('RULE-GEOMETRY-'..n,function()
 local b=empty();local a,z=at(c[2],c[3]),at(c[4],c[5]);local side=B.red(c[1]) and 'red' or 'black'
 b[a]=c[1];b[z]=side=='red' and 'p' or 'P'
 for _,extra in ipairs(c[8] or {}) do b[at(extra[1],extra[2])]=extra[3] end
 local p=position(b,side,c[6]);local before=state(p);local found=false
 for _,m in ipairs(G.generate(p)) do if m==move(a,z) then found=true end end
 assert(found==c[7],'move disagrees with hand-authored rule')
 assert((G.attacker(p,P.from90[z],p.side)~=nil)==c[7],'target attack disagrees with geometry')
 assert(state(p)==before,'query mutated state')
end) end

check('RULE-EDGES-AND-FRIENDLY-TARGET',function()
 for _,piece in ipairs({'R','N','C','A','E','P','K','r','n','c','a','e','p','k'}) do
  for _,square in ipairs({1,9,82,90}) do
   local b=empty();b[square]=piece;local side=B.red(piece) and 'red' or 'black';local p=position(b,side,true)
   for _,m in ipairs(G.generate(p)) do local e=P.external(m)
    assert(e[1]==square and e[2] and e[2]~=square and B.valid(b,e[1],e[2],true),'wrapped/off-board move')
   end
  end
 end
 local b=empty();b[at(0,5)]='R';b[at(0,4)]='P'
 local p=position(b,'red',false)
 for _,m in ipairs(G.generate(p)) do assert(m~=move(at(0,5),at(0,4)),'captured friendly pawn') end
end)

check('RULE-FLYING-KING-AND-SCREEN',function()
 local b=empty();b[5]='k';b[86]='K'
 for _,side in ipairs({'red','black'}) do
  local p=position(b,side,false);local a,z=side=='red' and 86 or 5,side=='red' and 5 or 86
  assert(G.win(p)==move(a,z));local j=run(b,side,false);assert(j.reason=='capture' and j.move[2]==z and j.score==9999)
 end
 b[41]='p'
 for _,side in ipairs({'red','black'}) do assert(not G.win(position(b,side,false)),'flew through a screen') end
end)

check('RULE-COUNTER-CAPTURE-BEFORE-DEFENCE',function()
 local b=empty();b[5]='k';b[86]='K';b[23]='R';b[77]='r'
 local p=position(b,'black',false);assert(G.danger(p,1) and G.danger(p,0))
 local j=run(b,'black',false);assert(j.move[1]==77 and j.move[2]==86 and j.score==9999)
end)

check('RULE-PINNED-ATTACKER-STILL-CAPTURES-KING',function()
 -- R14 pins the r5/K86 file, but its sideways capture of k15 ends the game.
 local b=empty();b[5]='r';b[15]='k';b[86]='K';b[14]='R'
 local p=position(b,'red',false);assert(not G.danger(p,0));assert(B.valid(b,14,15,false))
 local j=run(b,'red',false);assert(j.move[1]==14 and j.move[2]==15,'pin incorrectly filtered immediate win')
end)

check('RULE-CUSTOM-FREE-ADVISOR-AND-ELEPHANT-KING-ATTACK',function()
 for _,case in ipairs({{piece='A',source=15},{piece='E',source=25}}) do
  local b=empty();b[5]='k';b[85]='K';b[case.source]=case.piece
  local p=position(b,'red',true);assert(G.win(p)==move(case.source,5))
  assert(G.danger(position(b,'black',true),1),'black AI missed free-piece king threat')
  assert(not G.win(position(b,'red',false)),'ordinary profile leaked free-piece attack')
  local j=run(b,'red',true);assert(j.move[1]==case.source and j.move[2]==5)
  if case.piece=='E' then
   b[15]='p';assert(not G.win(position(b,'red',true)),'elephant ignored blocked eye')
  end
 end
end)

check('RULE-CUSTOM-MATERIAL-AND-PROFILE-ISOLATION',function()
 for _,piece in ipairs({'A','E'}) do
  for _,square in ipairs({1,15,41,90}) do
   local p=position(empty(),'red',true);local value=E.piece(piece=='A' and 9 or 10,P.from90[square],p.rules)
   assert(value>0 and value<100,'free-piece evaluation is empty or unbounded')
  end
 end
 local b=B.standard();for i,pc in ipairs(b) do if B.red(pc) and pc~='K' then b[i]='R' end end
 local p=position(b,'red',true);assert(math.abs(E.score(p,0))<p.rules.win)
 local j=run(b,'red',true,{nodeBudget=100,maxDepth=1,nullMove=true})
 assert(j.rules.freeRed and not j.book and not j.nullMove and j.nullProbes==0)
 local restoredArmy=run(B.standard(),'black',true,{nodeBudget=100,maxDepth=1})
 assert(restoredArmy.rules.freeRed and not restoredArmy.book,'standard-looking custom army lost its profile')
end)

local function blockedPalace(b,side)
 local base=side=='black' and 0 or 7;local advisor=side=='black' and 'a' or 'A'
 for rank=base,base+2 do for file=3,5 do b[at(file,rank)]=advisor end end
 b[at(4,side=='black' and 0 or 9)]=side=='black' and 'k' or 'K'
end
check('RULE-REAL-NO-MOVE-SKIP-WITH-BOTH-KINGS',function()
 local b=empty();blockedPalace(b,'black');b[85]='K';b[55]='P'
 assert(#G.generate(position(b,'black',false))==0 and #B.moves(b,'black',false)==0)
 local j=run(b,'black',false);assert(j.reason=='no-moves' and not j.move)
 local s=S.new();S.start(s,'fast',b);s.moves=12;s.black=6;S.begin(s,'black')
 assert(s.scene=='player-turn' and s.turn=='red' and s.moves==12 and s.red==0,'skip changed result or move count')
 local s2=S.new();blockedPalace(b,'red');b[55]=''
 S.start(s2,'fast',b);S.begin(s2,'red')
 assert(s2.scene=='result' and s2.resultTitle=='本局无法继续' and s2.moves==0)
 assert(s2.board[5]=='k' and s2.board[86]=='K','no-move fixture lost a king')
end)

check('STATE-REAL-PASS-SEARCH-CANCEL',function()
 local b=empty();blockedPalace(b,'black');b[85]='K';b[55]='P'
 local j=A.new(b,'red',false,{noBook=true,clock=false,operationsPerStep=1,maxDepth=3})
 local seen=false
 for n=1,10000 do
  if j.done then break end;A.step(j,0)
  for _,f in ipairs(j.stack) do if f.kind=='pass' then seen=true end end
  if seen then break end
 end
 assert(seen,'fixture never executed real pass');A.cancel(j);restored(j,b,'red',false)
end)

check('RULE-FORCED-LOSS-DOES-NOT-END-GAME-EARLY',function()
 local b=empty();b[5]='k';b[86]='K';b[23]='R';b[13]='R';b[15]='R'
 local p=position(b,'black',false);local moves=G.generate(p);assert(#moves==3)
 for _,m in ipairs(moves) do assert(not G.safe(p,m),'fixture has a safe escape') end
 local j=run(b,'black',false);assert(j.move and j.score==-9998)
 local early=A.new(b,'black',false,{noBook=true,clock=false});A.step(early,4);assert(early.reason=='deadline' and early.move);restored(early,b,'black',false)
 local s=S.new();S.start(s,'fast',b);S.begin(s,'black')
 for n=1,1000 do if s.scene~='ai-search' then break end;S.update(s,.01) end
 assert(s.scene=='player-turn' and s.moves==1,'forced loss was prematurely adjudicated')
 local king;for i,pc in ipairs(s.board) do if pc=='k' then king=i end end;assert(king)
 local capture;for _,m in ipairs(B.moves(s.board,'red',false)) do if m[2]==king then capture=m;break end end
 assert(capture and S.commit(s,capture));assert(s.scene=='result' and s.resultTitle=='您获胜了' and s.moves==2)
end)

check('RULE-REPEAT-KEEPS-PRODUCTION-PLAYABLE',function()
 for _,profile in ipairs({'casual-capture-v1','custom-capture-free-advisor-elephant-v1','reference-standard-v1'}) do
  local p=P.new(B.standard(),'red',R.get(false,profile));local before=state(p);local history={}
  for round=1,3 do for _,m in ipairs({{83,66},{2,21},{66,83},{21,2}}) do
   local u={};P.make(p,move(m[1],m[2]),u,'move');u.checked=G.danger(p,p.side);history[#history+1]=u
  end
   local value=P.repetition(p,round*4)
   if profile=='reference-standard-v1' then assert(value==-20) else assert(value==nil,'production repeat became a draw/ban') end
  end
  for n=#history,1,-1 do P.undo(p,history[n]) end;assert(state(p)==before)
 end
end)

check('STATE-CAPTURE-KING-MOVE-NULL-PASS-UNDO',function()
 local b=empty();b[5]='k';b[85]='K';b[41]='R';b[50]='r'
 for _,side in ipairs({'red','black'}) do
  for _,spec in ipairs({{m=side=='red' and move(41,50) or move(50,41),kind='move'},{m=side=='red' and move(85,84) or move(5,4),kind='move'},{kind='null'},{kind='pass'}}) do
   local p=position(b,side,false);local before=state(p);local u={};P.make(p,spec.m,u,spec.kind)
   assert(p.side~=(side=='red' and 0 or 1) and #p.history==1)
   local rebuilt=P.new(P.export(p),p.side==0 and 'red' or 'black',p.rules)
   assert(p.key==rebuilt.key and p.lock==rebuilt.lock and p.red==rebuilt.red and p.black==rebuilt.black)
   P.undo(p,u);assert(state(p)==before)
  end
 end
 local p=position(b,'red',false);local before=state(p);local u={};P.make(p,move(41,5),u,'move');assert(not p.kings[1]);P.undo(p,u);assert(state(p)==before)
end)

check('STATE-CLOCK-DEADLINE-AND-IDEMPOTENT-FINISH',function()
 local b=B.standard();local ticks=0
 local j=A.new(b,'black',false,{noBook=true,operationsPerStep=1000,nodesPerStep=1000,sliceSeconds=.005,clock=function() ticks=ticks+1;return ticks*.01 end})
 A.step(j,0);assert(not j.done and j.lastOperations==4,'cooperative slice guard did not yield')
 local operations=j.operations;A.step(j,4);assert(j.done and j.reason=='deadline' and j.operations==operations);restored(j,b,'black',false)
 local signature=tostring(j.score)..':'..j.depth..':'..j.nodes..':'..state(j.pos)
 A.step(j,100);A.cancel(j);assert(signature==tostring(j.score)..':'..j.depth..':'..j.nodes..':'..state(j.pos),'finished task resumed')
end)

check('CACHE-RULE-LEAF-PATH-AND-MATE-ISOLATION',function()
 local p=position(B.standard(),'red',false);local tt=TT.new(1)
 local f={depth=2,ext=1,q=6,ply=3,noNull=false,originalAlpha=-11000,alpha=-11000,beta=11000}
 for _,score in ipairs({9993,-9993,50,-50,9800,-9800}) do
  TT.store(tt,p,f,score,123,1);local encoded=tt.slots[0].score
  for n=1,5 do assert(TT.probe(tt,p,f)==score and tt.slots[0].score==encoded) end
  assert(TT.decode(TT.encode(score,3),3)==score)
 end
 TT.store(tt,p,f,77,123,2)
 for _,field in ipairs({'depth','ext','q','ply'}) do local old=f[field];f[field]=old+1;assert(TT.probe(tt,p,f)==nil,field..' reused value');f[field]=old end
 f.noNull=true;assert(TT.probe(tt,p,f)==nil);f.noNull=false
 for _,field in ipairs({'key','lock','context','contextLock'}) do local old=p[field];p[field]=old+1;assert(TT.probe(tt,p,f)==nil,field..' reused value');p[field]=old end
 local rules=p.rules;p.rules=R.get(true);assert(TT.probe(tt,p,f)==nil);p.rules=rules
 assert(TT.probe(tt,p,f)==77)
 f.dependent=true;TT.store(tt,p,f,88,321,3);assert(TT.probe(tt,p,f)==77 and tt.count==1,'path-dependent value entered TT')
end)

check('SESSION-FAST-DIFFICULT-SAME-SEARCH-AND-WAIT-FROZEN',function()
 local jobs={}
 for _,mode in ipairs({'fast','difficult'}) do
  local s=S.new();S.start(s,mode);s.bookSeed=17;assert(S.commit(s,{65,68}))
  assert(s.job and s.job.book and s.job.done);jobs[#jobs+1]=s.job
  if mode=='fast' then assert(s.moves==2 and s.scene=='player-turn')
  else
   assert(s.moves==1 and s.scene=='ai-wait' and s.extraWait>=4)
   local j=s.job;local nodes,depth,seed=j.nodes,j.depth,s.bookSeed;S.update(s,.1)
   assert(j.nodes==nodes and j.depth==depth and s.bookSeed==seed,'wait advanced search or seed')
   local old=j;S.undo(s);assert(s.moves==0 and not s.reply and not s.job)
   A.step(old,100);assert(s.moves==0 and s.scene=='player-turn','cancelled result leaked')
  end
 end
 assert(jobs[1].move[1]==jobs[2].move[1] and jobs[1].move[2]==jobs[2].move[2] and jobs[1].nextSeed==jobs[2].nextSeed)
end)

print('RULE SUMMARY '..(total-failures)..'/'..total)
assert(failures==0,tostring(failures)..' rule regression groups failed')
