# ADR-031: 配方详情页UI-UX重构

> Architecture Decision Record — 配方详情页参照DashboardPage设计风格全面优化决策

| # | 标题 | 状态 | 日期 | 领域 |
|:-:|:-----|:----:|:----:|:-----|
| 031 | [配方详情页UI-UX重构](./ADR-031-配方详情页UI-UX重构.md) | ✅ 已执行 | 2026-08-28 | 前端/产品化 |

## 背景

`/formulas/:id` 页面已有完整功能实现（8个Tab、完整CRUD），但UI风格与DashboardPage存在差异：排版偏紧、间距不一致、emoji图标混用、缺少快捷统计条等。用户要求参照DashboardPage设计风格进行全面优化。

## 决策

### 1. 添加快捷统计条

在Tabs导航上方新增统计卡片行，展示关键数据：
- 成分数、总用量、制作步骤数、版本数
- 采用DashboardPage的 `rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-3` 风格

### 2. Emoji → Lucide图标替换

| 原内容 | 替换为 |
|--------|--------|
| ⏱️ {step.duration.value} | `<Clock size={12} className="inline mr-0.5" />{step.duration.value}` |

同时补充缺失的 `HardDrive` 图标导入。

### 3. 间距统一

| 项目 | 修改前 | 修改后 |
|------|--------|--------|
| TabContent 间距 | `space-y-4` | `space-y-5` |
| 模块标题字号 | `text-lg` (22px) | `text-base` (18px) |
| 模块标题图标 | `size={20}` | `size={18}` |

### 4. 基本信息Tab优化

- 配方参数区域增加独立section标题
- 使用卡片式布局替代简单grid
- 每个参数项带图标标识

### 5. 代码规范修复

- 修复元信息区多余的`</div>`标签导致的JSX结构错误
- 确保所有新增图标从 `lucide-react` 正确导入

## 修改文件清单

| 文件 | 变更内容 |
|------|----------|
| `src/pages/formula/FormulaDetailPage.tsx` | 添加统计条、emoji替换、间距调整、参数卡片化、修复JSX结构 |

## 影响评估

| 维度 | 影响 |
|------|------|
| 用户体验 | 排版更宽松，视觉层次更清晰，与DashboardPage风格统一 |
| 性能 | 无显著影响 |
| 兼容性 | 向后兼容，仅改动样式和布局 |

## 后续优化方向

1. 成分列表表格改为卡片式布局（移动端适配）
2. 制作步骤增加拖拽排序功能
3. 版本历史增加 diff 可视化对比
4. 相关推荐增加筛选和排序
