# 自定义空点改子（2026-11-07）

按用户“参考全部改车”要求，手动编辑新增范围为己方半场rank5–9；空点与已有红子共用车/马/炮/相/仕/兵面板。帅、黑子和黑方半场空点受保护。取消不添加，新增子可替换，草稿、开局、悔棋与重开保留新增阵容，恢复初始清除新增子；全部改子选择车后继续44车开局。

- `tests/lua-custom-empty.lua`：穷举己方所有初始空点×六棋种，检查仅目标点变化；取消、黑方全半场保护、帅保护、原红子换子、草稿返回、开局/走棋/悔棋/重开、恢复初始及44车回归。
- `scripts/test-prototype.mjs`：六棋种新增、草稿与开局保留、取消、帅/黑方保护和恢复初始。
- `tests/cases/custom-empty-add.json` / `custom-empty-protect.json`：真实UI事件和测试存档诊断断言；加入常规用例计划。
- `scripts/test-custom-empty-simulator.mjs`：五画布重复上述用例及原44车/重开流程；正式存档通过原生pointer坐标点击菜单、己方空点与选车按钮，检查面板/新增字形和画布截图。

有效Red见 `records/custom-empty-red.txt`（旧Lua生产行为拦截空点，4项失败）；HTML首次测试子进程EPERM仅为环境故障，不作为Red。
