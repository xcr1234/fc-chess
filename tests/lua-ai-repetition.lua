local B=require('game.board')
local A=require('game.ai')
local S=require('game.session')
require('app.log').enabled=false
local function board()
 local b=B.copy({});b[B.index(4,0)]='k';b[B.index(3,9)]='K';b[B.index(0,4)]='r';return b
end
local function after(b,m,custom)
 local c=B.copy(b);c[m[2]]=c[m[1]];c[m[1]]='';return B.key(c,'red',custom)
end
local function run(b,custom,history,extra)
 local opts={noBook=true,clock=false,maxDepth=1,extensions=0,qDepth=16,nodeBudget=10000,positionHistory=history}
 for k,v in pairs(extra or {}) do opts[k]=v end
 local j=A.new(b,'black',custom,opts)
 while not j.done do A.step(j,0) end
 assert(j.restored and B.valid(b,j.move[1],j.move[2],custom))
 return j
end
local count=0
local function test(name,fn) fn();count=count+1;print('PASS '..name) end
for _,custom in ipairs({false,true}) do
 test('repeated root move yields to alternative custom='..tostring(custom),function()
  local b=custom and board() or B.standard();local first=run(b,custom);local key=after(b,first.move,custom)
  local next=run(b,custom,{key,key})
  assert(after(b,next.move,custom)~=key,'AI repeats its preferred position despite alternatives')
  local full=run(b,custom,{key,key},{pvs=false,tt=false})
  assert(full.score==next.score,'PVS/root penalty windows disagree')
 end)
end
test('book repetition falls back to search',function()
 local b=B.standard();b[68]=b[65];b[65]='';local choices=A.book(b,false,'black');assert(choices and #choices>0)
 local history={};for _,m in ipairs(choices) do history[#history+1]=after(b,m,false) end
 local j=A.new(b,'black',false,{positionHistory=history,clock=false})
 assert(not j.book,'repeated book choices bypassed policy')
 A.cancel(j);assert(j.restored)
end)
test('deadline fallback avoids repeated safe move',function()
 local b=board();local first=A.new(b,'black',true,{noBook=true,clock=false})
 local key=after(b,first.move,true);A.cancel(first)
 local j=run(b,true,{key},{nodeBudget=0})
 assert(after(b,j.move,true)~=key,'deadline fallback repeated')
end)
test('checking and chasing cycles both get a root preference penalty',function()
 local Policy=require('game.ai.repetition_policy');local P=require('game.ai.position')
 for _,victim in ipairs({'K','R'}) do
  local b=board();b[B.index(0,4)]='';b[B.index(2,8)]='r'
  if victim=='R' then b[B.index(3,9)]='';b[B.index(5,9)]='K';b[B.index(3,7)]='R' end
  local m={B.index(2,8),B.index(3,8)}
  local key=after(b,m,true)
  local penalties=Policy.penalties(b,'black',true,{key,key})
  assert(penalties[P.move(P.from90[m[1]],P.from90[m[2]])]>0)
  assert(next(Policy.penalties(b,'black',false,{key}))==nil,'rule profiles mixed')
 end
end)
test('only safe defence is retained despite repetition',function()
 local b=B.copy({});b[5]='k';b[1]='R';b[B.index(3,9)]='K'
 local m={5,14};local key=after(b,m,false)
 local j=run(b,false,{key,key,key});assert(j.move[1]==5 and j.move[2]==14,'repetition discarded necessary defence')
end)
test('immediate king capture overrides repetition',function()
 local b=board();b[B.index(0,4)]='';b[B.index(3,8)]='r'
 local m={B.index(3,8),B.index(3,9)};local key=after(b,m,false)
 local j=run(b,false,{key,key,key});assert(j.move[2]==m[2])
end)
test('history commit undo restart and player repeat permitted',function()
 local s=S.new();S.start(s,'fast',board());s.aiInput='hold'
 local start=B.key(s.board,'red',false)
 assert(s.positionHistory and s.positionHistory[1]==start,'missing game history')
 local cycle={{B.index(3,9),B.index(4,9)},{B.index(0,4),B.index(1,4)},{B.index(4,9),B.index(3,9)},{B.index(1,4),B.index(0,4)}}
 for n=1,3 do for _,m in ipairs(cycle) do assert(S.commit(s,m)) end end
 assert(s.scene=='player-turn' and #s.positionHistory==13,'repeat changed game rules')
 S.undo(s);assert(#s.positionHistory==11,'undo retained discarded positions')
 S.start(s,'custom');assert(#s.positionHistory==1,'restart retained prior game')
end)
print('PASS '..count..' repetition tests')
