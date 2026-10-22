import fs from 'node:fs';
const path='fc-chess.save.json';const s=JSON.parse(fs.readFileSync(path));const source=fs.readFileSync('dist/main.lua','utf8');
s.assets.scripts[0].path='dist/main.lua';s.assets.scripts[0].source=source;s.assets.server.root.children[0].name='FCChessHost';
fs.writeFileSync(path,JSON.stringify(s,null,2)+'\n');
s.meta.name='FC 中国象棋 · 测试桥接';s.assets.server.root.children[0].name='FCChessTestHost';fs.writeFileSync('tests/fc-chess.test.save.json',JSON.stringify(s,null,2)+'\n');
