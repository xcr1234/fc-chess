-- Cosmetic FC-style counter. It never changes AI search, move choice or waiting.
local M={}
local function ceiling(seconds) return math.min(40000,1000+math.floor(seconds*1800+1e-8)) end
function M.new() return {elapsed=0,value=0} end
function M.update(counter,dt)
 counter.elapsed=counter.elapsed+dt
 -- Sample at 20 Hz; deriving from elapsed time avoids frame-rate-dependent drift.
 local t=math.floor(counter.elapsed*20+1e-8)/20
 counter.value=math.floor(ceiling(t)*(1-math.exp(-6*t))+1e-8)
end
function M.finish(counter) counter.value=ceiling(counter.elapsed) end
function M.format(counter) return string.format('%05d',counter.value) end
return M
