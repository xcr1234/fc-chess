local M={}
local function clamp(x) return math.max(0,math.min(1,x)) end
-- Extra delay after calculation. Difficult and custom have separate defaults.
M.defaults={minSeconds=20,maxSeconds=40,simpleMinSeconds=10,simpleMaxSeconds=20}
M.customDefaults={minSeconds=4,maxSeconds=16}
local function difficultSeconds(s)
 local d=M.defaults
 if s and s.count==1 then return math.random(d.simpleMinSeconds,d.simpleMaxSeconds) end
 -- One draw: 15% uniform short waits; 85% symmetric triangular normal waits.
 local roll=math.random(1,10000)
 if roll<=1500 then return d.simpleMinSeconds+math.floor((roll-1)*(d.simpleMaxSeconds-d.simpleMinSeconds+1)/1500) end
 local u=(roll-1501)/8499
 local q=u<.5 and math.sqrt(u/2) or 1-math.sqrt((1-u)/2)
 return math.floor(d.minSeconds+(d.maxSeconds-d.minSeconds)*q+.5)
end
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
 -- Book hits and missing summaries take the same probability draw as search.
 if mode=='difficult' and automatic then return difficultSeconds(s) end
 if not s or (s.count and s.count<=1) then return simple end
 local sum,weight=0,0
 local function add(v,w) if v~=nil then sum=sum+clamp(v)*w;weight=weight+w end end
 add(s.count and (s.count-1)/59,.35)
 add(s.tactical and s.count and s.tactical/math.max(s.count,1),.25)
 add(s.gap and 1-clamp(s.gap/150),.30);add(s.instability,.10)
 return math.floor(low+(high-low)*(weight>0 and sum/weight or 0)+.5)
end
return M
