local S=require('game.session')
local W=require('game.wait')
require('app.log').enabled=false
local function setup(mode)
 local s=S.new();S.start(s,mode);s.waitPolicy={minSeconds=8,maxSeconds=24};s.aiInput='hold';S.commit(s,{55,46});S.computed(s,{28,37},{count=1});return s
end
for _,mode in ipairs({'difficult','custom'}) do
 local s=setup(mode);assert(s.extraWait==8 and s.remaining==8)
 S.update(s,2);assert(S.extendWait(s,5));assert(s.extraWait==13 and s.remaining==11)
 S.update(s,10);assert(s.moves==1);S.update(s,1);assert(s.moves==2)
 assert(not S.extendWait(s,5))
 s=setup(mode);S.action(s,'ResignButton');S.update(s,9);assert(s.ready)
 assert(S.extendWait(s,3) and not s.ready);S.action(s,'ConfirmNo');assert(s.moves==1)
 S.update(s,3);assert(s.moves==2)
 s=setup(mode);assert(not S.extendWait(s,-1));assert(not S.extendWait(s,0/0));S.undo(s);assert(not S.extendWait(s,5) and s.remaining==0)
 print('PASS '..mode..' configurable wait, extension, modal, undo')
end
local s=setup('fast');assert(s.moves==2 and not S.extendWait(s,5))
assert(W.seconds('fast',{count=60},{minSeconds=100,maxSeconds=200})==0)
print('PASS fast has no artificial delay')
