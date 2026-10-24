# 第 5 步 Lua 架构与挂载

## 2026-10-24 真机小字号兼容

用户真机19:23构建日志127次“字号超出限制”，截图小字/棋字不可见，统一定位到primitives.text的fontSize/minimumFontSize赋值。官方API未列精确限制，采用截图已验证能显示的25号基准：每个文本控件设置fontSize=25、adaptiveFontSize=false，不再写minimumFontSize=6；叶控件scale=逻辑字号/25，框宽高除以scale，位置不变。19:36用户复测日志无字号警告，但仍有矮框缺字；继续把未缩放排版高度保守扩到至少50，宽度/文字中心/有效字号保持，透明行框高度允许变大。50是兼容余量，不声称是官方精确阈值。动态文字/对齐仍直接操作同一文本控件，棋子/按钮热区和图片不缩放。

保守约束模型覆盖6–25逻辑字号与更新/几何，模型不代表精确真机字号限制。原生模拟器仅核对可读文本/字号和画面，不能代替真机复测；见tests/native-text-plan.md。

## 2026-10-24 结算返回棋盘

终局保留history；`ReturnBoardButton`仅在result转入`result-review`，不调用begin，不恢复计时或AI。square只接受player-turn、commit拒绝两种终局状态；review可走原悔棋确认与模式确认，认输不再响应。确认悔棋沿用历史快照恢复到上次红方落子前并清除resultTitle/Reason，冻结直到确认是才解除。生命周期和音效/BGM接口未变，review沿用全场景共用BGM且不生成落子事件。

结算遮罩从93高增到116高，保持顶部不动，底部增加20高“返回棋盤”热区；查看时隐藏结算遮罩，右侧认输文字变灰，底部说明悔棋后可继续。HTML同步第三项与键盘三项循环、终局走棋锁和悔棋续下。契约与证据见`tests/result-review-plan.md`、`records/result-review-*.json`。

## 2026-10-24 将军音效

`board.threatensKing`检查攻击方按现有基本走法能否吃到对方将帅，完整扫描棋盘以涵盖发现将军；只在session.commit有效落子后运行，不插入AI搜索或限制走法。session按单调递增的落子序号记录`moveSoundChecks`，audio.controller逐事件选择50888/50882，消费后删除，静音时也消费。这样一次同步前有红黑两步也不会丢失各步的将军属性，悔棋/重绘/重开不重播。吃将直接终局不报将军。HTML同步声音优先级；测试见`tests/check-audio-plan.md`。

## 2026-10-24 声音设置

`audio.catalog`从项目音乐目录生成，`audio.settings`管理会话偏好/分类分页和输入，`audio.controller`管理音效实例与BGM信号副作用。session仅在真实commit时增加`moveSoundSequence`，lifecycle渲染前同步音频；反复render不重复播放，关闭消耗序列不补播，销毁停止实例。默认music10167/volume100/sfx=true；全场景共用music，settingsReturnScene保存设置入口场景，设置/选曲期间不推进对局，返回恢复原工作；音量不用于音效API。

`view`新增audio-settings和music-select全画布页面；原菜单加入设置入口。`build:game`先生成目录再打包28模块，两个存档脚本内容与dist一致。生产存档serverLogic是FCChessBGM四参数接收探针，真实背景音乐节点不能由当前工具写入；[接线与验证边界](audio-integration.md)列出真实节点、变量和参数。测试桥新增偏好/序列探针，生产存档不包含测试UI。

## 2026-10-24 悔棋确认

`session.action(UndoButton)`有历史时设置`modal='undo'`，复用原确认遮罩和默认“否”焦点。ConfirmYes先关闭modal再调用原`undo`，保证取消任务与清除就绪回棋；ConfirmNo沿用原确认取消入口，必要时提交一次就绪回棋。`view`按modal类型显示“要悔棋嗎？”，原认输与回菜单语义保留。没有新增控件模板/平台API；HTML演示同步。无历史直接提示，不显示无效确认。

## 2026-10-24 模拟器浏览器点击容差

`tools/simulator-pointer-slop.mjs`由项目预览补丁嵌入0.4.1的真实`createPlaySession.bindInput`：按下后不足5 CSS px的累计移动不发给Worker，首次达到阈值立即发送，后续沿用原移动合并；释放时补足未收到move的大位移，取消/失去捕获/重启不污染下一次点击。原版Worker任意微移都会阻止CursorClick，此处仅修正浏览器输入，Lua与真机语义保持原实现。棋格热区16×16覆盖整个交点单元；边缘命中、轻点及拖拽证据见`records/simulator-input-native.json`。补丁仍校验固定版本和原始哈希，`npm run preview`自动应用；已有网页需要刷新。

## Lua 模块与挂载

