local M={}
local function clamp(x) return math.max(0,math.min(1,x)) end
function M.seconds(mode,s)
 if mode=='fast' then return 0 end
 if not s or (s.count and s.count<=1) then return 4 end
 local sum,weight=0,0
 local function add(v,w) if v~=nil then sum=sum+clamp(v)*w;weight=weight+w end end
 add(s.count and (s.count-1)/59,.35)
 add(s.tactical and s.count and s.tactical/math.max(s.count,1),.25)
 add(s.gap and 1-clamp(s.gap/150),.30);add(s.instability,.10)
 return math.floor(4+12*(weight>0 and sum/weight or 0)+.5)
end
return M
