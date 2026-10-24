local S=require('game.session')
local Audio=require('audio.controller')
require('app.log').enabled=false
local signals,sounds,stops,alive={},{},{},{}
game={ServerSignal=function(name)
 local params={};local signal={}
 for _,kind in ipairs({'Int','Float','Bool'}) do signal['Add'..kind]=function(_,v) params[#params+1]={kind,v} end end
 signal.SendSignal=function() signals[#signals+1]={name=name,params=params} end
 return signal
end,PlayAudio2D=function(id) local instance=#sounds+1;sounds[instance]=id;alive[instance]=true;return instance end,
 IsAudioAlive=function(id) return alive[id] or false end,StopAudio=function(id) stops[#stops+1]=id;alive[id]=false end}
local function check(name,fn) fn();print('PASS '..name) end
check('music IDs use the BGM server signal and never PlayAudio2D',function()
 local s=S.new();local a=Audio.new();Audio.sync(a,s)
 assert(#signals==1 and #sounds==0 and signals[1].name=='FCChessBGM')
 local p=signals[1].params;assert(p[1][1]=='Int' and p[1][2]==10167 and p[2][2]==100 and p[3][1]=='Float' and p[3][2]==117 and p[4][2]==true)
 for i=1,100 do Audio.sync(a,s) end assert(#signals==1)
 S.start(s,'fast');Audio.sync(a,s);S.action(s,'SettingsButton');Audio.sync(a,s);S.action(s,'SettingsBack');S.menu(s);Audio.sync(a,s);assert(#signals==1)
 S.action(s,'SettingsButton');S.action(s,'MusicButton');S.action(s,'PickMusic_10161');Audio.sync(a,s);assert(#signals==2 and signals[2].params[1][2]==10161)
 S.action(s,'SettingsBack');S.start(s,'fast');Audio.sync(a,s);assert(#signals==2)
end)
check('volume and music off emit a muted request but preserve the music namespace',function()
 local s=S.new();local a=Audio.new();Audio.sync(a,s);s.audio.volume=0;Audio.sync(a,s)
 local p=signals[#signals].params;assert(p[1][2]==10167 and p[2][2]==0 and p[4][2]==false)
 s.audio.music=0;s.audio.volume=50;Audio.sync(a,s);p=signals[#signals].params;assert(p[1][2]==0 and p[3][2]==0 and p[4][2]==false)
end)
check('red and black valid moves sound exactly once; selection invalid moves undo and render are silent',function()
 local s=S.new();local a=Audio.new();Audio.sync(a,s);local count=#sounds
 S.start(s,'fast');s.aiInput={computeSeconds=.1,waitSeconds=0,replySequence={{0,3,0,4}}}
 S.square(s,55);S.square(s,64);Audio.sync(a,s);assert(#sounds==count)
 S.square(s,46);Audio.sync(a,s);assert(#sounds==count+1 and sounds[#sounds]==50882)
 S.update(s,.2);Audio.sync(a,s);assert(#sounds==count+2 and sounds[#sounds]==50882)
 S.undo(s);for i=1,20 do Audio.sync(a,s) end assert(#sounds==count+2)
end)
check('turning sound off stops active voices and never replays muted moves after enabling',function()
 local s=S.new();local a=Audio.new();Audio.sync(a,s);s.moveSoundSequence=1;Audio.sync(a,s);local count=#sounds
 s.audio.sfx=false;s.moveSoundSequence=2;Audio.sync(a,s);assert(#sounds==count and #stops>0)
 s.audio.sfx=true;Audio.sync(a,s);assert(#sounds==count)
 s.moveSoundSequence=3;Audio.sync(a,s);assert(#sounds==count+1)
 Audio.destroy(a);local p=signals[#signals].params;assert(p[1][2]==0 and p[2][2]==0 and p[4][2]==false)
end)
