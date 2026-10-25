# 只在胜利时允许完成退出

只建一个**无参数**信号 `FCChessWin`，放在同一个服务端节点图里即可：

**监听FCChessWin → 设置玩家结算成功状态=胜利 → 设置玩家逃跑合法性=是**

两个设置节点的玩家实体接本次发信号的玩家，沿用BGM链路的玩家取法。不需要参数、变量或分支，**不连接「结算关卡」**。

Lua只在玩家获胜时发送一次。认输、失败、中性结束、未结束、重开及重连均不发送，不修改平台默认状态；本次游玩没赢过时，ESC仍按默认显示未完成。赢过后回看、悔棋或再开一盘不撤销已经获得的完成资格。

旧FCChessLose/FCChessDraw/FCChessResult/FCChessCompletion监听和完成标记变量不再使用。Lua已deploy，服务端仍需手动接上面这一条链，保存重新试玩检查胜利和未获胜两种ESC结果。

依据：[客户端控件API](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhtakr07vej4)的ServerSignal/SendSignal，[执行节点](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhw66orrrfkm)的两个玩家设置节点。
