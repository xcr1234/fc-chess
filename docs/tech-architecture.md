# 第 5 步 Lua 架构与挂载

- 维护源：`src/main.lua` 固定平台回调，静态加载 `app.lifecycle`；`src/game/board.lua` 统一合法走法与局面；`session.lua` 管理模式、步时、悔棋、确认层、版本与提交；`ai.lua` 为显式搜索栈、Alpha-beta、迭代加深、静态吃子延伸、有限置换表和标准开局书；`wait.lua` 根据搜索摘要计算附加等待。`src/ui/` 创建画布图元、控件和已拟合头像；`src/app/log.lua` 输出事件日志。`src/testing/` 只在测试存档宿主名称为 `FCChessTestHost` 时创建夹具入口和诊断控件。
- 单文件构建：`npm run build:game` 生成测试夹具模块、`dist/main.lua`，并把同一产物写入两份存档的 `scripts[].source`；常规维护请勿直接改 `dist` 或存档内联源码。SHA-256 见试玩记录。
- 正式存档：`fc-chess.save.json`；测试存档：`tests/fc-chess.test.save.json`。两份均为完整 `qxqy-simulator-save`，服务端 UI 容器内的客户端节点分别命名为 `FCChessHost` / `FCChessTestHost`，均挂载单一脚本映射 `dist/main.lua`。模板索引 1073742001–2004 对应容器、图片、文本、光标区；导入千星后需核对实际索引并语义更新引用。服务端无棋规节点或变量；规则与输入在客户端运行。
- 控件由 Lua 从少量模板动态实例化；设计空间为 256×224，居中等比缩放至当前画布。输入回调进入 `session`，状态驱动 `view`；AI 在 `OnUpdate(dt)` 分帧推进。官方 Lua 禁用 `coroutine.*`，故搜索使用显式栈，取消/预算中止时撤销全部试走。等待只计计算结束后的附加时间；确认层不暂停步时。
- 头像使用用户提供的 300 个椭圆数据，修正原点，以图片遮罩裁至原 JSON 的矩形 mask，复用在菜单和对局。原始 `assets/old-man.lua`、JSON 不修改。模拟器字形与真机、真机 300 图元性能尚待核对。
- 日志前缀 `[fc-chess]`：`ready/start/move/invalid/ai/cancel/stale/result/error`，记录局面版本、着法、吃子、搜索深度/节点、实际计算与附加等待；不逐帧打印。
