local B=require('game.board')
local A=require('game.ai')
local S=require('game.session')
require('app.log').enabled=false
local failures=0
local function check(name,fn)
 local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)))
 if not ok then failures=failures+1 end
end
local function play(b,a,z) assert(B.valid(b,a,z,false));b[z]=b[a];b[a]='' end
check('real book covers red root and several opening replies beyond first move',function()
 local b=B.standard()
 assert(A.book(b,false,'red'),'missing initial red book')
 play(b,65,68) -- b2e2: central cannon
 local j=A.new(b,'black',false,{seed=17})
 assert(j.book and j.done and j.nodes==0)
 play(b,j.move[1],j.move[2])
 local red=A.book(b,false,'red');assert(red and #red>0,'book stops after black first reply')
 play(b,red[1][1],red[1][2])
 local next=A.new(b,'black',false,{seed=17});assert(next.book,'missing second black book reply')
end)
check('seed selects weighted alternatives reproducibly without modifying the board',function()
 local b=B.standard();play(b,65,68);local key=B.key(b,'black',false)
 local found={}
 for seed=1,40 do
  local a=A.new(b,'black',false,{seed=seed*104729});local c=A.new(b,'black',false,{seed=seed*104729})
  assert(a.book and c.book and a.move[1]==c.move[1] and a.move[2]==c.move[2])
  found[a.move[1]*100+a.move[2]]=true
 end
 local count=0 for _ in pairs(found) do count=count+1 end
 assert(count>1,'all seeds still choose the first candidate');assert(B.key(b,'black',false)==key)
end)
check('mirror candidates keep weights and convert coordinates in both directions',function()
 local b=B.standard();play(b,65,68)
 local mirror={} for i=1,90 do local f,r=B.coords(i);mirror[B.index(8-f,r)]=b[i] end
 local one=A.book(b,false,'black');local two=A.book(mirror,false,'black')
 assert(one and two and #one==#two)
 local expected={}
 for _,m in ipairs(one) do local f,r=B.coords(m[1]);local x,y=B.coords(m[2]);expected[B.index(8-f,r)*100+B.index(8-x,y)]=m[3] end
 for _,m in ipairs(two) do assert(B.valid(mirror,m[1],m[2],false));assert(expected[m[1]*100+m[2]]==m[3] and m[3]>0,'weight or mirror mismatch') end
end)
check('unknown positions search; side and custom rules never share book hits',function()
 local b=B.standard();play(b,55,46);play(b,46,37)
 local j=A.new(b,'black',false,{seed=1,nodeBudget=16})
 assert(not j.book and not j.done,'unknown position did not fall back to search')
 A.step(j,5);assert(j.done and j.restored)
 local start=B.standard();assert(not A.book(start,true,'red'))
 assert(not A.new(start,'black',true,{}).book)
 assert(not A.book(start,false,'black'),'wrong side matched red root')
end)
check('book never overrides immediate king capture or returns exposed-king candidates',function()
 local b=B.standard();play(b,65,68)
 b[5]='';b[41]='k' -- deliberately leaves opening book by changing the whole position
 local j=A.new(b,'red',false,{});A.step(j,5)
 assert(not j.book and j.move[2]==41 and j.restored)
end)
check('session keeps seed in undo history and advances it only after real AI submission',function()
 local s=S.new();S.start(s,'difficult');s.bookSeed=123456
 assert(S.commit(s,{65,68}));assert(s.job.book and s.scene=='ai-wait' and s.bookSeed==123456)
 local move={s.reply[1],s.reply[2]};S.update(s,20)
 assert(s.moves==2 and s.bookSeed~=123456,'seed did not advance on submitted book move')
 S.undo(s);assert(s.bookSeed==123456 and s.moves==0)
 S.commit(s,{65,68});assert(s.reply[1]==move[1] and s.reply[2]==move[2],'undo changed the same seeded response')
 S.undo(s);assert(not s.reply and not s.job and s.bookSeed==123456)
end)
check('weighted selection uses weight intervals rather than a candidate index',function()
 local Book=require('game.ai.book');local choices={{1,2,1},{3,4,3}}
 local one=Book.choose(choices,1);local two=Book.choose(choices,63887);local three=Book.choose(choices,127773)
 assert(one[1]==1 and two[1]==3 and three[1]==3)
 local move,seed=Book.choose(choices,2147483646);assert(move[1]==3 and seed>0 and seed<2147483647)
 assert(not Book.choose({},1))
end)
check('invalid and exposed-king records fall back without mutating the visible board',function()
 local Book=require('game.ai.book');local data=require('game.ai.book_data')
 local b=B.standard();local key=Book.key(b,'red');local saved=data[key]
 data[key]='010200001';assert(not A.book(b,false,'red'),'accepted opponent move')
 data[key]=saved
 local exposed={} for i=1,90 do exposed[i]='' end exposed[5]='k';exposed[86]='K';exposed[77]='R'
 local exposedKey=Book.key(exposed,'red');local old=data[exposedKey];local _,mirror=Book.key(exposed,'red')
 local from,to=77,76;if mirror then from,to=77,78 end
 data[exposedKey]=string.format('%02d%02d00001',from,to)
 local original=B.key(exposed,'red',false);assert(not A.book(exposed,false,'red'),'accepted a move exposing king')
 assert(B.key(exposed,'red',false)==original);data[exposedKey]=old
 -- Simulated spurious book hit must never override an immediate king capture.
 exposed[77]='';exposed[68]='C';exposed[59]='P'
 local captureKey=Book.key(exposed,'red');old=data[captureKey];data[captureKey]='686700001'
 local job=A.new(exposed,'red',false,{});A.step(job,5)
 assert(not job.book and job.move[2]==5);data[captureKey]=old
end)
assert(failures==0,tostring(failures)..' opening book cases failed')
