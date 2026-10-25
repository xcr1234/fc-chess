# BGM默认50%与44车直开

| 用户要求 | 操作与预期 | 证据 |
| --- | --- | --- |
| 默认BGM50% | 新会话设置50，首条FCChessBGM请求音量50；加减仍10、范围0–100，用户修改跨开局保留 | lua-44-rooks、lua-audio-settings/controller、audio-settings-default |
| 全部改车 | ModeCustom→AllRooksButton，仅一次点击即player-turn、红方、000手；己方rank5–9除帅(4,9)外44个车，黑方半场逐格保持 | lua-44-rooks、forty-four-rooks.json |
| 继续对局 | 前排车(0,5)→(0,4)合法；真实AI完成黑方回复；搜索中悔棋恢复44车 | lua-44-rooks、lua-regression、search-* |
| 重开/草稿/重置 | 重开复用44车初始阵容；返回标题再进自定义保留；恢复初始回标准16红子 | custom-restart、draft-retained、edit-reset |
| 界面 | 五画布设置50%、一键直开、61棋子可见、空闲10帧不累积、返回编辑后重置 | 44-rooks-volume-layouts.json，40流程830断言 |

新增5项在旧实现上因默认音量/填满/直开缺失而失败，实装后5项通过，见44-rooks-{red,green}.txt。所有模拟器用例继续用同次dist及存档内联源码。长期静置/数字封顶用例保持原dt和断言，测试子进程使用模拟器既有QXQY_PLAY_TIMEOUT_MS=30000配置，避免原8秒宿主执行限额；不是游戏帧耗时或真机性能结果。
