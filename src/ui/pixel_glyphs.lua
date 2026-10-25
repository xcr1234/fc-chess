local U=require('ui.primitives')
local D=require('ui.pixel_glyph_data')
local M={boardSize=D.boardSize,paletteSize=D.paletteSize,riverSize=D.riverSize,colors=D.colors}
function M.has(value) return D.glyphs[value]~=nil end
local function layer(root,name,items,scale,tint)
 local controls={}
 for i,r in ipairs(items) do
  local n=name..i
  controls[#controls+1]=U.image(root,n,(r[1]+r[3]/2-D.size/2)*scale,(D.size/2-r[2]-r[4]/2)*scale,r[3]*scale,r[4]*scale,tint)
  U.refs[n]=nil
 end
 return controls
end
function M.disc(parent,name,value)
 local root=U.create('container',parent,name,0,0,16,16);U.refs[name]=nil
 local art=D.discs[value]
 layer(root,name..'Rim',art.rim,1,D.colors.black)
 local whites=layer(root,name..'White',art.white,1,D.colors.shadow)
 return root,whites
end
function M.tintDisc(whites,selected)
 local color=U.color(selected and 'b4b4b4' or D.colors.shadow)
 for _,c in ipairs(whites or {}) do c.imageColor=color end
end
function M.draw(parent,name,x,y,size,value,color)
 local rects=D.glyphs[value]
 if not rects then return nil end
 local root=U.create('container',parent,name,x,y,size,size)
 -- Dynamic artwork is owned by its parent, not the global text lookup table.
 U.refs[name]=nil
 local scale=size/D.size
 if D.shadows[value] then layer(root,name..'ShadowRun',D.shadows[value],scale,D.colors.shadow) end
 layer(root,name..'Run',rects,scale,color)
 return root
end
return M
