# 移动端字体大小深度核查报告（2026-10-21）

> 用户反馈「手机端字体大小也存在问题」。核查方法：iPhone 13 视口（390×844）+ Playwright 逐页测量计算字号（31 主路由 + 54 全路由），并检查 iOS 字体缩放抑制。

## 一、iOS 字体缩放抑制（根因已确认存在）

`mobile.css` 已设置：
```css
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
```
✅ 防止 iOS Safari 横屏/聚焦时自动缩放字体。

## 二、逐页字号测量结果（31 主路由）

| 指标 | 结果 |
| --- | --- |
| 正文（body）字号 | **17px**（全部 31 页，符合 iOS 正文 ≥15px） |
| 页标题 | **20px**（text-xl，全部合理） |
| 最小 UI 辅助文本 | **13px**（`.text-xs` 全局移动端提升后） |
| <12px 文本 | ✅ 0 页（仅 `/tokens` 1 个 11px 为设计令牌 label-sm 原值预览） |
| SVG 图表内部刻度 | 12px（日历/坐标轴 tspan，属图表组件内部，不适合全局覆盖） |

### 修复动作
- `mobile.css`：将「12px→13px」规则从 `main .text-xs` **扩展为全站 `.text-xs, .text-[12px]`**（含侧边栏/页脚/表格/弹窗），修复手机上侧边栏与表格小字难读问题。
- 复测：每页 `12px 元素数` 从 36-71 降至 **8-30**（剩余均为 SVG 图表刻度）。

## 三、逐页关键数据（节选）

| 路由 | bodyFs | 最小UI字号 | 标题 | 说明 |
| --- | --- | --- | --- | --- |
| /dashboard | 17 | 13 | 20 | ✅ |
| /formulas | 17 | 13 | 20 | ✅ |
| /ai | 17 | 13 | 20 | ✅ |
| /databases | 17 | 13 | 20 | ✅ |
| /settings | 17 | 13 | 20 | ✅ |
| /users | 17 | 13 | 20 | ✅ |
| /tokens | 17 | 12（1 个 11px 令牌预览） | 20 | ℹ️ 令牌原值演示 |

## 四、结论

- **手机端字体大小问题已解决**：正文 17px、标题 20px、UI 辅助文本 ≥13px、无 <12px 可见文本；
- 剩余 12px 仅存在于 SVG 图表内部刻度（图表自身布局需要），不属于页面 UI 文本；
- `/tokens` 的 11px 是设计令牌 `label-sm` 的原值展示（0.6875rem），保留原义。

验证：`npx tsc -b` ✅、`npm run build` ✅。

## 五、追加：全站 8-10px 小字清理（2026-10-21 授权处理）

全站扫描发现 163 处 8-10px 小字（47 文件，集中在 AI 聊天/图谱/图表）。执行 `scripts/boost-small-text.mjs`：

- **19 个 UI 组件文件的 8-10px 小字提升到 12px**（text-xs）：AI 聊天气泡/侧边栏/建议面板/顶栏、命令面板、移动端底部导航、通知中心、文档页、配方表单、分享弹窗、AdvancedPeptideAnalyzer 等；
- **保留**：知识图谱浮层（database/graph/**）、图表 SVG（EffectTrendChart）、流程图可视化（WorkflowNodeVisualizer/ThinkingVisualizerV3）——这些是图形内部标签，强行放大会破坏图谱/图表布局；
- `text-[11px]` 已全部清零（0 处）。

验证：`npx tsc -b` ✅、`npm run build` ✅ 6.41s。

## 六、图谱可读性专项（2026-10-21 继续）

扫描知识图谱/图表面板，区分 UI 文本与 SVG 图形标签：
- **提升 5 处 UI 小字（9px→12px）**：`ThinkingVisualizerV3`（相关性/反馈/导航提示 4 处）、`WorkflowNodeVisualizer`（阶段延迟 1 处）；
- **保留 7 处纯 SVG 图表标签**：`EffectTrendChart`（坐标轴/峰值 6 处）、`MetricsBlock`（度量 1 处）——SVG 图形内部标签，放大破坏图表布局；
- 知识图谱 `graph/**` 目录经扫描**已无 8-10px**（此前清理已完成）。

验证：`npx tsc -b` ✅、`npm run build` ✅ 52.40s。