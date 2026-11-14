# EG1163 HO/LO independent protection — 2026-11-14

用户确认：13−14脚过流只限制上管HO最小脉宽，LO仍按CP和ERRO比较关系（保留现有SS约束与死区）输出，不根据缩短后的HO重新安排。删除瞬态积分中loStart对duty的最后一处钳制，门极重建保持原比较器窗口。保留下管自身保护、HCS及HO−COM观测。

验证：check-eg1163-independent-lo.cjs通过55/72/150kHz、三个比较器控制电平的过流前后LO时序一致性、HO限宽、无重叠与实际瞬态记录检查；build-v2通过。不改变ERRO启动拟合或原理图布局。
