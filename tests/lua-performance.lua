local B=require('game.board')
local A=require('game.ai')
require('app.log').enabled=false
-- Isolated host elapsed samples: real engine, no fixture replies or UI.
for _,profile in ipairs({'standard','fifteen-rooks','free-pieces'}) do
 local b=B.standard();local custom=profile~='standard'
 if profile=='fifteen-rooks' then for i,p in ipairs(b) do if B.red(p) and p~='K' then b[i]='R' end end end
 if profile=='free-pieces' then b[55]='A';b[57]='E';b[59]='A';b[61]='E';b[63]='A' end
 for ply=1,4 do
  local side=ply%2==1 and 'red' or 'black';local key=B.key(b,side,custom)
  local t=os.clock();local j=A.new(b,side,custom,{noBook=true});local init=os.clock()-t
  local samples={};local frames=0
  while not j.done do
   t=os.clock();A.step(j,1/60);samples[#samples+1]=(os.clock()-t)*1000;frames=frames+1;assert(frames<=241)
  end
  assert(j.restored and B.key(j.board,side,custom)==key and B.key(b,side,custom)==key and not j.partialExact)
  assert(j.move and B.valid(b,j.move[1],j.move[2],custom))
  table.sort(samples)
  print(string.format('SAMPLE {"profile":"%s","ply":%d,"initMs":%.3f,"stepP50Ms":%.3f,"stepP95Ms":%.3f,"stepMaxMs":%.3f,"frames":%d,"nodes":%d,"depth":%d}',profile,ply,init*1000,samples[math.max(1,math.ceil(#samples*.5))] or 0,samples[math.max(1,math.ceil(#samples*.95))] or 0,samples[#samples] or 0,frames,j.nodes,j.depth))
  b[j.move[2]]=b[j.move[1]];b[j.move[1]]=''
 end
end
