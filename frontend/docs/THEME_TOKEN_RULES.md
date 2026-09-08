# Theme Token 强制使用规范

> 本文档规定 RMFOOD 项目中主题系统的强制使用规则，违反将导致主题切换失效。

## 核心原则

**所有颜色和样式必须通过 CSS 变量或语义化类引用，禁止硬编码颜色值。**

## ✅ 允许使用的类/变量

### shadcn 语义类
```css
/* 背景 */
bg-background    /* var(--bg-canvas) — 页面背景 */
bg-card          /* var(--bg-surface-container) — 卡片背景 */
bg-popover       /* var(--bg-surface-container) — 弹出层背景 */
bg-muted         /* var(--color-neutral-muted) — 弱化背景 */
bg-primary       /* var(--color-primary-600) — 主色背景 */
bg-secondary     /* var(--color-secondary-500) — 辅色背景 */
bg-success       /* var(--color-success) — 成功背景 */
bg-warning       /* var(--color-warning) — 警告背景 */
bg-destructive   /* var(--color-error) — 错误背景 */

/* 文字 */
text-foreground  /* var(--text-primary) — 主文字 */
text-muted       /* var(--text-muted) — 弱化文字 */
text-primary     /* var(--color-primary-600) — 主色文字 */
text-secondary   /* var(--color-secondary-500) — 辅色文字 */
text-success     /* var(--color-success) — 成功文字 */
text-warning     /* var(--color-warning) — 警告文字 */
text-destructive /* var(--color-error) — 错误文字 */

/* 边框 */
border-border    /* var(--border-color) — 默认边框 */
border-primary   /* var(--color-primary-600) — 主色边框 */
```

### RMFOOD 自定义语义类
```css
/* 中性色阶（替代 Tailwind 内置 neutral-*）*/
bg-neutral-50 ~ bg-neutral-900
text-neutral-50 ~ text-neutral-900
border-neutral-50 ~ border-neutral-900

/* 表面层级 */
bg-surface-default    /* var(--bg-surface-container) */
bg-surface-variant    /* var(--bg-surface-container-low) */
bg-background-default /* var(--bg-primary) */
bg-background-elevated/* var(--bg-surface-elevated) */
bg-background-hover   /* var(--hover-bg) */

/* 工具类 */
text-text-primary    /* var(--text-primary) */
text-text-secondary  /* var(--text-secondary) */
text-text-muted      /* var(--text-muted) */
surface-hover        /* var(--hover-bg) */
```

### CSS 变量引用（JavaScript style prop）
```javascript
// 推荐：使用 CSS 变量
style={{ color: 'var(--text-primary)' }}
style={{ background: 'var(--bg-surface-container)' }}

// 不推荐但可接受（仅限动态计算值）
style={{ color: theme.colors.text.primary }}
```

## ❌ 禁止使用

### 硬编码 Tailwind 内置颜色
```css
/* ❌ 禁止 */
bg-white              → 改用 bg-background 或 bg-card
bg-gray-100           → 改用 bg-neutral-100
bg-gray-50            → 改用 bg-neutral-50
text-gray-600         → 改用 text-muted 或 text-secondary
text-gray-900         → 改用 text-foreground
border-gray-200       → 改用 border-border
```

### 硬编码 HEX 颜色值
```javascript
// ❌ 禁止
<div style={{ background: '#10b981' }}>
<span className="text-[#059669]">

// ✅ 正确
<div style={{ background: 'var(--color-primary)' }}>
<span className="text-primary-600">  {/* 前提：semantic-utils.css 已导入 */}
```

### inline style 冗余写法
```javascript
// ❌ 禁止 — 用 className 替代
<div className="px-4 py-2" style={{ 
  color: 'var(--text-secondary)',
  fontSize: '14px',
  fontWeight: 500 
}}>

// ✅ 正确 — 使用语义类
<div className="px-4 py-2 text-secondary text-sm font-medium">
```

## 新增页面开发规范

1. **新建页面必须使用语义化类名**，禁止使用 `bg-white`、`text-gray-*` 等硬编码颜色
2. **新建组件必须通过 CSS 变量引用颜色**，禁止在组件内硬编码 hex 值
3. **主题切换测试**：每新增页面后，必须验证 Light ↔ Dark 模式下颜色正常切换

## 变量替换速查表

| 禁止写法 | 正确替换 |
|---------|---------|
| `bg-white` | `bg-background` 或 `bg-card` |
| `bg-gray-50` | `bg-neutral-50` |
| `bg-gray-100` | `bg-neutral-100` |
| `bg-gray-500` | `bg-neutral-500` |
| `text-gray-500` | `text-muted` 或 `text-neutral-500` |
| `text-gray-700` | `text-secondary` 或 `text-neutral-700` |
| `text-gray-900` | `text-foreground` 或 `text-neutral-900` |
| `border-gray-200` | `border-border` 或 `border-neutral-200` |
| `#10b981` (primary) | `var(--color-primary)` |
| `#059669` (primary-600) | `var(--color-primary-600)` |
| `#f8fafc` (canvas) | `var(--bg-canvas)` |
| `#0f172a` (dark canvas) | `var(--bg-canvas)` (dark mode 自动切换) |