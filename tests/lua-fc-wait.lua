local W=require('game.wait')
local S=require('game.session')
require('app.log').enabled=false
local failures=0
local function check(name,fn)
 local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)))
 if not ok then failures=failures+1 end
end
local function withRandom(value,fn,low,high)
 local original=math.random;local calls=0
 math.random=function(a,b) assert(a==(low or 10) and b==(high or 20));calls=calls+1;return value end
 local ok,err=pcall(fn);math.random=original;assert(ok,err);return calls
end
local complex={count=60,tactical=60,gap=0,instability=1}
local function setup(mode,compute)
 local s=S.new();S.start(s,mode);s.aiInput='hold';S.commit(s,{55,46});S.update(s,compute)
 assert(s.scene=='ai-search' and s.moves==1);return s
end
check('ordinary difficult draws short and normal waits at probability boundaries',function()
 for _,sample in ipairs({{1,10},{1500,20},{1501,20},{5750,30},{10000,40}}) do
  assert(withRandom(sample[1],function() assert(W.seconds('difficult',complex)==sample[2]) end,1,10000)==1)
 end
end)
check('uniform rolls give fifteen percent short slots and normal waits centered on thirty',function()
 local counts={};local sum,normalSum=0,0
 for roll=1,10000 do
  withRandom(roll,function()
   local n=W.seconds('difficult',complex);assert(n>=10 and n<=40 and n==math.floor(n))
   if roll<=1500 then assert(n>=10 and n<=20) else assert(n>=20 and n<=40);normalSum=normalSum+n end
   counts[n]=(counts[n] or 0)+1;sum=sum+n
  end,1,10000)
 end
 local short=0;for n=10,19 do short=short+(counts[n] or 0) end
 assert(short>=1300 and short<=1400,'short waits too rare or too common')
 assert(math.abs(normalSum/8500-30)<.01 and math.abs(sum/10000-27.75)<.01)
 assert(counts[30]>counts[25] and counts[25]>counts[20],'normal waits not concentrated near thirty')
end)
check('one available move draws one integer from ten through twenty',function()
 assert(withRandom(10,function() assert(W.seconds('difficult',{count=1,tactical=1,gap=0,instability=1})==10) end)==1)
 assert(withRandom(20,function() assert(W.seconds('difficult',{count=1})==20) end)==1)
 math.randomseed(391)
 local seen={};for i=1,64 do local n=W.seconds('difficult',{count=1});assert(n>=10 and n<=20 and n==math.floor(n));seen[n]=true end
 local distinct=0;for _ in pairs(seen) do distinct=distinct+1 end;assert(distinct>1)
end)
check('book, missing, partial and large summaries all participate in the same draw',function()
 for _,summary in ipairs({false,{},{count=0,tactical=0},{count=30,tactical=10},{count=300,tactical=300}}) do
  for _,sample in ipairs({{1,10},{5750,30},{10000,40}}) do
   assert(withRandom(sample[1],function() assert(W.seconds('difficult',summary or nil)==sample[2]) end,1,10000)==1)
  end
 end
end)
check('ordinary waits are selected once, survive updates, and add to calculation time',function()
 local s=setup('difficult',12)
 assert(withRandom(5750,function() S.computed(s,{28,37},complex);S.update(s,5);S.update(s,5) end,1,10000)==1)
 assert(s.extraWait==30 and s.remaining==20 and s.scene=='ai-wait')
 S.update(s,19.9);assert(s.moves==1);S.update(s,.1);assert(s.moves==2)
end)
check('custom and fast retain their original timing and policy overrides still work',function()
 assert(W.seconds('custom',{count=1})==4 and W.seconds('custom',complex)==16)
 assert(W.seconds('custom',{count=30,tactical=10})==9)
 assert(W.seconds('fast',complex)==0)
 assert(W.seconds('difficult',{count=1},{minSeconds=8,maxSeconds=24})==8)
 assert(W.seconds('custom',complex,{minSeconds=8,maxSeconds=24})==24)
end)
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
