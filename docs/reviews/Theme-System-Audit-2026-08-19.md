# 项目主题系统问题汇总报告

> 审查日期: 2026-08-19
> 审查范围: frontend/src/styles/ + frontend/src/components/ + frontend/src/pages/

---

## 一、主题系统健康度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| CSS 变量完整性 | ⭐⭐⭐⭐⭐ (95%) | 核心变量定义完整 |
| 品牌色系一致性 | ⭐⭐⭐ (70%) | UI 组件仍有非品牌色 |
| 暗色模式兼容性 | ⭐⭐⭐⭐ (90%) | dark.css 覆盖完整 |
| 无障碍支持 | ⭐⭐⭐⭐⭐ (95%) | 高对比度/阅读模式 |
| 工具类可用性 | ⭐⭐⭐ (75%) | 部分语义类缺失 |
| **整体评分** | **⭐⭐⭐ (3/5)** | 基础良好，需持续优化 |

---

## 二、P1 严重问题

### 2.1 StatCard variant='secondary' 使用非品牌色

**位置**: `src/components/ui/StatCard.tsx:23`

```tsx
// ❌ 当前实现
secondary: { iconBg:'bg-violet-100 dark:bg-violet-900/30', iconColor:'text-violet-600 dark:text-violet-400' },

// ✅ 应为
secondary: { iconBg:'bg-secondary-100 dark:bg-secondary-900/30', iconColor:'text-secondary-600 dark:text-secondary-400' },
```

**影响**: 统计卡片在 Ocean Blue 主题下显示为紫色，违反品牌色系规范。

---

### 2.2 neutral-default / neutral-subtle 等自定义颜色未定义

**问题**: 代码中大量使用 `bg-neutral-default`、`text-neutral-600`、`border-neutral-default` 等类，但这些是 CSS 变量形式的自定义颜色，未在 Tailwind `@theme` 中显式注册。

**现状**:
- `bg-neutral-default` → 通过 CSS 变量 `--color-neutral-default` 工作（有 fallback）
- `text-neutral-600` → 使用 Tailwind 内置 slate-600，非品牌色
- `border-neutral-default` → 通过 CSS 变量工作

**建议**: 在 `semantic-utils.css` 中补充完整的 neutral 工具类映射。

---

## 三、P2 重要问题

### 3.1 UI 组件非品牌色使用统计

| 文件 | 非品牌色类型 | 使用次数 | 建议 |
|------|-------------|---------|------|
| EmptyStateIllustration.tsx | slate, gray, indigo, violet, rose, pink, amber, cyan, teal | ~50+ | 插图颜色，可接受 |
| FormulaDetailPage.tsx | violet, rose, amber | ~100+ | 部分功能色，需审查 |
| FormulaCaseDetailPage.tsx | slate, indigo, violet, rose, pink, amber, cyan, teal | ~50+ | 装饰性颜色 |
| FormulaCompare.tsx | violet, rose, pink, amber | ~20+ | 功能对比色 |
| Tooltip.tsx | slate | 8 | 应使用 neutral |
| Toast.tsx | slate, amber | 3 | 应使用 neutral |
| NotificationBell.tsx | slate, violet | 5 | 应使用 neutral |
| StatCard.tsx | violet | 4 | **应改为 accent/secondary** |

### 3.2 rgba(0,0,0) 阴影定义

**位置**: `base.css` L105, L123-126, L225-248; `dark.css` L109, L127-146

**分析**: 阴影中的 `rgba(0,0,0, X)` 是标准的 CSS 阴影写法，并非问题。Dark mode 下的阴影使用更高透明度 (0.3-0.45) 是正确的设计。

**结论**: ✅ 无需修改，这是正确的阴影实现。

### 3.3 语义工具类缺失

以下类在 `semantic-utils.css` 中**已定义**，但不在 `index.css` 的 `@theme` 中：

```css
/* semantic-utils.css 已定义的类 */
.text-text-primary    { color: var(--text-primary, #0f172a); }
.text-text-secondary  { color: var(--text-secondary, #334155); }
.text-text-muted      { color: var(--text-muted, #64748b); }
.text-text-disabled   { color: var(--text-disabled, #94a3b8); }
.bg-bg-secondary      { background: var(--bg-secondary, #ffffff); }
.bg-bg-tertiary       { background: var(--bg-tertiary, #f1f5f9); }
.border-border-color  { border-color: var(--border-color, #e2e8f0); }
.surface-card         { /* 复合样式 */ }
```

**状态**: ✅ 已在 `index.css` L196 附近定义，可正常使用。

---

## 四、P3 建议优化

### 4.1 图表组件硬编码颜色 (664处)

**分布**: AI 图表组件、Analytics 图表、Formula 趋势图等

**分析**: 图表颜色通常是数据驱动的颜色，用于区分不同数据系列，不属于主题系统问题。

**建议**: 
- 保持现状（功能性颜色）
- 可选: 添加 `theme-aware` 版本支持

### 4.2 KnowledgeGraph / PreferenceLearner 节点颜色

**分析**: 这些是功能性颜色（区分不同节点类型），不属于主题系统范畴。

**结论**: ✅ 无需修改。

### 4.3 过渡动画优化

**状态**: ✅ 已清除 `transition-all`，统一使用 `transition-normal`。

---

## 五、已修复的问题（本次审查前）

| 问题 | 状态 |
|------|------|
| Dashboard 硬编码 Indigo 颜色 | ✅ 已清理 |
| Dashboard 硬编码 rgba(99,102,241) | ✅ 已清理 |
| Dashboard 渐变使用非品牌色 (teal) | ✅ 已修复 |
| FormulaCard 标题字号 oversized | ✅ 已修复 |
| FormulaCard 触摸目标不足 | ✅ 已修复 |
| Banner 圆角不符合规范 | ✅ 已修复 |
| 批量删除按钮触摸目标 | ✅ 已修复 |
| 硬编码字号 text-[10px]/[13px]/[15px] | ✅ 已修复 |

---

## 六、下一步行动建议

### 立即修复 (P1)

1. **StatCard variant='secondary'** 改用 `secondary` 色系
2. **补充 neutral-* 工具类** 到 semantic-utils.css

### 计划修复 (P2)

1. **UI 组件非品牌色替换**:
   - Tooltip, Toast, NotificationBell → 使用 neutral-*
   - FormulaDetailPage 中的 violet/rose/amber → 审查是否为功能色

2. **Tailwind @theme 补充**:
   - 添加 `--color-neutral-default`, `--color-neutral-subtle` 等自定义颜色映射

### 长期优化 (P3)

1. 图表组件 theme-aware 支持
2. 添加 CSS 变量 linting 规则
3. 建立设计系统文档站点

---

## 七、构建验证

```
✓ built in 57s
✓ 8597+ modules transformed
```
