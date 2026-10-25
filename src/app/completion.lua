local Log=require('app.log')
local M={signalName='FCChessCompletion'}
function M.new() return {} end
function M.sync(self,s)
 if self.attemptedSequence==s.completionSequence then return end
 self.attemptedSequence=s.completionSequence
 local completed=s.completedOutcome~=nil
 local outcome=s.completedOutcome or 0
 local ok,err=pcall(function()
  local signal=game.ServerSignal(M.signalName)
  signal:AddBool(completed);signal:AddInt(outcome);signal:SendSignal()
 end)
 if ok then
  self.sentSequence=s.completionSequence
  Log.event('completion-request','completed='..tostring(completed)..' outcome='..outcome..' sequence='..s.completionSequence)
 else
  -- Native signal definitions are connected in the editor. A missing/mistyped
  -- definition must not stop the board or generate an error on every redraw.
  Log.error('completion-request failed: '..tostring(err))
 end
end
return M
