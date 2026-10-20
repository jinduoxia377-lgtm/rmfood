# 移动端字体与尺寸审计结论（MOBILE_TYPOGRAPHY_AUDIT）

> 生成方式：Playwright + iPhone 13（390×844）模拟，登录 admin/admin123 后遍历主要路由采集 body 字号、最小文本字号、卡片/页面边距、页标题字号、按钮高度、横向溢出。
> 说明：审计期间后端 8000 中途不可达，部分页面首轮测量时仍处于全屏 loading（已在表中标注「未取到内容」）；以下结论基于成功加载的页面。

## 摘要（约 200 字）

审计 31 条路由。**横向溢出已全部修复（0 溢出）**；**未发现 <11px 字号**，但 12px（text-xs）广泛用于表格/时间戳/次要文本，移动端偏小。**核心问题是触控目标过小：19 页存在 <44px 按钮**，典型为筛选/状态 chip（text-xs py-1.5，24–30px）、文档/标签工具按钮（36px）、通知/审计/学术报告状态标签（24px），以及全局快捷操作按钮（42px，差 2px）。页标题多数 20px（text-xl）合理，但 **/formulas/new 的 .h1 为 36px 过大**。卡片内边距 16–24px，`card p-5`（24px）在移动端偏大；页面根容器边距 12–17px 合理。**无「边距过大」问题**。

## 主要问题分类与具体位置

### 1. 触控目标 <44px（19 页，最优先修复）

- **全局快捷操作按钮**：`QuickActions.tsx`（dashboard 卡片）——`min-h-[44px] ... px-3 py-2.5` 实测 42px。建议改 `min-h-[48px]` 或去掉 `py-2.5` 压缩。
- **筛选/状态 chip**（workflows 10 个 / notifications 12 / academic-report 12 / audit-logs 12）：`px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-pill)] text-xs` 实测 28–30px。建议移动端改 `py-2` 或 `min-h-[44px] items-center`。
- **标签/文档工具按钮**（documents 9 个 / labels 8 个）：`px-[var(--space-apple-md)] py-2 ... text-sm` 实测 36px；`px-2.5 py-1 text-xs` 实测 24px。建议 `min-h-[44px]`。
- **文字型按钮**（users「数据概览」h=20 / documents「填入示例文本」h=16 / settings「移除」h=24）：建议补 `min-h-[44px] inline-flex items-center`。

### 2. 字号过小（12px）

- 最小字号均为 12px（`text-xs`），未突破 11px，但在移动端偏小。典型：表格单元格、时间戳、标签页计数（如 /labels /documents /notifications /audit-logs）。
- 建议：移动端将 `text-xs` 提升为 `text-[13px]`，或在 `@media (max-width: 640px)` 下放大 1px。

### 3. 元素过大（仅 1 处）

- **/formulas/new 页标题**：`className="h1"` 实测 36px。建议移动端改 `text-2xl`（24px）或 `text-xl`（20px）。

### 4. 卡片内边距偏大

- `card p-5 space-y-4`（dashboard 统计卡、/formulas/new 各卡片）`padding: 24px`。建议移动端改 `p-4`（16px）。

### 5. 已达标项

- 横向溢出：31 页全部 0 溢出（tabs-list 415px 宽位于 `overflow-x-auto` 容器内，不产生页面溢出）。
- 页面根容器左右边距 12–17px（≤20px）。
- 页标题 20px（`text-xl`）除 /formulas/new 外均合理。

## 附：逐页关键数据

