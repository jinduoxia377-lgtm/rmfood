# 移动端字体专项核查报告（MOBILE_FONT_TEAM_REPORT）

> 生成时间：2026-10-22 00:20
> 工具：`node scripts/audit-typography.mjs`（iPhone 13，390×844）+ 针对性补测（Playwright）
> 数据：`scripts/typography-audit-data.json`（长审计 31 路由）+ 对 7 个未有效采集页面的人工补测

## 一、结论摘要

1. **正文字号：全部 31 页均为 17px**（`--text-body-apple`），满足规范「正文 ≥15px」。
2. **最小字号：30 页最小为 12px**；仅 `/tokens` 出现 11px（设计令牌预览 `label-sm`，按任务要求**排除**）。
3. **标题字号：30 页 h1 均为 20px**（`text-xl`）；`/formulas` 无可见 h1/h2（页标题由横幅内非标题元素呈现）。**无超大标题（>28px）**。
4. **<12px 可见 UI 文本：不存在**（排除 SVG 图表刻度与 `/tokens` 令牌预览后，`below12Count` 全为 0）。
5. 12px（`text-xs`）文本广泛存在（侧边导航、页脚、时间戳、表格次要文本、状态徽章/按钮），虽高于 11px 底线，但按 iOS HIG 属于偏小层级，建议组件级提升至 13px。
6. 附带：**0 页横向溢出**；**0 页边距 >20px**；23 页存在 <44px 按钮（触控目标问题，非字体范畴）。

## 二、逐页数据（正文 / 最小 / 标题字号）

| 路由 | 正文(px) | 最小(px) | 标题(px) | <12px 可见文本 | 备注 |
|---|---:|---:|---:|---:|---|
| /dashboard | 17 | 12 | 20 | 0 | |
| /formulas | 17 | 12 | – | 0 | 无可见 h1/h2 |
| /formulas/new | 17 | 12 | 20 | 0 | |
| /experiments | 17 | 12 | 20 | 0 | 补测 |
| /experiments/new | 17 | 12 | 20 | 0 | |
| /batches | 17 | 12 | 20 | 0 | |
| /doe | 17 | 12 | 20 | 0 | 补测 |
| /stability | 17 | 12 | 20 | 0 | |
| /documents | 17 | 12 | 20 | 0 | 补测 |
| /compliance | 17 | 12 | 20 | 0 | |
| /label-check | 17 | 12 | 20 | 0 | 补测 |
| /ingredient-analysis | 17 | 12 | 20 | 0 | |
| /labels | 17 | 12 | 20 | 0 | 补测 |
| /ai | 17 | 12 | 20 | 0 | |
| /databases | 17 | 12 | 20 | 0 | 长审计 contentLoaded=false，已核对 |
| /regulations | 17 | 12 | 20 | 0 | |
| /terminology | 17 | 12 | 20 | 0 | |
| /workflows | 17 | 12 | 20 | 0 | |
| /agent | 17 | 12 | 20 | 0 | |
| /analytics | 17 | 12 | 20 | 0 | |
| /organizations | 17 | 12 | 20 | 0 | |
| /settings | 17 | 12 | 20 | 0 | |
| /users | 17 | 12 | 20 | 0 | |
| /audit-logs | 17 | 12 | 20 | 0 | |
| /billing | 17 | 12 | 20 | 0 | |
| /notifications | 17 | 12 | 20 | 0 | |
| /academic-report | 17 | 12 | 20 | 0 | |
| /peptide-structure | 17 | 12 | 20 | 0 | |
| /integrations | 17 | 12 | 20 | 0 | 长审计被重定向，已补测 |
| /landing | 17 | 12 | 20 | 0 | 公开页；12px 文本 265 处（营销标签） |
| /tokens | 17 | 11 | 20 | 1 | 11px 为令牌预览 label-sm，**按任务排除** |

> 说明：长审计中 `/integrations`、`/tokens` 因会话过期被重定向到 /login，`/experiments`、`/doe`、`/documents`、`/label-check`、`/labels` 因页面渲染时序被采到空内容；以上 7 页均已通过独立登录 + 等待 h1 渲染后补测，数据有效。

## 三、<12px 可见 UI 文本专项检查

- 遍历每页所有可见、含直接文本的 HTML 元素（`closest('svg')` 已排除图表刻度；`/tokens` 令牌预览按任务排除）。
- 结果：**31 页 below12Count 均为 0**（除 /tokens 的 1 处 11px 令牌预览外），即**不存在 <12px 的可见 UI 文本**。
- 例外说明：`/databases` 等含图表页面的 SVG `tspan` 刻度为 12px（如词云、柱状图刻度），已按要求排除，不计入问题。

## 四、问题清单

### 无阻断性问题（字体维度全部达标）
- 无 <12px 可见 UI 文本（排除项后）。
- 正文 17px、标题 20px、页面边距 ≤20px、无横向溢出。

### 建议优化（非失败项，iOS HIG 体验建议）
1. **12px 辅助文本广泛分布（26 页含 ≤12px 文本）**：典型为侧边导航项 `truncate px-1`、页脚 `© 2026`、版本号 `v1.0.0`、表格时间戳/状态徽章、`text-xs` 按钮与筛选 chip。12px 虽高于 11px 底线，但按 iOS HIG 移动端辅助文本建议 ≥12px 且偏小，**建议在 `@media (max-width: 767px)` 下将 `text-xs` 提升为 13px**（组件级，避免全局覆盖破坏图表/紧凑工具栏）。
2. **/tokens 令牌预览 `label-sm` 为 11px**：属设计令牌展示页的预览用途，任务要求排除；若需对外展示可标注为桌面专用或提升至 12px。
3. **附带（非字体）**：23 页存在 <44px 按钮（如 `text-xs py-0.5` 徽章按钮 14–24px、分页 `w-8 h-8` 32px、主操作 `min-h-[44px] px-3 py-2.5` 实测 41.8px），建议组件级补 `min-h-[44px]`。

## 五、环境备注
- 审计期间后端 8000 一度响应超时/会话过期，已通过补测解决；未 kill/重启任何 node 进程，未修改任何源码。
- 本报告仅新增于 `frontend/docs/MOBILE_FONT_TEAM_REPORT.md`。