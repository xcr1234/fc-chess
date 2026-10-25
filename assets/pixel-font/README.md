# FC参考字模、棋子字底与河界

2026-10-25，用户明确原版相似度优先、较小尺寸不是硬要求。当前18字来自仓库256×224原版参考图的精确调色板分析，取代按汉字结构自绘的版本。保留原字格的偏旁、转折、错位、字底及河界白影；游戏只使用生成的矩形数据。

- 黑方：車、馬、象、士、將、包、卒。
- 红方：俥、傌、相、仕、帥、炮、兵。红炮使用火字旁“炮”，不使用“砲”。
- 河界：楚、河、漢、界。
- JSON同源尺寸：棋盘16、菜单12、河界16；红d82800、蓝24188c、白fcfcfc。

- `glyphs-16.json`：维护源；每字16行16格，`#`为着色像素，`.`为透明，另含阴影/字底图层和原图坐标/哈希。
- `fc-trace-verification.json`：14种棋子的可绘制色块与原图逐格核对结果。
- `previous-draft.json`：前版自绘格点，只供对照，不参与游戏构建。
- `包.svg`等：可编辑的矩形格点，字色为`currentColor`，河界保留白影。
- `包.png`等：16×16透明素材；棋子字为白色单色字模，河界为蓝字白影。查看器用最近邻放大。
- `comparison.png`：每组六字上排为上一版自绘/圆底，下排为当前参考字模/阶梯字底；离线对照，不是真机截图。
- `grid.png`：18字12倍网格，供逐格精修。
- `board-strip.png`：14种棋子字在棋子和棋线上的离线示意，黑/红各一排；非运行截图，也不表示真实开局位置。

复核：`node scripts/trace-fc-pixel-glyphs.mjs`按原图重取格点并核对色块；`node scripts/generate-pixel-glyphs.mjs`将各层合并为无损矩形并重新栅格化核对；`node scripts/preview-piece-pixels.mjs`更新PNG/SVG/对照。原图为`prototype/assets/original-screen.png`，不依赖字体替换或在线图片服务。

全套用于Lua棋盘/棋种菜单/河界，HTML同步。build和deploy自动生成矩形，使用既有100001图元，无新imageId或字体导入。字底随棋种重建/销毁，保留原图边缘差异。最新证据见`records/fc-reference-layouts.json`、`records/fc-reference-deploy.json`；本版真机外观与性能待重新加载后验证。
