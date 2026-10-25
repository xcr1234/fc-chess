local S=require('game.session')
local B=require('game.board')
local C=require('app.completion')
require('app.log').enabled=false
local failures,forbidden=0,0
local requests,failSend,attempts={},false,0
game=setmetatable({ServerSignal=function(name)
 attempts=attempts+1
 if failSend then error('unconfigured signal') end
 local values={};local signal={}
 function signal:AddBool(value) values[#values+1]={'Bool',value} end
 function signal:AddInt(value) values[#values+1]={'Int',value} end
 function signal:SendSignal() requests[#requests+1]={name=name,params=values} end
 return signal
end},{__index=function(_,name)return function()forbidden=forbidden+1;error('unexpected platform call '..name)end end})
local function check(name,fn)
 requests={};failSend=false;attempts=0
 local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)));if not ok then failures=failures+1 end
end
local function expect(index)
 local r=requests[index];assert(r and r.name=='FCChessWin','wrong victory signal')
 assert(#r.params==0,'victory signal must have no parameters')
end
local function empty()local b={}for i=1,90 do b[i]='' end return b end
local function win(s)
 local b=empty();b[B.index(3,9)]='K';b[B.index(4,0)]='k';b[B.index(4,5)]='R'
 S.start(s,'difficult',b);S.square(s,B.index(4,5));S.square(s,B.index(4,0));assert(s.scene=='result')
end
check('cold session menus and starting send no reset or completion',function()
 local s=S.new();local c=C.new();C.sync(c,s);assert(#requests==0)
 for i=1,10 do C.sync(c,s) end
 S.action(s,'ModeCustom');S.action(s,'AllRooksButton');C.sync(c,s);S.menu(s);C.sync(c,s)
 assert(#requests==0 and attempts==0)
end)
check('real king capture sends victory once even after result audio has consumed its events',function()
 local s=S.new();local c=C.new();C.sync(c,s);win(s);s.resultSoundOutcomes={};C.sync(c,s);expect(1)
 for i=1,20 do S.update(s,1);C.sync(c,s) end assert(#requests==1)
end)
check('real defeat never notifies the server',function()
 local s=S.new();local c=C.new();C.sync(c,s)
 local b=empty();b[B.index(3,9)]='K';b[B.index(4,0)]='k';b[B.index(0,6)]='P';b[B.index(3,8)]='r'
 S.start(s,'difficult',b);s.aiInput={computeSeconds=.1,waitSeconds=0,replySequence={{3,8,3,9}}}
 S.square(s,B.index(0,6));S.square(s,B.index(0,5));S.update(s,.2);assert(s.scene=='result');C.sync(c,s);assert(#requests==0 and attempts==0)
end)
check('cancelled and confirmed resignation never notify the server',function()
 local s=S.new();local c=C.new();C.sync(c,s);S.start(s,'fast')
 S.action(s,'ResignButton');C.sync(c,s);S.action(s,'ConfirmNo');C.sync(c,s);assert(#requests==0)
 S.action(s,'ResignButton');S.action(s,'ConfirmYes');C.sync(c,s);assert(#requests==0 and attempts==0)
end)
check('review undo restart menu and later loss cannot revoke a victory',function()
 local s=S.new();local c=C.new();C.sync(c,s);win(s);C.sync(c,s);expect(1)
 S.action(s,'ReturnBoardButton');S.action(s,'UndoButton');S.action(s,'ConfirmYes');C.sync(c,s);assert(s.scene=='player-turn')
 S.start(s,'fast');C.sync(c,s);S.menu(s);C.sync(c,s);S.cancel(s,'destroy');C.sync(c,s);assert(#requests==1)
 S.start(s,'fast');S.action(s,'ResignButton');S.action(s,'ConfirmYes');C.sync(c,s);assert(#requests==1)
 local fresh=S.new();C.sync(C.new(),fresh);assert(#requests==1,'recreated client must not reset server result')
end)
check('neutral result sends nothing and cannot overwrite an earlier win',function()
 local s=S.new();local c=C.new();C.sync(c,s);S.start(s,'fast');S.finish(s,'本局無法繼續','雙方暫無可走棋');C.sync(c,s);assert(#requests==0 and attempts==0)
 win(s);C.sync(c,s);expect(1);S.start(s,'fast');S.finish(s,'本局無法繼續','雙方暫無可走棋');C.sync(c,s);assert(#requests==1 and attempts==1)
end)
check('missing signal cannot crash or retry every frame; next victory can retry',function()
 local s=S.new();local c=C.new();failSend=true;C.sync(c,s);assert(attempts==0)
 win(s);C.sync(c,s);for i=1,10 do C.sync(c,s) end;assert(#requests==0 and attempts==1)
 failSend=false;win(s);C.sync(c,s);expect(1);assert(s.scene=='result' and attempts==2)
end)
assert(forbidden==0,'forced platform/level call attempted')
assert(failures==0,tostring(failures)..' completion failures')
