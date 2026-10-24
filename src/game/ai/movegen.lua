-- SPDX-License-Identifier: GPL-2.0-or-later
-- XQWLight JS 1.0 mailbox generation, Morning Yellow (C) 2004-2012 www.xqbase.com.
-- Capture rules add flying capture, arbitrary piece counts, and free red A/E.
local P=require('game.ai.position')
local R=require('game.ai.rules')
local M={}
local orth={-16,-1,1,16}
local diag={-17,-15,15,17}
local knight={{-33,-31},{-18,14},{-14,18},{31,33}}
local function add(p,out,a,z,captures)
 if not P.to90[z] then return end
 local target=p.board[z]
 if P.side(target)~=p.side and (not captures or target~=0) then out[#out+1]=a+z*256 end
end
-- One piece per scheduler operation, bounded by four board rays.
function M.piece(p,a,out,captures)
 local pc=p.board[a];if P.side(pc)~=p.side then return end
 local k=pc%8;local free=p.rules.freeRed and p.side==0
 if k==0 then
  for _,d in ipairs(orth) do local z=a+d;if R.palace(z,p.side) then add(p,out,a,z,captures) end end
  if not p.rules.standard then
   local king=p.kings[1-p.side]
   if king and king%16==a%16 and math.abs(king-a)>16 then
    local d=king>a and 16 or -16;local z=a+d
    while p.board[z]==0 do z=z+d end
    if z==king then add(p,out,a,z,captures) end
   end
  end
 elseif k==1 then
  for _,d in ipairs(diag) do local z=a+d;if free or R.palace(z,p.side) then add(p,out,a,z,captures) end end
 elseif k==2 then
  for _,d in ipairs(diag) do local z=a+2*d
   if P.to90[z] and (free or R.home(z,p.side)) and p.board[a+d]==0 then add(p,out,a,z,captures) end
  end
 elseif k==3 then
  for i,d in ipairs(orth) do if p.board[a+d]==0 then for _,jump in ipairs(knight[i]) do add(p,out,a,a+jump,captures) end end end
 elseif k==4 or k==5 then
  for _,d in ipairs(orth) do
   local z=a+d;local screen=false
   while P.to90[z] do
    local target=p.board[z]
    if target==0 then if not screen and not captures then out[#out+1]=a+z*256 end
    elseif not screen then
     if k==4 then if P.side(target)~=p.side then out[#out+1]=a+z*256 end;break end
     screen=true
    else if P.side(target)~=p.side then out[#out+1]=a+z*256 end;break end
    z=z+d
   end
  end
 elseif k==6 then
  add(p,out,a,a+(p.side==0 and -16 or 16),captures)
  if not R.home(a,p.side) then add(p,out,a,a-1,captures);add(p,out,a,a+1,captures) end
 end
end
function M.generate(p,captures,out)
 out=out or {};for i=#out,1,-1 do out[i]=nil end
 for _,sq in ipairs(P.squares) do M.piece(p,sq,out,captures) end
 return out
end
-- Direct target attack query: no all-moves allocation or full-board scan.
-- Returns the attacker's square, so immediate king capture needs no generation.
function M.attacker(p,z,side)
 if not z then return nil end
 local b=p.board;local tag=8+side*8
 local forward=side==0 and -16 or 16
 local a=z-forward
 if b[a]==tag+6 and P.to90[a] then return a end
 for _,d in ipairs({-1,1}) do a=z+d;if b[a]==tag+6 and P.to90[a] and not R.home(a,side) then return a end end
 for i,d in ipairs(orth) do
  for _,jump in ipairs(knight[i]) do a=z-jump;if b[a]==tag+3 and P.to90[a] and b[a+d]==0 then return a end end
 end
 for _,d in ipairs(diag) do
  a=z-d
  if b[a]==tag+1 and P.to90[a] and ((p.rules.freeRed and side==0) or R.palace(z,side)) then return a end
  a=z-2*d
  if b[a]==tag+2 and P.to90[a] and b[z-d]==0 and ((p.rules.freeRed and side==0) or R.home(z,side)) then return a end
 end
 for _,d in ipairs(orth) do
  a=z+d;local screen=false
  while P.to90[a] do
   local pc=b[a]
   if pc~=0 then
    if not screen then
     if pc==tag+4 then return a end
     if pc==tag and ((math.abs(d)==16 and b[z]%8==0) or (a==z+d and R.palace(z,side))) then
      -- A king's ordinary attack is one step; flying attacks require a king target.
      if math.abs(d)==16 or math.abs(a-z)==1 then return a end
     end
     screen=true
    else if pc==tag+5 then return a end;break end
   end
   a=a+d
  end
 end
end
function M.danger(p,side) return M.attacker(p,p.kings[side],1-side)~=nil end
function M.safe(p,m)
 -- Geometry-only probe: never touch incremental scores/hash/history or allocate
 -- undo/context entries just to classify a move during sorting.
 local a,z=m%256,math.floor(m/256);local pc,cap=p.board[a],p.board[z]
 if cap~=0 and cap%8==0 and not p.rules.standard then return true end
 p.board[a]=0;p.board[z]=pc
 local king=pc%8==0 and z or p.kings[p.side]
 local safe=king~=nil and M.attacker(p,king,1-p.side)==nil
 p.board[a]=pc;p.board[z]=cap
 return safe
end
function M.win(p)
 if p.rules.standard then return nil end
 local z=p.kings[1-p.side];local a=M.attacker(p,z,p.side)
 if a then return a+z*256 end
end
return M
