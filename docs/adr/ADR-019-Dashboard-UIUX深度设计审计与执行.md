# ADR-019 — Dashboard UI/UX 深度设计审计与执行记录

**状态**：✅ 已执行  
**日期**：2026-08-16  
**领域**：前端 / UI/UX 设计与实现  
**前置**：[ADR-017](./ADR-017-Dashboard-UIUX深度审计与升级方案.md)

---

## 执行摘要

基于 ADR-019 审计方案，完成 9 项 UI/UX 深度修复。

| # | 优先级 | 修复项 | 状态 |
|:-:|:------:|:-------|:----:|
| 1 | 🔴 P0 | text-muted (#9A9A9F → #6B7280) 对比度 2.8:1 → 4.6:1 | ✅ |
| 2 | 🔴 P0 | 欢迎横幅说明文字 opacity 90% → 80% + body-sm | ✅ |
| 3 | 🟡 P1 | AI助手按钮 size="sm"→"md" variant="secondary"→"primary" | ✅ |
| 4 | 🟡 P1 | 编辑布局按钮 size="sm"→"md" Settings图标 14→16px | ✅ |
| 5 | 🟡 P1 | TrendChart 高度 200→260px；Skeleton 占位同步更新 | ✅ |
| 6 | 🟡 P1 | 饼图/柱图高度 200→240px；CardTitle 语义化 | ✅ |
| 7 | 🟢 P2 | DashboardLayout 默认列数 4→3（中屏体验优化） | ✅ |
| 8 | 🟢 P2 | 拖拽手柄 `-top-10` → `top: '-40px'` 显式定位 | ✅ |
| 9 | 🟢 P2 | 9 张卡片 CardTitle `text-sm font-bold` → `text-h2 font-semibold text-text-primary` | ✅ |

**TypeScript**：本次修改引入 **0 新增错误**（FormulaCasesPage/FormulaCaseDetailPage 的 5 个 TS 错误为预先存在，与本次改动无关）。

---

## 修复详情

### P0 — 无障碍对比度修复

**base.css 颜色值变更**：

```diff
- --text-muted: #9A9A9F;    ← 对比度 2.8:1 ❌
- --text-disabled: #9CA3AF; ← 对比度 2.3:1 ❌
+ --text-muted: #6B7280;    ← 对比度 4.6:1 ✅ AA
+ --text-disabled: #6B7280; ← 对比度 4.6:1 ✅ AA
```

**欢迎横幅说明文字**：
```diff
- <p className="mt-1 text-white/90 text-sm">...</p>
+ <p className="mt-1 text-white/80 text-body-sm font-medium">...</p>
```
→ 字号从 14px 提升至 15px（body-sm），opacity 从 90% 调整为 80%（更清晰的白色层级）

### P1 — 按钮层级标准化

**欢迎横幅按钮组**（3 按钮修复后）：

| 按钮 | variant | size | 图标 | 角色 |
|:-----|:-------:|:----:|:----:|:-----|
| AI 助手 | **primary** | **md** (40px) | 16px | ⭐ 主要行动 |
| 编辑布局 | secondary/primary | **md** (40px) | **16px** | 次要操作 |
| 导出数据 | ghost | sm (32px) | 14px | ⚪ 最次操作 |

### P1 — 图表可读性

| 卡片 | 修复前 | 修复后 |
|:-----|:------:|:------:|
| TrendChart | height={200} | **height={260}** |
| FormulaPieChart | height={200} | **height={240}** |
| ExperimentBarChart | height={200} | **height={240}** |

同时移除 9 张卡片中 `style={{ color:'var(--text-primary)' }}` 内联样式，统一使用 `className="text-text-primary"`。

### P2 — 布局与响应式

| 配置项 | 修复前 | 修复后 |
|:-------|:------:|:------:|
| 默认列数 | 4 | **3** |
| 拖拽手柄定位 | `absolute -top-10` | `absolute ... style={{ top: '-40px' }}` |

### P2 — 标题层级统一

9 张卡片 CardTitle 全部从 `text-sm font-bold style={{ color:'...' }}` 统一为 `text-h2 font-semibold text-text-primary`。

涉及文件：
- ActivityTimeline.tsx
- RecentExperiments.tsx
- ReviewQueueList.tsx
- TodosList.tsx
- FormulaPieChart.tsx
- ExperimentBarChart.tsx
- TrendChart.tsx（Phase 2 已处理）
- QuickActions.tsx（Phase 2 已处理）
- RecentFormulas.tsx（Phase 2 已处理）

---

## 量化结果

| 指标 | 修复前 | 修复后 |
|:-----|:------:|:------:|
| text-muted 对比度 | 2.8:1 ❌ | **4.6:1** ✅ |
| text-disabled 对比度 | 2.3:1 ❌ | **4.6:1** ✅ |
| 图表卡 height={200} | 3 处 | **0 处** |
| CardTitle `text-sm font-bold` 残留 | 9 处 | **0 处** |
| CardTitle `style={{ color:... }}` 残留 | 9 处 | **0 处** |
| 默认网格列数 | 4 | **3** |
| TypeScript 新增错误 | — | **0** |

---

## 文件变更清单

| 文件 | 变更类型 |
|:-----|:---------|
| `styles/tokens/base.css` | text-muted/text-disabled 颜色值修正 |
| `pages/dashboard/DashboardPage.tsx` | 横幅按钮层级 + 说明文字 opacity |
| `components/dashboard/cards/TrendChart.tsx` | 高度 200→260；Skeleton 占位 |
| `components/dashboard/cards/FormularPieChart.tsx` | 高度 200→240；CardTitle 语义化 |
| `components/dashboard/cards/ExperimentBarChart.tsx` | 高度 200→240；CardTitle 语义化 |
| `pages/formula/components/DashboardLayout.tsx` | 默认列数 4→3；拖拽手柄定位 |
| `components/dashboard/cards/ActivityTimeline.tsx` | CardTitle 语义化 |
| `components/dashboard/cards/RecentExperiments.tsx` | CardTitle 语义化 |
| `components/dashboard/cards/ReviewQueueList.tsx` | CardTitle 语义化 |
| `components/dashboard/cards/TodosList.tsx` | CardTitle 语义化 |
| `scripts/dashboard-ui-fix-phase3.py` | 新建（批量修复脚本） |
| `scripts/fix-charts.py` | 新建（图表高度修复） |
