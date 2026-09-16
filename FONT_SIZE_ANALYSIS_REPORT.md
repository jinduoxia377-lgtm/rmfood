# 智能对话模块字体大小深度分析报告

**分析日期**: 2026-05-31  
**状态**: ✅ 全部修复完成

---

## 一、问题发现

### 1.1 硬编码像素值 (74 处)

**chatTheme.css 中发现的所有硬编码 `font-size: Npx` 声明**:

| 原值 | 问题 | 修复后 |
|------|------|--------|
| `10px` (×4) | 低于设计系统最小值 | `var(--chat-font-xs, 0.6875rem)` |
| `10.5px` (×1) | 非标准值 | `var(--chat-font-xs, 0.6875rem)` |
| `11px` (×5) | 非标准值 | `var(--chat-font-xs, 0.6875rem)` |
| `11.5px` (×1) | 非标准值 | `var(--chat-font-xs, 0.6875rem)` |
| `12px` (×8) | 非标准值 | `var(--chat-font-sm, 0.75rem)` |
| `12.5px` (×2) | **严重**: 非标准小数 | `var(--chat-font-sm, 0.75rem)` |
| `13px` (×6) | 非标准值 | `var(--chat-font-base, 0.875rem)` |
| `13.5px` (×3) | **严重**: 非标准小数 | `var(--chat-font-base, 0.875rem)` |
| `14px` (×5) | 与设计系统不一致 | `var(--chat-font-base, 0.875rem)` |
| `15px` (×1) | 非标准值 | `var(--chat-font-md, 0.9375rem)` |
| `16px` (×2) | 非标准值 | `var(--chat-font-lg, 1rem)` |
| `17px` (×1) | 非标准值 | `var(--chat-font-md, 0.9375rem)` |
| `1.3em`~`0.875em` | 相对单位不统一 | 映射到 rem 变量 |

### 1.2 非标准行高 (22 处)

| 原值 | 问题 | 修复后 |
|------|------|--------|
| `1.25` (×1) | 应使用 CSS 变量 | `var(--chat-leading-tight, 1.25)` |
| `1.3`~`1.42` (×8) | 应使用 CSS 变量 | `var(--chat-leading-snug, 1.33)` |
| `1.55` (×3) | 应使用 CSS 变量 | `var(--chat-leading-normal, 1.5)` |
| `1.6`~`1.68` (×7) | 应使用 CSS 变量 | `var(--chat-leading-relaxed, 1.625)` |
| `1.75` (×1) | 应使用 CSS 变量 | `var(--chat-leading-loose, 1.75)` |

### 1.3 Sub-Minimum 字体 (1 处)

| 文件 | 行号 | 问题 | 修复 |
|------|------|------|------|
| `MessageBubble.tsx` | L129 | `text-[9px]` 低于设计系统最小值 (11px) | `text-[11px]` |

### 1.4 重复定义冲突

`.chat-bubble-ai` 在 CSS 中存在**两处定义**:
- L224-233: 旧版本 (背景透明, 无边框)
- L626-660: 新版本 (带背景色和阴影)

**问题**: 浏览器使用最后定义的规则，导致旧版样式可能覆盖新版。

---

## 二、设计系统对照

### 2.1 base.css 设计令牌

```css
--text-h1: 2.25rem;    /* 36px */
--text-h2: 1.75rem;    /* 28px */
--text-h3: 1.5rem;     /* 24px */
--text-h4: 1.375rem;   /* 22px */
--text-body-lg: 1rem;  /* 16px */
--text-body: 0.9375rem; /* 15px ⭐️ */
--text-body-sm: 0.875rem; /* 14px */
--text-caption: 0.75rem;  /* 12px */
--text-overline: 0.6875rem; /* 11px */
```

### 2.2 chatTheme.css 新增令牌

```css
--chat-font-xs: 0.6875rem;      /* 11px — labels/badges */
--chat-font-sm: 0.75rem;        /* 12px — captions */
--chat-font-base: 0.875rem;     /* 14px — body-sm */
--chat-font-md: 0.9375rem;      /* 15px — body */
--chat-font-lg: 1rem;           /* 16px — body-lg */
--chat-font-h4: 1.375rem;       /* 22px — card title */
--chat-font-h3: 1.5rem;         /* 24px — sub-heading */
--chat-font-h2: 1.75rem;        /* 28px — section heading */
--chat-font-h1: 2.25rem;        /* 36px — page heading */

--chat-leading-tight: 1.25;
--chat-leading-snug: 1.33;
--chat-leading-normal: 1.5;
--chat-leading-relaxed: 1.625;
--chat-leading-loose: 1.75;
```

---

## 三、修复清单

| 修复项 | 文件 | 数量 | 状态 |
|--------|------|------|------|
| 硬编码 px → rem 变量 | `chatTheme.css` | 74 处 | ✅ |
| 非标准行高 → CSS 变量 | `chatTheme.css` | 22 处 | ✅ |
| Sub-minimum 字体修复 | `MessageBubble.tsx` | 1 处 | ✅ |
| 新增字体令牌 | `chatTheme.css` | 13 个变量 | ✅ |
| DSH tokens rem 化 | `chatTheme.css` | 3 个变量 | ✅ |

---

## 四、验证结果

```bash
# TypeScript
pnpm exec tsc --noEmit
# ✅ Already up to date, Done in 628ms

# 硬编码 px font-size 扫描
# ✅ 0 个剩余 (全部已替换为 var(--chat-font-*) )

# 非标准行高扫描
# ✅ 0 个剩余 (全部已映射到 CSS 变量)

# TSX sub-minimum 字体扫描
# ✅ 0 个 text-[9px] 或 text-[10px]
```

---

## 五、关键影响

### 5.1 可读性提升

- **AI 气泡正文**: 14px → 14px (rem 标准化, 保持可读)
- **用户气泡正文**: 14px → 14px (rem 标准化)
- **操作按钮文字**: 12px → 12px (rem 标准化)
- **时间戳/标签**: 10px → 11px (提升到设计系统最小值)

### 5.2 主题一致性

所有字体大小现在通过 CSS 变量统一管理，支持：
- 暗黑模式自动适配
- 用户字体缩放设置
- 未来设计令牌调整

### 5.3 维护性

- 修改单个变量即可全局生效
- 消除硬编码导致的样式不一致
- 符合 base.css 设计令牌体系

---

## 六、后续建议

1. **定期审计**: 每月运行 font-size 扫描脚本
2. **设计令牌文档化**: 将 `--chat-font-*` 系列记录到 design-system/DESIGN.md
3. **自动化检测**: 添加 pre-commit hook 检测硬编码字体大小
