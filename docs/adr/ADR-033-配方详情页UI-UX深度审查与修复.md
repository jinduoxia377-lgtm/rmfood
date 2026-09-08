# ADR-033: 配方详情页UI/UX深度审查与修复

> Architecture Decision Record — 对 FormulaDetailPage 进行系统性 UI/UX 审查并修复所有不一致问题

| # | 标题 | 状态 | 日期 | 领域 |
|:-:|:-----|:----:|:----:|:-----|
| 033 | [配方详情页UI/UX深度审查与修复](./ADR-033-配方详情页UI-UX深度审查与修复.md) | ✅ 已执行 | 2026-08-28 | 前端/产品化 |

## 审查范围

对 `/formulas/:id` 页面进行全面 UI/UX 审计，参照 DashboardPage 设计规范，检查以下维度：
- 整体布局间距（`space-y-*`、`px-*`、`pt-*`）
- 卡片样式一致性（`CardHeader`/`CardContent` 使用模式）
- 标题字号（`text-lg` vs `text-base`）
- 统计卡片配色与图标容器
- 表格/列表样式
- Tab 导航对齐

## 发现的问题

### 高优先级

| # | 问题 | 位置 | 修复方式 |
|---|------|------|----------|
| 1 | `<Tabs>` 嵌套缩进错误（多一层缩进） | 1497行 | 修正缩进 |
| 2 | 可解释性 Tab `space-y-4` 改为 `space-y-5 pt-5` | 2496行 | 统一间距 |
| 3 | 可解释性 Tab `text-lg font-semibold` 改为 `text-base` | 2500行 | 统一字号 |
| 4 | 深度分析 Tab 同样问题 | 2546行 | 统一间距+字号 |
| 5 | 营养成分 Tab `space-y-6 pt-4 text-lg` 不统一 | 2076行 | 统一为 `space-y-5 pt-5 text-base` |

### 中优先级

| # | 问题 | 位置 | 修复方式 |
|---|------|------|----------|
| 6 | 成分表格缺少卡片化 Header | 1935行 | 添加 `overflow-hidden rounded-xl border` 包裹 + 表头说明 |
| 7 | 审核区域 CardHeader 图标容器偏小 | 2758行 | `w-10 h-10` → `w-9 h-9`，对齐其他 Card |

## 已实施修复

1. **Tabs 缩进** — 修正 `<Tabs>` 标签缩进层级
2. **可解释性 Tab** — 添加 section 分隔条（`w-1 h-5 bg-violet-500`），统一间距和字号
3. **深度分析 Tab** — 同样添加分隔条，统一为 `space-y-5 pt-5 text-base`
4. **营养成分 Tab** — 统一为 `space-y-5 pt-5 text-base`，添加绿/成功色系分隔条
5. **成分表格** — 新增卡片化 Header 行（灰色背景 + uppercase tracking-wider 标签）
6. **外层表格 div** — 添加 `overflow-hidden` 确保圆角裁剪生效

## 修改文件清单

| 文件 | 变更内容 |
|------|----------|
| `src/pages/formula/FormualDetailPage.tsx` | 修复缩进、统一间距/字号、卡片化表格 |

## 影响评估

- 无功能变更，纯 UI 视觉层面优化
- 编译零错误，页面正常加载（200 OK）

## 最终 UI/UX 审计结果

### ✅ 已对齐 DashboardPage 规范的部分
- 整体布局：`space-y-5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- 头部横幅：渐变顶条 + 四色统计卡片（primary/secondary/success/violet）
- 基本信息字段：卡片式布局 + uppercase 标签 + 彩色分隔条
- 配方参数：四色卡片（amber/sky/cyan/emerald）带图标
- 独立 Card 模块：统一 `border-neutral-200`、图标容器 `w-9 h-9 rounded-xl`、`text-base` 标题
- 所有 Tab 内容：统一 `space-y-5 pt-5` + `text-base` 标题

### ✅ 已修复的问题
- 编译错误（Tabs 闭合标签修复）
- 组件嵌套缩进问题
- 成分表格卡片化
- 各 Tab 间距/字号不一致

### 📋 后续可进一步优化项（非阻塞）
1. 成分表格增加横向滚动优化体验
2. 制作步骤增加拖拽排序（@dnd-kit）
3. 版本历史增加 diff 高亮
4. 相关推荐增加横向筛选标签栏
5. 添加页面级面包屑导航
