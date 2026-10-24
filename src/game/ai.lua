-- Stable game-facing facade; book policy is separate from the search kernel.
local Book=require('game.ai.book')
local Search=require('game.ai.search')
local P=require('game.ai.position')
local M={}
function M.bookEnabled(custom) return Book.enabled(custom) end
function M.book(b,custom,side) return Book.candidates(b,side or 'black',custom) end
function M.new(board,side,custom,opts)
 opts=opts or {}
 local job=Search.new(board,side,custom,opts)
 local wins=job.move and string.upper(board[job.move[2]])=='K'
 local choices=not opts.noBook and not job.rules.standard and not wins and M.book(board,custom,side)
 if choices then
  local fresh={}
  for _,m in ipairs(choices) do
   if not job.rootPenalties[P.move(P.from90[m[1]],P.from90[m[2]])] then fresh[#fresh+1]=m end
  end
  choices=#fresh>0 and fresh or nil
 end
 if choices then job.move,job.nextSeed=Book.choose(choices,opts.seed);job.done=true;job.book=true end
 return job
end
M.step=Search.step
M.cancel=Search.cancel
return M
