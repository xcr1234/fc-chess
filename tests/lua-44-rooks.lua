local S=require('game.session')
local B=require('game.board')
require('app.log').enabled=false
local failures=0
local function check(name,fn)local ok,err=pcall(fn);print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)));if not ok then failures=failures+1 end end
local function preset(s)S.action(s,'ModeCustom');S.action(s,'AllRooksButton') end
local function verify(s)
 local standard=B.standard();local rooks,kings,red,black=0,0,0,0
 for i,p in ipairs(s.board) do
  if i<=45 then assert(p==standard[i],'black half changed at '..i)
  else assert(p==(i==86 and 'K' or 'R'),'own half not full at '..i) end
  if p=='R' then rooks=rooks+1 end;if p=='K' then kings=kings+1 end
  if B.red(p) then red=red+1 elseif p~='' then black=black+1 end
 end
 assert(rooks==44 and kings==1 and red==45 and black==16)
end
check('BGM starts at 50 and user changes survive the preset',function()
 local s=S.new();assert(s.audio.volume==50);s.audio.volume=70;preset(s);assert(s.audio.volume==70)
end)
check('one preset click fills the own half and starts a red custom turn',function()
 local s=S.new();preset(s);verify(s)
 assert(s.scene=='player-turn' and s.custom and s.turn=='red' and s.moves==0 and #s.history==0)
 assert(table.concat(s.draft,',')==table.concat(s.board,',') and table.concat(s.initial,',')==table.concat(s.board,','))
end)
check('restart and returning to edit preserve the 44-rook draft; reset clears it',function()
 local s=S.new();preset(s);S.finish(s,'您落敗了','主動認輸');S.action(s,'RestartButton');verify(s)
 S.menu(s);S.action(s,'ModeCustom');assert(s.scene=='custom-edit');verify(s)
 S.action(s,'ResetCustomButton');assert(table.concat(s.board,',')==table.concat(B.standard(),','))
end)
check('front rook can move and undo cancels search and restores all 44 rooks',function()
 local s=S.new();preset(s);S.square(s,46);S.square(s,37);assert(s.moves==1 and s.board[37]=='R' and s.board[46]=='')
 S.action(s,'UndoButton');S.action(s,'ConfirmYes');assert(s.scene=='player-turn' and s.moves==0 and not s.job and not s.reply);verify(s)
end)
check('real custom AI completes a reply on the 61-piece board',function()
 local s=S.new();preset(s);S.square(s,46);S.square(s,37);assert(s.turn=='black')
 for i=1,1200 do S.update(s,1/30);if s.scene=='player-turn' then break end end
 assert(s.scene=='player-turn' and s.moves==2 and s.turn=='red','AI reply did not finish')
 assert(not s.job or s.job.restored,'AI working board not restored')
 S.undo(s);verify(s)
end)
assert(failures==0,tostring(failures)..' 44-rook failures')
