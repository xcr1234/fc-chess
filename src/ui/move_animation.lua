local B=require('game.board')
local M={}
function M.new() return {epoch=nil,sequence=0,landed=0,discard=0,queue={}} end
function M.duration(a,b)
 local x,y=B.coords(a);local u,v=B.coords(b)
 return math.min(.42,math.max(.16,math.sqrt((u-x)^2+(v-y)^2)*16/128))
end
function M.sync(a,s,enabled)
 if a.epoch~=s.visualEpoch or not enabled then
  a.queue={};a.epoch=s.visualEpoch
  -- Reset/hidden pages discard pending sounds; fresh moves still animate.
  local first=enabled and s.visualMoves and s.visualMoves[1]
  local baseline=first and first.sequence-1 or s.moveSoundSequence
  a.sequence=baseline;a.landed=baseline;a.discard=baseline
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
  dt=dt-left;a.landed=move.event.sequence;table.remove(a.queue,1)
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
function M.soundState(a) return {landed=a.landed,discard=a.discard,busy=M.busy(a)} end
return M
