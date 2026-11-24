local S=require('game.session')
local B=require('game.board')
local Audio=require('audio.controller')
require('app.log').enabled=false
local sounds,alive={},{ }
game={ServerSignal=function()local s={}for _,n in ipairs({'AddInt','AddFloat','AddBool','SendSignal'})do s[n]=function()end end return s end,
 PlayAudio2D=function(id)local i=#sounds+1;sounds[i]=id;alive[i]=true;return i end,
 IsAudioAlive=function(i)return alive[i]or false end,StopAudio=function(i)alive[i]=false end}
local function board(rows)local b={}for i=1,90 do b[i]=''end for _,p in ipairs(rows)do b[B.index(p[1],p[2])]=p[3]end return b end
local function setup(rows)local s=S.new();S.start(s,'fast',rows and board(rows));s.aiInput='hold';return s,Audio.new()end
local failures=0
local function check(name,fn)sounds={};alive={};local ok,err=pcall(fn);print((ok and 'PASS 'or'FAIL ')..name..(ok and ''or': '..tostring(err)));if not ok then failures=failures+1 end end
check('capturing black king plays the normal move followed by victory once',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{4,5,'R'}});S.square(s,B.index(4,5));S.square(s,B.index(4,0));Audio.sync(a,s)
 assert(s.scene=='result'and #sounds==2 and sounds[1]==50882 and sounds[2]==50228)
 for i=1,20 do Audio.sync(a,s)end assert(#sounds==2)
end)
check('black capturing red king plays defeat',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{0,6,'P'},{3,8,'r'}})
 s.aiInput={computeSeconds=.1,waitSeconds=0,replySequence={{3,8,3,9}}};S.square(s,B.index(0,6));S.square(s,B.index(0,5));Audio.sync(a,s);S.update(s,.2);Audio.sync(a,s)
 assert(s.scene=='result'and #sounds==3 and sounds[1]==50882 and sounds[2]==50882 and sounds[3]==50265)
end)
check('only confirmed resignation plays defeat and later games can play again',function()
 local s,a=setup();S.action(s,'ResignButton');S.action(s,'ConfirmNo');Audio.sync(a,s);assert(#sounds==0)
 for i=1,2 do
  S.action(s,'ResignButton');S.action(s,'ConfirmYes');Audio.sync(a,s);assert(#sounds==i and sounds[i]==50265)
  S.action(s,'RestartButton');Audio.sync(a,s)
 end
end)
check('sound off consumes the result event without replay on enable',function()
 local s,a=setup();s.audio.sfx=false;S.action(s,'ResignButton');S.action(s,'ConfirmYes');Audio.sync(a,s);assert(#sounds==0)
 s.audio.sfx=true;Audio.sync(a,s);assert(#sounds==0)
end)
check('neutral inability to continue has no victory or defeat sound',function()
 local s,a=setup();S.finish(s,'本局无法继续','双方暂无可走棋');Audio.sync(a,s);assert(#sounds==0)
end)
assert(failures==0,tostring(failures)..' result audio failures')
