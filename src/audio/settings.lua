local Catalog=require('audio.catalog')
local M={pageSize=5,catalog=Catalog,categories={'全部','探索','戰鬥','任務','其他'}}
local byId={};for _,track in ipairs(Catalog) do byId[track.id]=track end
local recommended={title={10167,10161},board={10029,10167}}
function M.new() return {title=10167,board=10029,volume=30,sfx=true} end
function M.track(id) return byId[id] end
function M.name(id) return id==0 and '無BGM' or (byId[id] and byId[id].name or '無BGM') end
function M.recommended(target,id) for _,v in ipairs(recommended[target] or {}) do if v==id then return true end end return false end
function M.list(target,category)
 local list,used={},{}
 local function add(track) if track and not used[track.id] and (category==0 or track.category==category-1) then list[#list+1]=track;used[track.id]=true end end
 for _,id in ipairs(recommended[target] or {}) do add(byId[id]) end
 for _,track in ipairs(Catalog) do add(track) end
 return list
end
function M.pages(s) return math.max(1,math.ceil(#M.list(s.musicTarget,s.musicCategory)/M.pageSize)) end
function M.action(s,name)
 if s.scene=='mode-select' and name=='SettingsButton' then s.scene='audio-settings';return true end
 if s.scene=='audio-settings' then
  if name=='SettingsBack' then s.scene='mode-select'
  elseif name=='TitleMusicButton' or name=='BoardMusicButton' then s.musicTarget=name=='TitleMusicButton' and 'title' or 'board';s.musicCategory=0;s.musicPage=0;s.scene='music-select'
  elseif name=='VolumeUp' then s.audio.volume=math.min(100,s.audio.volume+10)
  elseif name=='VolumeDown' then s.audio.volume=math.max(0,s.audio.volume-10)
  elseif name=='SfxToggle' then s.audio.sfx=not s.audio.sfx end
  return true
 end
 if s.scene=='music-select' then
  local id=tonumber(name:match('^PickMusic_(%d+)$'));local category=tonumber(name:match('^MusicCategory_(%d)$'))
  if name=='MusicBack' then s.scene='audio-settings'
  elseif name=='MusicOff' then s.audio[s.musicTarget]=0;s.scene='audio-settings'
  elseif id and byId[id] then s.audio[s.musicTarget]=id;s.scene='audio-settings'
  elseif category and category>=0 and category<=4 then s.musicCategory=category;s.musicPage=0
  elseif name=='MusicNext' then s.musicPage=math.min(M.pages(s)-1,s.musicPage+1)
  elseif name=='MusicPrevious' then s.musicPage=math.max(0,s.musicPage-1) end
  return true
 end
 return false
end
return M
