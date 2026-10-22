# 游戏测试制定与运行约定

当前阶段只完成测试制定和静态格式校验；**没有运行模拟器、runCase或真机测试**。

## 文件与检查

- `cases/*.json`：47个`qxqy-autotest/version:1`原生格式用例，含独立的boot、first-success、first-fail、restart和mobile-smoke。
- `plan.json`：用例到画布和夹具的运行清单，不是模拟器用例；`args.canvasId`作为未来runCase的外部参数，不塞进原生case未知字段。
- `acceptance.md`：规则/用例追踪、手工视觉及设备检查。
- `npm run check:game-cases`：从锁定依赖`beyond-simulator-mcp@0.4.1/dist/index.js`抽取**纯用例解析函数**做离线验证，检查所有字段均被保留。不会import其CLI、开工程、初始化Worker或运行case；版本/纯函数定位变化时失败并要求重新核对。
- `npm run test:prototype`：在Node中验证实际HTML规则/计时函数和控制器；不等于模拟器Lua或设备测试。

格式来源为当前安装包的`lr`（事件）、`In`（断言）、`Ii`（用例）纯函数。支持click、pointer、key等事件，以及control/tree/log/lua等断言。本批用例使用click/control；`lua`断言实际在独立只读查询环境运行，不能拿它修改游戏或加载夹具。

## 稳定控件契约（步骤5实现）

画布内玩家动作采用：ModeDifficult、ModeFast、ModeCustom、Square_file_rank、UndoButton、ResignButton、ModeButton、ConfirmYes、ConfirmNo、RestartButton、AllRooksButton、ResetCustomButton、StartCustomButton、EditBackButton。名字是本项目计划采用的控件名，不是官方API，也不声称已存在于Lua存档。

原生断言优先检查可见的TurnText、MoveCount、StatusText、RedStepTime、BlackStepTime、ResultTitle、ResultReason。棋子原始类型用Piece_file_rank诊断值（R/N/C/E/A/P/K及小写黑子，空格为""）；不要用字体/位图相似度测试棋规。

SceneState、ModeCount、SelectedSquare、RedRookCount、RedPieceCount、RuleProfile、PendingReply、ExtraWait、BookEnabled、SearchCompleteDepth、WorkingBoardRestored、PartialExactStored属于测试诊断文本，仅在测试夹具环境提供，读真实游戏状态/搜索计数，不直接生成“用例通过”结果。

## 定向夹具与证据边界

自然操作可完成的用例从菜单独立开始。特殊局面/可控AI/大步时用例在`plan.json`记录具体pieces、mode、turn、计时或AI输入；测试场景中第一条click指向`TestSetup_<case>`，加载该夹具后FixtureReady必须显示该case名字。没有FixtureReady、夹具不能到达或控件没接好都是环境/接入故障，不能算有效TDD Red。

这些TestSetup控件和诊断值是**步骤5待实现的测试桥接契约**，目前不存在；仅在测试场景配置打开时生成，正式游戏及导出的UI不包含测试入口或外围工具栏。测试和正式游戏使用同次Lua打包产物，桥接层只负责准备状态和注入可控输入，必须调用同一生产规则/提交/计时/取消逻辑，不能重写生产算法。

夹具AI参数：

- hold：挂起计算，用于观察玩家提交后的状态，不测试实际棋力。
- deterministic：固定seed与预算的正常引擎；replySequence为按给定坐标执行的受控回棋，用于重复局面可继续用例。
- computeSeconds/waitSeconds/waitRemainingSeconds：可控计算完成与等待截止事件，消费用例时钟；不使用墙钟睡眠，不改变正式等待参数。
- summary-only及TestComputeSummary：将输入的复杂度摘要交给生产等待函数；不是实际引擎吞吐测试。
- TestProbeBook读取规则档案对应书库开关；TestRunBudget以给定节点计数序列验证完整迭代/中止/撤销，输出实际深度和缓存状态。它们是测试动作，不作为玩家功能。

没有把夹具注入功能伪装成现成的MCP事件、服务端信号或官方Lua API。步骤5落实测试桥接与控件后才能重放；实现依赖的官方平台接口需届时核验。静态通过仅说明用例被该版本解析器接受，不证明控件可达、棋力、Lua行为或平台渲染通过。
