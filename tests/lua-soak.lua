local B=require('game.board')
local A=require('game.ai')
local S=require('game.session')
require('app.log').enabled=false
-- Real engine on both sides, production budgets, no fixture replies.
for _,custom in ipairs({false,true}) do
 local s=S.new();S.start(s,custom and 'custom' or 'fast')
 if custom then for i,p in ipairs(s.board) do if B.red(p) and p~='K' then s.board[i]='R' end end end
 local totalNodes,searches,minDepth,maxFrame=0,0,99,0
 local started=os.clock()
 for ply=1,80 do
  if s.scene=='result' then break end
  local side=s.turn;local before=B.key(s.board,side,s.custom)
  local j=A.new(s.board,side,s.custom,{noBook=true})
  local frames=0
  while not j.done do
   local t=os.clock();A.step(j,1/60);maxFrame=math.max(maxFrame,os.clock()-t);frames=frames+1;assert(frames<=241)
  end
  assert(j.restored and B.key(j.board,side,s.custom)==before and B.key(s.board,side,s.custom)==before)
  assert(not j.partialExact and j.move and B.valid(s.board,j.move[1],j.move[2],s.custom))
  totalNodes=totalNodes+j.nodes;searches=searches+1;minDepth=math.min(minDepth,j.depth)
  A.cancel(s.job);s.job=nil
  assert(S.commit(s,j.move))
  if ply%10==0 then print(string.format('PROGRESS custom=%s searches=%d plies=%d',tostring(custom),searches,s.moves)) end
 end
 print(string.format('SOAK custom=%s plies=%d scene=%s searches=%d nodes=%d minDepth=%d cpuSeconds=%.3f maxSearchStepMs=%.3f',tostring(custom),s.moves,s.scene,searches,totalNodes,minDepth,os.clock()-started,maxFrame*1000))
 S.cancel(s,'soak-complete')
end
