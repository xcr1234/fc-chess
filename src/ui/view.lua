local U=require('ui.primitives')
local P=require('ui.portrait')
local B=require('game.board')
local S=require('game.session')
local Counter=require('game.thinking_counter')
local Settings=require('audio.settings')
local Screen=require('ui.screen')
local M={}
local glyph={r='車',n='馬',e='象',a='士',k='將',c='砲',p='卒',R='車',N='馬',E='相',A='仕',K='帥',C='砲',P='兵'}
local root,screen,page,overlay,pageKind,overlayKind,onAction,onSquare
local pieces={}
local aiFrames={}
local function text(n,x,y,w,h,v,c,z,p) return U.text(p or page,n,x-128,y-112,w,h,v,c,z) end
local function rect(n,x,y,w,h,c,p) return U.image(p or page,n,x-128,y-112,w,h,c) end
local function button(n,label,x,y,w,h,p)
 p=p or page;U.image(p,n..'Border',x-128,y-112,w,h,'3defa0');U.image(p,n..'Fill',x-128,y-112,w-1,h-1,'00482f')
 text(n..'Label',x,y,w-2,h,label,'3defa0',n=='ModeButton' and w<60 and 7 or 8,p)
 return U.hit(p,n,x-128,y-112,w,h,function() onAction(n) end)
end
local function line(n,x,y,w,h,angle)
 local c=rect(n,x,y,w,h,'352599');if angle then c:SetLocalRotation(0,0,angle) end
end
function M.init(host,action,square)
 onAction=action;onSquare=square;screen=Screen.new(host);root=screen.content
 M.resize();return root
