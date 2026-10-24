# 娱乐规则验收与追踪

- 日期：2026-10-23（Asia/Shanghai）。最新用户要求：不做循环/长将/长捉、将死/困毙、自将/强制应将；实际吃将或认输才判胜负。
- 当前状态：JS 1.0 新内核的规则补充回归完成，67 个原生用例、262 条断言通过，见 `records/ai-rule-simulator.json`；本轮未重新做视觉矩阵/真机验收。历史五画布矩阵见 `records/lua-step6-matrix.json`。
- 规则来源：[GDD](../docs/gdd.md)、[详细设计](../docs/game-spec.md)、[JS 1.0 重写方案](../docs/ai-rebuild-proposal.md)。新内核的独立规则真值、6 个新增原生场景与证据边界见 [补充测试计划](ai-js-rule-regression-plan.md)，格式及桥接见 [README](README.md)。

每例独立开始，PC/mobile用不同canvasId。特殊局面/时间/AI输入逐例写在plan.json，实际断言写在独立case文件。时间消费固定dt；棋力回归使用相同规则档案、seed、预算和缓存初始状态。下表是规则→前置→动作→可观察结果的追踪，不是已执行结果。

| case | 前置 | 玩家/测试动作 | 主要预期 |
|---|---|---|---|
| [boot](cases/boot.json) | 菜单独立开始 | 仅观察 | SceneState=mode-select；ModeCount=3 |
| [first-success](cases/first-success.json) | 菜单独立开始 | ModeDifficult → Square_0_6 → Square_0_5 | MoveCount=001手；TurnText=黑方 |
| [first-fail](cases/first-fail.json) | 菜单独立开始 | ModeDifficult → Square_0_6 → Square_0_7 | MoveCount=000手；TurnText=紅方；StatusText=這步不能走 |
| [fast-immediate](cases/fast-immediate.json) | 菜单独立开始 | ModeFast → Square_0_6 → Square_0_5 | MoveCount=002手；TurnText=紅方；ExtraWait=0 |
| [selection](cases/selection.json) | 菜单独立开始 | ModeDifficult → Square_0_6 → Square_0_6 | SelectedSquare=none；MoveCount=000手 |
| [switch-selection](cases/switch-selection.json) | 菜单独立开始 | ModeDifficult → Square_0_6 → Square_2_6 | SelectedSquare=2,6；MoveCount=000手 |
| [resign](cases/resign.json) | 菜单独立开始 | ModeDifficult → ResignButton → ConfirmYes | SceneState=result；ResultTitle=您落敗了；ResultReason=主動認輸 |
| [modal-cancel](cases/modal-cancel.json) | 菜单独立开始 | ModeDifficult → ResignButton → ConfirmNo | SceneState=player-turn；MoveCount=000手 |
| [return-mode](cases/return-mode.json) | 菜单独立开始 | ModeDifficult → ModeButton → ConfirmYes | SceneState=mode-select；ModeCount=3 |
| [restart](cases/restart.json) | 菜单独立开始 | ModeFast → ResignButton → ConfirmYes → RestartButton | MoveCount=000手；TurnText=紅方；AIThinkingNumber=00000 |
| [edit-lock](cases/edit-lock.json) | 菜单独立开始 | ModeCustom → Square_4_9 | StatusText=帥保留，不能修改；RedPieceCount=16 |
| [fifteen-rooks](cases/fifteen-rooks.json) | 菜单独立开始 | ModeCustom → AllRooksButton → StartCustomButton | RedRookCount=15；RedPieceCount=16；MoveCount=000手 |
| [edit-reset](cases/edit-reset.json) | 菜单独立开始 | ModeCustom → AllRooksButton → ResetCustomButton → StartCustomButton | RedRookCount=2；RedPieceCount=16；RuleProfile=custom-capture-free-advisor-elephant-v1 |
| [custom-restart](cases/custom-restart.json) | 菜单独立开始 | ModeCustom → AllRooksButton → StartCustomButton → ResignButton → ConfirmYes → RestartButton | RedRookCount=15；MoveCount=000手；TurnText=紅方 |
| [draft-retained](cases/draft-retained.json) | 菜单独立开始 | ModeCustom → AllRooksButton → EditBackButton → ModeCustom | RedRookCount=15；SceneState=custom-edit |
| [mobile-smoke](cases/mobile-smoke.json) | 菜单独立开始 | ModeDifficult → Square_0_6 → Square_0_5 → ModeButton → ConfirmNo | MoveCount=001手；TurnText=黑方 |
| [rook-block](cases/rook-block.json) | 定向夹具（见plan.json） | Square_0_5 → Square_0_1 | MoveCount=000手；StatusText=這步不能走 |
| [horse-leg](cases/horse-leg.json) | 定向夹具（见plan.json） | Square_5_5 → Square_7_4 | MoveCount=000手；StatusText=這步不能走 |
| [cannon-screen](cases/cannon-screen.json) | 定向夹具（见plan.json） | Square_2_5 → Square_2_1 | MoveCount=001手；Piece_2_1=C；Piece_2_5= |
| [elephant-eye](cases/elephant-eye.json) | 定向夹具（见plan.json） | Square_2_6 → Square_4_4 | MoveCount=000手；StatusText=這步不能走 |
| [standard-zones](cases/standard-zones.json) | 定向夹具（见plan.json） | Square_2_6 → Square_4_4 | MoveCount=000手；StatusText=這步不能走 |
| [pawn-river](cases/pawn-river.json) | 定向夹具（见plan.json） | Square_0_4 → Square_1_4 | MoveCount=001手；Piece_1_4=P |
| [free-advisor](cases/free-advisor.json) | 定向夹具（见plan.json） | Square_0_6 → Square_1_5 | MoveCount=001手；Piece_1_5=A |
| [free-elephant](cases/free-elephant.json) | 定向夹具（见plan.json） | Square_0_6 → Square_2_4 | MoveCount=001手；Piece_2_4=E |
| [expose-king](cases/expose-king.json) | 定向夹具（见plan.json） | Square_4_5 → Square_3_5 | MoveCount=001手；Piece_3_5=R；SceneState=ai-search |
| [ignore-threat](cases/ignore-threat.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_5 | MoveCount=001手；Piece_0_5=P；SceneState=ai-search |
| [capture-king](cases/capture-king.json) | 定向夹具（见plan.json） | Square_4_5 → Square_4_0 | MoveCount=001手；SceneState=result；ResultTitle=您獲勝了；ResultReason=吃掉黑將 |
| [decline-capture](cases/decline-capture.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_5 | MoveCount=001手；Piece_4_0=k；SceneState=ai-search |
| [flying-king](cases/flying-king.json) | 定向夹具（见plan.json） | Square_4_9 → Square_4_0 | MoveCount=001手；SceneState=result；ResultTitle=您獲勝了 |
| [repeat-continues](cases/repeat-continues.json) | 定向夹具（见plan.json） | Square_0_5 → Square_1_5 → Square_1_5 → Square_0_5 → Square_0_5 → Square_1_5 → Square_1_5 → Square_0_5 → Square_0_5 → Square_1_5 → Square_1_5 → Square_0_5 | SceneState=player-turn；MoveCount=012手 |
| [undo-wait](cases/undo-wait.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_5 → UndoButton | MoveCount=000手；TurnText=紅方；PendingReply=none |
| [undo-pair](cases/undo-pair.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_5 → UndoButton | MoveCount=000手；TurnText=紅方；RedStepTime=00:00 |
| [stale-version](cases/stale-version.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_5 → ModeButton → ConfirmYes → ModeFast | MoveCount=000手；TurnText=紅方 |
| [step-only](cases/step-only.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_5 | RedStepTime=00:03；AIThinkingNumber=11800 |
| [step-invalid](cases/step-invalid.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_7 | RedStepTime=00:07；MoveCount=000手 |
| [step-format](cases/step-format.json) | 定向夹具（见plan.json） | 仅观察 | RedStepTime=100:00；SceneState=player-turn |
| [step-stop](cases/step-stop.json) | 定向夹具（见plan.json） | Square_4_5 → Square_4_0 | RedStepTime=00:00；AIThinkingNumber=00000；SceneState=result |
| [counter](cases/counter.json) | 定向夹具（见plan.json） | Square_0_6 → Square_0_5 | MoveCount=1000手 |
| [modal-ready](cases/modal-ready.json) | 定向夹具（见plan.json） | ResignButton → ConfirmNo | MoveCount=002手；TurnText=紅方 |
| [wait-simple](cases/wait-simple.json) | 定向夹具（见plan.json） | TestComputeSummary | ExtraWait=4 |
| [wait-complex](cases/wait-complex.json) | 定向夹具（见plan.json） | TestComputeSummary | ExtraWait=16 |
| [wait-custom](cases/wait-custom.json) | 定向夹具（见plan.json） | TestComputeSummary | ExtraWait=16 |
| [wait-fast](cases/wait-fast.json) | 定向夹具（见plan.json） | TestComputeSummary | ExtraWait=0 |
| [wait-missing](cases/wait-missing.json) | 定向夹具（见plan.json） | TestComputeSummary | ExtraWait=9 |
| [wait-saturation](cases/wait-saturation.json) | 定向夹具（见plan.json） | TestComputeSummary | ExtraWait=16 |
| [ai-custom-book](cases/ai-custom-book.json) | 定向夹具（见plan.json） | TestProbeBook | BookEnabled=false |
| [ai-budget](cases/ai-budget.json) | 定向夹具（见plan.json） | TestRunBudget | SearchCompleteDepth=2；WorkingBoardRestored=true；PartialExactStored=false |

## 手工与设备检查

第6步新增自然操作边界（均不注入受控回棋，使用正式引擎）：

| case | 操作 | 预期 |
|---|---|---|
| search-undo-spam | 15车走子，搜索中连续悔棋，再走最右路后悔棋 | 恢复000手/红方，无旧回棋 |
| search-resign | 15车搜索期间确认认输，继续推进时间 | 结果保持落败，手数不再变化 |
| search-leave | 15车搜索期间离局，再开快速 | 新局000手/红方，无旧回棋 |
| restart-twice | 两次认输并重开 | 两次经过结果页，新局000手 |
| edge-contact | 最右路兵非法后退，再前进 | 拒绝非法着法，只计合法一步 |
| input-spam | 连点取消、空悔棋、取消确认、思考期间点棋、悔棋 | 不重复提交，恢复000手 |

五画布坐标检查从菜单直接点困难、点击第9路兵热区右缘及目标、打开确认并点击棋盘、取消后悔棋；断言001手→确认层保持001手→000手。此处验证模拟器坐标输入，不等于真实手机触摸证据。

| 项目 | 操作 | 预期/证据 |
|---|---|---|
| visual-baseline | 菜单/编辑/对局/确认/结果逐页查看 | 保留已认可配色/头像/构图，无关卡及03:00占位，右上无额外状态 |
| pointer-resize | PC、横竖屏手机及不同DPR，点九路边缘并缩放 | 命中准确；局面、选择、步时不因缩放清零；画布完整，无外围必需操作 |
| no-pause | 计算/等待时按Enter、打开确认、前后台切换 | 无暂停/继续层；确认不重置时钟。Lua后台补时留待官方时钟核验 |
| performance-device | 同次Lua产物测试原始阵容中局、15车、自由士相 | 记录节点、完整深度、最长帧和内存；按钮可响应。模拟器不冒充真机 |
| casual-boundaries | 连续攻击将帅、送将、两个将帅照面，遇到无基本走法 | 不提前判胜负/和棋；基本移动限制仍有效；无步跳过，双方均无步只显示无法继续 |

实际执行时记录产物SHA-256、runtime=html/simulator/device、执行者、画布、夹具/seed/预算、步骤、预期/实际与证据路径。步骤5才执行有效Red→Green→Regress；格式错误、输入到不了控件、夹具未加载或工具故障不是游戏行为Red。

## 2026-10-23 第5步修复用例

| case | 操作 | 预期 |
|---|---|---|
| ai-move-feedback | 受控AI计算1秒并等2秒，选子、悔棋 | 实际起止边框显示且坐标正确，数字06400，选框并存，悔棋全部复原 |
| ai-number-long-wait | 计算1秒并等8秒，落子后继续推进 | 数字17200并保持定格，高于短等待的06400 |
| ai-number-cap | 计算30秒后快速落子 | 数字40000封顶，实际落点框显示 |
| ai-feedback-restart | AI落子、认输重开、返回自定义 | 新局与编辑均清空数字及上手边框 |

`lua-feedback.lua`另验20Hz连续增长、计算/等待/确认均增长、分帧等价、即时书库回棋至少01000、连续两轮悔棋恢复上一组标记/数字、撤销旧任务，以及实际吃帅后的反馈定格。以上均走生产session逻辑；有效Red为原实现缺少对应状态，测试环境错误不计Red。
