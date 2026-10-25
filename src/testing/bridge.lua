local U=require('ui.primitives')
local B=require('game.board')
local S=require('game.session')
local AI=require('game.ai')
local Wait=require('game.wait')
local F=require('testing.fixtures')
local M={}
local ready='';local probe
function M.setup(s,name)
 local f=F[name];local b=B.standard()
 if f.pieces then b={} for i=1,90 do b[i]='' end for _,p in ipairs(f.pieces) do b[B.index(p.file,p.rank)]=p.piece end end
 S.start(s,f.mode or 'difficult',b);s.bookSeed=f.bookSeed or s.bookSeed;s.fixture=f;s.aiInput=f.ai;s.moves=f.moveCount or 0;s.red=(f.redStepMilliseconds or 0)/1000;ready=name;probe=nil;s.replyIndex=0
 if f.phase=='ai-wait' then s.scene=f.phase;s.turn='black';local m=f.reply;s.reply={B.index(m[1],m[2]),B.index(m[3],m[4])};s.remaining=f.waitRemainingSeconds;s.replyVersion=s.version end
end
function M.init(host,s,render)
 local p=U.create('container',host,'TestBridge',-10000,-10000,1,1)
 p.showCursor=true
 for _,n in ipairs({'SceneState','ModeCount','SelectedSquare','RedRookCount','RedPieceCount','RuleProfile','PendingReply','ExtraWait','BookEnabled','BookUsed','SearchCompleteDepth','WorkingBoardRestored','PartialExactStored','CustomLightSearch','FirstIterationComplete','FixtureReady'}) do U.text(p,n,0,0,1,1,'','ffffff',6) end
 for _,n in ipairs({'MusicChoice','SfxEnabled','MusicVolumeValue','MoveSoundSequence','ExtraWaitInBounds'}) do U.text(p,n,0,0,1,1,'','ffffff',6) end
 for r=0,9 do for f=0,8 do U.text(p,'Piece_'..f..'_'..r,0,0,1,1,'','ffffff',6) end end
 for n in pairs(F) do U.hit(p,'TestSetup_'..n,0,0,1,1,function() M.setup(s,n);render() end) end
 U.hit(p,'TestComputeSummary',0,0,1,1,function() s.extraWait=Wait.seconds(s.mode,s.fixture.summary);render() end)
 U.hit(p,'TestProbeBook',0,0,1,1,function() render() end)
 U.hit(p,'TestRunBudget',0,0,1,1,function()
  probe=AI.new(s.board,'black',s.custom,{nodeBudget=s.fixture.ai.nodeBudget,noBook=true,maxDepth=s.fixture.ai.maxDepth})
  while not probe.done do AI.step(probe,0) end
  render()
 end)
end
function M.render(s)
 U.set('MusicChoice',s.audio.music);U.set('SfxEnabled',s.audio.sfx);U.set('MusicVolumeValue',s.audio.volume);U.set('MoveSoundSequence',s.moveSoundSequence)
 U.set('FixtureReady',ready);U.set('SceneState',s.scene);U.set('ModeCount',3)
 local bounds=s.fixture and s.fixture.waitRange
 U.set('ExtraWaitInBounds',bounds and s.extraWait>=bounds[1] and s.extraWait<=bounds[2] and s.extraWait==math.floor(s.extraWait) or false)
 local selected='none';if s.selected then local f,r=B.coords(s.selected);selected=f..','..r end U.set('SelectedSquare',selected)
 local count,rooks=0,0
 for i,p in ipairs(s.board) do if B.red(p) then count=count+1 end if p=='R' then rooks=rooks+1 end local f,r=B.coords(i);U.set('Piece_'..f..'_'..r,p) end
 U.set('RedRookCount',rooks);U.set('RedPieceCount',count);U.set('RuleProfile',S.profile(s));U.set('PendingReply',s.reply and 'pending' or 'none');U.set('ExtraWait',s.extraWait);U.set('BookEnabled',AI.bookEnabled(s.custom))
 local job=probe or s.job;U.set('BookUsed',job and job.book or false);U.set('SearchCompleteDepth',job and job.depth or 0);U.set('WorkingBoardRestored',not job or job.restored);U.set('PartialExactStored',job and job.partialExact or false)
 U.set('CustomLightSearch',job and job.lightweight or false);U.set('FirstIterationComplete',job and job.depth>=1 or false)
end
return M
