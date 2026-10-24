-- Rule semantics are explicit; no global mode or shared search cache.
local M={}
function M.get(custom,name)
 name=name or (custom and 'custom-capture-free-advisor-elephant-v1' or 'casual-capture-v1')
 assert(name=='reference-standard-v1' or name=='casual-capture-v1' or name=='custom-capture-free-advisor-elephant-v1','unknown AI rules')
 return {id=name,standard=name=='reference-standard-v1',freeRed=name=='custom-capture-free-advisor-elephant-v1',mate=10000,win=9800}
end
function M.home(sq,side) return (sq<128)==(side==1) end
function M.palace(sq,side)
 local file=sq%16
 return file>=6 and file<=8 and (side==0 and sq>=160 and sq<208 or side==1 and sq>=48 and sq<96)
end
return M
