local B=require('game.board')
local AI=require('game.ai')
local Wait=require('game.wait')
local Counter=require('game.thinking_counter')
local Log=require('app.log')
local Settings=require('audio.settings')
local M={}
local gameSerial=0
local function other(s) return s=='red' and 'black' or 'red' end
function M.new() return {scene='mode-select',mode='difficult',board=B.standard(),draft=B.standard(),initial=B.standard(),turn='red',moves=0,red=0,black=0,aiCounter=Counter.new(),version=0,history={},status='請選擇模式',extraWait=0,audio=Settings.new(),moveSoundSequence=0} end
function M.cancel(s,reason)
 AI.cancel(s.job);s.job=nil;s.reply=nil;s.ready=false;s.remaining=0;s.extraWait=0;s.version=s.version+1
 Log.event('cancel',reason..' version='..s.version)
end
function M.start(s,mode,board)
 M.cancel(s,'start');s.mode=mode;s.custom=mode=='custom';s.board=B.copy(board or B.standard());s.initial=B.copy(s.board)
 gameSerial=(gameSerial+1)%20000;s.bookSeed=gameSerial*104729+1
 local red,black=false,false for _,p in ipairs(s.board) do red=red or p=='K';black=black or p=='k' end
 assert(red and black,'Invalid initial board: both kings required')
 s.scene='player-turn';s.turn='red';s.moves=0;s.red=0;s.black=0;s.selected=nil;s.modal=nil;s.palette=nil;s.history={};s.extraWait=0;s.status='請走棋';s.fixture=nil;s.aiInput=nil
 s.aiCounter=Counter.new();s.lastAiMove=nil
 Log.event('start',mode..' profile='..M.profile(s))
end
function M.profile(s) return s.custom and 'custom-capture-free-advisor-elephant-v1' or 'casual-capture-v1' end
function M.finish(s,title,reason)
 M.cancel(s,'result');s.scene='result';s.modal=nil;s.selected=nil;s.resultTitle=title;s.resultReason=reason;s.status=reason
 Log.event('result',title..' '..reason..' moves='..s.moves)
end
function M.menu(s) M.cancel(s,'menu');s.scene='mode-select';s.modal=nil;s.palette=nil;s.selected=nil;s.status='請選擇模式';s.aiCounter=Counter.new();s.lastAiMove=nil end
function M.begin(s,side)
 s.turn=side;s[side]=0
 if #B.moves(s.board,side,s.custom)==0 then
  side=other(side)
  if #B.moves(s.board,side,s.custom)==0 then M.finish(s,'本局無法繼續','雙方暫無可走棋');return end
  s.turn=side;s[side]=0;Log.event('skip','no basic move; next='..side)
 end
 if side=='red' then s.scene='player-turn';s.status='請走棋';return end
 s.scene='ai-search';s.status='思考中';s.compute=0;s.replyVersion=s.version
 s.aiCounter=Counter.new()
 local a=s.aiInput
 if a=='hold' or (type(a)=='table' and (a.computeSeconds or a.replySequence)) then return end
 Log.event('ai-position','side=black profile='..M.profile(s)..' board='..table.concat(s.board,','))
 s.job=AI.new(s.board,'black',s.custom,{seed=s.bookSeed})
 if s.job.done then M.computed(s,s.job.move,s.job.summary) end
