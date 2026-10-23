local B=require('game.board');local A=require('game.ai')
assert(A.new(B.standard(),'black',false,{noBook=true}).pvs==true,'PVS kernel is absent')
local function position(n)
 local b={} for i=1,90 do b[i]='' end
 b[5]='k';b[85]='K';b[20+n]='c';b[38+n]='p';b[65+n]='N';b[74+n]='R'
 return b
end
local function run(b,pvs,custom)
 local key=B.key(b,'black',custom)
 local j=A.new(b,'black',custom,{noBook=true,pvs=pvs,nodeBudget=100000,maxDepth=3})
 local initial=j.eval
 local frames=0
 while not j.done do A.step(j,0);frames=frames+1;assert(frames<100000) end
 assert(j.depth==3 and j.restored and j.eval==initial and B.key(b,'black',custom)==key)
 return j
end
local probes,researches=0,0
for n=1,6 do for _,custom in ipairs({false,true}) do
 local b=position(n);local p=run(b,true,custom);local ref=run(b,false,custom)
 assert(p.score==ref.score,'PVS score disagrees with alpha-beta')
 probes=probes+p.probes;researches=researches+p.researches
 print('PASS PVS/reference score sample='..n..' custom='..tostring(custom)..' nodes='..p.nodes..'/'..ref.nodes)
end end
assert(probes>0 and researches>0,'corpus did not exercise probes and re-search')
-- Cancel exactly while a re-search is on the stack, including all incremental state.
local b=position(2);local j=A.new(b,'black',false,{noBook=true,nodeBudget=100000,maxDepth=5});local initial=j.eval
while not j.done and j.researches==0 do A.step(j,0) end
assert(not j.done and j.researches>0);A.cancel(j)
assert(j.restored and j.eval==initial)
print('PASS cancel during PVS re-search; probes='..probes..' re-searches='..researches)
