local B=require('game.board')
local A=require('game.ai')
local failures=0
local function run(name,b,verify,opts)
 local key=B.key(b,'black',false)
 local j=A.new(b,'black',false,opts or {noBook=true});local initialEval=j.eval
 while not j.done do A.step(j,1/60) end
 local ok,err=pcall(function()
  assert(j.restored and B.key(j.board,'black',false)==key and B.key(b,'black',false)==key)
  assert(j.eval==initialEval,'incremental evaluation was not restored')
  assert(B.valid(b,j.move[1],j.move[2],false));verify(j)
 end)
 print((ok and 'PASS ' or 'FAIL ')..name..' depth='..j.depth..' nodes='..j.nodes..' move='..j.move[1]..'-'..j.move[2]..(err and ' '..err or ''))
 if not ok then failures=failures+1 end
end
local function empty() local b={} for i=1,90 do b[i]='' end return b end
local b=B.standard();b[46]=b[55];b[55]=''
run('out-of-book must not trade cannon for protected horse',b,function(j) assert(not (j.move[1]==20 and j.move[2]==83)) end)
-- Black rook must leave the red pawn attack; capturing the pawn is safe.
b=empty();b[5]='k';b[85]='K';b[41]='r';b[50]='P'
run('save attacked rook',b,function(j) assert(j.move[1]==41) end)
-- A free rook is worth taking; avoids an over-conservative no-capture fix.
b=empty();b[5]='k';b[85]='K';b[20]='c';b[29]='p';b[56]='R'
run('take genuinely free rook',b,function(j) assert(j.move[1]==20 and j.move[2]==56) end)
b=empty();b[5]='k';b[86]='K';b[77]='r'
run('immediate king capture',b,function(j) assert(j.move[2]==86) end)
-- At depth one the quiet king escape must still be examined by quiescence.
b=empty();b[5]='k';b[85]='K';b[23]='R';b[40]='p'
run('quiet escape from rook attack',b,function(j)
 local c=B.copy(b);c[j.move[2]]=c[j.move[1]];c[j.move[1]]=''
 local king;for i=1,90 do if c[i]=='k' then king=i end end
 for i=1,90 do if B.side(c[i])=='red' then assert(not B.valid(c,i,king,false),'king left capturable') end end
end,{noBook=true,maxDepth=1})
assert(failures==0,tostring(failures)..' tactical failures')
