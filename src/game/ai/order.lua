-- SPDX-License-Identifier: GPL-2.0-or-later
-- JS 1.0 MVV/LVA, killer and history ordering; incremental deterministic heap.
-- Morning Yellow (C) 2004-2012 www.xqbase.com. Lua adaptations by this project.
local M={}
local victim={[0]=50,10,10,30,40,30,20}
local attacker={[0]=5,1,1,1,4,4,2}
function M.capture(p,m)
 local a,z=m%256,math.floor(m/256)
 return victim[p.board[z]%8]-attacker[p.board[a]%8]
end
function M.historyKey(p,m) return (p.board[m%256]-8)*256+math.floor(m/256) end
function M.rank(job,f,m)
 if m==f.preferred then return 10000000 end
 local pc=job.pos.board[math.floor(m/256)]
 if pc~=0 then return 100000+M.capture(job.pos,m)*100 end
 local killers=job.killers[f.ply]
 if killers then if m==killers[1] then return 90000 elseif m==killers[2] then return 80000 end end
 return job.history[M.historyKey(job.pos,m)] or 0
end
local function better(m,v,other,score) return v>score or (v==score and m<other) end
function M.add(f,m,v)
 local i=f.heapCount+1;f.heapCount=i
 while i>1 do local parent=math.floor(i/2)
  if not better(m,v,f.heap[parent],f.ranks[parent]) then break end
  f.heap[i]=f.heap[parent];f.ranks[i]=f.ranks[parent];i=parent
 end
 f.heap[i]=m;f.ranks[i]=v
end
function M.take(f)
 if f.heapCount==0 then return nil end
 local result=f.heap[1];local m,v=f.heap[f.heapCount],f.ranks[f.heapCount]
 f.heap[f.heapCount]=nil;f.ranks[f.heapCount]=nil;f.heapCount=f.heapCount-1
 if f.heapCount==0 then return result end
 local i=1
 while i*2<=f.heapCount do
  local child=i*2
  if child<f.heapCount and better(f.heap[child+1],f.ranks[child+1],f.heap[child],f.ranks[child]) then child=child+1 end
  if not better(f.heap[child],f.ranks[child],m,v) then break end
  f.heap[i]=f.heap[child];f.ranks[i]=f.ranks[child];i=child
 end
 f.heap[i]=m;f.ranks[i]=v
 return result
end
function M.reward(job,f,m)
 if not m then return end
 local key=M.historyKey(job.pos,m)
 job.history[key]=math.min(70000,(job.history[key] or 0)+f.depth*f.depth)
 local k=job.killers[f.ply] or {};job.killers[f.ply]=k
 if k[1]~=m then k[2]=k[1];k[1]=m end
end
return M
