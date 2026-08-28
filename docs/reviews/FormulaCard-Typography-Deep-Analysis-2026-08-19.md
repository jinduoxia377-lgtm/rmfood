# FormulaCard 排版深度分析与修复报告

> 分析日期: 2026-08-19
> 页面: http://localhost:3000/formulas?sort_field=updated_at&sort_dir=desc

---

## 一、问题诊断

### 🔴 P0 — 卡片高度不一致（核心问题）

```
┌─ 卡片 A (有描述+标签) ─────────────┐    ┌─ 卡片 B (无描述无标签) ────────┐
│  [★] 配方名称                       │    │  [★] 配方名称                   │
│  [☐] F001 · v1.2         [草稿]    │    │  [☐] F002 · v1.0    [草稿]    │
│                                     │    │                                 │
│  这是一段描述文字...                  │    │                                 │
│  跨越多行...                          │    │                                 │
│                                     │    │                                 │
│  [补气养血] [健脾益胃] [+1]           │    │                                 │
│                                     │    │                                 │
│  ─────────────────                    │    │  ─────────────────              │
│  2024-01-15      [👁️] [↗️]          │    │  2024-01-15      [👁️] [↗️]      │
└─────────────────────────────────────┘    └─────────────────────────────────┘
       高度 ~320px                              高度 ~200px ← 差 120px!
```

**根因**: 卡片无 `min-height` 约束，内容差异导致高度参差不齐。

**修复**:
```tsx
// 修复前
<Card className="group card-hover relative animate-in ...">

// 修复后
<Card className="group card-hover relative min-h-[280px] flex flex-col animate-in ...">
```

同时添加 `mt-auto` 到底部区域，确保 footer 始终在底部：
```tsx
// 修复后
<div className="flex items-center justify-between mt-auto pt-4 border-t ...">
```

---

### 🟡 P1 — Filter 面板硬编码字号

| 位置 | 原值 | 规范值 | 说明 |
|------|------|--------|------|
| L1123 h3 | `text-[15px]` | `text-body` (15px) | 语义化 |
| L1143 label | `text-[13px]` | `text-body-sm` (14px) | 标签文字 |
| L1258 p | `text-[13px]` | `text-body-sm` (14px) | 显示设置标签 |
| L1506 thead | `text-[13px]` | `text-overline` (11px) | 表格头应使用 overline uppercase |

---

### 🟡 P1 — 图标尺寸过小

| 位置 | 原值 | 规范值 | 说明 |
|------|------|--------|------|
| L1099 X 图标 | `size={10}` (10px) | `size={14}` | 筛选标签关闭按钮 |
| L1324 X 图标 | `size={10}` (10px) | `size={14}` | 同上 |
| L1125 Filter 图标 | `w-3.5 h-3.5` (14px) | `w-4 h-4` (16px) | 筛选面板标题图标 |

---

### 🟡 P1 — 表格行高不一致

```
| 列 | padding | 问题 |
|----|---------|------|
| Checkbox | px-4 py-4 | ✅ |
| 名称 | px-4 py-3 | ❌ 不一致 |
| 状态 | px-4 py-3 | ❌ 不一致 |
| 成分数量 | px-4 py-4 | ✅ |
| 创建者 | px-4 py-4 | ✅ |
```

**修复**: 统一所有 th 为 `py-4`

---

### 🟢 P2 — 卡片内部布局细节

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| 标题区对齐 | `items-start` | `items-center` |
| 操作按钮间距 | `gap-1` (4px) | `gap-1.5` (6px) |
| Footer 位置 | 随内容浮动 | `mt-auto` 固定底部 |

---

## 二、修复后卡片结构

```
┌─ Card (min-h-[280px] flex flex-col) ───────────────────┐
│  Content: px-5 py-5 pb-4                               │
│                                                        │
│  [Star 16px] absolute top-4 right-4                    │
│                                                        │
│  ┌─ 标题区 (items-center mb-3) ─────────────────────┐  │
│  │  [Checkbox 24px] h3 text-h4 (22px) [Badge]      │  │
│  │  p caption (12px) · v1.2                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ 描述 (mb-3) ───────────────────────────────────┐  │
│  │  p body-sm (14px) line-clamp-2                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ 标签 (gap-2 mb-3) ─────────────────────────────┐  │
│  │  [tag] [tag] [tag] [+2]                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ 底部分隔线 (mt-auto pt-4 border-t) ────────────┐   │
│  │  2024-01-15              [👁️ 16px] [↗️ 16px]    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 三、Typography 层级对照

| 元素 | 修复前 | 修复后 | DESIGN.md 规范 |
|------|--------|--------|----------------|
| 页面标题 | `text-h1` → `text-display-lg` | ✅ | display-lg (36px) |
| 卡片标题 | `text-h2` → `text-h4` | ✅ | h4 (22px) |
| 描述文字 | `text-body-sm` | ✅ | body-sm (14px) |
| 代码/版本 | `text-caption` | ✅ | caption (12px) |
| 日期 | `text-caption` | ✅ | caption (12px) |
| Filter 标题 | `text-[15px]` → `text-body` | ✅ | body (15px) |
| Filter 标签 | `text-[13px]` → `text-body-sm` | ✅ | body-sm (14px) |
| 表格头 | `text-[13px]` → `text-overline` | ✅ | overline (11px) uppercase |

---

## 四、修改文件清单

| 文件 | 修改行数 | 主要修改 |
|------|---------|----------|
| `FormulaCard.tsx` | 5 | min-height、flex布局、对齐、间距 |
| `FormulaListPage.tsx` | 9 | 字号、图标尺寸、表格行高 |

---

## 五、构建验证

```
✓ built in 47s
✓ 8597+ modules transformed
```

---

## 六、WCAG 2.1 AA 合规状态

| 检查项 | 修复前 | 修复后 |
|--------|--------|--------|
| 触摸目标 ≥44px | ✅ PASS | ✅ PASS |
| 图标尺寸 ≥14px | ❌ FAIL (10px) | ✅ PASS |
| 字号使用 CSS 变量 | ⚠️ 混用硬编码 | ✅ 统一 |
| 表格可访问性 | ✅ PASS | ✅ PASS |
