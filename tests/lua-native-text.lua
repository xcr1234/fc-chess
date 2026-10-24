local U=require('ui.primitives')
local failures=0
local function check(name,fn)local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)));if not ok then failures=failures+1 end end
-- Conservative compatibility model, not a claim about the undocumented exact
-- native range. Native logs reject our tiny sizes; 25 is visibly working there.
Enum={TextHorizontalAlignment={Middle=1,Left=2},TextVerticalAlignment={Middle=1}}
Color=function(r,g,b,a)return {r,g,b,a} end
game={InstantiateClientUIControl=function(id,parent)
 local values={fontSize=20,minimumFontSize=20,adaptiveFontSize=false,parent=parent}
 local methods={SetAnchorMin=function()end,SetAnchorMax=function()end,SetPivot=function()end,SetActive=function()end,
  SetSizeDelta=function(_,w,h)values.w=w;values.h=h end,SetAnchoredPosition=function(_,x,y)values.x=x;values.y=y end,
  SetLocalScale=function(_,x,y,z)values.sx=x;values.sy=y;values.sz=z end}
 return setmetatable({},{__index=function(_,k)return methods[k] or values[k] end,__newindex=function(_,k,v)
  if (k=='fontSize' or k=='minimumFontSize') and (v<20 or v>100 or v%1~=0) then error('字号超出限制: '..k..'='..v) end
  values[k]=v
 end})
end}
check('all game font roles avoid small native font assignments',function()
 for _,size in ipairs({6,8,9,10,11,12,13,15,16,25}) do
  local c=U.text({},'Role'..size,0,0,150,33,'中國象棋','fff9e9',size)
  assert(c.fontSize>=20 and c.fontSize<=100 and not c.adaptiveFontSize)
 end
end)
check('text scale preserves effective font size, position and width with vertical headroom',function()
 for _,size in ipairs({6,8,10,15,25}) do
  local c=U.text({},'Geometry'..size,28,-40,142,33,'中國象棋','fff9e9',size)
  assert(math.abs(c.fontSize*c.sx-size)<1e-8 and c.sx==c.sy)
  assert(math.abs(c.w*c.sx-142)<1e-8 and c.h*c.sy>=33 and c.x==28 and c.y==-40)
 end
end)
check('short title, mode, piece and HUD boxes reserve a conservative two-font line box',function()
 for _,role in ipairs({{'Title',142,33,25},{'Mode',150,20,15},{'Subtitle',150,12,8},{'Piece',14,14,10},{'HUD',40,13,10},{'Count',56,12,8}}) do
  local c=U.text({},role[1],5,-7,role[2],role[3],'車','fff9e9',role[4])
  assert(c.h>=c.fontSize*2,role[1]..' has insufficient line-box headroom: '..c.h)
  assert(c.x==5 and c.y==-7 and math.abs(c.w*c.sx-role[2])<1e-8)
 end
end)
check('dynamic piece labels, counters and manual alignment remain writable',function()
 local c=U.text({},'Glyph',0,0,14,14,'車','f33d43',10);U.set('Glyph','帥');assert(c.text=='帥')
 c.horizontalAlignment=Enum.TextHorizontalAlignment.Left;assert(c.horizontalAlignment==2)
 local n=U.text({},'Count',0,0,56,12,'000手','3defa0',8);U.set('Count','001手');assert(n.text=='001手')
end)
assert(failures==0,tostring(failures)..' native text failures')
