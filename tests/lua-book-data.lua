local B=require('game.board')
local Book=require('game.ai.book')
local data=require('game.ai.book_data')
local count,moves=0,0
for key,packed in pairs(data) do
 local layout,turn=key:match('^(%S+) ([wb])$');assert(layout and turn)
 local b={};local i=1
 for char in layout:gmatch('.') do
  if char~='/' then
   local empty=tonumber(char)
   if empty then for _=1,empty do b[i]='';i=i+1 end else b[i]=char;i=i+1 end
  end
 end
 assert(i==91 and #packed%9==0)
 local side=turn=='w' and 'red' or 'black';assert(Book.key(b,side)==key)
 local original=B.key(b,side,false)
 local choices=Book.candidates(b,side,false);assert(choices and #choices==#packed/9,'valid upstream candidate filtered unexpectedly')
 for _,m in ipairs(choices) do
  assert(B.side(b[m[1]])==side and B.valid(b,m[1],m[2],false) and m[3]>0)
  moves=moves+1
 end
 assert(B.key(b,side,false)==original,'candidate validation changed a position')
 count=count+1
end
print(string.format('PASS full book: %d positions, %d legal weighted candidates',count,moves))
assert(count>8000 and moves>9000)
