local S=require('game.session')
local B=require('game.board')
require('app.log').enabled=false
local failures=0
local function check(name,fn)local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)));if not ok then failures=failures+1 end end
local function edit()local s=S.new();S.action(s,'ModeCustom');return s end
check('bulk button opens palette without changing board or starting',function()
 local s=edit();local before=table.concat(s.board,',');S.action(s,'AllRooksButton')
 assert(s.scene=='custom-edit' and s.palette=='all','bulk button must wait for choice')
 assert(table.concat(s.board,',')==before and table.concat(s.draft,',')==before and s.moves==0)
 S.square(s,46);S.action(s,'StartCustomButton');assert(s.palette=='all' and s.scene=='custom-edit')
 S.action(s,'Choose_K');S.action(s,'Choose_Q');assert(s.palette=='all' and table.concat(s.board,',')==before)
end)
check('all six choices fill 44 own-half points, keep king/black army, and start once',function()
 for _,p in ipairs({'R','N','C','E','A','P'}) do
  local s=edit();S.action(s,'AllRooksButton');S.action(s,'Choose_'..p)
  assert(s.scene=='player-turn' and not s.palette and s.custom and s.moves==0 and #s.history==0)
  local standard=B.standard();for i=1,90 do
   assert(s.board[i]==(i<=45 and standard[i] or (i==86 and 'K' or p)),'wrong piece at '..i..' for '..p)
   assert(s.board[i]==s.draft[i] and s.board[i]==s.initial[i])
  end
  local version=s.version;S.action(s,'Choose_'..p);assert(s.version==version,'duplicate selection restarted game')
 end
end)
check('cancel keeps a manually edited draft and later single edits stay local',function()
 local s=edit();S.square(s,46);S.action(s,'Choose_N');local before=table.concat(s.board,',')
 S.action(s,'AllRooksButton');S.action(s,'PaletteCancel');assert(s.scene=='custom-edit' and not s.palette)
 assert(table.concat(s.board,',')==before and table.concat(s.draft,',')==before)
 S.square(s,47);assert(s.palette==47);S.action(s,'Choose_A');assert(s.board[46]=='N' and s.board[47]=='A' and s.board[48]=='')
end)
check('non-rook bulk lineup survives restart/menu and reset returns to standard',function()
 local s=edit();S.action(s,'AllRooksButton');S.action(s,'Choose_C');assert(s.board[46]=='C');local before=table.concat(s.board,',')
 S.finish(s,'您落敗了','主動認輸');S.action(s,'RestartButton');assert(table.concat(s.board,',')==before)
 S.menu(s);S.action(s,'ModeCustom');assert(table.concat(s.board,',')==before)
 S.action(s,'ResetCustomButton');assert(table.concat(s.board,',')==table.concat(B.standard(),','))
 S.square(s,46);S.action(s,'Choose_R');S.action(s,'StartCustomButton');assert(s.board[46]=='R' and s.board[47]=='')
end)
assert(failures==0,tostring(failures)..' bulk piece failures')
