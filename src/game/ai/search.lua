-- SPDX-License-Identifier: GPL-2.0-or-later
-- XQWLight JS 1.0 search port, Morning Yellow (C) 2004-2012 www.xqbase.com.
-- Explicit resumable frames replace recursion/coroutines. Incomplete iterations
-- never publish scores; full-window and PVS share terminal and leaf semantics.
local P=require('game.ai.position')
local G=require('game.ai.movegen')
local E=require('game.ai.evaluate')
local R=require('game.ai.rules')
local O=require('game.ai.order')
local TT=require('game.ai.tt')
local Scheduler=require('game.ai.scheduler')
local M={}
local INF=11000
local function clear(t) for i=#t,1,-1 do t[i]=nil end end
local function push(j,move,kind,depth,alpha,beta,ply,ext,q,noNull,trial)
 local index=#j.stack+1;local f=j.frames[index]
 if not f then f={moves={},heap={},ranks={},unsafe={},undo={},probe={}};j.frames[index]=f end
 for _,m in ipairs(f.moves) do f.unsafe[m]=nil end
 clear(f.moves);clear(f.heap);clear(f.ranks)
 f.move=move;f.kind=kind;f.depth=depth;f.alpha=alpha;f.originalAlpha=alpha;f.beta=beta;f.ply=ply;f.ext=ext;f.q=q;f.noNull=noNull;f.trial=trial
 f.phase='enter';f.best=-INF;f.bestMove=nil;f.dependent=false;f.heapCount=0;f.safeCount=0;f.count=0;f.tactical=0;f.searched=0;f.preferred=nil;f.danger=false;f.horizon=false
 f.changed=kind=='move' or kind=='pass' or kind=='null'
 if f.changed then P.make(j.pos,move,f.undo,kind);f.undo.checked=kind~='null' and G.danger(j.pos,j.pos.side) end
 j.stack[index]=f
 return f
end
local function restore(j,f) if f.changed then P.undo(j.pos,f.undo) end end
function M.finish(j,reason)
 for i=#j.stack,1,-1 do restore(j,j.stack[i]);j.stack[i]=nil end
 j.done=true;j.reason=reason or 'complete';j.partialExact=false
 j.eval=j.pos.red-j.pos.black
 j.restored=j.pos.key==j.initialKey and j.pos.lock==j.initialLock and j.eval==j.initialEval and j.pos.side==j.initialSide and #j.pos.history==0 and j.pos.context==0
 j.ttCount=j.transpositions.count
end
local function accept(j,f,score,move,dependent)
 f.dependent=f.dependent or dependent
 f.searched=f.searched+1
 if score>f.best then f.best=score;f.bestMove=move end
 if score>f.alpha then f.alpha=score end
 f.phase='select'
