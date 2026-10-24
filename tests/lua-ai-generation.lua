local B=require('game.board')
local P=require('game.ai.position')
local R=require('game.ai.rules')
local G=require('game.ai.movegen')
for _,standard in ipairs({false,true}) do
 local p=P.new(B.standard(),'red',R.get(false,standard and 'reference-standard-v1' or 'casual-capture-v1'))
 local u={};P.make(p,P.move(P.from90[83],P.from90[66]),u,'move')
 assert((p.context~=0)==standard,'history identity does not match repetition policy')
 P.undo(p,u);assert(p.context==0 and p.contextLock==0)
 if not standard then assert(next(p.contextIds)==nil and p.serial==0) end
end
print('PASS production skips unused path identities; standard keeps repetition context')
local p=P.new(B.standard(),'red',R.get(false));local undo={}
for _,kind in ipairs({'pass','null','move'}) do
 local u={};local m=kind=='move' and P.move(P.from90[83],P.from90[66]) or nil
 P.make(p,m,u,kind);undo[#undo+1]=u
 assert(p.context==(kind=='pass' and 1 or kind=='null' and 2 or 0))
end
for i=#undo,1,-1 do P.undo(p,undo[i]) end
assert(p.context==0 and p.contextLock==0 and #p.history==0)
print('PASS pass/null boundaries remain distinct and restore cleanly')
for _,custom in ipairs({false,true}) do for _,side in ipairs({'red','black'}) do
 local b=B.standard();if custom then for i,pc in ipairs(b) do if B.red(pc) and pc~='K' then b[i]='R' end end end
 local pos=P.new(b,side,R.get(custom));local before=B.key(b,side,custom)
 for _,captures in ipairs({false,true}) do
  local expected={};for _,m in ipairs(B.moves(b,side,custom)) do if not captures or b[m[2]]~='' then expected[m[1]*100+m[2]]=true end end
  for _,m in ipairs(G.generate(pos,captures)) do local e=P.external(m);assert(expected[e[1]*100+e[2]]);expected[e[1]*100+e[2]]=nil end
  assert(next(expected)==nil)
 end
 assert(B.key(P.export(pos),side,custom)==before)
end end
print('PASS fast color filtering preserves all/capture move sets and custom armies')
local A=require('game.ai')
for sample=1,2 do
 local b={} for i=1,90 do b[i]='' end;b[5]='k';b[85]='K';b[20+sample]='c';b[38+sample]='p';b[65+sample]='N';b[74+sample]='R'
 local score
 for _,priority in ipairs({false,true}) do
  local j=A.new(b,'black',false,{noBook=true,clock=false,maxDepth=3,extensions=0,tt=false,priority=priority,nodeBudget=200000})
  while not j.done do A.step(j,0) end
  assert(j.reason=='complete' and j.restored)
  score=score or j.score;assert(score==j.score,'lazy priority search changes fixed-depth value')
  assert(j.summary.count==#B.moves(b,'black',false),'priority moves counted twice or omitted')
  if priority then assert(j.priorityProbes>0 and j.priorityCutoffs>0,'priority path did not skip generation') end
 end
end
print('PASS lazy priority probes preserve exact root score/count and produce early cutoffs')
