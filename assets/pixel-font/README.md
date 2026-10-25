# 棋子像素字首稿

2026-10-25，受用户提供的FC原版截图启发，试画“包 / 俥 / 傌 / 將”四字。每字为16×16独立像素图标；使用人工编排的格点，保留阶梯边缘、粗细变化与字内空隙。不是完整字体，也没有嵌入截图或字体文件。

- `glyphs-16.json`：维护源；每字16行，每行16格，`#`为着色像素，`.`为透明。
- `包.svg`等：可编辑的矩形格点，颜色为`currentColor`。
- `包.png`等：16×16白色透明底像素素材；查看器需使用最近邻放大。
- `comparison.png`：上排是本机Noto Sans SC原生文字示意，下排是同一组手绘像素字；**上排并非真机字体截图**，用于字形方向比较。
- `grid.png`：四字12倍网格，供逐格精修。
- `board-strip.png`：四字放在棋子和棋线上的离线局部示意；以原子图元重建，非运行截图。为对照字形暂将四种棋子并排，不表示真实开局位置。

复核与重新生成：在仓库根目录运行`node scripts/preview-piece-pixels.mjs`。脚本检查每字恰好16×16且只包含两种格点；PNG与SVG均由同一JSON生成。生成不依赖外部图片服务或全局安装。

用户随后授权接入，四字已替换Lua棋盘和对应棋种菜单，HTML同步。`scripts/generate-pixel-glyphs.mjs`从JSON无损合并连续格点，生成Lua/HTML矩形数据；build和deploy自动运行。每字分别15、22、24、26个矩形，使用现有100001基础图元，不依赖单字PNG/SVG导入或新的imageId。PNG/SVG继续作为可编辑素材交付；其余文字保持原生。测试与部署见`records/pixel-glyph-layouts.json`、`records/pixel-glyph-deploy.json`，真机效果仍待验证。
