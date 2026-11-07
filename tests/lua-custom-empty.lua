local S=require('game.session')
local B=require('game.board')
require('app.log').enabled=false
local failures=0
local function check(name,fn)local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)));if not ok then failures=failures+1 end end
local function edit() local s=S.new();S.action(s,'ModeCustom');return s end
check('every empty own-half square accepts all six red piece types',function()
 for i=46,90 do if B.standard()[i]=='' then for _,p in ipairs({'R','N','C','E','A','P'}) do
  local s=edit();S.square(s,i);assert(s.palette==i,'empty square blocked: '..i)
  S.action(s,'Choose_'..p);assert(s.board[i]==p and s.draft[i]==p and not s.palette)
  for j=1,90 do if j~=i then assert(s.board[j]==B.standard()[j]) end end
  assert(s.scene=='custom-edit' and s.moves==0)
 end end end
end)
check('cancel leaves an empty square and draft unchanged',function()
 local s=edit();S.square(s,46);assert(s.palette==46);S.action(s,'PaletteCancel')
 assert(s.board[46]=='' and s.draft[46]=='' and not s.palette)
end)
check('king and every black-half square remain protected',function()
 local s=edit();local before=table.concat(s.board,',')
 for i=1,45 do S.square(s,i);assert(not s.palette) end
 S.square(s,86);assert(not s.palette and s.status=='帥保留，不能修改')
 assert(table.concat(s.board,',')==before)
 S.square(s,82);assert(s.palette==82);S.action(s,'Choose_N');assert(s.board[82]=='N')
end)
check('added piece can be replaced; draft survives menu, start, move, undo and restart',function()
 local s=edit();S.square(s,46);assert(s.palette==46);S.action(s,'Choose_R')
 S.square(s,46);S.action(s,'Choose_N');assert(s.board[46]=='N')
 S.square(s,46);S.action(s,'Choose_R');S.action(s,'EditBackButton');S.action(s,'ModeCustom');assert(s.board[46]=='R')
 S.action(s,'StartCustomButton');assert(s.scene=='player-turn' and s.initial[46]=='R')
 S.square(s,46);S.square(s,37);assert(s.moves==1 and s.board[37]=='R')
 S.action(s,'UndoButton');S.action(s,'ConfirmYes');assert(s.board[46]=='R' and s.moves==0)
 S.finish(s,'您落敗了','主動認輸');S.action(s,'RestartButton');assert(s.board[46]=='R' and s.moves==0)
end)
check('reset discards additions; all-rooks still fills 44 and starts immediately',function()
 local s=edit();S.square(s,46);assert(s.palette==46);S.action(s,'Choose_A');S.action(s,'ResetCustomButton')
 assert(table.concat(s.board,',')==table.concat(B.standard(),',') and s.draft[46]=='')
 S.action(s,'AllRooksButton');S.action(s,'Choose_R');local rooks=0;for _,p in ipairs(s.board) do if p=='R' then rooks=rooks+1 end end
 assert(rooks==44 and s.scene=='player-turn' and s.board[86]=='K')
end)
assert(failures==0,tostring(failures)..' custom empty-square failures')
