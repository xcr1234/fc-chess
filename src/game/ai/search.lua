local B=require('game.board')
local M={}
local values={K=1000000,R=900,N=400,C=450,E=200,A=200,P=100}
local function other(s) return s=='red' and 'black' or 'red' end
local function value(p) return values[string.upper(p)] or 0 end
-- Piece-specific positional terms; incremental score is always red minus black.
-- Independently expressed heuristics, not copied upstream tables.
local function pieceScore(p,i)
 if p=='' then return 0 end
 local f,r=B.coords(i);local k=string.upper(p)
 local advance=B.red(p) and 9-r or r
 local center=4-math.abs(f-4);local pos=0
 if k=='P' then pos=advance*8+(advance>=5 and center*6 or 0)
 elseif k=='N' then pos=center*8+math.min(advance,6)*4
 elseif k=='R' then pos=center*3+math.min(advance,7)*2
 elseif k=='C' then pos=center*4+(advance<=4 and advance*3 or 0)
 elseif k=='K' then pos=-advance*4 end
 return (B.red(p) and 1 or -1)*(value(p)+pos)
end
local function evaluate(job,side)
 return (side=='red' and 1 or -1)*job.eval
end
local function endangered(job,side)
 local king=job.kings[side]
 if not king then return false end
 for i=1,90 do
  if B.side(job.board[i])==other(side) and B.valid(job.board,i,king,job.custom) then return true end
 end
 return false
end
local function ordered(b,moves,preferred,job,ply)
 local ranks={}
 for _,m in ipairs(moves) do
  local key=m[1]*100+m[2]
  ranks[key]=(preferred and m[1]==preferred[1] and m[2]==preferred[2] and 1e8 or 0)+value(b[m[2]])*10-value(b[m[1]])+(job and job.history[key] or 0)+(job and job.killers[ply or 0]==key and 5000 or 0)
 end
 table.sort(moves,function(a,c)
  local x,y=ranks[a[1]*100+a[2]],ranks[c[1]*100+c[2]];if x==y then return a[1]*100+a[2]<c[1]*100+c[2] end return x>y
 end)
 return moves
end
local function restore(job,f) if f.move then job.eval=f.oldEval;job.kings[f.side=='red' and 'black' or 'red']=f.oldKing;job.board[f.move[1]]=f.piece;job.board[f.move[2]]=f.captured end end
local function finish(job)
 for i=#job.stack,1,-1 do restore(job,job.stack[i]) end
 job.stack={};job.partialExact=false
 for _,entry in pairs(job.tt) do if entry.flag=='exact' and not entry.complete then job.partialExact=true end end
 job.restored=B.key(job.board,job.side,job.custom)==job.original;job.done=true
