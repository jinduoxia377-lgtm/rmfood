# RMFOOD 登录页面设计规范 (Login Page Design Specification)

**版本**: v2.0.0  
**设计院长**: UI/UX Pro Max 设计智能框架  
**更新日期**: 2026-06-04  
**适用技术栈**: React 19 + TypeScript 6 + TailwindCSS 4 + CSS Custom Properties

---

## 1. 设计理念 (Design Philosophy)

### 品牌定位
RMFOOD 是面向**药食同源功能性食品**的专业配方研发平台。设计需要在**科学严谨**与**自然有机**之间取得平衡。

### 设计关键词
- **科学感**: 精密、可信、数据驱动
- **自然感**: 有机、温暖、生命力
- **专业感**: 简洁、高效、克制

### 情感目标
用户打开登录页时，应感受到：
1. **信任** — 这是一个专业严肃的平台
2. **温暖** — 品牌有温度，不是冷冰冰的工具
3. **高效** — 登录流程快速无阻碍

---

## 2. 色彩系统 (Color System)

### 主色调 — 翡翠绿 (Emerald Green)
代表自然、安全、生命，呼应"药食同源"理念。

| 令牌 | 色值 | 用途 |
|------|------|------|
| `--color-brand-50` | `#ecfdf5` | 最浅背景 |
| `--color-brand-100` | `#d1fae5` | 浅色背景 |
| `--color-brand-200` | `#a7f3d0` | 悬浮背景 |
| `--color-brand-300` | `#6ee7b7` | 边框 |
| `--color-brand-400` | `#34d399` | 装饰元素 |
| `--color-brand-500` | `#10b981` | 主色（亮） |
| `--color-brand-600` | `#059669` | **主色（标准）** |
| `--color-brand-700` | `#047857` | 深色/hover |
| `--color-brand-800` | `#065f46` | 更深色 |
| `--color-brand-900` | `#064e3b` | 最深色/文字 |

### 辅助色 — 科学蓝 (Science Blue)

| 令牌 | 色值 | 用途 |
|------|------|------|
| `--color-accent-500` | `#3b82f6` | 链接、次要CTA |
| `--color-accent-600` | `#2563eb` | 链接hover |

### 功能色

| 令牌 | 色值 | 用途 |
|------|------|------|
| `--color-error` | `#ef4444` | 错误状态 |
| `--color-success` | `#22c55e` | 成功状态 |
| `--color-warning` | `#f59e0b` | 警告状态 |

### 中性色

| 令牌 | Light | Dark | 用途 |
|------|-------|------|------|
| `--color-surface` | `#ffffff` | `#0f172a` | 卡片背景 |
| `--color-bg` | `#f8fafc` | `#020617` | 页面背景 |
| `--color-text-primary` | `#0f172a` | `#f1f5f9` | 主文字 |
| `--color-text-secondary` | `#475569` | `#94a3b8` | 次要文字 |
| `--color-border` | `#e2e8f0` | `#1e293b` | 边框 |

---

## 3. 字体系统 (Typography)

### 字体栈

```css
--font-sans: 'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### 字号层级

| 令牌 | 大小 | 行高 | 字重 | 用途 |
|------|------|------|------|------|
| `--text-xs` | 12px | 1.5 | 400 | 辅助信息、版权 |
| `--text-sm` | 14px | 1.5 | 400 | 表单标签、提示 |
| `--text-base` | 16px | 1.6 | 400 | 正文、输入框 |
| `--text-lg` | 18px | 1.5 | 500 | 大正文 |
| `--text-xl` | 20px | 1.4 | 600 | 小标题 |
| `--text-2xl` | 24px | 1.3 | 700 | 页面标题 |
| `--text-3xl` | 30px | 1.2 | 700 | Hero 标题 |
| `--text-4xl` | 36px | 1.1 | 800 | 品牌大标题 |

---

## 4. 间距系统 (Spacing)

基于 4px 基准的 4dp 递增系统：

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--space-1` | 4px | 最小间距 |
| `--space-2` | 8px | 紧密间距 |
| `--space-3` | 12px | 标准内边距 |
| `--space-4` | 16px | 组件内边距 |
| `--space-5` | 20px | 中等间距 |
| `--space-6` | 24px | 段落间距 |
| `--space-8` | 32px | 区块间距 |
| `--space-10` | 40px | 大区块间距 |
| `--space-12` | 48px | 页面级间距 |
| `--space-16` | 64px | 超大间距 |

