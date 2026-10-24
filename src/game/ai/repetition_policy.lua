-- AI preference only. Inspired by XQWLight's history/book repetition checks;
-- never adjudicates a game or removes a player's basic moves.
local B=require('game.board')
local P=require('game.ai.position')
local M={}
function M.penalties(board,side,custom,history)
 local out={};if not history or #history==0 then return out end
 local counts={}
 for _,key in ipairs(history) do counts[key]=(counts[key] or 0)+1 end
 local b=B.copy(board);local nextSide=side=='black' and 'red' or 'black'
 for _,m in ipairs(B.moves(b,side,custom)) do
  local a,z=m[1],m[2];local pc,cap=b[a],b[z]
  if cap=='' then
   b[z]=pc;b[a]=''
   local n=counts[B.key(b,nextSide,custom)] or 0
   b[a]=pc;b[z]=cap
   if n>0 then out[P.move(P.from90[a],P.from90[z])]=math.min(36,n*12) end
  end
 end
 return out
end
return M
