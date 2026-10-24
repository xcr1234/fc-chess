-- SPDX-License-Identifier: GPL-2.0-or-later
-- XQWLight JS 1.0 position port, Morning Yellow (C) 2004-2012 www.xqbase.com.
-- Adaptations: numeric mailbox, reversible frame-owned undo, 31-bit hash lanes
-- (identical in Fengari/32-bit and native 64-bit Lua), explicit history context.
local T=require('game.ai.tables')
local E=require('game.ai.evaluate')
local M={squares={},to90={},from90={}}
local codes={K=8,A=9,E=10,N=11,R=12,C=13,P=14,k=16,a=17,e=18,n=19,r=20,c=21,p=22}
local chars={} for c,p in pairs(codes) do chars[p]=c end
for i=1,90 do
 local sq=(math.floor((i-1)/9)+3)*16+(i-1)%9+3
 M.squares[i]=sq;M.to90[sq]=i;M.from90[i]=sq
end
function M.side(pc) if pc==0 or not pc then return nil end return pc<16 and 0 or 1 end
function M.move(a,z) return a+z*256 end
function M.external(m) if not m or m==0 then return nil end return {M.to90[m%256],M.to90[math.floor(m/256)]} end
local function change(pos,sq,pc,sign)
 pos.key=pos.key ~ T.key[pc][sq];pos.lock=pos.lock ~ T.lock[pc][sq]
 local v=sign*E.piece(pc,sq,pos.rules)
 if pc<16 then pos.red=pos.red+v else pos.black=pos.black+v end
end
function M.new(board,side,rules)
 local p={board={},side=side=='red' and 0 or 1,rules=rules,red=0,black=0,key=0,lock=0,kings={},history={},context=0,contextLock=0,serial=0,contextIds={}}
 for sq=0,255 do p.board[sq]=0 end
 for i=1,90 do local pc=codes[board[i]]
  if pc then local sq=M.from90[i];p.board[sq]=pc;change(p,sq,pc,1);if pc%8==0 then p.kings[M.side(pc)]=sq end end
 end
 if p.side==1 then p.key=p.key ~ T.sideKey;p.lock=p.lock ~ T.sideLock end
 return p
end
function M.make(p,m,u,kind)
 u.move=m;u.kind=kind;u.key=p.key;u.lock=p.lock;u.red=p.red;u.black=p.black
 u.redKing=p.kings[0];u.blackKing=p.kings[1];u.context=p.context;u.contextLock=p.contextLock;u.side=p.side;u.checked=false
 u.captured=0
 if m and m~=0 then
  local a,z=m%256,math.floor(m/256);local pc,cap=p.board[a],p.board[z]
  u.piece=pc;u.captured=cap
  if cap~=0 then change(p,z,cap,-1);if cap%8==0 then p.kings[M.side(cap)]=nil end end
  change(p,a,pc,-1);change(p,z,pc,1);p.board[a]=0;p.board[z]=pc
  if pc%8==0 then p.kings[p.side]=z end
 end
 p.side=1-p.side;p.key=p.key ~ T.sideKey;p.lock=p.lock ~ T.sideLock
 -- Path identities are interned per parent and move. Unlike rolling hashes,
 -- this context has no collision and distinguishes histories for TT values.
 -- Captures reset reversible history; null/pass remain distinct boundaries.
 if u.captured~=0 then p.context=0;p.contextLock=0
 else
  local parent=p.context
  local edges=p.contextIds[parent];if not edges then edges={};p.contextIds[parent]=edges end
  local edge=m or (kind=='null' and -1 or -2)
  local id=edges[edge];if not id then p.serial=p.serial+1;id=p.serial;edges[edge]=id end
  p.context=id;p.contextLock=kind=='null' and 1 or 0
 end
 p.history[#p.history+1]=u
end
function M.undo(p,u)
 if u.move and u.move~=0 then local a,z=u.move%256,math.floor(u.move/256);p.board[a]=u.piece;p.board[z]=u.captured end
 p.key=u.key;p.lock=u.lock;p.red=u.red;p.black=u.black;p.side=u.side
 p.kings[0]=u.redKing;p.kings[1]=u.blackKing;p.context=u.context;p.contextLock=u.contextLock
 p.history[#p.history]=nil
end
function M.repetition(p,ply)
 local own,opp=true,true
 for i=#p.history,1,-1 do
  local u=p.history[i]
  if u.kind=='null' or not u.move or u.captured~=0 then break end
  if u.side==p.side then own=own and u.checked else opp=opp and u.checked end
  if u.side==p.side and u.key==p.key and u.lock==p.lock then
   if not p.rules.standard then return nil end -- No invented production draw policy.
   local score=(own and ply-9900 or 0)+(opp and 9900-ply or 0)
   return score~=0 and score or (ply%2==0 and -20 or 20)
  end
 end
end
function M.export(p)
 local b={} for i,sq in ipairs(M.squares) do b[i]=chars[p.board[sq]] or '' end return b
end
return M
