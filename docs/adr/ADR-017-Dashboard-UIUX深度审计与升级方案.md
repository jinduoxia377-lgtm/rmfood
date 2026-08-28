# ADR-017 — Dashboard 页面 UI/UX 深度审计与升级方案

**状态**：📋 待执行  
**日期**：2026-08-16  
**领域**：前端 / UI/UX  
**前置**：[ADR-012](./ADR-012-主题系统精简与统一.md)、[ADR-014](./ADR-014-主题系统组件级迁移.md)、[ADR-016](./ADR-016-主题系统深度审计与补齐.md)

---

## 一、审计范围

| 文件 | 行数 | 说明 |
|:-----|-----:|:-----|
| `pages/dashboard/DashboardPage.tsx` | ~2000+ | 主页面（可拖拽卡片布局 + AI洞察 + KPI监控） |
| `pages/database/DashboardOverview.tsx` | 1897 | 数据库仪表盘（4 Tab：概览/排行/关联/质量） |
| `components/dashboard/cards/*.tsx` | 700+ | 8 张卡片组件 |
| `components/layout/MainLayout.tsx` | 746 | 侧边栏 + 顶栏布局 |
| `components/ui/StatCard.tsx` | 35 | 统计卡片基座 |
| `components/ui/Card.tsx` | ~100 | 卡片容器 |

---

## 二、发现的问题（按优先级排序）

### 🔴 P0 — 主题一致性断裂（影响所有用户）

#### 问题 1：文字颜色语义类零使用
```
text-neutral-*:    210 处   ← 硬编码 Tailwind 中性色
text-text-primary:   0 处   ← 语义类完全未用
text-text-secondary: 0 处   ← 语义类完全未用
```
**影响**：切换暗色模式时，文字颜色不响应。当前依赖 `dark:text-white` 手动维护，极易遗漏。

**修复方案**：
```
text-neutral-900  → text-text-primary
text-neutral-700  → text-text-secondary  
text-neutral-500  → text-text-muted
text-neutral-400  → text-text-disabled
```

#### 问题 2：Dashboard 区域 59 处硬编码 hex 颜色
集中在 `DashboardOverview.tsx` 的渐变配置、Sparkline SVG、饼图 Color 数组。

**修复方案**：将静态 hex 替换为 CSS 变量引用，或迁移至 `theme.presets.ts` 的动态色阶。

#### 问题 3：30 处 `dark:bg-*` 残留
主要为 `bg-primary-100 dark:bg-primary-900/30` 等双值写法。

**修复方案**：利用 `semantic-utils.css` 中已有的语义类，或直接依赖 CSS 变量的暗色覆盖（已实现）。

---

### 🟡 P1 — 设计系统一致性（视觉品质）

#### 问题 4：字体层级未使用 Token
```
text-h[1-4]:     0 处   ← 排版 Token 未使用
text-display:    2 处   ← 仅 2 处使用，其余用 text-xl~3xl 硬编码
text-overline:   0 处   ← 完全未用
```
**影响**：标题大小不统一，不同区域字号跳跃。

**修复方案**：
```
h1 (22px)  → text-h1（现有 - 1.375rem）
h2 (18px)  → text-h2（现有 - 1.125rem）
小标题      → text-body-sm（现有 - 14px）
标签/徽章   → text-overline（现有 - 11px uppercase）
```

#### 问题 5：卡片阴影层级混乱
```
shadow-sm: 24处  shadow-md: 4处  shadow-lg: 5处
无 shadow-xs / shadow-card / shadow-elevated
```
**影响**：视觉上卡片浮起层级不分明，缺乏 Material Design 3 的 elevation 体系。

**修复方案**：建立 4 级 elevation 映射：
```
默认卡片    → shadow-sm（或与 surface-card 内置 shadow 一致）
悬浮卡片    → shadow-card-hover
模态/弹出   → shadow-modal
浮层        → shadow-elevated
```

#### 问题 6：背景层语义类未使用
```
bg-surface/*:    0 处  ← 完全未使用
bg-neutral-*:   45 处 ← 部分使用，但未系统性替换
```
**影响**：背景色切换不响应主题，亮/暗色模式下视觉层次丢失。

