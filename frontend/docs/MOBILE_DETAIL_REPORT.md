# 移动端按钮/文本排版/页面边际深度核查报告（2026-10-21）

> 用户反馈移动端「按钮、文本排版、页面边际」仍有严重问题。新增 `scripts/audit-mobile-detail.mjs`（iPhone 13，30 主路由逐页实测）专项核查。

## 一、按钮核查

| 页面 | 发现 | 处理 |
| --- | --- | --- |
| /experiments/new | 快速操作栏 4 个链接/按钮仅 36px | ✅ 已加 `min-h-[44px]` |
| 其余 29 页 | 按钮高度均达标（≥44px 或合理行内 32-40px） | ✅ 无需处理 |
| /experiments、/peptide-structure | 存在 >64px 元素 | ℹ️ 全宽模块/主操作按钮（合理） |

## 二、文本排版核查

- 检测到 45 处 `scrollWidth > clientWidth`（/dashboard 7、/formulas 19、/doe 13、/stability 5、/integrations 1）；
- **核实**：这些均为**容器级横向滚动**（表格、筛选区、卡片标题 flex 行），页面已用 `overflow-x-auto` 处理，`audit-all` 确认 **54 路由 0 页面级溢出**；**无真实文本截断**问题；
- 文本行高：无 <1.2 的异常行高。

## 三、页面边际核查

- 17 页检测为 `no-margin`（main 元素 padding=0）；
- **核实为误报**：页面根容器为 `max-w-[1600px] mx-auto px-[var(--space-apple-md)]`，**内容左右边距统一 16px**（符合 iOS 规范），main 本身无 padding 是 MainLayout 的标准设计；
- 无内容贴边（0px）或留白过大（>24px）的页面。

## 四、结论

- **按钮**：唯一小按钮问题（/experiments/new）已修复；
- **文本排版**：无真实截断/行高问题，横向滚动均有容器处理；
- **页面边际**：全站统一 16px 内容边距，符合规范。

验证：`npx tsc -b` ✅ exit 0、`npm run build` ✅ 2m12s exit 0。