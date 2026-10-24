-- SPDX-License-Identifier: GPL-2.0-or-later
-- XQWLight JS 1.0 TT port, Morning Yellow (C) 2004-2012 www.xqbase.com.
-- Fix upstream probeHash score mutation; strict leaf/path semantics and bounded slots.
local M={}
function M.new(size)
 size=size or 16384;assert(size>=1 and (size & (size-1))==0,'TT size must be a power of two')
 return {slots={},mask=size-1,count=0,hits=0,stores=0}
end
function M.encode(score,ply) if score>9800 then return score+ply elseif score< -9800 then return score-ply else return score end end
function M.decode(score,ply) if score>9800 then return score-ply elseif score< -9800 then return score+ply else return score end end
function M.probe(tt,p,f)
 local e=tt.slots[p.key & tt.mask]
 if not e or e.key~=p.key or e.lock~=p.lock or e.rule~=p.rules.id then return nil,nil end
 -- Different depths/extensions/quiescence/null permissions only offer an ordering move.
 if e.depth~=f.depth or e.ext~=f.ext or e.q~=f.q or e.leaf~=f.leaf or e.ply~=f.ply or e.noNull~=f.noNull or e.context~=p.context or e.contextLock~=p.contextLock then return nil,e.move end
 local score=M.decode(e.score,f.ply)
 if e.flag=='exact' or (e.flag=='lower' and score>=f.beta) or (e.flag=='upper' and score<=f.alpha) then tt.hits=tt.hits+1;return score,e.move end
 return nil,e.move
end
function M.store(tt,p,f,score,move,generation)
 if f.dependent then return end
 local slot=p.key & tt.mask;local e=tt.slots[slot]
 if e and e.generation==generation and e.depth>f.depth then return end
 if not e then e={};tt.slots[slot]=e;tt.count=tt.count+1 end
 e.key=p.key;e.lock=p.lock;e.rule=p.rules.id;e.depth=f.depth;e.ext=f.ext;e.q=f.q;e.leaf=f.leaf;e.ply=f.ply;e.noNull=f.noNull
 e.context=p.context;e.contextLock=p.contextLock;e.score=M.encode(score,f.ply);e.move=move;e.generation=generation
 e.flag=score<=f.originalAlpha and 'upper' or (score>=f.beta and 'lower' or 'exact');e.complete=true
 tt.stores=tt.stores+1
end
return M
