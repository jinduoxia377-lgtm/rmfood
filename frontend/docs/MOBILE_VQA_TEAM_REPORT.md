# 移动端视觉规范复测报告（VQA3 · 2026-10-21 深夜）

> 方法：运行 `scripts/audit-mobile-vqa3.mjs`（每路由独立浏览器上下文，iPhone 13 390×844），遍历 **52 路由**，检测 6 类视觉规范问题：品牌横幅过高（>220px）、固定多列网格（列宽<130px）、双列过窄（<150px）、非全宽表单控件（<容器60%）、过大内边距（p-8+/space-y-8+）、固定宽残留（w-[400px]+）。
> 数据：`scripts/mobile-vqa3-data.json`（52 路由全量）；运行日志：`scripts/audit-mobile-vqa3-run.log`。

## 一、总览

- **52 路由**：47 页完全干净（0 标记），5 页有标记，1 页首轮异常（/batches，补测通过）。
- **固定多列网格**：全部清零 ✅（此前全站 207 处响应式改造保持有效）。
- **双列过窄 / 固定宽残留**：全部清零 ✅。
- **品牌横幅**：`/formulas/cases/1` 已修复至阈值内（此前 286px → 现在 0 标记）✅；仅剩 `/users` 统计卡与 `/radix-demo` 演示页被标记（均非横幅，见下）。

## 二、真实问题（1 项，轻微，建议修复）

| 页面 | 位置（文件:行号） | 问题 | 建议修复 |
| --- | --- | --- | --- |
| /organizations/1 | `src/pages/organizations/components/detail/OverviewTab.tsx:237`（同类：`MembersTab.tsx:365`、`TeamsTab.tsx:320`、`ResourcesTab.tsx:174`、`SettingsTab.tsx:223`、`IntegrationsTab.tsx:91`） | 详情 Tab 内容容器 `p-8 space-y-8`：移动端 32px 内边距偏大，挤压内容宽度 | 改为 `p-4 sm:p-8 space-y-8`（移动端 16px，桌面保持 32px） |

## 三、合理项 / 误报（其余 7 项，无需处理）

| 页面 | 标记 | 判定与依据 |
| --- | --- | --- |
| /organizations | `space-y-8 max-w-[1600px] mx-auto px-[...]`（`OrganizationsPage.tsx:334`） | 页面根容器 32px 区块间距，属标准页面节奏（与全站一致），合理 |
| /organizations | `p-12 text-center`（`OrganizationsPage.tsx:605/856/990`、`ComplianceTab.tsx:487` 等） | 空状态卡片留白（48px），空态需宽松视觉，合理 |
| /doe | `non-fullwidth-input ratio=50%`（文件上传/导入控件） | 浏览器文件控件固有形态，非全宽可接受（与上轮结论一致） |
| /users | `tall-brand-banner h=846`（`UserManagementPage.tsx:1394`） | 「数据概览」渐变统计卡，**可折叠**内容区块（图表+多统计卡堆叠），非页面横幅，合理 |
| /radix-demo | `tall-brand-banner h=1830` + `oversized-padding` | 组件演示页（非业务页面），全屏渐变容器为演示背景，可忽略 |
| /batches | 首轮 `ERR`（导航被 `/login` 中断） | 登录态瞬时失效导致的重定向竞争，`VQA_ROUTES=/batches` 补测 **0 问题**，非缺陷 |

## 四、结论

- **无紧急/严重问题**：固定多列网格、双列过窄、固定宽残留、品牌横幅过高均已清零或仅在合理场景出现。
- **1 处轻微可优化项**：`/organizations/1` 详情 Tab 的 32px 内边距，建议移动端降为 16px（`p-4 sm:p-8`）。
- 其余标记均为合理设计（空态留白、区块间距、文件控件、可折叠统计卡）或非业务页（radix-demo）。

> 验证过程中未修改任何源码、未 kill/重启任何进程；仅新增/更新 `frontend/scripts/mobile-vqa3-data.json`、`frontend/scripts/audit-mobile-vqa3-run.log` 与本文档。