-- XQWLight data adapter. Generated data is GPL-2.0-or-later; retain its notices.
local B=require('game.board')
local P=require('game.ai.position')
local G=require('game.ai.movegen')
local R=require('game.ai.rules')
local M={}
local data
local function mirrorSquare(i) local f,r=B.coords(i);return B.index(8-f,r) end
local function positionKey(b,side,mirrored)
 local ranks={}
 for r=0,9 do
  local row={};local empty=0
  for f=0,8 do
   local p=b[B.index(mirrored and 8-f or f,r)]
   if p=='' then empty=empty+1
   else
    if empty>0 then row[#row+1]=tostring(empty);empty=0 end
    row[#row+1]=p
   end
  end
  if empty>0 then row[#row+1]=tostring(empty) end
  ranks[#ranks+1]=table.concat(row)
 end
 return table.concat(ranks,'/')..(side=='red' and ' w' or ' b')
end
function M.key(b,side)
 local direct=positionKey(b,side,false);local mirror=positionKey(b,side,true)
 if mirror<direct then return mirror,true end
 return direct,false
end
function M.enabled(custom) return not custom end
local function safe(pos,move,legal)
 local m=P.move(P.from90[move[1]],P.from90[move[2]])
 if not legal[m] then return false end
 return G.safe(pos,m)
end
function M.candidates(b,side,custom)
 if custom or (side~='red' and side~='black') then return nil end
 data=data or require('game.ai.book_data')
 local key,mirrored=M.key(b,side);local packed=data[key]
 if not packed then return nil end
 local pos=P.new(b,side,R.get(false));local legal={}
 for _,m in ipairs(G.generate(pos)) do legal[m]=true end
 local choices={}
 for i=1,#packed,9 do
  local a=tonumber(string.sub(packed,i,i+1));local z=tonumber(string.sub(packed,i+2,i+3));local weight=tonumber(string.sub(packed,i+4,i+8))
  if a and z and weight and a>=1 and a<=90 and z>=1 and z<=90 and weight>0 then
   if mirrored then a=mirrorSquare(a);z=mirrorSquare(z) end
   local move={a,z,weight}
   if safe(pos,move,legal) then choices[#choices+1]=move end
  end
 end
 if #choices>0 then return choices end
end
function M.choose(choices,seed)
 if not choices or #choices==0 then return nil end
 local state=math.floor(tonumber(seed) or 1)%2147483647
 if state<=0 then state=1 end
 -- Force floating arithmetic: exact below 2^53, including 32-bit Lua runtimes.
 state=(state*16807.0)%2147483647
 local total=0 for _,m in ipairs(choices) do total=total+m[3] end
 local ticket=(state/2147483647)*total
 for _,m in ipairs(choices) do
  ticket=ticket-m[3]
  if ticket<0 then return {m[1],m[2]},state end
 end
 local last=choices[#choices];return {last[1],last[2]},state
end
return M