- 维护源：`src/main.lua` 固定平台回调，静态加载 `app.lifecycle`；`src/game/board.lua` 管理游戏侧基本走法与局面；`session.lua` 管理模式、红方步时、AI反馈、悔棋、确认层、版本与提交。`ai.lua` 为新 AI 任务门面，`ai/position.lua`、`movegen.lua`、`evaluate.lua`、`rules.lua`、`order.lua`、`tt.lua`、`search.lua`、`scheduler.lua` 与 `tables.lua` 实现固定 XQWLight JS 1.0 的新内核；三模式共用内核，按规则档适配。`ai/book.lua` 与 `ai/book_data.lua` 负责同源开局数据；`wait.lua` 计算附加等待；`thinking_counter.lua` 管理五位模拟数字。`src/ui/` 创建画布图元、控件和头像，`src/app/log.lua` 输出事件日志。`src/testing/` 仅在测试存档宿主为 `FCChessTestHost` 时创建夹具入口与诊断控件。
- 单文件构建：`npm run build:game` 生成测试夹具模块、`dist/main.lua`，并把同一产物写入两份存档的 `scripts[].source`；常规维护请勿直接改 `dist` 或存档内联源码。SHA-256 见试玩记录。
- 正式存档：`fc-chess.save.json`；测试存档：`tests/fc-chess.test.save.json`。两份均为完整 `qxqy-simulator-save`，服务端 UI 容器内的客户端节点分别命名为 `FCChessHost` / `FCChessTestHost`，均挂载单一脚本映射 `dist/main.lua`。2026-10-24按用户真机回传校准：容器/图片/文本/光标模板1073741847–1850，客户端控件容器资源1073741845，FCChessHost1073741854；源码只引用四个模板索引。没有将服务端资源索引混入模板实例化。规则与输入在客户端运行，BGM接收探针不是真实音乐节点图。
- 控件由 Lua 从少量模板动态实例化；设计空间为 256×224，居中等比缩放至当前画布。输入回调进入 `session`，状态驱动 `view`；AI 在 `OnUpdate(dt)` 分帧推进。官方 Lua 禁用 `coroutine.*`，故搜索使用显式栈，取消/预算中止时撤销全部试走。等待只计计算结束后的附加时间；确认层不暂停步时。
- 头像使用用户提供的 300 个椭圆数据，修正原点，以图片遮罩裁至原 JSON 的矩形 mask，复用在菜单和对局。原始 `assets/old-man.lua`、JSON 不修改。模拟器字形与真机、真机 300 图元性能尚待核对。
- 日志前缀 `[fc-chess]`：`ready/start/move/invalid/ai-position/ai/cancel/stale/result/error`，记录局面版本、着法、吃子、搜索深度/节点、实际计算与附加等待；`ai-position`包含回棋前的完整90格棋盘及规则档，`ai`附带停止原因与分数；不逐帧打印。

## JS 1.0 新内核与规则验证（2026-10-24）

- 最新保持速度的优化见[报告](ai-throughput-results.md)：标准4秒与分帧配额不增，自定义1.5秒保留。主搜索安全节点先尝试经几何验证的TT/PV/杀手着法，失败高分时可跳过其余生成/排序，根完整统计去重；危险节点、空步验证和自定义路径不使用该延迟阶段。生产无重复评分，路径身份只保留pass/null边界；离线标准档保留完整重复身份。完整走子/撤销历史保留，固定深度与缓存/切片对照通过。
- 新内核使用 256 格工作棋盘、增量评价/哈希、显式栈 PVS、静态搜索、延伸和有界 TT；空步为可选验证项。2026-10-24起，自定义默认娱乐浅搜：2层、2000节点、1.5秒逻辑截止、无静态/将军延伸、无TT；叶子只作静态估计，先检查真实终局和立即吃将。`lightweight=false`仅供离线完整搜索验证，不是玩家入口；TT签名另含叶子策略，估计叶子通过依赖标记禁止写入精确值。正式会话仍使用 90 格棋盘，生产提交只采用基本走法与实际吃将裁判。
- 生成/排序/静态/重搜等按工作单元分帧；节点/总耗时保护与协作式时钟检查并用，不提供硬实时抢占承诺。困难/快速同计算政策，故意等待不推进搜索。
- 新增 `tests/lua-ai-rules.lua`、修正并扩展的捉子集以及 6 个原生真实 AI 场景。67/67 原生用例、262 断言通过；25 模块同次构建已显式写入两存档，哈希见 `records/ai-rule-simulator.json`。
- 本次未改 AI 算法或画面；未部署外部目录、未做真机/视觉性能验收。以下保留平台接入与历史修复记录；新内核当前行为和证据以本节、重写方案及生产进度为准。

## 第5步续作验证

- 超时发生在首层完成前时，保底着法取排序后的合法候选，优先立即吃将；不再取棋盘扫描顺序中的首项。纯Lua回归保留有效Red及Green记录。
- `scripts/run-simulator-cases.mjs` 从plan读取原生用例，通过项目内MCP执行，检查产物同步及非空结果；`--layouts`使用正式存档生成五画布截图，裁切仅移除等比预览留边。
- `tests/lua-soak.lua` 使用真实引擎连续搜索标准阵容和15车局面，检查合法性、试走撤销与中断缓存；数据来自宿主Fengari，不能当作真机性能。
- 当前仍按节点/栈操作限制帧工作量，没有毫秒级抢占保证。压力测试出现长搜索帧；后续应优化走法/评估分配及调度，再在独立负载环境和真机测量。`OnUpdate(dt)`资料仅明确不受关卡时停影响，没有保证系统后台时间补偿；当前已验证大dt累加，不引入未经验证的墙钟混算。

