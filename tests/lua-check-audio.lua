local B=require('game.board')
local S=require('game.session')
local Audio=require('audio.controller')
require('app.log').enabled=false
local failures=0
local function check(name,fn) local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)));if not ok then failures=failures+1 end end
local function board(rows)
 local b={} for i=1,90 do b[i]='' end
 for _,p in ipairs(rows) do b[B.index(p[1],p[2])]=p[3] end return b
end
check('rook, cannon screens and horse legs detect real attacks only',function()
 local b=board({{3,9,'K'},{4,0,'k'},{4,5,'R'}});assert(B.threatensKing(b,'red',false));b[B.index(4,3)]='P';assert(not B.threatensKing(b,'red',false))
 b[B.index(4,5)]='C';assert(B.threatensKing(b,'red',false));b[B.index(4,2)]='p';assert(not B.threatensKing(b,'red',false));b[B.index(4,3)]='';b[B.index(4,2)]='';assert(not B.threatensKing(b,'red',false))
 b[B.index(4,5)]='';b[B.index(3,2)]='N';assert(B.threatensKing(b,'red',false));b[B.index(3,1)]='p';assert(not B.threatensKing(b,'red',false))
end)
check('pawn directions, crossed river and facing generals use current profiles',function()
 local b=board({{3,9,'K'},{4,0,'k'},{4,1,'P'}});assert(B.threatensKing(b,'red',false));b[B.index(4,1)]='';b[B.index(3,0)]='P';assert(B.threatensKing(b,'red',false))
 b=board({{4,9,'K'},{3,0,'k'},{4,8,'p'}});assert(B.threatensKing(b,'black',false));b[B.index(4,8)]='';b[B.index(3,9)]='p';assert(B.threatensKing(b,'black',false))
 b=board({{4,9,'K'},{4,0,'k'}});assert(B.threatensKing(b,'red',false) and B.threatensKing(b,'black',false));b[B.index(4,5)]='p';assert(not B.threatensKing(b,'red',false))
end)
check('custom red advisors and elephants can threaten across the river',function()
 for _,p in ipairs({{3,1,'A'},{2,2,'E'}}) do
  local b=board({{3,9,'K'},{4,0,'k'},p});assert(not B.threatensKing(b,'red',false));assert(B.threatensKing(b,'red',true))
 end
 local b=board({{4,9,'K'},{3,0,'k'},{3,8,'a'}});assert(not B.threatensKing(b,'black',true))
end)
local sounds,alive={},{}
game={ServerSignal=function() return {AddInt=function()end,AddFloat=function()end,AddBool=function()end,SendSignal=function()end} end,
 PlayAudio2D=function(id) sounds[#sounds+1]=id;alive[#sounds]=true;return #sounds end,
 IsAudioAlive=function(id)return alive[id] or false end,StopAudio=function(id)alive[id]=false end}
local function setup(rows,side)
 sounds={};alive={};local s=S.new();S.start(s,'difficult',board(rows));s.aiInput='hold';s.turn=side or 'red';return s,Audio.new()
end
local function commit(s,a,x,y,u,v)assert(S.commit(s,{B.index(x,y),B.index(u,v)}));if a then Audio.sync(a,s) end end
check('checking moves replace normal sound once; repeated render, select and undo stay silent',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{0,5,'R'}});Audio.sync(a,s);assert(#sounds==0)
 commit(s,a,0,5,4,5);assert(#sounds==1 and sounds[1]==50888)
 for i=1,10 do Audio.sync(a,s) end S.undo(s);Audio.sync(a,s);assert(#sounds==1)
 S.square(s,B.index(0,5));S.square(s,B.index(1,4));Audio.sync(a,s);assert(#sounds==1)
end)
check('black checking move and discovered double attack each play one check sound',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{0,8,'r'}},'black');commit(s,a,0,8,3,8);assert(#sounds==1 and sounds[1]==50888)
 s,a=setup({{3,9,'K'},{4,0,'k'},{4,6,'R'},{4,4,'N'},{0,1,'R'}});commit(s,a,4,4,5,2);assert(#sounds==1 and sounds[1]==50888)
end)
check('queued normal and check moves keep their own sounds and consume events',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{0,6,'P'},{0,8,'r'}})
 commit(s,nil,0,6,0,5);commit(s,nil,0,8,3,8);Audio.sync(a,s)
 assert(#sounds==2 and sounds[1]==50882 and sounds[2]==50888);assert(next(s.moveSoundChecks)==nil)
end)
check('mute consumes check events; no replay on enable or restart',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{0,5,'R'}});s.audio.sfx=false;commit(s,a,0,5,4,5);assert(#sounds==0 and next(s.moveSoundChecks)==nil)
 s.audio.sfx=true;Audio.sync(a,s);S.start(s,'fast');Audio.sync(a,s);assert(#sounds==0)
end)
check('capturing a king has no check sound and missing king is not threatened',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{4,5,'R'}});commit(s,a,4,5,4,0)
 assert(s.scene=='result' and #sounds==2 and sounds[1]==50882 and sounds[2]==50228);assert(not B.threatensKing(s.board,'red',false))
end)
check('ignoring check remains legal and continuous checking moves each sound once',function()
 local s,a=setup({{3,9,'K'},{4,0,'k'},{0,5,'R'},{8,3,'p'}})
 commit(s,a,0,5,4,5);assert(B.threatensKing(s.board,'red',false));commit(s,a,8,3,8,4)
 commit(s,a,4,5,4,4);assert(s.moves==3 and sounds[1]==50888 and sounds[2]==50882 and sounds[3]==50888)
end)
assert(failures==0,tostring(failures)..' check audio failures')
