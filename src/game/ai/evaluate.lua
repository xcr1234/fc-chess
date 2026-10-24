-- SPDX-License-Identifier: GPL-2.0-or-later
-- Port of XQWLight JS 1.0 evaluation, Morning Yellow (C) 2004-2012 www.xqbase.com.
local T=require('game.ai.tables')
local M={}
function M.piece(pc,sq,rules)
 local value=T.value[pc][sq]
 -- The JS table already includes material. Extend only previously unvalued
 -- free red advisor/elephant squares on the same bounded 18..23 scale.
 if rules.freeRed and (pc==9 or pc==10) and value==0 then
  return 18+math.min(5,4-math.abs(sq%16-7)+1)
 end
 return value
end
function M.score(pos,ply)
 local value=(pos.side==0 and pos.red-pos.black or pos.black-pos.red)+3
 local draw=ply%2==0 and -20 or 20
 if value==draw then value=value-1 end
 -- Even malformed/extreme custom armies cannot outrank terminal scores.
 return math.max(-9000,math.min(9000,value))
end
return M
