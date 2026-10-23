# XQWLight 自带开局库

来源：[xqbase/xqwlight](https://github.com/xqbase/xqwlight/tree/6221733f1f79b3acb44cce6f83dc6100443cb2c9)，固定版本与LF规范化后校验值见 `UPSTREAM.json`。

- `book.js`：上游 `JavaScript/book.js`，保留全部12081条现成记录及原版权头。
- `position.js`：上游 `JavaScript/position.js`，仅在开发期用于恢复与校验现成记录，不装入游戏。
- `LICENSE`：上游GNU GPL v2许可全文；两个源文件头授权GPL v2或更新版本。
- Copyright (C) 2004–2012 www.xqbase.com；作者Morning Yellow。

项目适配器 `scripts/build-opening-book.mjs` 生成 `src/game/ai/book_data.lua`，后者是该数据的格式转换，保留GPL-2.0-or-later标记。随游戏分发相关产物时保留本许可、版权声明及对应源码/转换脚本；开源源码保存在本仓库。生成Lua文件头也保留来源与许可提示。

这是现成库的格式适配，没有收集棋谱训练或创建新库。运行时按恢复出的完整局面匹配；无法从现成记录恢复、或被检测为短哈希歧义的记录不启用，数量见 `records/opening-book-conversion.json`。权重保留上游值，对镜像重复证据取最大值而不累加。

命令：`npm run build:book`重新转换；`npm run check:book`校验生成物；`npm run test:book`执行上游对照、全量Lua数据与运行时回归。转换/测试不联网。