**修复方案**：
```
bg-white        → surface-card（已定义，含 border + radius）
bg-neutral-50   → bg-neutral-default（CSS变量自动响应暗色）
bg-slate-50     → bg-neutral-subtle（语义更清晰）
```

---

### 🟢 P2 — 交互与体验优化

#### 问题 7：QuickActions 图标渐变硬编码
```tsx
color:'from-primary-500 to-primary-600'
color:'from-violet-500 to-purple-600'
// ... 5 个 Action 各有独立渐变
```
**建议**：提取为 `ACTION_VARIANTS` 常量，使用语义色阶而非 Tailwind 类名拼接。

#### 问题 8：Sparkline SVG ID 冲突
```tsx
<linearGradient id={`spark-gradient-${positive ? 'up' : 'down'}`}>
```
同名 ID 在多张 Sparkline 同时渲染时会产生冲突，导致部分迷你图渲染异常。

**修复方案**：改用 CSS `currentColor` + SVG `<use>` 引用，或为每张图生成唯一 ID（包含组件实例计数）。

#### 问题 9：DashboardPage 缺少 Skeleton Loading
`DashboardOverview.tsx` 有 skeleton 实现，但 `DashboardPage.tsx`（主页面）未见对应骨架屏。

**建议**：为 StatsCards、TrendChart、QuickActions 等卡片添加统一的 Skeleton 组件。

---

## 三、优化升级方案（分三阶段）

### Phase 1：主题一致性修复（预计 2h）

| 任务 | 文件 | 预估改动 |
|:-----|:-----|:--------:|
| 1.1 文字颜色语义化 | `DashboardOverview.tsx` + 所有 cards | 210 处替换 |
| 1.2 背景色语义化 | 同上 | 45 处替换 |
| 1.3 移除 dark: 前缀残留 | 同上 | 30 处清理 |
| 1.4 修复 Sparkline ID 冲突 | `DashboardOverview.tsx:267` | 1 处修复 |

**脚本化执行**：可复用 `scripts/migrate-theme-v6.py` + 新增规则。

### Phase 2：设计系统对齐（预计 4h）

| 任务 | 文件 | 说明 |
|:-----|:-----|:-----|
| 2.1 标题层级统一 | DashboardOverview + DashboardPage | text-h1/h2 替代 text-xl/2xl |
| 2.2 阴影层级标准化 | Card 组件 | 4 级 elevation 映射 |
| 2.3 背景层语义化 | 全 Dashboard 区域 | bg-surface-* / bg-neutral-* |
| 2.4 QuickActions 常量提取 | `QuickActions.tsx` | 渐变色集中管理 |

### Phase 3：体验增强（预计 6h）

| 任务 | 说明 |
|:-----|:-----|
| 3.1 Skeleton Loading | 为 DashboardPage 8 张卡片添加骨架屏 |
| 3.2 空状态优化 | 无数据时展示引导式 EmptyState |
| 3.3 微交互动效 | hover 卡片添加 `recipe-card-transition` |
| 3.4 暗色模式视觉验收 | 逐组件检查 contrast ratio ≥ 4.5:1 |

---

## 四、UI 视觉评分

| 维度 | 得分 | 说明 |
|:-----|:----:|:-----|
| 主题响应性 | 6/10 | 结构性修复后达标，但局部硬编码仍需清理 |
| 视觉一致性 | 7/10 | 阴影层级和字体大小存在不一致 |
| 信息架构 | 8/10 | 4 Tab 分类清晰，卡片布局合理 |
| 交互反馈 | 7/10 | hover/active 状态存在，但缺少 skeleton |
| 无障碍 | 6/10 | focus-ring 已修复，但 contrast 需验收 |
| **综合** | **6.8/10** | 基础扎实，需精细打磨 |

---

## 五、执行建议

**优先执行 Phase 1**（主题一致性），这是 ADR-016 修复的延续，风险最低、收益最大。Phase 2/3 可作为独立 PR 迭代。
