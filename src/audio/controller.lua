local Settings=require('audio.settings')
local Log=require('app.log')
local M={moveSoundId=50882,checkSoundId=50888,resultSoundIds={win=50228,lose=50265},signalName='FCChessBGM'}
function M.new() return {sequence=0,resultSequence=0,voices={}} end
local function stopMoves(self)
 for instance,kind in pairs(self.voices) do
  if kind=='move' or kind=='check' then game.StopAudio(instance);self.voices[instance]=nil end
 end
end
local function play(self,id,kind)
 if kind=='check' or kind=='result' then stopMoves(self)
 elseif kind=='move' then
  for _,voice in pairs(self.voices) do if voice=='check' then return end end
 end
 local instance=game.PlayAudio2D(id);self.voices[instance]=kind
end
local function request(id,volume,seconds,enabled)
 local signal=game.ServerSignal(M.signalName)
 signal:AddInt(id);signal:AddInt(volume);signal:AddFloat(seconds);signal:AddBool(enabled);signal:SendSignal()
 Log.event('bgm-request','id='..id..' volume='..volume..' enabled='..tostring(enabled))
end
function M.sync(self,s,presentation)
 local id=s.audio.music;local track=Settings.track(id)
 local enabled=track~=nil and s.audio.volume>0
 local key=id..':'..s.audio.volume
 if self.key~=key then request(id,s.audio.volume,track and track.seconds or 0,enabled);self.key=key end
 for instance in pairs(self.voices) do if not game.IsAudioAlive(instance) then self.voices[instance]=nil end end
 local discard=presentation and presentation.discard or 0
 for i=self.sequence+1,discard do s.moveSoundChecks[i]=nil end
 self.sequence=math.max(self.sequence,discard)
 local through=presentation and presentation.landed or s.moveSoundSequence
 local resultThrough=(not presentation or not presentation.busy) and s.resultSoundSequence or self.resultSequence
 if s.audio.sfx then
  local hasCheck=false
  for i=self.sequence+1,through do hasCheck=hasCheck or s.moveSoundChecks[i] end
  for i=self.sequence+1,through do
   local checking=s.moveSoundChecks[i]
   if checking or not hasCheck then play(self,checking and M.checkSoundId or M.moveSoundId,checking and 'check' or 'move') end
  end
  for i=self.resultSequence+1,resultThrough do
   local id=M.resultSoundIds[s.resultSoundOutcomes[i]]
   if id then play(self,id,'result') end
  end
 else
  for instance in pairs(self.voices) do game.StopAudio(instance);self.voices[instance]=nil end
  through=s.moveSoundSequence;resultThrough=s.resultSoundSequence
 end
 for i=self.sequence+1,through do s.moveSoundChecks[i]=nil end
 self.sequence=math.max(self.sequence,through)
 for i=self.resultSequence+1,resultThrough do s.resultSoundOutcomes[i]=nil end
 self.resultSequence=math.max(self.resultSequence,resultThrough)
end
function M.destroy(self)
 for instance in pairs(self.voices) do if game.IsAudioAlive(instance) then game.StopAudio(instance) end end
 self.voices={};request(0,0,0,false);self.key=nil
end
return M