end
function M.resize()local w,h=game.GetUICanvasSize();Screen.resize(screen,w,h)end
local function build(kind,s)
 if page then game.DestroyClientUIControl(page) end
 page=U.create('container',root,'Page',0,0,256,224);page.showCursor=true;pieces={}
 Screen.color(screen,kind=='menu' and '6840fa' or '193b57')
 rect('Background',128,112,256,224,kind=='menu' and '6840fa' or '193b57')
 if kind=='audio-settings' then
  text('SettingsTitle',128,198,190,24,'聲音設定','fff9e9',16)
  for _,v in ipairs({{'MusicCaption','背景音樂',156},{'VolumeCaption','BGM音量',118},{'SfxCaption','走棋音效',80}}) do
   text(v[1],62,v[3],60,16,v[2],'28eff0',9).horizontalAlignment=Enum.TextHorizontalAlignment.Left
  end
  button('MusicButton',Settings.name(s.audio.music),164,156,120,24)
  button('VolumeDown','－',116,118,24,24);text('BGMVolume',164,118,60,18,s.audio.volume..'%','fff9e9',11);button('VolumeUp','＋',212,118,24,24)
  button('SfxToggle',s.audio.sfx and '開啟' or '關閉',164,80,120,24)
  button('SettingsBack','返回',128,32,88,24);return
 elseif kind=='music-select' then
  text('MusicTitle',113,207,170,20,'選擇背景音樂','fff9e9',13)
  button('MusicBack','返回',226,207,42,20)
  for i,label in ipairs(Settings.categories) do button('MusicCategory_'..(i-1),(s.musicCategory==i-1 and '·' or '')..label,34+(i-1)*47,182,44,20) end
  button('MusicOff','無BGM',128,157,232,22)
  local list=Settings.list(s.musicCategory)
  for row=1,Settings.pageSize do local track=list[s.musicPage*Settings.pageSize+row]
   if track then local label=(Settings.recommended(track.id) and '推薦 · ' or '')..track.name
    if s.audio.music==track.id then label='已選 · '..label end
    button('PickMusic_'..track.id,label,128,132-(row-1)*24,232,21)
   end
  end
  button('MusicPrevious','上一頁',48,14,68,20);text('MusicPage',128,14,78,16,(s.musicPage+1)..' / '..Settings.pages(s),'28eff0',9);button('MusicNext','下一頁',208,14,68,20);return
 end
 if kind=='menu' then
  rect('TitlePanel',128,197.5,142,33,'d60059');text('Title',128,197.5,142,33,'中國象棋','fff2c5',25)
  local names={'ModeDifficult','ModeFast','ModeCustom'};local labels={'困難','快速模式','自定義模式'};local sub={'經典老頭 · 原味等待','經典老頭 · 快速思考','修改己方初始棋子'}
  for i,n in ipairs(names) do local y=166-(i-1)*51;P.draw(page,'MenuPortrait'..i,46.5-128,y-17.5-112,35)
   text(n..'Title',156,y-11,150,20,labels[i],'fff9e9',15).horizontalAlignment=Enum.TextHorizontalAlignment.Left
   text(n..'Subtitle',156,y-29,150,12,sub[i],'e2d0ff',8).horizontalAlignment=Enum.TextHorizontalAlignment.Left
   U.hit(page,n,131.5-128,y-18-112,215,44,function() onAction(n) end)
  end
  text('MenuHint',100,13,185,14,'點擊模式，開始對局','fff9e9',8);button('SettingsButton','設定',222,15,50,22);return
 end
 rect('BoardPaper',120,104,144,160,'bbc6c8')
 for r=0,9 do line('Rank'..r,120,176-16*r,129,0.8) end
 for f=0,8 do local x=56+16*f
  if f==0 or f==8 then line('File'..f,x,104,.8,144) else line('FileTop'..f,x,144,.8,64);line('FileBottom'..f,x,64,.8,64) end
 end
 for i,y in ipairs({160,48}) do line('PalaceA'..i,120,y,math.sqrt(2)*32,.8,45);line('PalaceB'..i,120,y,math.sqrt(2)*32,.8,-45) end
 text('RiverLeft',86,104,40,15,'楚河','352599',11);text('RiverRight',150,104,40,15,'漢界','352599',11)
 for _,v in ipairs({{'BlackLabel','黑方',174},{'ComputerLabel','電腦',160},{'BlackLevel','1 級',144},{'RedLabel','紅方',78},{'HumanLabel','人腦',64},{'RedLevel','9 級',48}}) do text(v[1],22,v[3],40,13,v[2],'3defa0',10) end
 text('TurnText',226,201,52,14,'紅方','3defa0',10);text('MoveCount',226,184,56,12,'000手','3defa0',8)
 text('AIThinkingNumber',22,126,42,12,'00000','28eff0',8);text('RedStepTime',22,30,42,12,'00:00','28eff0',8)
 text('StatusText',128,10,248,12,'','28eff0',8)
 P.draw(page,'OldManPortrait',226-128,152-112,32)
 for r=0,9 do for f=0,8 do local i=B.index(f,r);local x,y=56+16*f-128,176-16*r-112
  local disk=U.image(page,'Disk_'..i,x,y,15,15,'fffdef',100002)
  local label=U.text(page,'Glyph_'..i,x,y,14,14,'','f33d43',10)
  local focus=U.create('container',page,'Selection_'..i,x,y,17,17)
  for j,v in ipairs({{0,8,17,.7},{0,-8,17,.7},{8,0,.7,17},{-8,0,.7,17}}) do U.image(focus,'SelectionEdge'..i..'_'..j,v[1],v[2],v[3],v[4],'fff29a') end
  focus:SetVisible(false)
  pieces[i]={disk,label,focus};U.hit(page,'Square_'..f..'_'..r,x,y,16,16,function() onSquare(i) end)
 end end
 -- Two reusable frames above the pieces; cursor hit areas remain unchanged.
 aiFrames={}
 for i,n in ipairs({'AILastFrom','AILastTo'}) do
  local frame=U.create('container',page,n,0,0,17,17)
  local thickness=i==1 and .8 or 1.3
  for j,v in ipairs({{0,8,17,thickness},{0,-8,17,thickness},{8,0,thickness,17},{-8,0,thickness,17}}) do U.image(frame,n..'Edge'..j,v[1],v[2],v[3],v[4],'28eff0') end
  frame:SetVisible(false);aiFrames[i]={control=frame}
 end
 if kind=='edit' then
  text('EditTitle',128,210,180,14,'自定義棋子','28eff0',10)
  for i,v in ipairs({{'AllRooksButton','全部改車'},{'ResetCustomButton','恢復初始'},{'StartCustomButton','開始對局'},{'EditBackButton','返回'}}) do button(v[1],v[2],227.5,93.5-(i-1)*21,47,17) end
 else
  for i,v in ipairs({{'UndoButton','悔棋'},{'ResignButton','認輸'},{'ModeButton','返回標題界面'}}) do button(v[1],v[2],227.5,93.5-(i-1)*21,47,17) end
  button('SettingsButton','設定',227.5,23,47,17)
 end
