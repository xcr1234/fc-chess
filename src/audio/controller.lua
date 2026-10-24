local Settings=require('audio.settings')
local Log=require('app.log')
local M={moveSoundId=50882,signalName='FCChessBGM'}
function M.new() return {sequence=0,voices={}} end
local function request(id,volume,seconds,enabled)
 local signal=game.ServerSignal(M.signalName)
 signal:AddInt(id);signal:AddInt(volume);signal:AddFloat(seconds);signal:AddBool(enabled);signal:SendSignal()
 Log.event('bgm-request','id='..id..' volume='..volume..' enabled='..tostring(enabled))
end
function M.sync(self,s)
 local menu=s.scene=='mode-select' or s.scene=='audio-settings' or s.scene=='music-select' or s.scene=='custom-edit'
 local id=s.audio[menu and 'title' or 'board'];local track=Settings.track(id)
 local enabled=track~=nil and s.audio.volume>0
 local key=id..':'..s.audio.volume
 if self.key~=key then request(id,s.audio.volume,track and track.seconds or 0,enabled);self.key=key end
 for instance in pairs(self.voices) do if not game.IsAudioAlive(instance) then self.voices[instance]=nil end end
 if s.audio.sfx then
  for i=self.sequence+1,s.moveSoundSequence do local instance=game.PlayAudio2D(M.moveSoundId);self.voices[instance]=true end
 else
  for instance in pairs(self.voices) do game.StopAudio(instance);self.voices[instance]=nil end
 end
 self.sequence=s.moveSoundSequence
end
function M.destroy(self)
 for instance in pairs(self.voices) do if game.IsAudioAlive(instance) then game.StopAudio(instance) end end
 self.voices={};request(0,0,0,false);self.key=nil
end
return M
