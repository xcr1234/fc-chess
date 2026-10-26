import fs from 'node:fs';
const path='fc-chess.save.json';const s=JSON.parse(fs.readFileSync(path));const source=fs.readFileSync('dist/main.lua','utf8');
// Simulator probe only: records received BGM requests. Native music playback
// requires the official server nodes documented in docs/audio-integration.md.
const signalName='FCChessBGM';
const vars=[['FCChessMusicIndex','Int'],['FCChessMusicVolume','Int'],['FCChessMusicSeconds','Float'],['FCChessMusicEnabled','Bool']];
s.serverLogic??={version:1,rules:[]};
s.serverLogic.rules=s.serverLogic.rules.filter(r=>r.id!=='fc-chess-bgm-receiver');
s.serverLogic.rules.push({id:'fc-chess-bgm-receiver',signalName,actions:vars.map(([name,variableType],i)=>({kind:'setCustomVariable',entityType:'PlayerSelf',name,variableType,value:{fromSignalParam:i}}))});
// Request probe only. Native escape legality and settlement enums require the
// server graph described in docs/completion-integration.md, without ending level.
s.serverLogic.rules=s.serverLogic.rules.filter(r=>!r.id.startsWith('fc-chess-completion-'));
s.serverLogic.rules.push({id:'fc-chess-completion-win',signalName:'FCChessWin',actions:[
 {kind:'setCustomVariable',entityType:'PlayerSelf',name:'FCChessVictoryReceived',variableType:'Bool',value:true}
]});
if(!source.trim())throw new Error('Build the Lua bundle before syncing saves');
// Keep generated code out of Git. The simulator reads path when source is empty.
s.assets.scripts[0].path='dist/main.lua';s.assets.scripts[0].source='';s.assets.server.root.children[0].name='FCChessHost';
fs.writeFileSync(path,JSON.stringify(s,null,2)+'\n');
s.meta.name='FC 中国象棋 · 测试桥接';s.assets.server.root.children[0].name='FCChessTestHost';fs.writeFileSync('tests/fc-chess.test.save.json',JSON.stringify(s,null,2)+'\n');
