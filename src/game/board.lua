local M={}
function M.index(f,r) return r*9+f+1 end
function M.copy(b) local c={} for i=1,90 do c[i]=b[i] or '' end return c end
function M.red(p) return p and p~='' and p==string.upper(p) end
function M.side(p) if not p or p=='' then return nil end return M.red(p) and 'red' or 'black' end
function M.standard()
 local b={} for i=1,90 do b[i]='' end
 local row={'r','n','e','a','k','a','e','n','r'}
 for f=0,8 do b[M.index(f,0)]=row[f+1];b[M.index(f,9)]=string.upper(row[f+1]) end
 for _,f in ipairs({1,7}) do b[M.index(f,2)]='c';b[M.index(f,7)]='C' end
 for f=0,8,2 do b[M.index(f,3)]='p';b[M.index(f,6)]='P' end
 return b
end
function M.coords(i) return (i-1)%9,math.floor((i-1)/9) end
function M.valid(b,a,z,custom)
 if a<1 or a>90 or z<1 or z>90 or a==z then return false end
 local p,t=b[a],b[z];if not p or p=='' or M.side(p)==M.side(t) then return false end
 local x,y=M.coords(a);local u,v=M.coords(z);local dx,dy=u-x,v-y;local ax,ay=math.abs(dx),math.abs(dy)
 local red=M.red(p);local k=string.upper(p)
 local palace=u>=3 and u<=5 and ((red and v>=7) or (not red and v<=2))
 local between=0
 if dx==0 or dy==0 then
  local sx=dx==0 and 0 or dx/ax;local sy=dy==0 and 0 or dy/ay
  local f,r=x+sx,y+sy
  while f~=u or r~=v do if b[M.index(f,r)]~='' then between=between+1 end f=f+sx;r=r+sy end
 end
 if k=='R' then return (dx==0 or dy==0) and between==0
 elseif k=='C' then return (dx==0 or dy==0) and between==(t=='' and 0 or 1)
 elseif k=='N' then
  if ax==2 and ay==1 then return b[M.index(x+dx/2,y)]=='' end
  if ax==1 and ay==2 then return b[M.index(x,y+dy/2)]=='' end
 elseif k=='E' then return ax==2 and ay==2 and b[M.index(x+dx/2,y+dy/2)]=='' and ((custom and red) or (red and v>=5) or (not red and v<=4))
 elseif k=='A' then return ax==1 and ay==1 and ((custom and red) or palace)
 elseif k=='K' then
  if dx==0 and string.upper(t)=='K' and between==0 then return true end
  return ax+ay==1 and palace
 elseif k=='P' then return (dx==0 and dy==(red and -1 or 1)) or (ay==0 and ax==1 and ((red and y<=4) or (not red and y>=5))) end
 return false
end
local orth={{1,0},{-1,0},{0,1},{0,-1}}
local diagonal={{1,1},{1,-1},{-1,1},{-1,-1}}
local horses={{2,1},{2,-1},{-2,1},{-2,-1},{1,2},{-1,2},{1,-2},{-1,-2}}
function M.moves(b,side,custom,captures)
 local out={}
 for a=1,90 do if M.side(b[a])==side then
  local x,y=M.coords(a);local k=string.upper(b[a])
  local function add(f,r)
   if f<0 or f>8 or r<0 or r>9 then return end
   local z=M.index(f,r)
   if (not captures or b[z]~='') and M.valid(b,a,z,custom) then out[#out+1]={a,z} end
  end
  if k=='R' or k=='C' then
   for _,d in ipairs(orth) do local f,r=x+d[1],y+d[2];local seen=0
    while f>=0 and f<=8 and r>=0 and r<=9 do
     add(f,r);if b[M.index(f,r)]~='' then seen=seen+1 end
     if seen>=(k=='R' and 1 or 2) then break end
     f=f+d[1];r=r+d[2]
    end
   end
  elseif k=='N' then for _,d in ipairs(horses) do add(x+d[1],y+d[2]) end
  elseif k=='A' or k=='E' then local step=k=='E' and 2 or 1;for _,d in ipairs(diagonal) do add(x+d[1]*step,y+d[2]*step) end
  elseif k=='K' then
   for _,d in ipairs(orth) do add(x+d[1],y+d[2]) end
   for r=0,9 do if math.abs(r-y)>1 and string.upper(b[M.index(x,r)])=='K' then add(x,r) end end
  else add(x,y+(side=='red' and -1 or 1));add(x-1,y);add(x+1,y) end
 end end
 return out
end
function M.key(b,side,custom) return table.concat(b,',')..side..tostring(custom) end
return M
