local Log=require('app.log')
local M={signalName='FCChessWin'}
function M.new() return {} end
function M.sync(self,s)
 -- Only a victory writes server state. All other outcomes keep platform defaults.
 if s.completedOutcome~=1 then return end
 if self.attemptedSequence==s.completionSequence then return end
 self.attemptedSequence=s.completionSequence
 local ok,err=pcall(function()
  game.ServerSignal(M.signalName):SendSignal()
 end)
 if ok then
  self.sentSequence=s.completionSequence
  Log.event('completion-request','signal='..M.signalName..' sequence='..s.completionSequence)
 else
  -- Native signal definitions are connected in the editor. A missing/mistyped
  -- definition must not stop the board or generate an error on every redraw.
  Log.error('completion-request failed: '..tostring(err))
 end
end
return M
