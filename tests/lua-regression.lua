local B=require('game.board')
local A=require('game.ai')
local S=require('game.session')
local W=require('game.wait')
require('app.log').enabled=false
local function check(name,fn) fn();print('PASS '..name) end
local function empty() local b={} for i=1,90 do b[i]='' end return b end
local function run(b,side,custom,opts)
 local original=B.key(b,side,custom);local j=A.new(b,side,custom,opts);local frames=0
 while not j.done do A.step(j,1/60);frames=frames+1;assert(frames<500) end
 assert(j.restored and B.key(j.board,side,custom)==original and B.key(b,side,custom)==original)
 assert(not j.move or B.valid(b,j.move[1],j.move[2],custom));return j
end
check('move generator matches exhaustive validator across seeded boards and both profiles',function()
 math.randomseed(19)
 for sample=1,24 do local b=empty();local pieces={'R','N','C','A','E','P','r','n','c','a','e','p'}
  for n=1,24 do b[math.random(1,90)]=pieces[math.random(1,#pieces)] end b[5]='k';b[86]='K'
  for _,side in ipairs({'red','black'}) do for _,custom in ipairs({false,true}) do
   local generated={} for _,m in ipairs(B.moves(b,side,custom)) do local key=m[1]*100+m[2];assert(not generated[key]);generated[key]=true end
   for a=1,90 do if B.side(b[a])==side then for z=1,90 do assert(not not generated[a*100+z]==B.valid(b,a,z,custom)) end end end
  end end
 end
end)
check('AI captures king before material, including fifteen rooks',function()
 local b=empty();b[5]='k';b[86]='K';b[77]='r';for i=10,24 do b[i]='R' end
 local j=run(b,'black',true,{noBook=true,nodeBudget=2000});assert(j.move[2]==86)
end)
check('real budget abort retains complete depth two and unwinds board',function()
 local b=empty();b[5]='k';b[86]='K';local j=run(b,'black',false,{noBook=true,nodeBudget=25,maxDepth=3})
 assert(j.depth==2 and j.nodes==25 and not j.partialExact)
end)
check('cancel mid-search unwinds private board and leaves visible board untouched',function()
 local b=B.standard();local key=B.key(b,'black',true);local j=A.new(b,'black',true,{noBook=true,nodeBudget=5000})
 A.step(j,.01);assert(not j.done);A.cancel(j);assert(j.done and j.restored);assert(B.key(j.board,'black',true)==key);assert(B.key(b,'black',true)==key)
end)
check('mode-independent search, legal opening book, custom disables book',function()
 local b=B.standard();b[46]=b[55];b[55]=''
 local one=run(b,'black',false,{seed=1});local two=run(b,'black',false,{seed=1})
 assert(one.book and two.book and one.move[1]==two.move[1] and one.move[2]==two.move[2]);assert(not A.book(b,true))
 local custom=run(b,'black',true,{nodeBudget=300});assert(not custom.book)
 assert(W.seconds('fast',one.summary)==0 and W.seconds('difficult',one.summary)>=4)
end)
check('restart retains initial custom board; undo cancels real unfinished search',function()
 local s=S.new();S.action(s,'ModeCustom');S.action(s,'AllRooksButton');S.action(s,'StartCustomButton')
 local initial=B.key(s.initial,'red',true);S.square(s,55);S.square(s,46);assert(s.scene=='ai-search');S.update(s,.01)
 S.undo(s);assert(s.moves==0 and s.turn=='red' and not s.job and not s.reply);assert(B.key(s.board,'red',true)==initial)
 S.finish(s,'您落敗了','主動認輸');S.action(s,'RestartButton');assert(B.key(s.board,'red',true)==initial)
end)
check('both empty move lists produce no win, loss or draw adjudication',function()
 local s=S.new();S.start(s,'difficult');s.board=empty();S.begin(s,'red');assert(s.scene=='result' and s.resultTitle=='本局無法繼續' and s.moves==0)
end)
check('invalid initial data is rejected instead of awarded a win',function()
 local s=S.new();assert(not pcall(S.start,s,'difficult',empty()))
end)
check('waiting limits and missing fields are deterministic',function()
 assert(W.seconds('difficult',{count=1,tactical=1})==4)
 assert(W.seconds('custom',{count=300,tactical=300,gap=0,instability=1})==16)
 assert(W.seconds('difficult',{count=30,tactical=10})==9)
end)
