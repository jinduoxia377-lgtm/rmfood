# 智能对话反馈内容字体层级优化报告

**模块**: 智能对话 (ChatTab)  
**范围**: AI 回复内容 (MarkdownRenderer + chatTheme.css)  
**日期**: 2026-05-31  
**状态**: ✅ 完成

---

## 一、问题分析

### 1.1 层级错乱

修复前，AI 气泡内的内容字体大小与设计系统完全脱节：

| 元素 | 修复前 | 问题 | 修复后 | 设计令牌 |
|------|--------|------|--------|----------|
| H1 | 1.35em (≈18.9px) | 偏大，应为 H3 层级 | **24px** | `--chat-font-h3` |
| H2 | 1.18em (≈16.5px) | 偏大，无对应层级 | **18px** | `--chat-font-xl` (新增) |
| H3 | 1.06em (≈14.8px) | 偏小，应为 Body-lg | **16px** | `--chat-font-lg` |
| H4 | 1em (14px) | 与正文无差异 | **15px** | `--chat-font-md` |
| 正文 p | 14px | 应使用 Body 标准 | **15px** | `--chat-font-body` |
| 列表 | 14px | 与正文不一致 | **15px** | `--chat-font-body` |
| 内联代码 | 14px (em) | 过大，应为 Caption | **12px** | `--chat-font-sm` |
| 表格 | 13px (0.82rem) | 非标准值 | **14px** | `--chat-font-sm` |

### 1.2 行高不统一

| 元素 | 修复前 | 修复后 |
|------|--------|--------|
| H1 | 1.35 | `var(--chat-leading-tight, 1.25)` |
| H2 | 1.4 | `var(--chat-leading-snug, 1.33)` |
| H3 | 1.42 | `var(--chat-leading-snug, 1.33)` |
| H4 | 1.45 | `var(--chat-leading-normal, 1.5)` |
| p | 1.7 | `var(--chat-leading-relaxed, 1.625)` |
| li | 1.55/1.63 | `var(--chat-leading-relaxed, 1.625)` |

### 1.3 颜色硬编码

修复前大量使用硬编码十六进制颜色 (`#374151`, `#d1d5db`, `#1f2937`)，不跟随主题变化。

---

## 二、设计系统对齐方案

### 2.1 字体层级映射（对齐页面全局层级）

```
页面层级:     H1(36px) → H2(28px) → H3(24px) → H4(22px) → Body-lg(16px) → Body(15px) → Body-sm(14px) → Caption(12px) → Overline(11px)
对话内容层级:  —       →   H2    →   H1    →   H2    →     —      →  p/ul/li →   code/table  →  kbd/fn-ref
```

**对话内容 H1** 对应页面 **H3** 层级（24px）— 因为气泡本身已是卡片容器，不需要页面标题那么大的字号

### 2.2 chatTheme.css 新增令牌

```css
/* 字体大小体系 */
--chat-font-xs: 0.6875rem;      /* 11px — labels/badges */
--chat-font-sm: 0.75rem;        /* 12px — captions */
--chat-font-base: 0.875rem;     /* 14px — body-sm */
--chat-font-md: 0.9375rem;      /* 15px — body */
--chat-font-lg: 1rem;           /* 16px — body-lg */
--chat-font-xl: 1.125rem;       /* 18px — chat H2 (新增) */
--chat-font-h4: 1.375rem;       /* 22px — card title */
--chat-font-h3: 1.5rem;         /* 24px — chat H1 */
--chat-font-h2: 1.75rem;        /* 28px — section heading */
--chat-font-h1: 2.25rem;        /* 36px — page heading */

/* 行高体系 */
--chat-leading-tight: 1.25;
--chat-leading-snug: 1.33;
--chat-leading-normal: 1.5;
--chat-leading-relaxed: 1.625;
--chat-leading-loose: 1.75;
```

### 2.3 MarkdownRenderer.tsx 新增令牌

```css
/* 在 .chat-md-root 中定义 */
--md-font-h1: 1.5rem;       /* 24px */
--md-font-h2: 1.125rem;     /* 18px */
--md-font-h3: 1rem;         /* 16px */
--md-font-h4: 0.9375rem;    /* 15px */
--md-font-body: 0.9375rem;  /* 15px */
--md-font-sm: 0.875rem;     /* 14px */
--md-font-caption: 0.75rem; /* 12px */
--md-font-overline: 0.6875rem; /* 11px */
```