end
local function pop(j,score,dependent)
 local f=j.stack[#j.stack];restore(j,f);j.stack[#j.stack]=nil
 local parent=j.stack[#j.stack]
 if not parent then
  j.depth=j.iteration;j.score=score
  local move=P.external(f.bestMove)
  if move then
   if j.previous then
    j.changes[#j.changes+1]=(move[1]~=j.previous[1] or move[2]~=j.previous[2]) and 1 or 0
    local n=0;for _,v in ipairs(j.changes) do n=n+v end;j.summary.instability=n/#j.changes
   end
   j.move=move;j.previous=move;j.bestInternal=f.bestMove
  end
  if j.iteration>=j.maxDepth or math.abs(score)>9800 then M.finish(j)
  else j.iteration=j.iteration+1 end
 elseif f.kind=='null' then
  parent.dependent=parent.dependent or dependent
  if -score>=parent.beta then
   parent.phase='verify';j.nullVerifications=j.nullVerifications+1
   push(j,nil,'verify',parent.depth-2,parent.beta-1,parent.beta,parent.ply,parent.ext,parent.q,true,false)
  else parent.phase='select' end
 elseif f.kind=='verify' then
  parent.dependent=parent.dependent or dependent
  if score>=parent.beta then
   -- Reduced verification produces a selective lower bound, never exact TT data.
   parent.best=score;parent.dependent=true;parent.phase='complete';j.nullCutoffs=j.nullCutoffs+1
  else parent.phase='select' end
 else
  score=-score
  parent.dependent=parent.dependent or dependent
  if f.trial and score>parent.alpha and score<parent.beta then
   j.researches=j.researches+1;parent.phase='research'
   push(j,f.move,f.kind,f.depth,-parent.beta,-parent.alpha,f.ply,f.ext,f.q,f.noNull,false)
  else accept(j,parent,score,f.move,dependent) end
 end
end
local function complete(j,f)
 if j.useTT and f.ply>0 then TT.store(j.transpositions,j.pos,f,f.best,f.bestMove,j.iteration) end
 if f.depth>0 and f.bestMove and f.best>f.originalAlpha then O.reward(j,f,f.bestMove) end
 pop(j,f.best,f.dependent)
end
local function enter(j,f)
 local p=j.pos
 if j.nodes>=j.budget then M.finish(j,'nodes');return end
 j.nodes=j.nodes+1
 if f.depth<=0 then j.qnodes=j.qnodes+1 else j.mainNodes=j.mainNodes+1 end
 if not p.kings[p.side] then pop(j,-10000+f.ply);return end
 if not p.kings[1-p.side] then pop(j,10000-f.ply);return end
 local win=G.win(p)
 if win then f.bestMove=win;pop(j,10000-f.ply-1);return end
 local rep=P.repetition(p,f.ply)
 if rep then pop(j,rep,true);return end
 if f.kind=='move' then f.danger=f.undo.checked else f.danger=G.danger(p,p.side) end
 -- A dangerous leaf has no sound stand-pat. Abort instead of fabricating exact data.
 if f.ply>=j.maxPly or (f.depth<=0 and f.q<=0) then
  if f.danger then M.finish(j,'danger-limit');return end
  f.horizon=true
 end
 if j.useTT and f.ply>0 and not f.horizon then
  local score,move=TT.probe(j.transpositions,p,f);f.preferred=move
  if score then pop(j,score);return end
 elseif f.ply==0 then f.preferred=j.bestInternal end
 f.cursor=1;f.classify=1
 f.captureOnly=f.horizon or (f.depth<=0 and not f.danger)
 f.phase=f.captureOnly and 'stand' or 'generate'
end
local function classify(j,f,m)
 local p=j.pos;local unsafe=false
 if f.danger or p.rules.standard then
  unsafe=not G.safe(p,m)
 end
 f.unsafe[m]=unsafe
 if unsafe and p.rules.standard then return end
 f.count=f.count+1
 if not unsafe then f.safeCount=f.safeCount+1 end
 if f.ply==0 then
  if p.board[math.floor(m/256)]~=0 then f.tactical=f.tactical+1 end
 end
 if f.depth<=0 and not f.danger then
  if p.board[math.floor(m/256)]==0 then return end
  if p.rules.standard then local rank=O.capture(p,m)
   if rank<10 or (rank<20 and R.home(math.floor(m/256),p.side)) then return end
  end
 end
 O.add(f,m,(unsafe and -1000000 or 0)+O.rank(j,f,m))
end
local function prepared(j,f)
 local p=j.pos
 if f.ply==0 then j.summary.count=f.count;j.summary.tactical=f.tactical end
 if f.count==0 and not f.captureOnly then
  if p.rules.standard then pop(j,-10000+f.ply);return end
  if f.kind=='pass' then j.unresolved=true;pop(j,0,true);return end
  if f.ply==0 then j.move=nil end
  f.phase='child'
  push(j,nil,'pass',f.depth-1,-f.beta,-f.alpha,f.ply+1,f.ext,f.depth<=0 and f.q-1 or f.q,true,false)
  return
 end
 f.phase='select'
 -- Opt-in until device strength/zugzwang comparisons justify production use.
 if j.nullMove and not f.noNull and f.ply>0 and f.depth>=3 and f.beta-f.alpha==1 and not f.danger and f.safeCount>1 and math.abs(f.beta)<9000 then
  local material=p.side==0 and p.red or p.black
  if material>400 then
   f.phase='null';j.nullProbes=j.nullProbes+1
   push(j,nil,'null',f.depth-3,-f.beta,1-f.beta,f.ply+1,f.ext,f.q,true,false)
  end
 end
end
local function selectMove(j,f)
 if f.alpha>=f.beta or f.heapCount==0 then f.phase='complete';return end
 local move=O.take(f)
 if f.unsafe[move] then accept(j,f,-10000+f.ply+2,move,false);return end
 local trial=j.pvs and f.depth>0 and f.searched>0 and f.beta-f.alpha>1
 local beta=trial and f.alpha+1 or f.beta
 local depth=f.depth-1;local ext=f.ext;local q=f.depth<=0 and f.q-1 or f.q
 f.phase='child'
 local child=push(j,move,'move',depth,-beta,-f.alpha,f.ply+1,ext,q,f.noNull,trial)
 if f.depth>0 and ext>0 and (child.undo.checked or (f.danger and f.safeCount==1)) then child.depth=f.depth;child.ext=ext-1 end
 if trial then j.probes=j.probes+1 end
end
function M.advance(j)
 local f=j.stack[#j.stack]
 if not f then
  push(j,nil,'root',j.iteration,-INF,INF,0,j.extensions,j.qDepth,false,false)
 elseif f.phase=='enter' then enter(j,f)
 elseif f.phase=='stand' then
  -- Production pass semantics need a basic move before allowing stand-pat.
  -- Search one piece per work unit; quiet moves are not sorted or classified.
  local found=j.pos.rules.standard
  if not found then
   while f.cursor<=90 do
    local sq=P.squares[f.cursor];f.cursor=f.cursor+1
    if P.side(j.pos.board[sq])==j.pos.side then G.piece(j.pos,sq,f.moves,false);break end
   end
   found=#f.moves>0
  end
  if found then
   clear(f.moves);f.cursor=1;f.best=E.score(j.pos,f.ply)
   if f.horizon then pop(j,f.best)
   elseif f.best>=f.beta then f.phase='complete'
   else f.alpha=math.max(f.alpha,f.best);f.phase='generate' end
  elseif f.cursor>90 then f.captureOnly=false;prepared(j,f) end
 elseif f.phase=='generate' then
  if f.classify<=#f.moves then
   local m=f.moves[f.classify];f.classify=f.classify+1;classify(j,f,m)
  else
   local found=false
   while f.cursor<=90 do
    local sq=P.squares[f.cursor];f.cursor=f.cursor+1
    if P.side(j.pos.board[sq])==j.pos.side then G.piece(j.pos,sq,f.moves,f.captureOnly);found=true;break end
   end
   if not found then prepared(j,f) end
  end
 elseif f.phase=='select' then selectMove(j,f)
 elseif f.phase=='complete' then complete(j,f)
 else error('search frame resumed while child is missing: '..f.phase) end
end
function M.new(board,side,custom,opts)
 opts=opts or {};local rules=R.get(custom,opts.profile);local p=P.new(board,side,rules)
 local copy={} for i=1,90 do copy[i]=board[i] or '' end
 local j={pos=p,board=copy,side=side,custom=custom,rules=rules,stack={},frames={},history={},killers={},changes={},nodes=0,qnodes=0,mainNodes=0,depth=0,iteration=1,elapsed=0,done=false,restored=true,partialExact=false,probes=0,researches=0,nullProbes=0,nullVerifications=0,nullCutoffs=0,summary={count=0,tactical=0}}
 j.initialKey=p.key;j.initialLock=p.lock;j.initialEval=p.red-p.black;j.initialSide=p.side;j.eval=j.initialEval
 j.kings={red=P.to90[p.kings[0]],black=P.to90[p.kings[1]]}
 j.budget=opts.nodeBudget or 16000;j.maxDepth=opts.maxDepth or 8;j.maxPly=opts.maxPly or 64;j.qDepth=opts.qDepth or 16;j.extensions=opts.extensions or 2
 j.pvs=opts.pvs~=false;j.useTT=opts.tt~=false;j.nullMove=opts.nullMove==true and not rules.freeRed
 j.transpositions=TT.new(opts.ttSize);j.tt=j.transpositions.slots;j.ttCount=0
 j.operationsPerStep=opts.operationsPerStep or 128;j.nodesPerStep=opts.nodesPerStep or 32;j.timeLimit=opts.timeLimit or 4
 j.clock=opts.clock~=false and (opts.clock or (os and os.clock)) or nil
 j.sliceSeconds=opts.sliceSeconds or 0.003;j.workBudget=opts.workBudget or math.huge
 -- Establish a verified fallback independent of the deadline: win, then safety.
 local win=G.win(p);local list={};local fallback;local safeFound=false
 if win then fallback=win
 else
  for _,sq in ipairs(P.squares) do
   clear(list);G.piece(p,sq,list,false)
   for _,m in ipairs(list) do
    if not fallback and not rules.standard then fallback=m end
    local safe=G.safe(p,m)
    if safe then fallback=m;safeFound=true;break end
   end
   if safeFound then break end
  end
 end
 j.move=P.external(fallback);j.bestInternal=fallback
 if not p.kings[p.side] or not p.kings[1-p.side] then j.move=nil;j.score=not p.kings[p.side] and -10000 or 10000;M.finish(j,'terminal')
 elseif win then j.score=9999;M.finish(j,'capture')
 elseif not fallback then
  if rules.standard then j.score=-10000 end
  M.finish(j,'no-moves')
 end
 return j
end
function M.step(j,dt) Scheduler.step(j,dt,M.advance,M.finish) end
function M.cancel(j) if j and not j.done then j.cancelled=true;M.finish(j,'cancelled') end end
return M
