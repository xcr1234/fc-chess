local Session=require('game.session')
local View=require('ui.view')
local Bridge=require('testing.bridge')
local Log=require('app.log')
local Audio=require('audio.controller')
local Completion=require('app.completion')
local M={}
local state,test,audio,completion
local function render() Completion.sync(completion,state);Audio.sync(audio,state);View.render(state);if test then Bridge.render(state) end end
function M.start()
 script:EnableUpdate(true)
 state=Session.new();audio=Audio.new();completion=Completion.new();test=script.object.name=='FCChessTestHost'
 View.init(script.object,function(name) Session.action(state,name);render() end,function(i) if not View.busy() then Session.square(state,i);render() end end)
 if test then Bridge.init(script.object,state,render) end
 render();Log.event('ready','UI ready test='..tostring(test))
end
function M.update(dt) View.update(dt);Session.update(state,dt);View.resize();render() end
function M.destroy() if state then Session.cancel(state,'destroy') end if audio then Audio.destroy(audio);audio=nil end View.destroy();state=nil;completion=nil end
return M
