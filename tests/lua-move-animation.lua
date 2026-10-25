local V=require('ui.view')
local U=require('ui.primitives')
local S=require('game.session')
require('app.log').enabled=false
Enum={ImageSource={StaticReference=1},CursorEventType={CursorClick=1},TextHorizontalAlignment={Middle=1,Left=2},TextVerticalAlignment={Middle=1},KeyEventType={}}
Color=function(r,g,b,a)return {r,g,b,a} end
local host={children={}}
game={GetUICanvasSize=function()return 1600,900 end,SetControllerFocus=function()end}
function game.InstantiateClientUIControl(_,parent)
 local c={parent=parent,children={},visible=true};parent.children[#parent.children+1]=c
 function c:SetAnchorMin()end function c:SetAnchorMax()end function c:SetPivot()end function c:SetActive()end
 function c:SetSizeDelta(x,y)self.w=x;self.h=y end
 function c:SetAnchoredPosition(x,y)self.x=x;self.y=y end
 function c:SetLocalScale()end function c:SetImage()end function c:SetVisible(v)self.visible=v end function c:SetLocalRotation()end
 function c:AddCursorEventListener(_,fn)self.click=fn end function c:AddKeyEventListener()end
 return c
end
function game.DestroyClientUIControl(c)
 c.destroyed=true
 for i,v in ipairs(c.parent.children)do if v==c then table.remove(c.parent.children,i);break end end
end
local function find(c,name)
 if c.name==name then return c end
 for _,v in ipairs(c.children)do local found=find(v,name);if found then return found end end
end
local s=S.new();S.start(s,'difficult');s.aiInput='hold'
V.init(host,function()end,function()end);V.render(s)
S.square(s,55);V.render(s)
assert(not find(host,'SelectionEdge55_1'),'selected square frame still drawn')
local white=assert(find(host,'DiskArt_55White1'))
assert(white.imageColor[1]<252,'selected piece background did not darken')
S.square(s,57);V.render(s);assert(white.imageColor[1]==252 and find(host,'DiskArt_57White1').imageColor[1]==180,'switch did not move the tint')
S.square(s,55);V.render(s)
S.square(s,55);V.render(s);assert(white.imageColor[1]==252,'cancel did not restore background')
V.destroy()
print('PASS selected background darkens and restores without a frame')
local B=require('game.board')
local Motion=require('ui.move_animation')
local function setup(entries)
 s=S.new();local board
 if entries then board={} for i=1,90 do board[i]='' end for _,p in ipairs(entries)do board[B.index(p[1],p[2])]=p[3] end end
 S.start(s,'difficult',board);s.aiInput='hold'
 V.init(host,function()end,function()end);V.render(s)
end
setup();assert(S.commit(s,{55,46}));V.render(s)
assert(V.busy() and U.refs.MovingPiece.visible and U.refs.MovingPiece.x==-72 and U.refs.MovingPiece.y==-32)
assert(U.refs.Glyph_55.text=='' and U.refs.Glyph_46.text=='','destination painted before landing')
V.update(.08);V.render(s);assert(U.refs.MovingPiece.y==-24,'missing intermediate position')
local disc=assert(find(host,'MovingDisc'));local letter=assert(find(host,'MovingGlyph'))
assert(disc.parent==letter.parent and letter.parent==U.refs.MovingPiece,'letter separated from disc')
V.update(1);V.render(s);assert(not V.busy() and U.refs.Glyph_46.text=='兵' and not U.refs.MovingPiece.visible)
assert(not find(host,'AILastFrom') and not find(host,'AILastTo'))
V.destroy();print('PASS move has intermediate position and a single final piece')
setup({{4,9,'K'},{4,0,'k'},{0,6,'R'},{0,3,'p'}})
assert(S.commit(s,{55,28}));V.render(s);assert(U.refs.Glyph_28.text=='卒','capture removed too early')
V.update(.5);V.render(s);assert(U.refs.Glyph_28.text=='俥' and not V.busy())
V.destroy();print('PASS captured piece remains until landing')
setup({{4,9,'K'},{4,0,'k'},{4,5,'R'}})
assert(S.commit(s,{50,5}));V.render(s);assert(s.scene=='result' and V.busy() and not find(host,'ResultTitle'))
V.update(1);V.render(s);assert(find(host,'ResultTitle'),'result did not appear after landing')
V.destroy();print('PASS king capture finishes before result overlay')
setup();assert(S.commit(s,{55,46}));assert(S.commit(s,{28,37}));V.render(s)
assert(#s.visualMoves==2 and U.refs.MovingPiece.y==-32)
V.update(.16);V.render(s);assert(V.busy() and U.refs.MovingPiece.y==16 and U.refs.Glyph_46.text=='兵')
V.update(.08);V.render(s);assert(U.refs.MovingPiece.y==8)
S.undo(s);V.render(s);assert(not V.busy() and U.refs.Glyph_55.text=='兵' and U.refs.Glyph_28.text=='卒')
V.update(100);V.render(s);assert(not V.busy() and U.refs.Glyph_46.text=='')
V.destroy();print('PASS instant replies queue in order and undo cancels both')
setup();S.commit(s,{55,46});V.render(s);S.action(s,'SettingsButton');V.render(s);V.update(1);S.action(s,'SettingsBack');V.render(s)
assert(not V.busy() and U.refs.Glyph_46.text=='兵','settings replayed an old animation')
S.menu(s);V.render(s);S.start(s,'fast');V.render(s);assert(not V.busy() and U.refs.Glyph_55.text=='兵')
V.destroy();print('PASS settings menu and restart never replay stale movement')
local a=Motion.new();Motion.sync(a,s,true);assert(not Motion.busy(a))
assert(Motion.duration(1,90)==.42 and Motion.duration(55,46)==.16)
S.commit(s,{55,46});Motion.sync(a,s,true);Motion.update(a,0);assert(Motion.busy(a) and a.queue[1].elapsed==0)
Motion.update(a,100);assert(not Motion.busy(a))
print('PASS animation duration bounded for long and short moves')
