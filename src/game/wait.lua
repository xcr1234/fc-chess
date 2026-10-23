local M={}
local function clamp(x) return math.max(0,math.min(1,x)) end
-- Shared by difficult/custom. Per-session override avoids global mutable settings.
M.defaults={minSeconds=4,maxSeconds=16}
function M.seconds(mode,s,policy)
 if mode=='fast' then return 0 end
 policy=policy or M.defaults
 local low=policy.minSeconds or M.defaults.minSeconds
 local high=policy.maxSeconds or M.defaults.maxSeconds
 assert(type(low)=='number' and type(high)=='number' and low>=0 and high>=low and high<math.huge,'Invalid wait policy')
 if not s or (s.count and s.count<=1) then return low end
 local sum,weight=0,0
 local function add(v,w) if v~=nil then sum=sum+clamp(v)*w;weight=weight+w end end
 add(s.count and (s.count-1)/59,.35)
 add(s.tactical and s.count and s.tactical/math.max(s.count,1),.25)
 add(s.gap and 1-clamp(s.gap/150),.30);add(s.instability,.10)
 return math.floor(low+(high-low)*(weight>0 and sum/weight or 0)+.5)
end
return M
