local Audio=require('audio.controller')
local S=require('game.session')
local B=require('game.board')
require('app.log').enabled=false
local sounds,alive,stops={},{},{}
game={ServerSignal=function()return {AddInt=function()end,AddFloat=function()end,AddBool=function()end,SendSignal=function()end}end,
 PlayAudio2D=function(id)local n=#sounds+1;sounds[n]=id;alive[n]=true;return n end,
 IsAudioAlive=function(i)return alive[i] or false end,StopAudio=function(i)alive[i]=false;stops[#stops+1]=i end}
local function setup()
 sounds={};alive={};stops={};local board={} for i=1,90 do board[i]='' end
 for _,p in ipairs({{3,9,'K'},{4,0,'k'},{0,6,'P'},{0,8,'r'}})do board[B.index(p[1],p[2])]=p[3] end
 local s=S.new();S.start(s,'difficult',board);s.aiInput='hold'
 return s,Audio.new()
end
local s,a=setup();S.commit(s,{55,46});S.commit(s,{73,76})
Audio.sync(a,s,{landed=0,discard=0,busy=true})
assert(#sounds==0,'move sounds played before either piece landed')
Audio.sync(a,s,{landed=1,discard=0,busy=true});assert(#sounds==1 and sounds[1]==50882)
Audio.sync(a,s,{landed=2,discard=0,busy=false});assert(#sounds==2 and sounds[2]==50888 and not alive[1] and alive[2])
Audio.sync(a,s,{landed=2,discard=0,busy=false});assert(#sounds==2)
print('PASS rapid normal and check sound at separate landings; check stops ordinary tail')
s.moveSoundSequence=3;s.moveSoundChecks[3]=false;Audio.sync(a,s,{landed=3,discard=0,busy=false})
assert(#sounds==2 and alive[2],'ordinary move masked active check sound')
alive[2]=false;s.moveSoundSequence=4;Audio.sync(a,s,{landed=4,discard=0,busy=false})
assert(#sounds==3 and sounds[3]==50882)
print('PASS normal sounds yield while check is alive, then resume on future moves')
s,a=setup();S.commit(s,{55,46});S.commit(s,{73,76});Audio.sync(a,s,{landed=2,discard=0,busy=false})
assert(#sounds==1 and sounds[1]==50888)
print('PASS large frame coalesces ordinary and checking landings into one check')
s,a=setup();S.commit(s,{55,46});Audio.sync(a,s,{landed=0,discard=0,busy=true});S.undo(s)
Audio.sync(a,s,{landed=1,discard=1,busy=false});assert(#sounds==0 and next(s.moveSoundChecks)==nil)
print('PASS interrupted movement discards unplayed sound on undo')
s,a=setup();S.commit(s,{55,46});s.audio.sfx=false;Audio.sync(a,s,{landed=0,discard=0,busy=true});s.audio.sfx=true
Audio.sync(a,s,{landed=1,discard=0,busy=false});assert(#sounds==0)
print('PASS mute consumes unfinished move events without replay after enabling')
s,a=setup();s.board[B.index(4,5)]='R';s.board[B.index(0,6)]='';S.commit(s,{50,5})
Audio.sync(a,s,{landed=0,discard=0,busy=true});assert(#sounds==0)
Audio.sync(a,s,{landed=1,discard=0,busy=false});assert(#sounds==2 and sounds[1]==50882 and sounds[2]==50228 and not alive[1])
print('PASS result waits for last landing and stops residual move sound')
local Motion=require('ui.move_animation');s,a=setup();local motion=Motion.new();Motion.sync(motion,s,true)
S.commit(s,{55,46});S.commit(s,{73,76});Motion.sync(motion,s,true);Audio.sync(a,s,Motion.soundState(motion));assert(#sounds==0)
Motion.update(motion,.16);Audio.sync(a,s,Motion.soundState(motion));assert(#sounds==1 and sounds[1]==50882)
Motion.update(motion,.42);Audio.sync(a,s,Motion.soundState(motion));assert(#sounds==2 and sounds[2]==50888)
print('PASS real motion queue releases sound only at each landing')
