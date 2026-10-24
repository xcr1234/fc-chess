local S=require('game.session')
local Settings=require('audio.settings')
require('app.log').enabled=false
local failures=0
local function check(name,fn)
 local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)));if not ok then failures=failures+1 end
end
check('title settings entry and nested back do not start a game',function()
 local s=S.new();S.action(s,'SettingsButton');assert(s.scene=='audio-settings','settings entry missing')
 S.action(s,'TitleMusicButton');assert(s.scene=='music-select' and s.musicTarget=='title')
 S.action(s,'MusicBack');assert(s.scene=='audio-settings');S.action(s,'SettingsBack');assert(s.scene=='mode-select' and s.moves==0)
end)
check('title and board choices and off are independent',function()
 local s=S.new();assert(s.audio,'audio preferences missing');S.action(s,'SettingsButton');S.action(s,'TitleMusicButton')
 S.action(s,'PickMusic_10161');assert(s.audio.title==10161 and s.audio.board==10029 and s.scene=='audio-settings')
 S.action(s,'BoardMusicButton');S.action(s,'MusicOff');assert(s.audio.board==0 and s.audio.title==10161)
 S.action(s,'SettingsBack');S.action(s,'ModeFast');S.menu(s);assert(s.audio.board==0 and s.audio.title==10161)
end)
check('volume clamps and mute does not erase chosen music',function()
 local s=S.new();assert(s.audio and s.audio.volume==30);S.action(s,'SettingsButton')
 for i=1,20 do S.action(s,'VolumeDown') end assert(s.audio.volume==0 and s.audio.title==10167)
 for i=1,30 do S.action(s,'VolumeUp') end assert(s.audio.volume==100)
end)
check('sound toggle is independent of music and persists through a new match',function()
 local s=S.new();assert(s.audio and s.audio.sfx);S.action(s,'SettingsButton');S.action(s,'SfxToggle');assert(not s.audio.sfx and s.audio.title==10167)
 S.action(s,'SettingsBack');S.start(s,'difficult');s.aiInput='hold';S.square(s,55);S.square(s,46);S.undo(s)
 assert(not s.audio.sfx and s.audio.volume==30)
end)
check('settings and music operations cannot change a live game',function()
 local s=S.new();assert(s.audio);S.start(s,'difficult');S.action(s,'SettingsButton');S.action(s,'PickMusic_10002');S.action(s,'VolumeDown')
 assert(s.scene=='player-turn' and s.audio.title==10167 and s.audio.volume==30)
end)
check('only real commits advance the sound sequence, including both sides',function()
 local s=S.new();assert(s.moveSoundSequence==0,'sound event sequence missing');S.start(s,'fast');s.aiInput={computeSeconds=.1,waitSeconds=0,replySequence={{0,3,0,4}}}
 S.square(s,55);S.square(s,64);assert(s.moveSoundSequence==0);S.square(s,46);assert(s.moveSoundSequence==1)
 S.update(s,.2);assert(s.moveSoundSequence==2);S.undo(s);assert(s.moveSoundSequence==2)
end)
check('all 188 tracks are reachable once and recommendations lead each full list',function()
 for _,target in ipairs({'title','board'}) do
  local list=Settings.list(target,0);assert(#list==188 and Settings.recommended(target,list[1].id));local seen={}
  for _,track in ipairs(list) do assert(not seen[track.id]);seen[track.id]=true end
  local union={} for category=1,4 do for _,track in ipairs(Settings.list(target,category)) do assert(track.category==category-1);union[track.id]=true end end
  for id in pairs(seen) do assert(union[id]) end
 end
 local s=S.new();S.action(s,'SettingsButton');S.action(s,'TitleMusicButton');S.action(s,'PickMusic_50882');assert(s.audio.title==10167 and s.scene=='music-select')
 for i=1,100 do S.action(s,'MusicNext') end assert(s.musicPage==Settings.pages(s)-1)
 S.action(s,'MusicCategory_4');assert(s.musicPage==0);for i=1,100 do S.action(s,'MusicPrevious') end assert(s.musicPage==0)
end)
assert(failures==0,tostring(failures)..' audio setting failures')
