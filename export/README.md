# FC 中国象棋真机导入文件

依次使用`fc-chess-client.gia`（四个基础模板）、`fc-chess-server.gia`（主屏客户端控件容器），再把单个`main.lua`建立脚本映射并挂到容器内部的`FCChessHost`。

导入后先核对四个模板索引；GIA不包含Lua映射和挂载。版本/哈希见[manifest.json](manifest.json)，逐步操作及首轮试玩项目见[真机交接说明](../docs/device-handoff.md)。

当前状态：模拟器候选，尚未真机导入或试玩；已知搜索长帧风险仍保留。用户已选择手动导入，没有配置或执行游戏目录复制。
