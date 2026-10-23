local B=require('game.board');local A=require('game.ai')
local failed,count=0,0
-- Geometrically legal reconstructed middlegames, not a replay of user games.
for _,target in ipairs({1,9,2,8,20,26}) do
 local b=B.standard();local attacker
 -- Place a red knight at a legal attack square of the target.
 for i=10,54 do
  local old=b[i];b[i]='N'
  if B.valid(b,i,target,false) and not B.valid(b,i,5,false) then attacker=i;break end
  b[i]=old
 end
 if attacker then
  count=count+1
  local victim=b[target];local key=B.key(b,'black',false)
  local j=A.new(b,'black',false,{noBook=true})
  while not j.done do A.step(j,1/60) end
  local c=B.copy(b);c[j.move[2]]=c[j.move[1]];c[j.move[1]]=''
  local saved=c[target]~=victim or c[attacker]~='N' or not B.valid(c,attacker,target,false)
  -- Winning the king or taking an equal/higher-valued piece also answers the threat.
  local values={k=1000000,K=1000000,R=900,N=400,C=450,P=100,r=900,n=400,c=450}
  saved=saved or (values[b[j.move[2]]] or 0)>=(values[victim] or 0)
  assert(j.restored and B.key(b,'black',false)==key)
  print((saved and 'PASS ' or 'FAIL ')..'knight threatens '..victim..' at '..target..' from '..attacker..' reply='..j.move[1]..'-'..j.move[2]..' depth='..j.depth)
  if not saved then failed=failed+1 end
 end
end
assert(count==6,'incomplete threat fixtures');assert(failed==0,'ignored '..failed..' direct threats')

-- Sparse middle/endgame: a threatened horse must be saved, the attack removed,
-- or the attacker captured. These positions have no compensating king capture.
for _,kind in ipairs({'R','C','N','P'}) do
 local b={} for i=1,90 do b[i]='' end
 b[6]='k';b[85]='K';b[41]='n';b[20]='c';b[55]='P'
 local attacker=kind=='N' and 60 or (kind=='P' and 50 or 68)
 b[attacker]=kind
 if kind=='C' then b[50]='p' end
 assert(B.valid(b,attacker,41,false),'invalid horse threat fixture')
 local j=A.new(b,'black',false,{noBook=true})
 while not j.done do A.step(j,1/60) end
 local c=B.copy(b);c[j.move[2]]=c[j.move[1]];c[j.move[1]]=''
 assert(j.restored)
 local saved=c[41]~='n' or c[attacker]~=kind or not B.valid(c,attacker,41,false)
 print((saved and 'PASS ' or 'FAIL ')..'late horse threatened by '..kind..' reply='..j.move[1]..'-'..j.move[2]..' depth='..j.depth)
 assert(saved,'ignored late horse threat from '..kind)
end
