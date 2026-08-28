# ADR-018 — Dashboard UI/UX 深度修复与升级

**状态**：✅ 已执行  
**日期**：2026-08-16  
**领域**：前端 / UI/UX  
**前置**：[ADR-017](./ADR-017-Dashboard-UIUX深度审计与升级方案.md)

---

## 执行摘要

基于 ADR-017 审计结果，完成 Phase 1（主题一致性）、Phase 2（设计系统对齐）、Phase 3（交互体验）共 3 个阶段修复。

| 阶段 | 任务 | 状态 | TypeScript |
|:-----|:-----|:----:|:----------:|
| Phase 1 | text-neutral → text-text-* 语义化（461 处） | ✅ | 0 错误 |
| Phase 1 | dark:bg/text 中性色残留清理 | ✅ | 0 错误 |
| Phase 1 | Sparkline SVG ID 冲突修复（计数器方案） | ✅ | 0 错误 |
| Phase 2 | 标题层级 Token 统一（text-h1/h2） | ✅ | 0 错误 |
| Phase 2 | 阴影层级标准化（shadow-card/elevated） | ✅ | 0 错误 |
| Phase 2 | 背景语义类统一（surface-card / bg-neutral-*） | ✅ | 0 错误 |
| Phase 3 | Skeleton Loading 全卡片覆盖（StatsCards/TrendChart/QuickActions） | ✅ | 0 错误 |
| Phase 3 | QuickActions 渐变常量提取（ACTION_VARIANTS） | ✅ | 0 错误 |

---

## 修复详情

### Phase 1：主题一致性

**脚本**：`scripts/dashboard-ui-fix.py`（Python，统一正则处理）

| 指标 | 修复前 | 修复后 |
|:-----|:------:|:------:|
| text-neutral-* 残留 | 461 处 | **0** |
| dark:bg-neutral 残留 | 403 处 | **0** |
| text-text-primary 使用 | 0 处 | **88 处** |
| text-text-secondary 使用 | 0 处 | **130 处** |
| text-text-muted 使用 | - | **162 处** |

**Sparkline ID 修复**（`DashboardOverview.tsx`）：
```tsx
// 修复前：所有实例共享同一 ID，多张迷你图同时渲染时冲突
<linearGradient id={`spark-gradient-${positive ? 'up' : 'down'}`}>

// 修复后：模块级计数器保证全局唯一
let _sparklineIdCounter = 0;
const gradientId = `spark-gradient-${++_sparklineIdCounter}-${positive ? 'up' : 'down'}`;
<linearGradient id={gradientId}>
```

### Phase 2：设计系统对齐

| 组件 | 改动 |
|:-----|:-----|
| `TrendChart.tsx` | `text-sm font-bold` → `text-h2 font-semibold`；添加 `loading` prop + Skeleton |
| `StatsCards.tsx` | 新增 `loading?: boolean` prop；骨架屏替代 StatCard |
| `QuickActions.tsx` | 渐变色提取为 `ACTION_VARIANTS` 常量；添加 `loading` prop；`text-text-primary` / `text-text-muted` / `text-text-disabled` 语义化 |
| `RecentFormulas.tsx` | `text-h2 font-semibold`；`divide-slate-100` → `divide-neutral-default/50`；移除 `dark:text-white` 手动 fallback |

### Phase 3：交互体验

**Skeleton Loading 覆盖**：

| 卡片 | loading prop | Skeleton 实现 |
|:-----|:------------:|:-------------|
| StatsCards | ✅ | 标题条 + 图标圆 + 数值条 |
| TrendChart | ✅ | 标题行 + 图表区域 |
| QuickActions | ✅ | 标题条 + 4×2 操作项骨架 |
| RecentFormulas | ✅ | 已有（保留增强） |

---

## 最终量化指标

```
text-neutral 残留:           0       ✅ 全部语义化
dark:*neutral 残留:          0       ✅ 全部清理
text-text-primary:          88       ✅
text-text-secondary:        130      ✅
text-text-muted:            162      ✅
text-h[1-4] 使用:           34       ✅（原 0）
shadow-card/elevated:       32       ✅（原 0）
surface-card 引用:           81       ✅
bg-neutral-* 引用:          158      ✅
Sparkline 唯一 ID:          ✅       ✅
TypeScript 编译:            0 错误   ✅
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|:-----|:---------|:-----|
| `scripts/dashboard-ui-fix.py` | 新建 | Phase 1+2 统一迁移脚本 |
| `pages/database/DashboardOverview.tsx` | 修改 | Sparkline ID 唯一化；文字/阴影/背景语义化 |
| `components/dashboard/cards/StatsCards.tsx` | 修改 | 新增 loading + Skeleton |
| `components/dashboard/cards/TrendChart.tsx` | 修改 | 新增 loading + Skeleton；标题/颜色语义化 |
| `components/dashboard/cards/QuickActions.tsx` | 修改 | ACTION_VARIANTS 常量；loading + Skeleton；语义类 |
| `components/dashboard/cards/RecentFormulas.tsx` | 修改 | text-h2；语义类；移除 dark: 残留 |
| `styles/components/semantic-utils.css` | 修改 | hover:bg-neutral-50；hover:bg-slate-*；focus-ring 暗色变体 |
| `styles/tokens/dark.css` | 修改 | 中性色暗色覆盖 + 71 个品牌色阶暗色覆盖 |
| `index.css` | 修改 | semantic-utils.css import；@theme 补充 shadow-modal + gradient-text |
| `theme/index.ts` | 修改 | useSemanticTheme 导出 |
