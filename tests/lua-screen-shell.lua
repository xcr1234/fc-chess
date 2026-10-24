local V=require('ui.view')
local U=require('ui.primitives')
local S=require('game.session')
require('app.log').enabled=false
local w,h=1600,900
Enum={ImageSource={StaticReference=1},CursorEventType={CursorClick=1},TextHorizontalAlignment={Middle=1,Left=2},TextVerticalAlignment={Middle=1},KeyEventType={}}
for _,direction in ipairs({'Forward','Backward','Left','Right'}) do for _,phase in ipairs({'Down','Up'}) do
 local name='KeyboardMove'..direction..'Key'..phase;Enum.KeyEventType[name]=name
end end
Color=function(r,g,b,a)return {r,g,b,a} end
local host={children={}}
game={GetUICanvasSize=function()return w,h end,SetControllerFocus=function()end}
function game.InstantiateClientUIControl(_,parent)
 local c={parent=parent,children={},keys={},sx=1,sy=1}
 parent.children[#parent.children+1]=c
 function c:SetAnchorMin()end function c:SetAnchorMax()end function c:SetPivot()end function c:SetActive()end
 function c:SetSizeDelta(x,y)self.w=x;self.h=y end
 function c:SetAnchoredPosition(x,y)self.x=x;self.y=y end
 function c:SetLocalScale(x,y)self.sx=x;self.sy=y end
 function c:SetImage()end function c:SetVisible(v)self.visible=v end function c:SetLocalRotation()end
 function c:AddCursorEventListener(_,callback)self.click=callback end
 function c:AddKeyEventListener(event,callback)self.keys[event]=callback end
 return c
end
function game.DestroyClientUIControl(c)
 c.destroyed=true
 for i,v in ipairs(c.parent.children)do if v==c then table.remove(c.parent.children,i);break end end
end
local failures=0
local function check(name,fn)
 local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)))
 V.destroy();host.children={};if not ok then failures=failures+1 end
end
check('full viewport is opaque and resize keeps the board proportional',function()
 V.init(host,function()end,function()end);V.render(S.new())
 for _,size in ipairs({{1600,900},{2560,1080},{1280,960},{720,1280}})do
  w,h=size[1],size[2];V.resize()
  local bg=assert(U.refs.ScreenBackground,'full-window background missing')
  local screen=assert(U.refs.ScreenRoot);local board=U.refs.GameRoot
  assert(bg.w==w and bg.h==h and bg.imageColor[4]==255 and screen.w==w and screen.h==h)
  assert(board.w==256 and board.h==224 and board.sx==math.min(w/256,h/224) and board.sy==board.sx)
 end
end)
check('WASD down and up are consumed without touching the match',function()
 V.init(host,function()end,function()end);local state=S.new();V.render(state)
 local screen=assert(U.refs.ScreenRoot,'input isolation root missing')
 assert(screen.disableKeyEventPassthrough and screen.disableCursorEventPassthrough)
 local count=0;for _,event in pairs(Enum.KeyEventType)do assert(screen.keys[event] and screen.keys[event]()==true,'movement event not consumed: '..event);count=count+1 end
 assert(count==8 and state.scene=='mode-select' and state.moves==0)
end)
check('outside-board clicks are blocked behind the interactive game',function()
 V.init(host,function()end,function()end);V.render(S.new())
 local screen=assert(U.refs.ScreenRoot,'screen root missing');local blocker=assert(U.refs.ScreenBlocker)
 assert(blocker.w==w and blocker.h==h and blocker.parent==screen and blocker.click)
 assert(screen.children[1]==U.refs.ScreenBackground and screen.children[2]==blocker and screen.children[3]==U.refs.GameRoot)
 local s=S.new();V.render(s);assert(U.refs.ScreenBackground.imageColor[1]==104)
 S.start(s,'fast');V.render(s);assert(U.refs.ScreenBackground.imageColor[1]==25)
end)
check('destroy and reinitialize remove the full-window layer as one unit',function()
 V.init(host,function()end,function()end);local screen=assert(U.refs.ScreenRoot,'screen root missing')
 V.destroy();assert(screen.destroyed and #host.children==0)
 V.init(host,function()end,function()end);assert(#host.children==1 and U.refs.ScreenRoot~=screen)
end)
assert(failures==0,tostring(failures)..' screen shell failures')
