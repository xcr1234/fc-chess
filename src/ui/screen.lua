local U=require('ui.primitives')
local M={}
function M.new(host)
 local self={root=U.create('container',host,'ScreenRoot',0,0,1,1)}
 self.root.showCursor=true
 self.root.disableKeyEventPassthrough=true
 self.root.disableCursorEventPassthrough=true
 local function consume()return true end
 for _,direction in ipairs({'Forward','Backward','Left','Right'})do
  for _,phase in ipairs({'Down','Up'})do
   self.root:AddKeyEventListener(Enum.KeyEventType['KeyboardMove'..direction..'Key'..phase],consume)
  end
 end
 self.background=U.image(self.root,'ScreenBackground',0,0,1,1,'193b57')
 self.blocker=U.hit(self.root,'ScreenBlocker',0,0,1,1,function()end)
 self.content=U.create('container',self.root,'GameRoot',0,0,256,224)
 self.content.showCursor=true
 return self
end
function M.resize(self,w,h)
 if w<=0 or h<=0 or (w==self.width and h==self.height)then return end
 self.width=w;self.height=h
 self.root:SetSizeDelta(w,h);self.background:SetSizeDelta(w,h);self.blocker:SetSizeDelta(w,h)
 local z=math.min(w/256,h/224);self.content:SetLocalScale(z,z,1)
end
function M.color(self,hex)self.background.imageColor=U.color(hex)end
function M.destroy(self)if self then game.DestroyClientUIControl(self.root)end end
return M
