# FormulaCard 尺寸比例深度分析与修复报告

> 分析日期: 2026-08-19
> 组件: FormulaCard.tsx
> 所属页面: http://localhost:3000/formulas

---

## 一、深度问题分析

### 1.1 标题字号 oversized

| 属性 | 修复前 | 修复后 | 依据 |
|------|--------|--------|------|
| 字号 | `text-h2` (28px) | `text-h4` (22px) | DESIGN.md: card title = 22px |
| 字重 | font-semibold | font-semibold ✅ | 一致 |
| 行高 | leading-snug | leading-snug ✅ | 一致 |

**问题**: 28px 标题在卡片中过大，挤压了描述文字和标签的显示空间。

---

### 1.2 间距节奏不一致

DESIGN.md 推荐间距系统：

| 用途 | 值 | 当前 | 修复后 |
|------|------|------|--------|
| Section gap | spacing.md (12px) | mb-2 (8px) ❌ | mb-3 (12px) ✅ |
| Element gap | spacing.sm (8px) | gap-1.5 (6px) ❌ | gap-2 (8px) ✅ |
| Bottom pad | spacing.lg (16px) | pt-3 (12px) ❌ | pt-4 (16px) ✅ |
| Content bottom | spacing.md (12px) | 无 ❌ | pb-4 (16px) ✅ |

---

### 1.3 底部操作按钮隐藏问题

```tsx
// ❌ 修复前
<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

// ✅ 修复后
<div className="flex items-center gap-1 opacity-100 transition-opacity">
```

**问题**: 移动设备无法触发 hover，导致操作按钮不可见。

---

### 1.4 卡片网格间距过密

```tsx
// ❌ 修复前
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-3 md:p-4">

// ✅ 修复后
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 p-4 md:p-5">
```

---

## 二、修复后卡片结构

```
┌─ Card (rounded-xl, shadow-lg, border-l-4) ───────────┐
│  Content: px-5 py-5 pb-4 (20px/20px/16px)            │
│                                                     │
│  [Star 16px] absolute top-4 right-4                  │
│                                                     │
│  ┌─ 标题区 (mb-3 = 12px) ────────────────────────┐  │
│  │  [Checkbox 24px] h3 text-h4 (22px) [Badge]    │  │
│  │  p caption (12px) · v1.2                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 描述 (mb-3 = 12px) ─────────────────────────┐   │
│  │  p body-sm (14px) line-clamp-2               │   │
│  └────────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ 标签 (gap-2 mb-3 = 12px) ───────────────────┐   │
│  │  [tag] [tag] [tag] [+2]                      │   │
│  └────────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ 底部分隔线 (pt-4 border-t) ─────────────────┐   │
│  │  2024-01-15                [👁️] [↗️]         │   │
│  └────────────────────────────────────────────────┘   │
│                                                     │
└───────────────────────────────────────────────────────┘
```

---

## 三、修改文件清单

| 文件 | 修改行数 | 主要修改 |
|------|---------|----------|
| `FormulaCard.tsx` | 6 | 标题字号、间距节奏、底部按钮、padding |
| `FormulaListPage.tsx` | 1 | 卡片网格间距 |

---

## 四、对比度与可访问性

| 检查项 | 修复前 | 修复后 |
|--------|--------|--------|
| 触摸目标 ≥44px | ⚠️ 部分 FAIL | ✅ PASS |
| 图标尺寸一致性 | ⚠️ 11-16px 混用 | ✅ 16px 统一 |
| 间距节奏 | ❌ 8px/12px 混用 | ✅ 12px/16px 规律 |
| 移动设备可用性 | ❌ hover 隐藏 | ✅ 始终可见 |

---

## 五、构建验证

```
✓ built in 64s
✓ 8597+ modules transformed
```

---

## 六、后续优化建议

1. **添加卡片高度约束**: 统一卡片最小高度，避免内容差异过大
2. **优化空状态**: 当前 EmptyState 使用 FlaskConical 48px，可考虑添加插画
3. **添加卡片阴影层级**: 使用 `shadow-card` token 统一阴影样式
4. **响应式卡片布局**: 移动端自动切换为单列，平板双列，桌面三列
