-- Diagnostic positions reconstructed from user feedback; not exact recorded games.
local B=require('game.board')
local A=require('game.ai')
local function move(b,a,z)
 assert(B.valid(b,a,z,false),'invalid fixture '..a..'-'..z)
 b[z]=b[a];b[a]=''
end
local function report(label,b)
 local started=os.clock()
 local j=A.new(b,'black',false,{nodeBudget=NODE_BUDGET or 1600,maxDepth=DEPTH or 3,noBook=label=='isolated-out-of-book-edge-pawn'})
 local frames=0
 while not j.done do A.step(j,1/60);frames=frames+1 end
 local m=j.move
 print(string.format('RESULT %s book=%s depth=%d nodes=%d frames=%d elapsed=%.3f move=%d-%d piece=%s captured=%s seconds=%.3f gap=%s',label,tostring(j.book),j.depth,j.nodes,frames,j.elapsed,m[1],m[2],b[m[1]],b[m[2]],os.clock()-started,tostring(j.summary.gap)))
 local c=B.copy(b);move(c,m[1],m[2])
 local replies=B.moves(c,'red',false,true)
 for _,r in ipairs(replies) do if r[2]==m[2] or c[r[2]]=='k' then print('RECAPTURE '..label..' '..r[1]..'-'..r[2]..' '..c[r[1]]..'x'..c[r[2]]) end end
 assert(j.restored and B.key(b,'black',false)==B.key(j.board,'black',false))
end
local b=B.standard();move(b,65,68);report('red-middle-cannon',b)
move(b,20,23)
local capture=B.copy(b);move(capture,68,32);report('middle-cannon-takes-pawn',capture)
local idle=B.copy(b);move(idle,55,46);report('middle-cannon-then-edge-pawn',idle)
local edge=B.standard();move(edge,55,46);report('isolated-out-of-book-edge-pawn',edge)