end
function M.commit(s,m)
 if not m or not B.valid(s.board,m[1],m[2],s.custom) or B.side(s.board[m[1]])~=s.turn then return false end
 if s.turn=='red' then
  s.history[#s.history+1]={board=B.copy(s.board),moves=s.moves,black=s.black,bookSeed=s.bookSeed,lastAiMove=s.lastAiMove,aiCounter={elapsed=s.aiCounter.elapsed,value=s.aiCounter.value}}
 else
  if s.job and s.job.nextSeed then s.bookSeed=s.job.nextSeed end
  s.lastAiMove={m[1],m[2]};Counter.finish(s.aiCounter)
 end
 local captured=s.board[m[2]];s.board[m[2]]=s.board[m[1]];s.board[m[1]]='';s.moves=s.moves+1;s.selected=nil
 s.moveSoundSequence=s.moveSoundSequence+1
 Log.event('move',s.turn..' '..m[1]..'->'..m[2]..' captured='..captured..' step='..string.format('%.2f',s[s.turn])..' count='..s.moves)
 if captured=='k' then M.finish(s,'您獲勝了','吃掉黑將')
 elseif captured=='K' then M.finish(s,'您落敗了','帥被吃掉')
 else M.begin(s,other(s.turn)) end
 return true
end
function M.computed(s,move,summary)
 s.reply=move;s.replyVersion=s.version;s.extraWait=Wait.seconds(s.mode,summary,s.waitPolicy)
 local a=s.aiInput
 if type(a)=='table' and a.waitSeconds then s.extraWait=a.waitSeconds elseif s.fixture and s.fixture.waitSeconds then s.extraWait=s.fixture.waitSeconds end
 s.remaining=s.extraWait;s.scene='ai-wait'
 Log.event('ai',string.format('depth=%d nodes=%d compute=%.3f wait=%.3f book=%s reason=%s score=%s',s.job and s.job.depth or 0,s.job and s.job.nodes or 0,s.compute or 0,s.extraWait,tostring(s.job and s.job.book or false),s.job and (s.job.book and 'book' or s.job.reason) or 'fixture',tostring(s.job and s.job.score)))
 if s.remaining<=0 then M.submitReply(s) end
end
-- Add seconds to the current artificial wait only. Does not restart search.
-- extraWait is the planned total; remaining is the current countdown.
function M.extendWait(s,seconds)
 if s.mode=='fast' or s.scene~='ai-wait' or not s.reply or s.replyVersion~=s.version then return false end
 if type(seconds)~='number' or seconds~=seconds or seconds<=0 or seconds==math.huge then return false end
 local remaining=math.max(0,s.remaining)+seconds
 if remaining==math.huge or s.extraWait+seconds==math.huge then return false end
 s.extraWait=s.extraWait+seconds;s.remaining=remaining;s.ready=false
 return true
end
function M.submitReply(s)
 if s.modal then s.ready=true;return end
 if s.replyVersion~=s.version or s.turn~='black' then s.reply=nil;s.ready=false;Log.event('stale','discard reply');return end
 local m=s.reply;s.reply=nil;s.ready=false
 if not M.commit(s,m) then Log.error('AI reply illegal');M.begin(s,'red') end
end
function M.square(s,i)
 if s.modal or s.palette or s.scene=='result' or s.scene=='mode-select' then return end
 if s.scene=='custom-edit' then
  if s.board[i]=='K' then s.status='帥保留，不能修改'
  elseif B.red(s.board[i]) then s.palette=i else s.status='只能修改紅方棋子' end
  return
 end
 if s.scene~='player-turn' then return end
 if B.red(s.board[i]) then s.selected=s.selected~=i and i or nil;s.status='請選擇落點';return end
 if not s.selected then s.status='請先選擇己方棋子';return end
 if not M.commit(s,{s.selected,i}) then s.status='這步不能走';Log.event('invalid','target='..i) end
end
function M.undo(s)
 if s.scene=='result' or s.scene=='mode-select' or s.modal then return end
 local h=table.remove(s.history)
 if not h then s.status='尚無棋步可悔';return end
 M.cancel(s,'undo');s.board=B.copy(h.board);s.moves=h.moves;s.black=h.black;s.red=0;s.turn='red';s.scene='player-turn';s.selected=nil;s.status='已悔棋'
 s.bookSeed=h.bookSeed
 s.lastAiMove=h.lastAiMove;s.aiCounter=h.aiCounter
end
function M.action(s,name)
 if Settings.action(s,name) then return end
 if s.modal then
  if name=='ConfirmNo' then s.modal=nil;if s.ready then M.submitReply(s) end
  elseif name=='ConfirmYes' then
   if s.modal=='undo' then s.modal=nil;M.undo(s)
   elseif s.modal=='resign' then M.finish(s,'您落敗了','主動認輸') else M.menu(s) end
  end
  return
 end
 if s.palette then
  local p=name:match('^Choose_(%u)$')
  if p and p~='K' then s.board[s.palette]=p;s.draft=B.copy(s.board);s.palette=nil elseif name=='PaletteCancel' then s.palette=nil end
  return
 end
 if s.scene=='mode-select' then
  if name=='ModeCustom' then M.cancel(s,'edit');s.mode='custom';s.custom=true;s.board=B.copy(s.draft);s.scene='custom-edit';s.moves=0;s.red=0;s.black=0;s.turn='red';s.status='點擊紅方棋子修改'
  elseif name=='ModeDifficult' or name=='ModeFast' then M.start(s,name=='ModeFast' and 'fast' or 'difficult') end
 elseif s.scene=='custom-edit' then
  if name=='AllRooksButton' then for i,p in ipairs(s.board) do if B.red(p) and p~='K' then s.board[i]='R' end end s.draft=B.copy(s.board)
  elseif name=='ResetCustomButton' then s.board=B.standard();s.draft=B.copy(s.board)
  elseif name=='StartCustomButton' then M.start(s,'custom',s.draft)
  elseif name=='EditBackButton' then M.menu(s) end
 elseif s.scene=='result' then
  if name=='RestartButton' then M.start(s,s.mode,s.initial) elseif name=='ModeButton' then M.menu(s) end
 elseif name=='UndoButton' then if #s.history>0 then s.modal='undo' else s.status='尚無棋步可悔' end
 elseif name=='ResignButton' then s.modal='resign'
 elseif name=='ModeButton' then s.modal='menu' end
end
function M.update(s,dt)
 if s.scene=='player-turn' or s.scene=='ai-search' or s.scene=='ai-wait' then s[s.turn]=s[s.turn]+dt end
 if s.scene=='ai-search' or s.scene=='ai-wait' then Counter.update(s.aiCounter,dt) end
 if s.scene=='ai-search' then
  s.compute=s.compute+dt
  local a=s.aiInput
  if a=='hold' then return end
  if type(a)=='table' and (a.computeSeconds or a.replySequence) then
   if s.compute+1e-8<(a.computeSeconds or 0) then return end
   local move
   if a.replySequence then s.replyIndex=(s.replyIndex or 0)+1;local m=a.replySequence[s.replyIndex];if m then move={B.index(m[1],m[2]),B.index(m[3],m[4])} end end
   move=move or B.moves(s.board,'black',s.custom)[1];M.computed(s,move,{count=1})
  else
   AI.step(s.job,dt)
   if s.job.done then M.computed(s,s.job.move,s.job.summary) end
  end
 elseif s.scene=='ai-wait' then s.remaining=s.remaining-dt;if s.remaining<=1e-8 then M.submitReply(s) end end
end
function M.format(seconds) local n=math.floor(seconds+1e-8);return string.format('%02d:%02d',math.floor(n/60),n%60) end
return M