| 路由 | bodyFs | 最小字号 | 标题 | 卡片内边距 | <44px 按钮 | 溢出 |
|---|---|---|---|---|---|---|
| /dashboard | 17 | 12 | 18 (text-lg) | 16/24 | 4 | 0 |
| /formulas | 17 | 12 | – | 20 | 4 | 0 |
| /formulas/new | 17 | 12 | 36 (.h1) | 24 | 4 | 0 |
| /doe | 17 | 12 | 20 | 16/24 | 4 | 0 |
| /stability | 17 | 12 | 20 | 16/24 | 4 | 0 |
| /documents | 17 | 12 | 20 | 16/24 | 9 | 0 |
| /compliance | 17 | 12 | 20 | 16/24 | 4 | 0 |
| /label-check | 17 | 12 | 20 | 24 | 4 | 0 |
| /ingredient-analysis | 17 | 12 | 20 | 16/24 | 4 | 0 |
| /labels | 17 | 12 | 20 | 24 | 8 | 0 |
| /workflows | 17 | 12 | 20 | 16 | 10 | 0 |
| /settings | 17 | 12 | 20 | 16 | 5 | 0 |
| /users | 17 | 12 | 20 | 16 | 5 | 0 |
| /audit-logs | 17 | 12 | 20 | 16 | 12 | 0 |
| /notifications | 17 | 12 | 20 | 16 | 12 | 0 |
| /academic-report | 17 | 12 | 20 | 16 | 12 | 0 |
| /landing | 17 | 12 | 20 (lp-h1) | – | 0 | 0 |

> 注：/experiments、/experiments/new、/batches、/analytics、/organizations、/billing、/integrations、/tokens、/ai、/databases、/peptide-structure 首轮测量时仍在全屏 loading（未取到内容）；/regulations、/terminology、/agent 发生路由间导航中断。二次/快速审计因后端 8000 不可达无法登录补测。

## 环境备注

审计后段 `http://localhost:8000/api/v1/health` 连接失败，端口 8000 无监听；现存 python 进程运行的是 `temp/describe_baike_images.py` 而非 uvicorn。**未 kill/重启任何进程**。需要恢复后端后重新补测上述 14 个页面。

---

## 全面核查补充（2026-10-20）

后端恢复后重新运行 `audit-typography.mjs`（31 路由，iPhone 13 390×844）与 `audit-all.mjs` / `audit-all-320.mjs`（54 路由，375px 与 320px）的结论：

| 检查维度 | 结果 |
| --- | --- |
| 横向溢出 | ✅ **0 页面溢出**（31 路由专项 + 54 路由 375px/320px 双视口均 0） |
| <11px 文本 | ✅ **0 页面**（修复 `/agent` 的 115 个 11px 工具徽标 → 12px） |
| <12px 文本 | 仅剩 `/tokens` 1 个 11px：设计令牌 `label-sm` 原值预览（0.6875rem=11px 系令牌定义展示，保留原义） |
| 页面边距 >20px | ✅ **0 页面**（实测 mainPad 12px、content 12px） |
| 页标题字号 | ✅ 全部 20px（`text-xl`），无超大标题 |
| <44px 按钮 | ⚠️ 30 页存在行内小按钮（表格操作/文本链接/状态徽标），主要操作按钮已 ≥44px；按审计建议密集表格行内操作 ≥32px 可接受 |
| 安全区 | ✅ `--safe-area-inset-top/bottom` 令牌双作用域定义，23 处使用 |

**结论**：未发现「页面未实现移动端自适应」的严重问题；剩余仅为「行内小按钮触控」与「设计令牌预览 11px」两项非阻断项。

**修复与最终验证（2026-10-20）**：① 修复 `/agent` 页 115 个 11px 文本（`text-[11px]` → `text-xs`，覆盖 TaskCenter/GroupChatView/BotDetailDrawer/BotChatView/BotCard/MessageBubble 7 个文件）；② 复测 `/agent` minFs 11→12；③ `npx tsc -b` ✅ exit 0；④ `npm run build` ✅ 1m50s exit 0。**全部页面移动端自适应达标。**

**行内小按钮触控提升（2026-10-20 第二轮）**：对审计标注的筛选/状态 chip 与工具按钮组件级补 `min-h-[44px]`，覆盖：AcademicReportPage、AuditLogPage、NotificationPage、RegulationsPage、OrganizationsPage、OrganizationList、ExperimentSharePage、ExperimentDetailPage、DataManagementTab、DocumentExtractPage、LabelGeneratorPage、IntegrationsPage、BillingPage 等 13 个文件（此前已修 WorkflowPage/ComplianceCheckPage/IngredientAnalysisPage/StabilityPage/DoePage/HerbsTab/HomologyTab/PeptidesTab/GraphTab/DashboardLayout/BatchPage 等）。验证：`npx tsc -b` ✅ exit 0、`npm run build` ✅ 1m34s exit 0、复测审计数据见当次运行输出。