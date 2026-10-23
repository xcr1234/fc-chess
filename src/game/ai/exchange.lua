-- Bounded static exchange evaluation. Use project basic moves (including
-- king exposure) rather than standard-chess pinned-piece legality.
local B=require('game.board')
local M={}
local values={K=1000000,R=900,N=400,C=450,E=200,A=200,P=100}
local function value(p) return values[string.upper(p)] or 0 end
local function other(s) return s=='red' and 'black' or 'red' end
function M.gain(b,m,custom)
 if string.upper(b[m[2]])=='K' then return values.K end
 local target=m[2];local turn=B.side(b[m[1]]);local gains={value(b[target])};local changes={}
 local function move(a)
  changes[#changes+1]={a,b[a],b[target]};b[target]=b[a];b[a]=''
 end
 move(m[1]);turn=other(turn)
 for n=1,89 do
  local best,cost=nil,math.huge
  for i=1,90 do
   if B.side(b[i])==turn and value(b[i])<cost and B.valid(b,i,target,custom) then best=i;cost=value(b[i]) end
  end
  if not best then break end
  gains[#gains+1]=value(b[target])-gains[#gains]
  if string.upper(b[target])=='K' then break end
  move(best);turn=other(turn)
 end
 for i=#changes,1,-1 do local c=changes[i];b[c[1]]=c[2];b[target]=c[3] end
 for i=#gains,2,-1 do gains[i-1]=-math.max(-gains[i-1],gains[i]) end
 return gains[1]
end
-- A side to move can save one loose piece. Two independent targets represent
-- a fork; use the second exposure rather than charging both as certain losses.
function M.risk(b,side,toMove,custom)
 local targets={}
 for _,m in ipairs(B.moves(b,other(side),custom,true)) do
  local gain=string.upper(b[m[2]])~='K' and M.gain(b,m,custom) or 0
  if gain>0 then targets[m[2]]=math.max(targets[m[2]] or 0,gain) end
 end
 local first,second=0,0
 for _,gain in pairs(targets) do
  if gain>first then second=first;first=gain elseif gain>second then second=gain end
 end
 return side==toMove and second or first
end
return M
