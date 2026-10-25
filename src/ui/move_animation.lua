local B=require('game.board')
local M={}
function M.new() return {epoch=nil,sequence=0,queue={}} end
function M.duration(a,b)
 local x,y=B.coords(a);local u,v=B.coords(b)
 return math.min(.42,math.max(.16,math.sqrt((u-x)^2+(v-y)^2)*16/128))
end
function M.sync(a,s,enabled)
 if a.epoch~=s.visualEpoch or not enabled then
  a.queue={};a.epoch=s.visualEpoch
  -- A fresh board starts at the first unconsumed move; hidden pages snap.
  a.sequence=enabled and 0 or s.moveSoundSequence
 end
 if enabled then for _,event in ipairs(s.visualMoves or {}) do
  if event.sequence>a.sequence then
   a.queue[#a.queue+1]={event=event,elapsed=0,duration=M.duration(event.from,event.to)}
   a.sequence=event.sequence
  end
 end end
end
function M.update(a,dt)
 if type(dt)~='number' or dt~=dt or dt<=0 or dt==math.huge then return end
 while a.queue[1] do
  local move=a.queue[1];local left=move.duration-move.elapsed
  if dt<left then move.elapsed=move.elapsed+dt;return end
  dt=dt-left;table.remove(a.queue,1)
 end
end
function M.frame(a,s)
 local move=a.queue[1]
 if not move then return s.board end
 local e=move.event;local board=B.copy(e.before);board[e.from]=''
 local f,r=B.coords(e.from);local u,v=B.coords(e.to);local t=move.elapsed/move.duration
 return board,{piece=e.piece,x=math.floor(56+16*(f+(u-f)*t)-128+.5),y=math.floor(176-16*(r+(v-r)*t)-112+.5),sequence=e.sequence}
end
function M.busy(a) return a and #a.queue>0 end
return M
