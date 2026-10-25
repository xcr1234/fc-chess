local Log=require('app.log')
local M={signalNames={[0]='FCChessDraw',[1]='FCChessWin',[2]='FCChessLose'}}
function M.new() return {} end
function M.sync(self,s)
 -- Only completed rounds write server state. Startup/reconnect never resets it.
 if s.completedOutcome==nil then return end
 if self.attemptedSequence==s.completionSequence then return end
 self.attemptedSequence=s.completionSequence
 local outcome=s.completedOutcome
 local signalName=M.signalNames[outcome]
 local ok,err=pcall(function()
  game.ServerSignal(signalName):SendSignal()
 end)
 if ok then
  self.sentSequence=s.completionSequence
  Log.event('completion-request','signal='..signalName..' outcome='..outcome..' sequence='..s.completionSequence)
 else
  -- Native signal definitions are connected in the editor. A missing/mistyped
  -- definition must not stop the board or generate an error on every redraw.
  Log.error('completion-request failed: '..tostring(err))
 end
end
return M
