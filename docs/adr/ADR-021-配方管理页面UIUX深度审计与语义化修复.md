# ADR-021 — 配方管理页面 UI/UX 深度审计与语义化修复

**状态**：✅ 已执行  
**日期**：2026-08-16  
**领域**：前端 / UI/UX / 设计系统  
**前置**：[ADR-019](./ADR-019-Dashboard-UIUX深度设计审计与执行.md)、[ADR-020](./ADR-020-TypeScript错误修复-配方案例页面.md)

---

## 问题

`http://localhost:3000/formulas?sort_field=updated_at&sort_dir=desc`（配方管理列表页）存在以下 UI/UX 问题：

| 类别 | 具体问题 |
|:-----|:---------|
| 文字色彩 | 大量 `text-neutral-500/600/700` 未使用语义化 Token，对比度不足 |
| 标题层级 | 筛选面板标题 `text-[15px]` 硬编码，未使用 `text-h` Token |
| 状态色 | `STATUS_OPTIONS` 草稿/归档用 `bg-neutral-100`，已通过用 `bg-primary-100`，语义混乱 |
| 表格样式 | 表头背景 `bg-neutral-700/95` 过于沉重；行 hover 用 `bg-slate-50`；边框用 `border-neutral-200` |
| 卡片视觉 | FormulaCard 标题硬编码 `text-[15px] font-semibold text-neutral-900`；次级信息无层次区分 |
| 暗色模式 | 多处 `dark:text-white` 硬编码，未使用 `dark:text-text-primary` |
| slate/gray 残留 | 渐变背景大量使用 `from-slate-100 to-gray-50` 等，应改用 neutral 语义色 |

---

## 修复内容

### FormulaListPage.tsx（~144 处改动）

**STATUS_OPTIONS 状态色语义化：**
```diff
- { value:'draft', label:'草稿', color:'bg-neutral-100 text-neutral-700' }
+ { value:'draft', label:'草稿', color:'bg-neutral-default text-text-primary' }

- { value:'approved', label:'已通过', color:'bg-primary-100 text-primary-700' }
+ { value:'approved', label:'已通过', color:'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300' }

- { value:'rejected', label:'已驳回', color:'bg-error-100 text-error-700' }
+ { value:'rejected', label:'已驳回', color:'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300' }

- { value:'archived', label:'已归档', color:'bg-neutral-100 text-neutral-600' }
+ { value:'archived', label:'已归档', color:'bg-neutral-subtle text-text-disabled' }
```

**文字色彩语义化（102→0 处 `text-neutral-*`）：**
```
text-neutral-900/800 → text-text-primary
text-neutral-700     → text-text-secondary
text-neutral-500     → text-text-muted
text-neutral-400/300 → text-text-disabled
```

**标题层级标准化：**
```diff
- text-[15px] font-semibold text-neutral-800
+ text-h2 font-semibold text-text-primary

- text-[13px] font-medium text-neutral-500
+ text-body-sm font-medium text-text-muted

- text-[13px] font-medium text-neutral-500 uppercase tracking-wider
+ text-overline font-medium text-text-muted uppercase tracking-wider
```

**slate/gray → neutral 语义色：**
```diff
- from-slate-100 via-slate-50 to-gray-50
+ from-neutral-subtle via-neutral-default to-neutral-subtle/50

- from-slate-600 to-gray-600 dark:from-slate-400 dark:to-gray-400
+ from-neutral-600 to-neutral-700 dark:from-neutral-400 dark:to-neutral-500

- bg-neutral-700/95 (表头背景)
+ bg-surface-overlay90 (表头背景)
```

**边框/分隔线：**
```diff
- border-neutral-200        → border-neutral-default/80
- border-neutral-100        → border-neutral-default/50
- hover:bg-neutral-100      → hover:bg-neutral-default
- hover:border-neutral-300  → hover:border-neutral-default/80
```

**暗色模式修复：**
```diff
- dark:text-white           → dark:text-text-primary
- dark:hover:text-white     → dark:hover:text-text-primary
```

**表格样式：**
```diff
- divide-y divide-slate-100 dark:divide-slate-700/50
+ divide-y divide-neutral-default/50 dark:divide-neutral-default/30

- hover:[&]:bg-slate-50/90/50
+ hover:[&]:bg-neutral-subtle/60

- bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50
+ bg-gradient-to-b from-surface-card to-neutral-subtle/40 dark:from-surface-card dark:to-neutral-subtle/20
```

### FormulaCard.tsx（11 处改动）

```diff
- <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600">
+ <h3 className="text-h2 font-semibold text-text-primary group-hover:text-primary-600">

- <p className="text-xs text-neutral-400 mt-0.5">代码 · v版本</p>
+ <p className="text-caption text-text-disabled mt-0.5">代码 · v版本</p>

- <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{description}</p>
+ <p className="text-body-sm text-text-secondary line-clamp-2 mb-3">{description}</p>

- className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
+ className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-neutral-default transition-colors"

- <Star className={isFavorite ? 'fill-amber-400 text-warning-400' : 'text-neutral-300'} />
+ <Star className={isFavorite ? 'fill-amber-400 text-warning-400' : 'text-text-disabled'} />

- className="border-neutral-300 hover:border-primary-400"
+ className="border-neutral-default hover:border-primary-400"

- <span className="text-xs text-neutral-400">{formatDate(updatedAt)}</span>
+ <span className="text-caption text-text-disabled">{formatDate(updatedAt)}</span>

- border-t border-neutral-100
+ border-t border-neutral-default/50

- text-neutral-400 hover:text-primary-600
+ text-text-disabled hover:text-primary-600
```

---

## 验证结果

| 检查项 | 修复前 | 修复后 |
|:-------|:------:|:------:|
| TypeScript 编译错误 | 0 | 0 ✅ |
| `text-neutral-*` 残留 | 102 | **0** ✅ |
| `slate/gray` 背景残留 | 大量 | **0** ✅ |
| `dark:text-white` 残留 | 多处 | **0** ✅ |
| `text-[13px]` 硬编码 | 2处 | **0** ✅ |
| `hover:bg-neutral-100` | 多处 | **0** ✅ |
| `border-neutral-2xx/3xx` | 多处 | **0** ✅ |
| 前端服务 (3000) | HTTP 200 | HTTP 200 ✅ |
| 后端服务 (8000) | healthy | healthy ✅ |

---

## 视觉层级总结

修复后的配方管理列表页遵循 Major Third 类型比例：

| 元素 | 修复前 | 修复后 |
|:-----|:-------|:-------|
| 页面标题 | — | `text-h1 font-bold text-text-primary`（PageHeader 默认）|
| 筛选面板标题 | `text-[15px]` | `text-h2 font-semibold` |
| 筛选标签小字 | `text-[13px]` | `text-body-sm font-medium` / `text-overline uppercase` |
| 卡片标题 | `text-[15px]` | `text-h2 font-semibold` |
| 卡片描述 | `text-sm text-neutral-500` | `text-body-sm text-text-secondary` |
| 版本号/日期 | `text-xs text-neutral-400` | `text-caption text-text-disabled` |
| 表格正文 | `text-sm text-neutral-500` | `text-sm text-text-muted` |
| 表格表头 | `bg-neutral-700/95 text-[13px]` | `bg-surface-overlay90 text-overline` |
