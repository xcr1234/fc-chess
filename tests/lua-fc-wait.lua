local W=require('game.wait')
local S=require('game.session')
require('app.log').enabled=false
local failures=0
local function check(name,fn)
 local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)))
 if not ok then failures=failures+1 end
end
local function withRandom(value,fn)
 local original=math.random;local calls=0
 math.random=function(low,high) assert(low==10 and high==20);calls=calls+1;return value end
 local ok,err=pcall(fn);math.random=original;assert(ok,err);return calls
end
local complex={count=60,tactical=60,gap=0,instability=1}
check('ordinary difficult targets span 20 to 40 with a 30 second midpoint',function()
 assert(W.seconds('difficult',{count=2,tactical=0,gap=150,instability=0})==20)
 assert(W.seconds('difficult',{count=30,tactical=15,gap=75,instability=.5})==30)
 assert(W.seconds('difficult',complex)==40)
end)
check('one available move draws one integer from ten through twenty',function()
 assert(withRandom(10,function() assert(W.seconds('difficult',{count=1,tactical=1,gap=0,instability=1})==10) end)==1)
 assert(withRandom(20,function() assert(W.seconds('difficult',{count=1})==20) end)==1)
 math.randomseed(391)
 local seen={};for i=1,64 do local n=W.seconds('difficult',{count=1});assert(n>=10 and n<=20 and n==math.floor(n));seen[n]=true end
 local distinct=0;for _ in pairs(seen) do distinct=distinct+1 end;assert(distinct>1)
 assert(W.seconds('difficult',{count=2,tactical=0})>=20)
end)
check('unknown book metrics use thirty seconds; partial summaries are reweighted',function()
 assert(W.seconds('difficult',nil)==30)
 assert(W.seconds('difficult',{})==30)
 assert(W.seconds('difficult',{count=0,tactical=0})==30)
 assert(W.seconds('difficult',{count=30,tactical=10})==29)
end)
check('custom and fast retain their original timing and policy overrides still work',function()
 assert(W.seconds('custom',{count=1})==4 and W.seconds('custom',complex)==16)
 assert(W.seconds('custom',{count=30,tactical=10})==9)
 assert(W.seconds('fast',complex)==0)
 assert(W.seconds('difficult',{count=1},{minSeconds=8,maxSeconds=24})==8)
 assert(W.seconds('custom',complex,{minSeconds=8,maxSeconds=24})==24)
end)
local function setup(mode,compute)
 local s=S.new();S.start(s,mode);s.aiInput='hold';S.commit(s,{55,46});S.update(s,compute)
 assert(s.scene=='ai-search' and s.moves==1);return s
end
check('difficult waits the full ten seconds after three seconds of calculation',function()
 local s=setup('difficult',3);assert(withRandom(10,function() S.computed(s,{28,37},{count=1}) end)==1)
 assert(s.extraWait==10 and s.remaining==10)
 S.update(s,9.9);assert(s.moves==1);S.update(s,.1);assert(s.moves==2 and s.scene=='player-turn')
end)
check('even a long calculation does not consume the artificial wait',function()
 local s=setup('difficult',12);withRandom(10,function() S.computed(s,{28,37},{count=1}) end)
 assert(s.extraWait==10 and s.moves==1 and s.scene=='ai-wait')
 S.update(s,10);assert(s.moves==2 and s.scene=='player-turn')
end)
check('custom still adds its delay after compute and diagnostic wait overrides remain exact',function()
 local s=setup('custom',3);S.computed(s,{28,37},{count=1});assert(s.extraWait==4)
 s=setup('difficult',3);s.aiInput={waitSeconds=2};S.computed(s,{28,37},complex);assert(s.extraWait==2)
end)
assert(failures==0,tostring(failures)..' FC wait failures')