end
function M.render(s)
 local kind=s.scene=='mode-select' and 'menu' or (s.scene=='custom-edit' and 'edit' or ((s.scene=='audio-settings' or s.scene=='music-select') and s.scene or 'board'))
 local key=kind
 if kind=='audio-settings' then key=key..s.audio.music..':'..s.audio.volume..':'..tostring(s.audio.sfx)
 elseif kind=='music-select' then key=key..s.audio.music..':'..s.musicCategory..':'..s.musicPage end
 if key~=pageKind then if overlay then game.DestroyClientUIControl(overlay);overlay=nil end overlayKind=nil;build(kind,s);pageKind=key end
 if kind=='audio-settings' or kind=='music-select' then return end
 if kind~='menu' then
  U.set('TurnText',s.turn=='red' and '紅方' or '黑方');U.set('MoveCount',string.format('%03d手',s.moves));U.set('StatusText',s.status)
  if kind=='board' and U.refs.ResignButtonLabel then U.refs.ResignButtonLabel.fontColor=U.color(s.scene=='result-review' and '78909a' or '3defa0') end
  U.set('RedStepTime',S.format(s.red));U.set('AIThinkingNumber',Counter.format(s.aiCounter))
  for i,frame in ipairs(aiFrames) do
   local square=kind=='board' and s.lastAiMove and s.lastAiMove[i] or nil
   if frame.square~=square then
    frame.control:SetVisible(square~=nil)
    if square then local f,r=B.coords(square);frame.control:SetAnchoredPosition(56+16*f-128,176-16*r-112) end
    frame.square=square
   end
  end
  for i,p in ipairs(s.board) do local c=pieces[i]
   if c.last~=p then c[1]:SetVisible(p~='');c[2]:SetVisible(p~='');c[2].text=glyph[p] or '';c[2].fontColor=U.color(B.red(p) and 'f33d43' or '2818a0');c.last=p end
   local selected=s.selected==i;if c.selected~=selected then c[3]:SetVisible(selected);c.selected=selected end
  end
 end
 local o=s.modal or (s.palette and 'palette') or (s.scene=='result' and 'result') or ''
 if o~=overlayKind then
  if overlay then game.DestroyClientUIControl(overlay);overlay=nil end
  overlayKind=o
  if o~='' then
   overlay=U.create('container',root,'Overlay',0,0,256,224);overlay.showCursor=true;overlay.disableCursorEventPassthrough=true
   U.hit(overlay,'ModalBlocker',0,0,256,224,function() end)
   local w,h,y=198,72,111
   if o=='palette' then w,h,y=182,98,108 elseif o=='result' then w,h,y=172,116,96 end
   rect('OverlayBorder',128,y,w,h,'28eff0',overlay);rect('OverlayPanel',128,y,w-2,h-2,'193b57',overlay)
   if o=='palette' then
    text('PaletteTitle',128,146,180,16,'改成哪種棋子？','28eff0',11,overlay)
    for i,p in ipairs({'R','N','C','E','A','P'}) do button('Choose_'..p,glyph[p],83+((i-1)%3)*45,120-math.floor((i-1)/3)*25,38,20,overlay) end
    button('PaletteCancel','返回',128,74,48,14,overlay)
   elseif o=='result' then
    text('ResultTitle',128,139,180,22,s.resultTitle,'fff9e9',16,overlay);text('ResultReason',128,119,180,14,s.resultReason,'28eff0',8,overlay)
    button('RestartButton','再來一局',128,100,96,20,overlay);button('ModeButton','返回標題界面',128,77,96,20,overlay)
    button('ReturnBoardButton','返回棋盤',128,54,96,20,overlay)
   else
    text('ConfirmTitle',128,133,190,20,o=='undo' and '要悔棋嗎？' or (o=='resign' and '要認輸嗎？' or '返回標題界面？'),'fff9e9',12,overlay)
    if o=='menu' then text('ConfirmHint',128,112,190,14,'返回後無法恢復當前對局','28eff0',8,overlay) end
    button('ConfirmYes','是',92,88,60,23,overlay);local no=button('ConfirmNo','否',164,88,60,23,overlay);game.SetControllerFocus(no)
   end
  end
 end
end
function M.destroy() Screen.destroy(screen);screen=nil;root=nil;page=nil;overlay=nil;pageKind=nil;overlayKind=nil;U.refs={} end
return M
