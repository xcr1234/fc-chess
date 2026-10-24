local B=require('game.board');local A=require('game.ai')
local failed,count=0,0
local function check(name,fn)
 count=count+1;local ok,err=pcall(fn)
 print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)))
 if not ok then failed=failed+1 end
end
local function search(b)
 local key=B.key(b,'black',false);local j=A.new(b,'black',false,{noBook=true,clock=false})
 local frames=0
 while not j.done do A.step(j,1/60);frames=frames+1;assert(frames<1000,'search never finished') end
 assert(j.restored and B.key(b,'black',false)==key and j.move)
 assert(B.valid(b,j.move[1],j.move[2],false))
 local c=B.copy(b);c[j.move[2]]=c[j.move[1]];c[j.move[1]]=''
 local king;for i,p in ipairs(c) do if p=='k' then king=i end end
 if b[j.move[2]]~='K' then
  for i,p in ipairs(c) do if B.side(p)=='red' then assert(not B.valid(c,i,king,false),'response exposes king') end end
 end
 return j,c
end
local values={k=1000000,K=1000000,R=900,N=400,C=450,P=100,r=900,n=400,c=450}
local function saved(b,c,attacker,target,j)
 return c[target]~=b[target] or c[attacker]~='N' or not B.valid(c,attacker,target,false)
  or (values[b[j.move[2]]] or 0)>=(values[b[target]] or 0)
end
-- Preserve the four existing crowded-position regressions. They are examples
-- of defensive responses, not a universal requirement that attacked pieces run.
for _,target in ipairs({1,9,2,8}) do
 check('crowded target '..target,function()
  local b=B.standard()
  local attacker
  for i=10,54 do
   local old=b[i];b[i]='N'
   if B.valid(b,i,target,false) and not B.valid(b,i,5,false) then attacker=i;break end
   b[i]=old
  end
  assert(attacker,'invalid single-threat fixture')
  local j,c=search(b)
  assert(saved(b,c,attacker,target,j),'ignored single '..b[target]..' threat; reply='..j.move[1]..'-'..j.move[2])
 end)
end
-- An undefended rook/horse/cannon faces a pawn capture. Kings use different
-- files, there is no second black attacker, and the pawn is not pinned to its
-- king: equal exchanges and a counter-pin cannot invalidate this expectation.
for _,kind in ipairs({'r','n','c'}) do for _,target in ipairs({41,49}) do
 check('undefended '..kind..' at '..target,function()
  local b={} for i=1,90 do b[i]='' end
  b[4]='k';b[87]='K';b[target]=kind;local pawn=target+9;b[pawn]='P'
  assert(B.valid(b,pawn,target,false) and not B.valid(b,pawn,4,false))
  local j,c=search(b)
  assert(c[target]~=kind or c[pawn]~='P' or not B.valid(c,pawn,target,false),'ignored a free pawn capture of '..kind)
 end)
end end
-- A fork does not require saving every attacked piece. Both major targets and
-- the attack itself are identified geometrically before the real AI is run.
for _,fork in ipairs({{attacker=13,horse=2,cannon=20},{attacker=15,horse=8,cannon=26}}) do
 check('horse/cannon fork '..fork.attacker,function()
  local b=B.standard();b[fork.attacker]='N'
  assert(B.valid(b,fork.attacker,fork.horse,false) and B.valid(b,fork.attacker,fork.cannon,false))
  assert(not B.valid(b,fork.attacker,5,false),'fork also attacks king')
  local j,c=search(b)
  assert(saved(b,c,fork.attacker,fork.horse,j) or saved(b,c,fork.attacker,fork.cannon,j),'fork answered neither target')
 end)
end
-- Sparse middle/endgame: no compensating king capture; each case runs even
-- when an earlier case failed. Failure summaries never hide the later cases.
for _,kind in ipairs({'R','C','N','P'}) do
 check('late horse threatened by '..kind,function()
  local b={} for i=1,90 do b[i]='' end
  b[6]='k';b[85]='K';b[41]='n';b[20]='c';b[55]='P'
  local attacker=kind=='N' and 60 or (kind=='P' and 50 or 68)
  b[attacker]=kind
  if kind=='C' then b[50]='p' end
  assert(B.valid(b,attacker,41,false),'invalid horse threat fixture')
  local j,c=search(b)
  assert(c[41]~='n' or c[attacker]~=kind or not B.valid(c,attacker,41,false),'ignored late horse threat')
 end)
end
print('THREAT SUMMARY '..(count-failed)..'/'..count)
assert(count==16,'incomplete threat fixtures')
assert(failed==0,'ignored '..failed..' threat cases')
