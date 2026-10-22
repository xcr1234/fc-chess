local U=require('ui.primitives')
local D=require('ui.portrait_data')
local M={}
function M.draw(parent,name,x,y,size)
 local bg=U.image(parent,name,x,y,size,size,'f5a4cf')
 -- JSON mask is x=9,y=2,w=60,h=77 in the 79x80 source canvas.
 local mask=U.image(bg,name..'Mask',(39-39.5)*size/79,(40-40.5)*size/80,60*size/79,77*size/80,'ffffff')
 mask.enableMask=true
 local frame=U.create('container',mask,name..'Source',(.5)*size/79,(.5)*size/80,79,80)
 frame:SetLocalScale(size/79,size/80,1)
 for i,e in ipairs(D.elements) do
  local c=U.image(frame,name..'Ellipse'..i,e[2]-39.5,e[3]+40,e[4],e[5],'ffffff',100002)
  c:SetLocalRotation(0,0,e[6]);local p=D.palette[e[7]];c.imageColor=Color(p[1],p[2],p[3],e[8])
 end
 return bg
end
return M
