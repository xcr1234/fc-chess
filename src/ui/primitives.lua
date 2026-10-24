local M = { refs = {} }
local ids = {container=1073741847,image=1073741848,textbox=1073741849,cursor=1073741850}
function M.create(kind,parent,name,x,y,w,h)
  local c=game.InstantiateClientUIControl(ids[kind],parent)
  c.name=name; c:SetAnchorMin(.5,.5); c:SetAnchorMax(.5,.5); c:SetPivot(.5,.5)
  c:SetSizeDelta(w,h); c:SetAnchoredPosition(x,y); c:SetActive(true)
  M.refs[name]=c
  return c
end
function M.color(hex)
  return Color(tonumber(hex:sub(1,2),16),tonumber(hex:sub(3,4),16),tonumber(hex:sub(5,6),16),255)
end
function M.image(p,n,x,y,w,h,color,id)
  local c=M.create('image',p,n,x,y,w,h)
  c:SetImage(Enum.ImageSource.StaticReference,id or 100001);c.imageColor=M.color(color);c.enableMask=false;c.enableSoftEdge=false
  return c
end
function M.text(p,n,x,y,w,h,value,color,size)
  -- 25 is verified visible on native. Keep small logical fonts through leaf
  -- scaling instead of writing sizes rejected by the native font API.
  local scale=(size or 10)/25
  local c=M.create('textbox',p,n,x,y,w/scale,h/scale)
  c:SetLocalScale(scale,scale,1);c.adaptiveFontSize=false;c.fontSize=25;c.text=value
  c.fontColor=M.color(color or '3defa0');c.bgColor=Color(0,0,0,0);c.enableOutline=false
  c.horizontalAlignment=Enum.TextHorizontalAlignment.Middle;c.verticalAlignment=Enum.TextVerticalAlignment.Middle
  return c
end
function M.hit(p,n,x,y,w,h,fn)
  local c=M.create('cursor',p,n,x,y,w,h)
  c:AddCursorEventListener(Enum.CursorEventType.CursorClick,fn)
  return c
end
function M.set(n,v) if M.refs[n] and M.refs[n].text~=tostring(v) then M.refs[n].text=tostring(v) end end
return M
