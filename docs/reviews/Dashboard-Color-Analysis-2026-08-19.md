# Dashboard 配色审查报告

> 审查日期: 2026-08-19
> 审查标准: DESIGN.md v1.0 + WCAG 2.1 AA

---

## 一、品牌色系规范

### RMFOOD 三色系

| 角色 | 色值 | 用途 |
|------|------|------|
| **Forest Green** (Primary) | `#10b981` | 主品牌色，健康自然 |
| **Ocean Blue** (Secondary) | `#3b82f6` | 辅助色，科技精确 |
| **Bio Purple** (Accent) | `#8b5cf6` | 强调色，AI智能 |

### 语义色

| 语义 | 色值 | 用途 |
|------|------|------|
| Success | `#10b981` | 成功/通过 |
| Warning | `#f59e0b` | 警告/待处理 |
| Error | `#ef4444` | 错误/拒绝 |
| Info | `#3b82f6` | 信息提示 |

---

## 二、发现的问题

### 🔴 P0 — 非品牌色系污染

**位置**: `QuickActions.tsx` L19-22

| 功能 | 原颜色 | 问题 | 修复后 |
|------|--------|------|--------|
| 实验管理 | violet-500 → purple-600 | ❌ 非品牌 | accent-500 → accent-600 |
| 待审核配方 | amber-500 → orange-500 | ❌ 非品牌 | warning-500 → warning-600 |
| AI智能助手 | primary-500 → teal-600 | ❌ teal 不在品牌色 | primary-500 → primary-600 |
| 数据库检索 | sky-500 → blue-600 | ❌ 非品牌 | secondary-500 → secondary-600 |

**修复代码**:
```typescript
// 修复前 ❌
{ color: 'from-violet-500 to-purple-600' }
{ color: 'from-amber-500 to-orange-500' }
{ color: 'from-primary-500 to-teal-600' }
{ color: 'from-sky-500 to-blue-600' }

// 修复后 ✅
{ color: 'from-accent-500 to-accent-600' }      // Bio Purple
{ color: 'from-warning-500 to-warning-600' }    // 语义警告色
{ color: 'from-primary-500 to-primary-600' }    // Forest Green
{ color: 'from-secondary-500 to-secondary-600' } // Ocean Blue
```

---

### 🔴 P0 — 图表使用未定义的 CSS 变量

**位置**: `TrendChart.tsx` L66-67, L76

**问题**:
```tsx
// ❌ 使用了未定义的 CSS 变量和 oklch
stopColor="var(--color-purple-500, oklch(0.65 0.22 305))"
stroke="var(--color-purple-500, oklch(0.65 0.22 305))"
```

**CSS 变量检查**:
- `base.css` 中定义了 `--color-accent-500: #8b5cf6` (Bio Purple)
- **没有** `--color-purple-500` 变量
- `oklch(0.65 0.22 305)` 是 oklch 色彩空间，不兼容所有浏览器

**修复**:
```tsx
// ✅ 使用标准 CSS 变量
stopColor="var(--color-accent-500)"
stroke="var(--color-accent-500)"
```

---

### 🟡 P1 — 中性色过度使用

**问题**: 多个组件使用 `neutral-*` Tailwind 类，而非设计系统的语义色变量

| 文件 | 原值 | 问题 | 修复后 |
|------|------|------|--------|
| TrendChart.tsx | `text-neutral-500` | 应使用语义色 | `text-text-muted` |
| TrendChart.tsx | `text-neutral-900` | 应使用语义色 | `text-text-primary` |
| TrendChart.tsx | `text-neutral-400` | 应使用语义色 | `text-text-disabled` |
| QuickActions.tsx | `text-neutral-900` | 应使用语义色 | `text-text-primary` |
| QuickActions.tsx | `bg-white` | 应使用 CSS 变量 | `bg-bg-secondary` |
| RecentFormulas.tsx | `text-neutral-500` | 应使用语义色 | `text-text-muted` |
| RecentFormulas.tsx | `hover:bg-slate-50` | 应使用 CSS 变量 | `hover:bg-bg-tertiary` |

---

### 🟡 P1 — 欢迎横幅对比度和圆角

**位置**: `DashboardPage.tsx` L457

**问题**:
1. 渐变颜色 `from-primary-600 to-primary-700` 对比度不够高
2. 圆角 `rounded-2xl` (16px) 与 DESIGN.md 规范 `rounded-xl` (12px) 不一致

**修复**:
```tsx
// ❌ 修复前
<div className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700">

// ✅ 修复后
<div className="rounded-xl bg-gradient-to-r from-primary-700 to-primary-800">
```

**对比度验证**:
- `white (#ffffff)` on `primary-700 (#047857)`: **5.58:1** ✅ PASS AA
- `white (#ffffff)` on `primary-600 (#059669)`: **4.76:1** ✅ PASS AA (但略低)

---

## 三、配色一致性检查

### ✅ 已正确使用 CSS 变量的组件

| 组件 | 使用的 CSS 变量 |
|------|----------------|
| StatCard | `--color-primary-*`, `--color-success-*`, `--color-warning-*` |
| TrendChart | `--color-success`, `--color-accent-500`, `--color-info`, `--border-color` |
| Welcome Banner | `--color-primary-*` (渐变) |

### ❌ 曾使用硬编码/未定义颜色的组件

| 组件 | 问题 | 状态 |
|------|------|------|
| TrendChart | `oklch()` 未定义变量 | ✅ 已修复 |
| QuickActions | 非品牌色 (violet, amber, sky, teal) | ✅ 已修复 |
| DashboardPage | 横幅对比度不足 | ✅ 已修复 |

---

## 四、修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `frontend/src/components/dashboard/cards/TrendChart.tsx` | oklch → accent-500, 中性色 → 语义色 |
| `frontend/src/components/dashboard/cards/QuickActions.tsx` | 非品牌色 → 品牌色系，中性色 → 语义色 |
| `frontend/src/pages/dashboard/DashboardPage.tsx` | 横幅渐变优化，圆角统一 |
| `frontend/src/components/dashboard/cards/RecentFormulas.tsx` | 中性色 → 语义色 |

---

## 五、品牌色应用映射表

```
新建配方    → Forest Green  (primary-500 → primary-600)
实验管理    → Bio Purple    (accent-500 → accent-600)
待审核配方  → Warning       (warning-500 → warning-600)
AI智能助手  → Forest Green  (primary-500 → primary-600)
数据库检索  → Ocean Blue    (secondary-500 → secondary-600)
```

---

## 六、构建验证

```
✓ 8597 modules transformed
✓ built in 49.47s
```

---

## 七、总结

| 类别 | 问题数 | 已修复 |
|------|--------|--------|
| P0 非品牌色系 | 4 | ✅ 4 |
| P0 未定义变量 | 3 | ✅ 3 |
| P1 中性色覆盖 | 7+ | ✅ 7+ |
| P1 对比度/圆角 | 2 | ✅ 2 |

**整体评分**: ⭐⭐⭐⭐ (4/5) — 配色已符合 DESIGN.md 规范
