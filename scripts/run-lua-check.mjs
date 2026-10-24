import fs from 'node:fs';
import fengari from 'fengari';
import {preloadModules} from './lua-test-loader.mjs';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
const state=lauxlib.luaL_newstate();lualib.luaL_openlibs(state);
const modules=['app.log','game.board','game.wait','game.thinking_counter','game.ai','game.session','audio.controller'];
const code=preloadModules(modules)+'\ncoroutine=nil; printerr=print\n'+fs.readFileSync(process.argv[2],'utf8');
const status=lauxlib.luaL_dostring(state,to_luastring(code));if(status!==lua.LUA_OK){console.error(to_jsstring(lua.lua_tostring(state,-1)));process.exitCode=1;}lua.lua_close(state);