---

## 5. 圆角与阴影 (Elevation & Radius)

### 圆角

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--radius-sm` | 6px | 小元素 |
| `--radius-md` | 10px | 按钮、输入框 |
| `--radius-lg` | 16px | 卡片 |
| `--radius-xl` | 24px | 大容器 |
| `--radius-full` | 9999px | 圆形元素 |

### 阴影

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 微妙深度 |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)` | 卡片 |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)` | 弹出层 |

---

## 6. 动画系统 (Animation)

### 时长

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--duration-fast` | 150ms | 微交互（hover, focus） |
| `--duration-normal` | 250ms | 标准过渡 |
| `--duration-slow` | 350ms | 入场动画 |

### 缓动函数

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Spring 效果 |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 入场 |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | 退场 |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 标准 |

---

## 7. 布局规范 (Layout)

### 桌面端 (≥1024px)
- 左侧品牌区: 55% 宽度，固定视口高度
- 右侧表单区: 45% 宽度，垂直居中
- 表单最大宽度: 440px

### 平板端 (768px–1023px)
- 顶部品牌栏: 180px 高度
- 下方表单区: 剩余空间

### 手机端 (<768px)
- 顶部精简品牌栏: auto 高度
- 下方全宽表单区
- 卡片无边距全宽模式

---

## 8. 组件规范 (Component Specs)

### 输入框 (Input)
- 高度: 48px (桌面) / 52px (移动端)
- 左边图标: 20px, 距左 16px
- 文字: 16px, 行高 1.5
- 状态: idle → hover → focus → filled → error → disabled
- Focus 环: 2px brand-500, offset 2px
- Error 环: 2px error, offset 2px

### 主按钮 (Primary Button)
- 高度: 48px
- 圆角: 10px
- 字体: 16px, 600 字重
- 颜色: bg-brand-600, text-white
- Hover: bg-brand-700, shadow-md
- Active: scale(0.98)
- Loading: opacity 0.7, spinner 20px
- Disabled: opacity 0.5, cursor not-allowed

### 社交按钮 (Social Button)
- 最小触控区域: 44×44px
- 图标: 24px
- 标签: 12px, center
- Hover: bg 变化 + scale(1.02)

---

## 9. 响应式断点 (Breakpoints)

| 断点 | 宽度 | 设计策略 |
|------|------|----------|
| `xs` | < 480px | 单列，全宽卡片，最大触控目标 |
| `sm` | 480px–639px | 单列，适度留白 |
| `md` | 640px–767px | 单列，标准卡片 |
| `lg` | 768px–1023px | 上下布局，品牌栏+表单 |
| `xl` | ≥ 1024px | 左右分栏，完整品牌区 |

---

## 10. 可访问性标准 (Accessibility)

- WCAG 2.1 Level AA 合规
- 所有文本对比度 ≥ 4.5:1 (AA) / ≥ 7:1 (AAA 大文本)
- 触控目标 ≥ 44×44px (WCAG 2.5.5)
- 键盘导航完整（Tab/Shift+Tab/Enter/Escape）
- 屏幕阅读器支持（语义化 HTML + ARIA）
- prefers-reduced-motion 支持
- prefers-contrast: high 支持
- 焦点指示器始终可见

---

## 11. 文件结构

```
frontend/src/pages/auth/
├── LoginPage.tsx              # 登录页组件
├── LoginPage.css              # 登录页样式（设计令牌 + 样式）
└── LoginPage.theme-bridge.css # 主题变量映射层

frontend/src/config/
└── app.config.ts              # BRAND_CONFIG + LOGIN_PAGE_CONFIG

frontend/src/docs/
└── LOGIN_DESIGN_SPEC.md       # 本设计规范文档
```

---

*本规范遵循 UI/UX Pro Max 设计智能框架，基于 Priority 1-10 检查清单逐项验证。*
