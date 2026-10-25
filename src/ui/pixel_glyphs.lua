local U=require('ui.primitives')
local D=require('ui.pixel_glyph_data')
local M={}
function M.has(value) return D.glyphs[value]~=nil end
function M.draw(parent,name,x,y,size,value,color)
 local rects=D.glyphs[value]
 if not rects then return nil end
 local root=U.create('container',parent,name,x,y,size,size)
 -- Dynamic artwork is owned by its parent, not the global text lookup table.
 U.refs[name]=nil
 local scale=size/D.size
 for i,r in ipairs(rects) do
  local n=name..'Run'..i
  U.image(root,n,(r[1]+r[3]/2-D.size/2)*scale,(D.size/2-r[2]-r[4]/2)*scale,r[3]*scale,r[4]*scale,color)
  U.refs[n]=nil
 end
 return root
end
return M
