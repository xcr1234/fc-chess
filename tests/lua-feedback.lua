local S=require('game.session')
require('app.log').enabled=false
local failures=0
local function check(name,fn)
 local ok,err=pcall(fn)
 print((ok and 'PASS ' or 'FAIL ')..name..(ok and '' or ': '..tostring(err)))
 if not ok then failures=failures+1 end
end
local function thinking(mode)
 local s=S.new();S.start(s,mode or 'difficult');s.aiInput='hold';S.commit(s,{55,46});return s
end
check('AI move records both endpoints; selection does not replace them; undo restores prior feedback',function()
 local s=S.new();S.start(s,'fast')
 s.aiInput={computeSeconds=.1,waitSeconds=0,replySequence={{0,3,0,4},{2,3,2,4}}}
 S.commit(s,{55,46});S.update(s,.2)
 assert(s.lastAiMove and s.lastAiMove[1]==28 and s.lastAiMove[2]==37,'missing AI origin/destination')
 local first=s.aiCounter.value
 S.square(s,57);assert(s.selected==57 and s.lastAiMove[2]==37)
 S.square(s,48);assert(s.aiCounter.value==0,'new AI turn must start at zero')
 S.update(s,.4);assert(s.lastAiMove[1]==30 and s.lastAiMove[2]==39)
 S.undo(s);assert(s.moves==2 and s.lastAiMove[1]==28 and s.lastAiMove[2]==37 and s.aiCounter.value==first)
 S.undo(s);assert(s.moves==0 and not s.lastAiMove and s.aiCounter.value==0)
end)
check('thinking number grows frequently in search and wait and freezes after actual submission',function()
 local s=thinking();local previous=0
 for i=1,20 do S.update(s,.05);assert(s.aiCounter.value>previous,'number did not refresh');previous=s.aiCounter.value end
 s.aiInput={computeSeconds=0,waitSeconds=2,replySequence={{0,3,0,4}}}
 S.update(s,.1);assert(s.scene=='ai-wait');previous=s.aiCounter.value
 S.update(s,.1);assert(s.aiCounter.value>previous,'stopped during extra wait')
 S.update(s,2);assert(s.scene=='player-turn' and s.aiCounter.value>=1000)
 local final=s.aiCounter.value;S.update(s,60);assert(s.aiCounter.value==final)
end)
check('longer actual AI wait raises the final number beyond 40000',function()
 local values={}
 for _,elapsed in ipairs({0,.2,1,4,8,16,30,60}) do
  local s=thinking();S.update(s,elapsed)
  -- Isolate counter growth from the difficulty's random 10-20 second wait.
  s.aiInput={waitSeconds=4};S.computed(s,{28,37},{count=1});S.update(s,4)
  assert(s.moves==2 and s.aiCounter.value>=1000)
  values[#values+1]=s.aiCounter.value
 end
 assert(values[7]>40000,'long turn still stops at 40000')
 for i=2,#values do assert(values[i]>values[i-1],'longer wait did not produce a higher final number') end
 local Counter=require('game.thinking_counter')
 assert(Counter.format({value=values[8]})==tostring(values[8]) and #tostring(values[8])==6)
end)
check('growth is independent of frame splitting and never bypasses confirmation',function()
 local a,b=thinking(),thinking()
 for i=1,40 do S.update(a,.05) end S.update(b,2)
 assert(a.aiCounter.value==b.aiCounter.value,'frame rate changed the number')
 a.aiInput={computeSeconds=0,waitSeconds=0,replySequence={{0,3,0,4}}}
 S.action(a,'ResignButton');S.update(a,.1)
 assert(a.ready and a.moves==1 and not a.lastAiMove)
 local before=a.aiCounter.value;S.update(a,2);assert(a.aiCounter.value>before and a.moves==1)
 S.action(a,'ConfirmNo');assert(a.moves==2 and a.lastAiMove[2]==37)
 local final=a.aiCounter.value;S.update(a,10);assert(a.aiCounter.value==final)
end)
check('fast book replies, cancellation, restart and custom editing reset feedback safely',function()
 local s=S.new();S.start(s,'fast');S.commit(s,{65,68}) -- source-book central cannon
 S.update(s,.6)
 assert(s.moves==2 and s.aiCounter.value>=1000 and s.aiCounter.value<=40000 and s.lastAiMove)
 S.finish(s,'您落敗了','主動認輸');S.action(s,'RestartButton')
 assert(not s.lastAiMove and s.aiCounter.value==0)
 s.aiInput='hold';S.commit(s,{55,46});S.update(s,2);S.undo(s);S.update(s,20)
 assert(s.aiCounter.value==0 and not s.lastAiMove and s.moves==0)
 S.menu(s);S.action(s,'ModeCustom');assert(not s.lastAiMove and s.aiCounter.value==0)
end)
check('AI king capture preserves final move feedback and freezes its number in results',function()
 local board={} for i=1,90 do board[i]='' end board[5]='k';board[86]='K';board[77]='r'
 local s=S.new();S.start(s,'fast',board);s.aiInput='hold';S.begin(s,'black');S.update(s,3)
 S.computed(s,{77,86},{count=1})
 assert(s.scene=='result' and s.lastAiMove[1]==77 and s.lastAiMove[2]==86)
 local final=s.aiCounter.value;S.update(s,60);assert(s.aiCounter.value==final)
end)
assert(failures==0,tostring(failures)..' feedback regressions failed')