end
local function push(job,move,side,depth,alpha,beta,ply,q)
 local b=job.board;local f={move=move,piece=move and b[move[1]],captured=move and b[move[2]] or '',side=side,depth=depth,alpha=alpha,beta=beta,oldAlpha=alpha,ply=ply,q=q}
 if move then
  f.oldEval=job.eval;f.oldKing=job.kings[other(side)]
  job.eval=job.eval-pieceScore(f.piece,move[1])-pieceScore(f.captured,move[2])+pieceScore(f.piece,move[2])
  if string.upper(f.piece)=='K' then job.kings[other(side)]=move[2] end
  b[move[2]]=f.piece;b[move[1]]=''
 end;job.stack[#job.stack+1]=f
end
local function scoreFromTT(score,ply) if score>900000 then return score-ply elseif score< -900000 then return score+ply end return score end
local function scoreToTT(score,ply) if score>900000 then return score+ply elseif score< -900000 then return score-ply end return score end
function M.new(board,side,custom,opts)
 opts=opts or {};local b=B.copy(board);local root=B.moves(b,side,custom)
 -- A deadline can expire before even depth one completes. Keep the legal
 -- fallback tactical (especially an immediate king capture), not scan order.
 ordered(b,root,nil)
 local job={board=b,side=side,custom=custom,original=B.key(b,side,custom),nodes=0,depth=0,budget=opts.nodeBudget or 3200,done=false,restored=true,partialExact=false,elapsed=0,tt={},ttCount=0,history={},killers={},stack={},root=root,iteration=1,maxDepth=opts.maxDepth or 6,changes={}}
 job.pvs=opts.pvs~=false;job.probes=0;job.researches=0;job.eval=0;job.kings={};job.score=nil
 for i=1,90 do job.eval=job.eval+pieceScore(b[i],i);if string.upper(b[i])=='K' then job.kings[B.side(b[i])]=i end end
 job.move=root[1];job.summary={count=#root,tactical=0}
 local king for i=1,90 do if b[i]==(side=='red' and 'k' or 'K') then king=i;break end end
 for _,m in ipairs(root) do
  local captured=b[m[2]];local p=b[m[1]];b[m[2]]=p;b[m[1]]=''
  local tactical=captured~=''
  if not tactical then
   if king then for i=1,90 do if B.side(b[i])==side and B.valid(b,i,king,custom) then tactical=true;break end end end
  end
  b[m[1]]=p;b[m[2]]=captured
  if tactical then job.summary.tactical=job.summary.tactical+1 end
 end
 if #root==0 then job.done=true end
 return job
end
-- XQWLight-style PVS expressed as resumable frames. A trial result must
-- finish its full-window re-search before it can update the parent's PV.
local function pop(job,score)
 local f=table.remove(job.stack);restore(job,f)
 local parent=job.stack[#job.stack]
 if parent then
  score=-score
  if f.trial and score>parent.alpha and score<parent.beta then
   job.researches=job.researches+1
   push(job,f.move,f.side,f.depth,-parent.beta,-parent.alpha,f.ply,f.q)
   return
  end
  if score>parent.best then parent.best=score;parent.bestMove=f.move end
  parent.alpha=math.max(parent.alpha,score)
 else
  -- Only completed root frames are committed; cancelled trials never leak.
  job.depth=job.iteration;job.score=score
  if f.bestMove then job.move=f.bestMove end
  if job.previous then
   job.changes[#job.changes+1]=(job.previous[1]~=job.move[1] or job.previous[2]~=job.move[2]) and 1 or 0
   local n=0;for _,v in ipairs(job.changes) do n=n+v end
   job.summary.instability=n/#job.changes
  end
  job.previous=job.move;job.summary.gap=nil
  if job.iteration>=job.maxDepth or math.abs(score)>900000 then finish(job)
  else job.iteration=job.iteration+1 end
 end
end
function M.step(job,dt)
 if job.done then return end
 job.elapsed=job.elapsed+dt
 if job.elapsed>=4 or job.cancelled then finish(job);return end
 local visited,operations=0,0
 while not job.done and visited<16 and operations<128 do
  operations=operations+1
  local f=job.stack[#job.stack]
  if not f then
   push(job,nil,job.side,job.iteration,-2000000,2000000,0,2)
  elseif not f.entered then
   if job.nodes>=job.budget then finish(job);return end
   job.nodes=job.nodes+1;visited=visited+1;f.entered=true
   if string.upper(f.captured)=='K' then pop(job,-1000000+f.ply)
   else
    f.key=B.key(job.board,f.side,job.custom)
    local entry=job.tt[f.key];local cached
    if f.ply>0 and f.depth>0 and entry and entry.depth>=f.depth then
     local score=scoreFromTT(entry.score,f.ply)
     if entry.flag=='exact' then cached=score
     elseif entry.flag=='lower' and score>=f.beta then cached=score
     elseif entry.flag=='upper' and score<=f.alpha then cached=score end
    end
    if cached then pop(job,cached)
    else
     f.danger=f.depth<=0 and endangered(job,f.side)
     f.best=f.depth<=0 and not f.danger and evaluate(job,f.side) or -2000000
     if f.depth<=0 and f.q<=0 then
      pop(job,endangered(job,other(f.side)) and (1000000-f.ply-1) or evaluate(job,f.side))
     elseif f.depth<=0 and not f.danger and f.best>=f.beta then pop(job,f.best)
     else
      if f.depth<=0 then f.alpha=math.max(f.alpha,f.best) end
      f.moves=ordered(job.board,f.ply==0 and job.root or B.moves(job.board,f.side,job.custom,f.depth<=0 and not f.danger),f.ply==0 and job.move or (entry and entry.move),job,f.ply)
      f.next=1
      if #f.moves==0 then
       if f.depth>0 and #B.moves(job.board,other(f.side),job.custom)>0 then f.moves={false}
       else pop(job,evaluate(job,f.side)) end
      end
     end
    end
   end
  elseif f.next>#f.moves or f.alpha>=f.beta then
   if f.depth>0 then
    if f.alpha>=f.beta and f.bestMove and job.board[f.bestMove[2]]=='' then
     local key=f.bestMove[1]*100+f.bestMove[2]
     job.killers[f.ply]=key;job.history[key]=math.min(2000,(job.history[key] or 0)+f.depth*f.depth)
    end
    if job.ttCount>=1024 then job.tt={};job.ttCount=0 end
    job.tt[f.key]={depth=f.depth,score=scoreToTT(f.best,f.ply),move=f.bestMove,complete=true,flag=f.best<=f.oldAlpha and 'upper' or (f.best>=f.beta and 'lower' or 'exact')}
    job.ttCount=job.ttCount+1
   end
   pop(job,f.best)
  else
   local m=f.moves[f.next];f.next=f.next+1
   local trial=job.pvs and f.depth>1 and f.next>2 and f.beta-f.alpha>1
   local beta=trial and f.alpha+1 or f.beta
   push(job,m,other(f.side),f.depth-1,-beta,-f.alpha,f.ply+1,f.depth<=0 and f.q-1 or f.q)
   job.stack[#job.stack].trial=trial
   if trial then job.probes=job.probes+1 end
  end
 end
end
function M.cancel(job) if job and not job.done then job.cancelled=true;finish(job) end end
return M