## 第6步测试与局部优化

- 车/炮走法沿射线维护挡子计数，避免为每个落点重新扫描路径；走法排序先计算每个候选的排序分，复杂度摘要复用敌将位置。未改节点预算、分帧上限、棋规、排序优先级或等待参数，无新增平台API。随机棋盘同时用穷举校验完整走法和仅吃子走法。
- 正式/测试存档已显式同步同次打包源码；第6步报告均标注SHA-256。五画布截图及pointer检查使用正式存档，不包含测试入口。
- `--matrix`记录每页实际渲染节点/图片数、资源警告、挂载与迁移信息；它不是千星导出/导入验证。菜单922个渲染节点（含908图片，主要来自3×300椭圆头像），对局424个；被隐藏的选择框等控件不包含在渲染节点计数中。Lua产物64016字节。平台内存与图元上限仍需真机测量。
- 独立采样没有消除长帧风险，不能据此宣称60fps或真机流畅。详细结果与范围见 `records/playtest.md`。

## 2026-10-23 第5步反馈修复

- `session.aiCounter`仅保存本回合elapsed/value；进入黑方回合重新创建，在ai-search/ai-wait消费dt，实际黑方commit定格。黑方秒数仍作内部诊断与日志，视图不再显示。新数字不影响搜索、等待和公共随机状态。
- `lastAiMove`只在有效黑方提交时替换为起止索引；悔棋快照包含该着法和数字副本。回菜单/新局清空，结果页保留。视图用两组可复用四边图元AILastFrom/AILastTo移动到交点，玩家黄色选框单独管理；不新增光标热区。
- `AIThinkingNumber`替代`BlackStepTime`，原有布局和`RedStepTime`保留。增长上限与算法见game-spec.md；用dt推导而非逐帧随机加数，保证帧率无关和大dt封顶。
- 本轮删除第7步发布初稿、旧export文件及预检记录，当前仅维护源码/构建产物和完整模拟器存档；没有生成新的GIA或发布清单。

## 2026-10-23 现成开局库模块

- `third_party/xqwlight`保留固定版本的现成书库、仅供开发期转换的棋盘实现、来源校验清单与GPL许可。运行时不引入上游规则引擎。
- `scripts/build-opening-book.mjs`离线恢复书库对应的完整局面，检测短哈希歧义并排除，输出8704个镜像归一化局面与9934条带权重着法。`book_data.lua`是生成源模块，不能手改；修改转换器后运行build:book并执行test:book。`check:book`对比确定性产物及摘要；不要求玩家建库。
- `book.lua`懒加载数据，构造包含行棋方的完整FEN式键，解码候选、还原镜像、复核当前基本走法及己将下一手安全；局部种子按权重选取，不污染全局随机。`AI.book(b,custom,side)`保留旧black默认参数，实际AI.new传入真实side；立即吃将不采纳书着，未命中继续原搜索。
- `session.bookSeed`进入红方落子前快照。job.nextSeed只在有效黑方commit采纳，悔棋恢复；取消不会消耗候选随机状态。新局初值由脚本生命周期内局序号产生，便于固定seed回归。
- 开局数据占722964字节，16模块打包共792649字节；完整存档两份均同步同一产物。库内含多回合甚至中局记录，按完整棋盘命中而非手数；自定义全部禁库。
- 测试加载器按静态require发现依赖，参数探针继续可用。测试桥接新增BookUsed和可注入bookSeed，仅测试存档创建，不进入正式游戏画布。
- 60项/214断言原生模拟器回归通过，纯Lua全库与行为测试通过；正式手机画布完成真实点击试玩。设备内存/加载仍需真机核对，不把约0.79MB单文件大小当作运行内存。

## AI优化与等待扩展（2026-10-23）

`game.ai` 私有搜索状态新增eval（红减黑的增量评分）、kings和rootAlpha；每个栈帧保存oldEval/oldKing，与棋盘一起撤销。所有模式共用搜索。根候选的界限分不再作为等待gap。

`game.wait`统一管理困难/自定义基础等待上下限。`game.session`的waitPolicy为可选会话配置；extraWait/remaining为当前计划/剩余等待；extendWait(s,seconds)提供追加入口，取消清零。调用及边界见docs/ai-design.md最新节。

## 分帧PVS内核拆分

game.ai为书库策略及稳定调用门面；game.ai.search独立负责根/内部节点、迭代提交、PVS试探/重搜、TT与预算取消。两者均静态require，打包为同一dist/main.lua，无需额外挂载。job.probes/researches仅供诊断；未新增玩家仪表。详见docs/ai-search-rewrite.md。

## 静态交换与暴露风险

game.ai.exchange提供gain/risk，内部只临时改动传入工作棋盘并完整撤销。game.ai.search在叶子将风险半权重整数化加入位置/子力分，使用最多512项局面评价缓存；风险目标以被吃子价值上界剪除无效SEE。单文件打包新增1模块，不增加映射/挂载。