---

## 三、修复清单

### 3.1 chatTheme.css (AI 气泡内容样式)

| 行号 | 修复前 | 修复后 |
|------|--------|--------|
| L431 | `font-size: var(--chat-font-h3, 1rem)` = 16px | `var(--chat-font-h3, 1.5rem)` = **24px** |
| L432 | `font-size: var(--chat-font-h4, 0.9375rem)` = 15px | `var(--chat-font-xl, 1.125rem)` = **18px** |
| L433 | `font-size: var(--chat-font-base, 0.875rem)` = 14px | `var(--chat-font-lg, 1rem)` = **16px** |
| L434 | `font-size: 1em` = 14px | `var(--chat-font-md, 0.9375rem)` = **15px** |
| L435 | `margin: 5px 0;` 无字号 | `font-size: var(--chat-font-md)` + `margin: 6px 0` |
| L438 | `margin-bottom: 2px` | `margin-bottom: 3px` (对齐设计系统) |
| L439-443 | `font-size: var(--chat-font-sm)` + 硬编码颜色 | `font-size: var(--chat-font-sm)` + `var(--chat-error)` |

### 3.2 MarkdownRenderer.tsx (CSS-in-JS 注入样式)

| 元素 | 修复前 | 修复后 |
|------|--------|--------|
| h1 | `1.35em` (~18.9px) | `var(--md-font-h1, 1.5rem)` = 24px |
| h2 | `1.18em` (~16.5px) | `var(--md-font-h2, 1.125rem)` = 18px |
| h3 | `1.06em` (~14.8px) | `var(--md-font-h3, 1rem)` = 16px |
| h4 | `1em` (14px) | `var(--md-font-h4, 0.9375rem)` = 15px |
| p | `0.875rem` (14px), `1.7` lh | `var(--md-font-body, 0.9375rem)`, `var(--md-leading-relaxed, 1.625)` |
| ul/ol/li | `0.87rem` (14px) | `var(--md-font-body, 0.9375rem)` |
| table | `0.82rem` (13px) | `var(--md-font-sm, 0.875rem)` |
| th | `0.84em` + 硬编码颜色 | `var(--md-font-sm)` + `var(--md-text-primary)` |
| td | 硬编码颜色 | `var(--md-text-secondary)` |
| code (inline) | `0.82em` + `#BE185D` | `var(--md-font-caption)` + `var(--md-error)` |
| kbd | `0.78em` + 硬编码 | `var(--md-font-overline)` + 主题色 |
| blockquote | `0.87rem` | `var(--md-font-body)` |
| callout | `0.85rem`/`0.88rem` | `var(--md-font-sm)`/`var(--md-font-body)` |
| 所有颜色 | 21处硬编码 hex | 映射到 `--md-*` 主题变量 |

---

## 四、验证结果

```
✅ TypeScript: 0 errors
✅ CSS hardcoded px font-sizes: 0 (全部使用 rem/CSS 变量)
✅ CSS non-standard line-heights: 0 (全部使用 CSS 变量)
✅ .dark .chat-unified blocks: 1 (唯一权威块)
✅ Tailwind concat issues: 0
```

---

## 五、视觉层级对比

### 修复前
```
H1:  18.9px  ← 与 H2 差距过小
H2:  16.5px
H3:  14.8px  ← 几乎与正文无异
H4:  14px    ← 与正文完全一样
p:   14px
```

### 修复后
```
H1:  24px    ← 清晰区分，对应页面 H3 层级
H2:  18px    ← 中间层级，明显大于正文
H3:  16px    ← Body-lg 层级
H4:  15px    ← Body 层级
p:   15px    ← 标准正文，行高 1.625
```

---

## 六、文件变更

| 文件 | 变更类型 |
|------|---------|
| `features/styles/chatTheme.css` | +10 CSS 变量, 重写 AI 气泡排版规则 |
| `features/components/pro/MarkdownRenderer.tsx` | +8 CSS 变量, 重写全部 MDStyles, 颜色主题化 |
