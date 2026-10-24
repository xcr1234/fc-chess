local Catalog=require('audio.catalog')
local M={pageSize=5,catalog=Catalog,categories={'全部','探索','戰鬥','任務','其他'}}
local byId={};for _,track in ipairs(Catalog) do byId[track.id]=track end
local recommended={10167,10029,10161}
function M.new() return {music=10167,volume=100,sfx=true} end
function M.track(id) return byId[id] end
function M.name(id) return id==0 and '無BGM' or (byId[id] and byId[id].name or '無BGM') end
function M.recommended(id) for _,v in ipairs(recommended) do if v==id then return true end end return false end
function M.list(category)
 local list,used={},{}
 local function add(track) if track and not used[track.id] and (category==0 or track.category==category-1) then list[#list+1]=track;used[track.id]=true end end
 for _,id in ipairs(recommended) do add(byId[id]) end
 for _,track in ipairs(Catalog) do add(track) end
 return list
end
function M.pages(s) return math.max(1,math.ceil(#M.list(s.musicCategory)/M.pageSize)) end
function M.action(s,name)
 if name=='SettingsButton' and not s.modal and not s.palette and
  (s.scene=='mode-select' or s.scene=='player-turn' or s.scene=='ai-search' or s.scene=='ai-wait' or s.scene=='result-review') then
  s.settingsReturnScene=s.scene;s.scene='audio-settings';return true
 end
 if s.scene=='audio-settings' then
  if name=='SettingsBack' then s.scene=s.settingsReturnScene or 'mode-select';s.settingsReturnScene=nil
  elseif name=='MusicButton' then s.musicCategory=0;s.musicPage=0;s.scene='music-select'
  elseif name=='VolumeUp' then s.audio.volume=math.min(100,s.audio.volume+10)
  elseif name=='VolumeDown' then s.audio.volume=math.max(0,s.audio.volume-10)
  elseif name=='SfxToggle' then s.audio.sfx=not s.audio.sfx end
  return true
 end
 if s.scene=='music-select' then
  local id=tonumber(name:match('^PickMusic_(%d+)$'));local category=tonumber(name:match('^MusicCategory_(%d)$'))
  if name=='MusicBack' then s.scene='audio-settings'
  elseif name=='MusicOff' then s.audio.music=0;s.scene='audio-settings'
  elseif id and byId[id] then s.audio.music=id;s.scene='audio-settings'
  elseif category and category>=0 and category<=4 then s.musicCategory=category;s.musicPage=0
  elseif name=='MusicNext' then s.musicPage=math.min(M.pages(s)-1,s.musicPage+1)
  elseif name=='MusicPrevious' then s.musicPage=math.max(0,s.musicPage-1) end
  return true
 end
 return false
end
return M
