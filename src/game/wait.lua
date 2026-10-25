local M={}
local function clamp(x) return math.max(0,math.min(1,x)) end
-- Extra delay after calculation. Difficult and custom have separate defaults.
M.defaults={minSeconds=20,maxSeconds=40,simpleMinSeconds=10,simpleMaxSeconds=20}
M.customDefaults={minSeconds=4,maxSeconds=16}
function M.seconds(mode,s,policy)
 if mode=='fast' then return 0 end
 local defaults=mode=='custom' and M.customDefaults or M.defaults
 local automatic=policy==nil
 policy=policy or defaults
 local low=policy.minSeconds or defaults.minSeconds
 local high=policy.maxSeconds or defaults.maxSeconds
 local simple=policy.simpleSeconds or low
 assert(type(low)=='number' and type(high)=='number' and low>=0 and high>=low and high<math.huge,'Invalid wait policy')
 assert(type(simple)=='number' and simple>=0 and simple<=high,'Invalid simple wait')
 -- Book hits and unfinished summaries have no measured branching factor.
 -- Missing evidence should not make every such reply an unusually short move.
 if mode=='difficult' and automatic and (not s or next(s)==nil or s.count==0) then return math.floor((low+high)/2+.5) end
 if mode=='difficult' and automatic and s and s.count==1 then return math.random(defaults.simpleMinSeconds,defaults.simpleMaxSeconds) end
 if not s or (s.count and s.count<=1) then return simple end
 local sum,weight=0,0
 local function add(v,w) if v~=nil then sum=sum+clamp(v)*w;weight=weight+w end end
 add(s.count and (s.count-1)/59,.35)
 add(s.tactical and s.count and s.tactical/math.max(s.count,1),.25)
 add(s.gap and 1-clamp(s.gap/150),.30);add(s.instability,.10)
 return math.floor(low+(high-low)*(weight>0 and sum/weight or 0)+.5)
end
return M
