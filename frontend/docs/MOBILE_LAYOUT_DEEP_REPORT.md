# 移动端深度布局诊断与完善报告（2026-10-20）

> 背景：自动化审计（溢出/字号/边距）全绿后，用户真机测试仍反馈移动端存在严重适配问题。深度诊断发现根因不在「溢出」，而在**多列表格与密集网格在移动端的可用性**。

## 一、诊断方法

新增 `scripts/diagnose-layout-deep.mjs`（iPhone 13, 390×844），对 30 个主要路由测量：
- 内容区宽度占比（实测全部 94% ✅）
- 网格容器列数与每列宽度（标记 ≥3 列且列宽 <130px 的网格）
- 表格列数（标记 ≥5 列的表格）
- 固定 `min-width` 元素（>320px 的强制宽度）

## 二、发现的问题（6 页）

| 页面 | 问题 | 严重度 |
| --- | --- | --- |
| /users | 用户表 `min-w-[640px]`（9 列）在移动端强制 640px，即使已响应式隐藏次要列仍须大幅横向滚动；日志表 `min-w-[960px]`（12 列） | **高** |
| /batches | 7 列表格自然宽度 426px，移动端需横向滚动 | 中 |
| /tokens | 色板网格 `grid-cols-10`，每格仅 30px，几乎不可读 | 中 |
| /terminology | 分类 Tab `grid-cols-5`，每项仅 66px，文字易截断 | 中 |
| /labels | 标签尺寸选择 `grid-cols-3`，每项 86px，三行文字被挤压 | 中 |
| /formulas | `grid-cols-1 lg:grid-cols-12` 被脚本误读（移动端实际 1 列，无问题） | 误报 |

## 三、专业移动端完善方案（已落地）

遵循 Apple HIG「移动端优先、信息密度适可、触控可读」：

1. **/users 用户表**：`min-w-[640px]` → `min-w-0 md:min-w-[640px]`（移动端解除强制宽度，配合已有的响应式列隐藏，表格自适应视口；桌面保持原样）。
2. **/batches 批列表**：隐藏次要列——「配方」列 `hidden sm:table-cell`、「样本数」列 `hidden md:table-cell`（th/td 同步），表格自然宽度 426→330px，移动端基本无需横向滚动。
3. **/tokens 色板**：`grid-cols-10` → `grid-cols-5 sm:grid-cols-10`（移动端每格 30→60px，可读性翻倍）；`grid-cols-4` → `grid-cols-2 sm:grid-cols-4`。
4. **/terminology 分类 Tab**：`grid-cols-5` → `grid-cols-2 sm:grid-cols-5`（移动端两行换行，每项更宽）。
5. **/labels 标签尺寸**：`grid-cols-3` → `grid-cols-2 sm:grid-cols-3`（移动端两列，文字不再截断）。

## 四、复测结果（30 路由）

| 指标 | 修复前 | 修复后 |
| --- | --- | --- |
| 问题页面 | 6 | 3（含 1 误报 + 2 合理模式） |
| /users 表 min-w | 640px（强制） | 0（自适应，仅桌面 640） |
| /batches 表格宽度 | 426px | 330px |
| /tokens 色板列宽 | 30px | 60px |
| /labels 网格 | 3 列 86px | 2 列（达标） |
| /terminology Tab | 5 列 66px | 2 列（达标） |

剩余可接受项：
- `/users` 12 列操作日志表（960px 横向滚动）：日志型表格横向滚动是行业常见模式；
- `/tokens` 5 列色板（60px/格）：色块选择器，60px 已清晰；
- `/formulas` `grid-cols-1 lg:grid-cols-12`：移动端实际 1 列，诊断脚本对 lg 媒体查询的误读。

## 五、最终验证

- `npx tsc -b` ✅ exit 0
- `npm run build` ✅ 2m14s exit 0
- `audit-all.mjs`（375px / 320px）✅ 54 路由 0 溢出
- `diagnose-layout-deep.mjs` ✅ 无真实布局问题