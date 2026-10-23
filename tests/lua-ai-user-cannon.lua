local B=require('game.board');local A=require('game.ai')
local b=B.standard()
for _,m in ipairs({{65,68},{2,21},{57,48},{34,43},{83,66},{8,25},{66,49}}) do
 assert(B.valid(b,m[1],m[2],false),'invalid logged move');b[m[2]]=b[m[1]];b[m[1]]=''
end
for _,dt in ipairs({1/30,1/60}) do
 local j=A.new(b,'black',false)
 while not j.done do A.step(j,dt) end
 print('USER dt='..dt..' depth='..j.depth..' nodes='..j.nodes..' move='..j.move[1]..'-'..j.move[2]..' score='..tostring(j.score))
 assert(j.restored)
 assert(not (j.move[1]==26 and j.move[2]==89),'repeated cannon-for-protected-horse in logged position')
end
