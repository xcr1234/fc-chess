local A=require('game.ai')
local B=require('game.board')
local P=require('game.ai.position')
local G=require('game.ai.movegen')
local R=require('game.ai.rules')
local TT=require('game.ai.tt')
local S=require('game.session')
require('app.log').enabled=false
local failed,total=0,0
local function check(id,fn)
 total=total+1;local ok,err=pcall(fn)
 print((ok and 'PASS ' or 'FAIL ')..id..(ok and '' or ': '..tostring(err)))
 if not ok then failed=failed+1 end
end
local function empty() local b={} for i=1,90 do b[i]='' end return b end
local function army()
 local b=B.standard();for i,pc in ipairs(b) do if B.red(pc) and pc~='K' then b[i]='R' end end
 return b
end
local function restored(j,b,side)
 local clean=P.new(b,side,j.rules);local p=j.pos
 assert(j.restored and #j.stack==0 and #p.history==0 and p.context==0 and p.contextLock==0)
 assert(p.key==clean.key and p.lock==clean.lock and p.side==clean.side and p.red==clean.red and p.black==clean.black)
 assert(p.kings[0]==clean.kings[0] and p.kings[1]==clean.kings[1])
 local export=P.export(p);for i=1,90 do assert(export[i]==b[i] and j.board[i]==b[i]) end
 if j.move then assert(B.side(b[j.move[1]])==side and B.valid(b,j.move[1],j.move[2],true)) end
end
local function run(b,side,opts,dt)
 opts=opts or {};opts.noBook=true;opts.clock=false
 local before=B.key(b,side,true);local j=A.new(b,side,true,opts);local steps=0
 while not j.done do A.step(j,dt or 0);steps=steps+1;assert(steps<10000,'search did not finish') end
 assert(B.key(b,side,true)==before);restored(j,b,side);return j
end
check('CUSTOM-LIGHT-FIFTEEN-ROOKS-FIRST-ITERATION',function()
 for _,fps in ipairs({30,60}) do
  local b=army();b[46]=b[55];b[55]='';local j=run(b,'black',nil,1/fps)
  assert(j.depth>=1,'15-rook reply never completed its first comparison at '..fps..' FPS')
  assert(j.depth<=2 and j.qnodes==0 and j.estimatedLeaves>0,'custom search still expands long tactical chains')
 end
end)
check('CUSTOM-LIGHT-DEFAULTS-AND-STANDARD-ISOLATION',function()
 local j=A.new(army(),'black',true,{noBook=true,clock=false})
 assert(j.lightweight and j.maxDepth==2 and j.qDepth==0 and j.extensions==0)
 assert(j.timeLimit==1.5 and j.budget==2000 and not j.useTT and not j.book)
 A.cancel(j)
 local full=A.new(B.standard(),'black',false,{noBook=true,clock=false})
 assert(not full.lightweight and full.maxDepth==8 and full.qDepth==16 and full.extensions==2)
 assert(full.timeLimit==4 and full.budget==16000 and full.useTT);A.cancel(full)
end)
check('CUSTOM-LIGHT-COUNTER-CAPTURE-FIRST',function()
 local b=empty();b[5]='k';b[86]='K';b[23]='R';b[77]='r'
 local j=run(b,'black');assert(j.reason=='capture' and j.move[1]==77 and j.move[2]==86)
end)
check('CUSTOM-LIGHT-FREE-PIECE-DEFENCE',function()
 for _,piece in ipairs({{15,'A'},{25,'E'}}) do
  local b=empty();b[5]='k';b[85]='K';b[piece[1]]=piece[2]
  local j=run(b,'black');assert(j.depth>=1 and j.move)
  local p=P.new(b,'black',R.get(true));assert(G.danger(p,1))
  assert(G.safe(p,P.move(P.from90[j.move[1]],P.from90[j.move[2]])),'ignored immediate free-piece king capture')
 end
end)
check('CUSTOM-LIGHT-CAPTURES-HANGING-ROOK',function()
 local b=empty();b[5]='k';b[85]='K';b[41]='r';b[50]='R'
 local j=run(b,'black');assert(j.depth==2 and j.move[1]==41 and j.move[2]==50,'missed hanging rook')
end)
check('CUSTOM-LIGHT-DANGEROUS-HORIZON-IS-BOUNDED',function()
 local b=empty();b[6]='k';b[85]='K';b[41]='r'
 local j=run(b,'black');assert(j.reason=='complete' and j.depth==2 and j.estimatedLeaves>0,'dangerous leaf still aborts the entertainment iteration')
 local full=run(b,'black',{lightweight=false,maxDepth=2,qDepth=0,extensions=0})
 assert(full.reason=='danger-limit' and full.restored,'full tactical search horizon was changed')
end)
check('CUSTOM-LIGHT-TT-LEAF-POLICIES-DO-NOT-MIX',function()
 local p=P.new(B.standard(),'black',R.get(true));local tt=TT.new(1)
 local f={depth=1,ext=0,q=0,ply=1,noNull=false,originalAlpha=-11000,alpha=-11000,beta=11000,leaf='static'}
 TT.store(tt,p,f,50,123,1);assert(TT.probe(tt,p,f)==50)
 f.leaf='quiescent';assert(TT.probe(tt,p,f)==nil,'light/static value reused in full tactical search')
 local b=B.standard();b[46]=b[55];b[55]=''
 local j=run(b,'black',{tt=true})
 assert(j.depth==2 and j.estimatedLeaves>0 and j.transpositions.stores==0,'estimated leaves entered exact/bound caches')
end)
check('CUSTOM-LIGHT-CANCEL-AND-DEADLINE-RESTORE',function()
 local b=army();b[46]=b[55];b[55]=''
 for _,cut in ipairs({1,20,100}) do
  local j=A.new(b,'black',true,{noBook=true,clock=false,operationsPerStep=1})
  for n=1,cut do if not j.done then A.step(j,0) end end
  A.cancel(j);restored(j,b,'black')
 end
 local j=A.new(b,'black',true,{noBook=true,clock=false});A.step(j,1.5)
 assert(j.done and j.reason=='deadline' and j.move);restored(j,b,'black')
end)
check('CUSTOM-LIGHT-SESSION-STANDARD-ARMY-AND-UNDO',function()
 local s=S.new();S.start(s,'custom');assert(S.commit(s,{55,46}))
 local old=s.job;assert(old and old.lightweight and not old.book)
 S.undo(s);assert(s.scene=='player-turn' and s.moves==0 and not s.job and not s.reply)
 A.step(old,10);assert(s.moves==0 and old.restored,'cancelled custom result leaked')
end)
print('CUSTOM LIGHT SUMMARY '..(total-failed)..'/'..total)
assert(failed==0,tostring(failed)..' custom light regression groups failed')
