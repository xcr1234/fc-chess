local U=require('ui.primitives')
local P=require('ui.portrait')
local B=require('game.board')
local S=require('game.session')
local M={}
local glyph={r='車',n='馬',e='象',a='士',k='將',c='砲',p='卒',R='車',N='馬',E='相',A='仕',K='帥',C='砲',P='兵'}
local root,page,overlay,pageKind,overlayKind,onAction,onSquare
local pieces={}
local lastWidth,lastHeight
local function text(n,x,y,w,h,v,c,z,p) return U.text(p or page,n,x-128,y-112,w,h,v,c,z) end
local function rect(n,x,y,w,h,c,p) return U.image(p or page,n,x-128,y-112,w,h,c) end
local function button(n,label,x,y,w,h,p)
 p=p or page;U.image(p,n..'Border',x-128,y-112,w,h,'3defa0');U.image(p,n..'Fill',x-128,y-112,w-1,h-1,'00482f')
 text(n..'Label',x,y,w-2,h,label,'3defa0',8,p)
 return U.hit(p,n,x-128,y-112,w,h,function() onAction(n) end)
end
local function line(n,x,y,w,h,angle)
 local c=rect(n,x,y,w,h,'352599');if angle then c:SetLocalRotation(0,0,angle) end
end
function M.init(host,action,square)
 onAction=action;onSquare=square;root=U.create('container',host,'GameRoot',0,0,256,224);root.showCursor=true
 M.resize();return root
end
function M.resize() local w,h=game.GetUICanvasSize();if w~=lastWidth or h~=lastHeight then local z=math.min(w/256,h/224);root:SetLocalScale(z,z,1);lastWidth=w;lastHeight=h end end
local function build(kind)
 if page then game.DestroyClientUIControl(page) end
 page=U.create('container',root,'Page',0,0,256,224);page.showCursor=true;pieces={}
 rect('Background',128,112,256,224,kind=='menu' and '6840fa' or '193b57')
 if kind=='menu' then
  rect('TitlePanel',128,197.5,142,33,'d60059');text('Title',128,197.5,142,33,'中國象棋','fff2c5',25)
  local names={'ModeDifficult','ModeFast','ModeCustom'};local labels={'困難','快速模式','自定義模式'};local sub={'經典老頭 · 原味等待','經典老頭 · 快速思考','修改己方初始棋子'}
  for i,n in ipairs(names) do local y=166-(i-1)*51;P.draw(page,'MenuPortrait'..i,46.5-128,y-17.5-112,35)
   text(n..'Title',156,y-11,150,20,labels[i],'fff9e9',15).horizontalAlignment=Enum.TextHorizontalAlignment.Left
   text(n..'Subtitle',156,y-29,150,12,sub[i],'e2d0ff',8).horizontalAlignment=Enum.TextHorizontalAlignment.Left
   U.hit(page,n,131.5-128,y-18-112,215,44,function() onAction(n) end)
  end
  text('MenuHint',128,13,240,14,'點擊模式，開始對局','fff9e9',8);return
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
 text('BlackStepTime',22,126,42,12,'00:00','28eff0',8);text('RedStepTime',22,30,42,12,'00:00','28eff0',8)
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
 if kind=='edit' then
  text('EditTitle',128,210,180,14,'自定義棋子','28eff0',10)
  for i,v in ipairs({{'AllRooksButton','全部改車'},{'ResetCustomButton','恢復初始'},{'StartCustomButton','開始對局'},{'EditBackButton','返回'}}) do button(v[1],v[2],227.5,93.5-(i-1)*21,47,17) end
 else for i,v in ipairs({{'UndoButton','悔棋'},{'ResignButton','認輸'},{'ModeButton','模式選擇'}}) do button(v[1],v[2],227.5,93.5-(i-1)*21,47,17) end end
end
function M.render(s)
 local kind=s.scene=='mode-select' and 'menu' or (s.scene=='custom-edit' and 'edit' or 'board')
 if kind~=pageKind then if overlay then game.DestroyClientUIControl(overlay);overlay=nil end overlayKind=nil;build(kind);pageKind=kind end
 if kind~='menu' then
  U.set('TurnText',s.turn=='red' and '紅方' or '黑方');U.set('MoveCount',string.format('%03d手',s.moves));U.set('StatusText',s.status)
  U.set('RedStepTime',S.format(s.red));U.set('BlackStepTime',S.format(s.black))
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
   if o=='palette' then w,h,y=182,98,108 elseif o=='result' then w,h,y=172,93,107.5 end
   rect('OverlayBorder',128,y,w,h,'28eff0',overlay);rect('OverlayPanel',128,y,w-2,h-2,'193b57',overlay)
   if o=='palette' then
    text('PaletteTitle',128,146,180,16,'改成哪種棋子？','28eff0',11,overlay)
    for i,p in ipairs({'R','N','C','E','A','P'}) do button('Choose_'..p,glyph[p],83+((i-1)%3)*45,120-math.floor((i-1)/3)*25,38,20,overlay) end
    button('PaletteCancel','返回',128,74,48,14,overlay)
   elseif o=='result' then
    text('ResultTitle',128,139,180,22,s.resultTitle,'fff9e9',16,overlay);text('ResultReason',128,119,180,14,s.resultReason,'28eff0',8,overlay)
    button('RestartButton','再來一局',128,100,96,20,overlay);button('ModeButton','模式選擇',128,77,96,20,overlay)
   else
    text('ConfirmTitle',128,133,190,20,o=='resign' and '要認輸嗎？' or '返回模式選擇？','fff9e9',12,overlay)
    button('ConfirmYes','是',92,88,60,23,overlay);local no=button('ConfirmNo','否',164,88,60,23,overlay);game.SetControllerFocus(no)
   end
  end
 end
end
function M.destroy() if root then game.DestroyClientUIControl(root) end root=nil;page=nil;overlay=nil;pageKind=nil;overlayKind=nil;lastWidth=nil;lastHeight=nil;U.refs={} end
return M
