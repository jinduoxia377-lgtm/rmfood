# RMFOOD 主题系统开发规范 v2.0

> 基于 Apple Human Interface Guidelines (HIG) 设计体系  
> 版本: 2.0-alpha  
> 最后更新: 2026-09-14  
> 对齐标准: Apple HIG (iOS 18 / macOS Sonoma / visionOS)

---

## 目录

1. [设计哲学与原则](#1-设计哲学与原则)
2. [颜色系统](#2-颜色系统)
3. [字体系统](#3-字体系统)
4. [深色模式](#4-深色模式)
5. [材质与透明度](#5-材质与透明度)
6. [间距与布局](#6-间距与布局)
7. [圆角与阴影](#7-圆角与阴影)
8. [无障碍支持](#8-无障碍支持)
9. [响应式断点](#9-响应式断点)
10. [动画与过渡](#10-动画与过渡)
11. [主题切换机制](#11-主题切换机制)
12. [组件规范](#12-组件规范)
13. [实施检查清单](#13-实施检查清单)

---

## 1. 设计哲学与原则

### 1.1 核心理念

> **"UI chrome recedes so the content can speak."**

界面元素应退居幕后，让内容成为主角。遵循 Apple 的极简主义美学，强调：

- **清晰度 (Clarity)**: UI 元素清晰可见，不喧宾夺主
- **服从性 (Deference)**: 界面服从于内容，不干扰用户体验
- **深度 (Depth)**: 通过材质和阴影建立视觉层次

### 1.2 设计原则

```
┌─────────────────────────────────────────────────────────────┐
│  1. 内容优先                                                 │
│     - 产品图片/内容是视觉焦点                                │
│     - UI 元素提供结构但不抢镜                                │
├─────────────────────────────────────────────────────────────┤
│  2. 极简主义                                                 │
│     - 去除装饰性渐变和阴影                                   │
│     - 仅保留必要的视觉提示                                   │
├─────────────────────────────────────────────────────────────┤
│  3. 一致性                                                   │
│     - 全系统统一的设计语言                                   │
│     - 单一主题系统管理所有模块                               │
├─────────────────────────────────────────────────────────────┤
│  4. 可访问性                                                 │
│     - WCAG 2.1 AA/AAA 合规                                 │
│     - 支持系统级无障碍设置                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 颜色系统

### 2.1 System Colors（系统语义颜色）

Apple HIG 推荐使用语义化颜色，自动适配 Light/Dark/Increased Contrast。

```typescript
// SemanticColors 接口定义
interface SemanticColors {
  // 文字层级（labelColor 系列）
  label: {
    primary: string;        // 主要文字 - Light: #1d1d1f, Dark: #ffffff
    secondary: string;      // 次要文字 - Light: #3a3a3c, Dark: #8e8e93
    tertiary: string;       // 三级文字 - Light: #86868b, Dark: #636366
    quaternary: string;     // 四级文字 - Light: #aeaeb2, Dark: #48484a
  };
  
  // 分割线
  separator: string;        // 半透明分割线 - Light: rgba(0,0,0,0.1), Dark: rgba(255,255,255,0.1)
  opaqueSeparator: string;  // 不透明分割线 - Light: #c6c6c8, Dark: #38383a
  
  // 填充
  fill: string;             // 主要填充
  secondaryFill: string;    // 次要填充
  tertiaryFill: string;     // 三级填充
  
  // 高亮
  highlight: string;        // 高亮选中状态
  
  // 品牌色
  brand: {
    primary: string;        // 品牌主色 #047857 (Light) / #34d399 (Dark)
                            // ⚠️ 2026-10-17 修订：以桌面 Web 实际落地 L0 令牌为准（base.css
                            // --color-primary=#047857 / dark.css=#34d399），不再使用 Action Blue
    secondary: string;      // 品牌强调 #10b981 (Light) / #6ee7b7 (Dark)
    tertiary: string;       // 品牌浅色 #d1fae5 (Light) / #a7f3d0 (Dark)
  };
  
  // 功能色
  success: {
    main: string;
    background: string;
    text: string;
  };
  warning: {
    main: string;
    background: string;
    text: string;
  };
  error: {
    main: string;
    background: string;
    text: string;
  };
  info: {
    main: string;
    background: string;
    text: string;
  };
}
```

### 2.2 Increased Contrast 高对比度变体

```typescript
interface HighContrastColors {
  label: {
    primary: string;        // Dark: #ffffff (纯白)
    secondary: string;      // Dark: #ffffff (提高透明度)
  };
  separator: string;        // Dark: rgba(255,255,255,0.3)
  fill: string;             // Dark: #1c1c1e
}
```

### 2.3 颜色变量映射

```css
/* base.css - Light Mode */
:root {
  /* 文字 */
  --color-label-primary: #1d1d1f;
  --color-label-secondary: #3a3a3c;
  --color-label-tertiary: #86868b;
  --color-label-quaternary: #aeaeb2;
  
  /* 分割线 */
  --color-separator: rgba(0, 0, 0, 0.1);
  --color-opaque-separator: #c6c6c8;
  
  /* 背景 */
  --color-background-base: #ffffff;
  --color-background-elevated: #f5f5f7;
  --color-background-tertiary: #fafafc;
  
  /* 填充 */
  --color-fill-primary: #f2f2f7;
  --color-fill-secondary: #e5e5ea;
  --color-fill-tertiary: #d1d1d6;
  
  /* 品牌 */
  --color-brand-primary: #0066cc;
  --color-brand-secondary: #0071e3;
  --color-brand-tertiary: #2997ff;
  
  /* 功能色 */
  --color-success-main: #34C759;
  --color-warning-main: #FF9500;
  --color-error-main: #FF3B30;
  --color-info-main: #007AFF;
}

/* Dark Mode */
.dark {
  --color-label-primary: #ffffff;
  --color-label-secondary: #ebebf0;
  --color-label-tertiary: #98989d;
  --color-label-quaternary: #636366;
  
  --color-separator: rgba(255, 255, 255, 0.1);
  --color-opaque-separator: #38383a;
  
  --color-background-base: #000000;      /* 仅用于视频播放器等媒体场景 */
  --color-background-elevated: #1c1c1e;  /* Apple 标准深色 */
  --color-background-tertiary: #2c2c2e;
  
  --color-fill-primary: #2c2c2e;
  --color-fill-secondary: #3a3a3c;
  --color-fill-tertiary: #48484a;
  
  --color-brand-primary: #2997ff;
  --color-brand-secondary: #4d9fff;
  --color-brand-tertiary: #6bb3ff;
  
  --color-success-main: #30d158;
  --color-warning-main: #ffd60a;
  --color-error-main: #ff453a;
  --color-info-main: #5e5ce6;
}

/* Increased Contrast */
@media (prefers-contrast: more) {
  .dark {
    --color-label-primary: #ffffff;
    --color-label-secondary: #ffffff;
    --color-separator: rgba(255, 255, 255, 0.3);
    --color-background-elevated: #000000;
  }
}
```

---

## 3. 字体系统

### 3.1 字体栈定义

```typescript
interface FontStack {
  // Apple 设备专用（需授权）
  apple: string;
  
  // Web 跨平台替代
  web: string;
  
  // 回退方案
  fallback: string;
}

const fonts: FontStack = {
  apple: "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
  fallback: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};
```

### 3.2 字号规范（Apple HIG 标准）

| 类别 | iOS/iPadOS | macOS | 用途 |
|------|-----------|-------|------|
| Display | 56px+ | 48px+ | Hero 标题 |
| Title Large | 40px | 34px | 页面标题 |
| Title Medium | 34px | 28px | 区块标题 |
| Title Small | 28px | 22px | 卡片标题 |
| Subtitle | 21px | 17px | 副标题 |
| Body | **17px** | **13px** | 正文（默认） |
| Callout | 17px | 15px | 注释文字 |
| Caption | 14px | 12px | 说明文字 |
| Caption 2 | 12px | 11px | 次要说明 |

### 3.3 字重规范

```typescript
// Apple HIG 推荐字重
const fontWeight = {
  regular: 400,      // ✅ 推荐
  medium: 500,       // ✅ 推荐  
  semibold: 600,     // ✅ 推荐
  bold: 700,         // ✅ 推荐
  
  // ❌ 避免使用（尤其在小字号时）
  thin: 100,
  extralight: 200,
  light: 300,
};
```

### 3.4 排版刻度（14级）

```typescript
interface TypographyScale {
  'hero-display': {
    fontSize: '3.5rem';    // 56px
    fontWeight: 600;
    lineHeight: 1.07;
    letterSpacing: '-0.28px';
  };
  'title-large': {
    fontSize: '2.5rem';    // 40px
    fontWeight: 600;
    lineHeight: 1.1;
    letterSpacing: '0';
  };
  'title-medium': {
    fontSize: '2.125rem';  // 34px
    fontWeight: 600;
    lineHeight: 1.47;
    letterSpacing: '-0.374px';
  };
  'title-small': {
    fontSize: '1.75rem';   // 28px
    fontWeight: 400;
    lineHeight: 1.14;
    letterSpacing: '0.196px';
  };
  subtitle: {
    fontSize: '1.3125rem'; // 21px
    fontWeight: 600;
    lineHeight: 1.19;
    letterSpacing: '0.231px';
  };
  body: {
    fontSize: '1.0625rem'; // 17px - Apple 标准
    fontWeight: 400;
    lineHeight: 1.47;
    letterSpacing: '-0.374px';
  };
  body-strong: {
    fontSize: '1.0625rem'; // 17px
    fontWeight: 600;
    lineHeight: 1.24;
    letterSpacing: '-0.374px';
  };
  callout: {
    fontSize: '1.0625rem'; // 17px
    fontWeight: 400;
    lineHeight: 2.41;      // 紧凑行距
    letterSpacing: '0';
  };
  caption: {
    fontSize: '0.875rem';  // 14px
    fontWeight: 400;
    lineHeight: 1.43;
    letterSpacing: '-0.224px';
  };
  caption-strong: {
    fontSize: '0.875rem';  // 14px
    fontWeight: 600;
    lineHeight: 1.29;
    letterSpacing: '-0.224px';
  };
  button: {
    fontSize: '1.125rem';  // 18px
    fontWeight: 300;
    lineHeight: 1.0;
    letterSpacing: '0';
  };
  'fine-print': {
    fontSize: '0.75rem';   // 12px
    fontWeight: 400;
    lineHeight: 1.0;
    letterSpacing: '-0.12px';
  };
  'micro-legal': {
    fontSize: '0.625rem';  // 10px
    fontWeight: 400;
    lineHeight: 1.3;
    letterSpacing: '-0.08px';
  };
}
```

### 3.5 动态字体适配

```typescript
// Accessibility Category 映射
interface AccessibilityCategory {
  compact: { multiplier: 0.85; maxWidth: '320px' };
  small: { multiplier: 0.9; maxWidth: '360px' };
  large: { multiplier: 1.0; maxWidth: '414px' };      // 默认
  extraLarge: { multiplier: 1.15; maxWidth: '440px' };
  huge: { multiplier: 1.3; maxWidth: '480px' };
  access: { multiplier: 1.5; maxWidth: '520px' };
}

// 动态字体计算
function getDynamicFontSize(baseSize: number, category: string): number {
  const config = accessibilityCategories[category] || accessibilityCategories.large;
  return baseSize * config.multiplier;
}
```

---

## 4. 深色模式

### 4.1 核心原则

> **深色模式不是简单的颜色反转，而是使用感知对比度（Perceptual Contrast）**

```
┌─────────────────────────────────────────────────────────────┐
│  Apple HIG 深色模式规范                                      │
├─────────────────────────────────────────────────────────────┤
│  ✅ 背景色更暗，前景色更亮                                    │
│  ✅ 但不是纯黑 #000000（除非是视频播放器）                      │
│  ✅ 使用透明度而非纯黑来创建层次                               │
│  ✅ 测试: Dark + Increase Contrast                          │
│  ✅ 测试: Dark + Reduce Transparency                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 颜色规范

```css
/* Light Mode */
:root {
  --color-surface-base: #ffffff;
  --color-surface-elevated: #f5f5f7;
  --color-surface-tertiary: #fafafc;
}

/* Dark Mode - 使用感知对比度 */
.dark {
  /* 允许纯黑的场景：视频播放器、沉浸式媒体 */
  --color-surface-media: #000000;
  
  /* 标准深色背景 - 不是纯黑！ */
  --color-surface-base: #1c1c1e;      /* Apple 标准 */
  --color-surface-elevated: #2c2c2e;
  --color-surface-tertiary: #3a3a3c;
  
  /* 文字使用透明度而非纯白 */
  --color-text-primary: rgba(255, 255, 255, 0.9);
  --color-text-secondary: rgba(255, 255, 255, 0.6);
  --color-text-tertiary: rgba(255, 255, 255, 0.4);
}
```

### 4.3 深色模式测试清单

```markdown
## Dark Mode 测试清单

- [ ] 所有文字在深色背景下可读
- [ ] Dark + Increase Contrast 下对比度 ≥ 4.5:1
- [ ] Dark + Reduce Transparency 下材质正确
- [ ] Auto 模式下随系统切换正常
- [ ] 视频播放器可使用纯黑背景（允许例外）
```

---

## 5. 材质与透明度

### 5.1 Standard Materials

```typescript
interface Materials {
  // 透明度级别（Light Mode）
  ultraThin: string;    // rgba(255,255,255, 0.4)
  thin: string;         // rgba(255,255,255, 0.6)
  regular: string;      // rgba(255,255,255, 0.8)
  thick: string;        // rgba(255,255,255, 1.0)
  
  // 透明度级别（Dark Mode）
  ultraThinDark: string;   // rgba(255,255,255, 0.08)
  thinDark: string;        // rgba(255,255,255, 0.12)
  regularDark: string;     // rgba(255,255,255, 0.16)
  thickDark: string;       // rgba(255,255,255, 0.24)
}
```

### 5.2 Liquid Glass（iOS 26+）

```css
/* Liquid Glass - 仅用于导航和控制层 */
.liquid-glass-regular {
  backdrop-filter: saturate(180%) blur(20px);
  background: rgba(255, 255, 255, 0.4);
}

.liquid-glass-clear {
  backdrop-filter: saturate(150%) blur(40px);
  background: rgba(255, 255, 255, 0.2);
}

/* 禁止在内容层使用 Liquid Glass */
.content-card {
  backdrop-filter: none;  /* 使用 Standard Material */
  background: var(--material-thin);
}
```

### 5.3 材质使用规范

```
┌─────────────────────────────────────────────────────────────┐
│  材质使用规则                                                │
├─────────────────────────────────────────────────────────────┤
│  导航层（Tab Bar, Sidebar）:                                  │
│    → Liquid Glass regular/clear                             │
│                                                             │
│  功能控件（Button, Toggle）:                                 │
│    → 激活时使用 Liquid Glass                                 │
│    → 非激活时使用 Standard Material                          │
│                                                             │
│  内容层（Card, List）:                                       │
│    → 禁止使用 Liquid Glass                                   │
│    → 使用 Standard Material (thin/regular)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 间距与布局

### 6.1 8pt 网格系统

```typescript
interface Spacing {
  unit: number;           // 8px - 基础单位
  xxs: string;            // 4px - 特殊场景
  xs: string;             // 8px - 最小间距
  sm: string;             // 16px - 组件内边距
  md: string;             // 24px - 区块间距
  lg: string;             // 32px - 页面间距
  xl: string;             // 48px - 大区块
  xxl: string;            // 64px - 页面分割
  section: string;        // 80px - 产品瓦片垂直间距
}

const spacing: Spacing = {
  unit: 8,
  xxs: '0.25rem',   // 4px
  xs: '0.5rem',     // 8px
  sm: '1rem',       // 16px
  md: '1.5rem',     // 24px
  lg: '2rem',       // 32px
  xl: '3rem',       // 48px
  xxl: '4rem',      // 64px
  section: '5rem',  // 80px
};
```

### 6.2 触摸目标规范

```typescript
interface TouchTarget {
  minWidth: string;     // '44px' - Apple HIG 标准
  minHeight: string;    // '44px'
  minGap: string;       // '8px' - 相关控件间距
}

const touchTarget: TouchTarget = {
  minWidth: '44px',
  minHeight: '44px',
  minGap: '8px',
};
```

### 6.3 Safe Area 适配

```css
/* 安全区域适配 */
.safe-area-top {
  padding-top: env(safe-area-inset-top);
}
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
.safe-area-left {
  padding-left: env(safe-area-inset-left);
}
.safe-area-right {
  padding-right: env(safe-area-inset-right);
}
```

---

## 7. 圆角与阴影

### 7.1 圆角系统

```typescript
interface BorderRadius {
  none: string;        // 0px
  xs: string;          // 5px - 紧凑按钮
  sm: string;          // 8px - 标准按钮
  md: string;          // 11px - Pearl Button
  lg: string;          // 18px - Store Card
  pill: string;        // 9999px - 胶囊形按钮
  full: string;        // 9999px - 圆形头像
}

const borderRadius: BorderRadius = {
  none: '0px',
  xs: '5px',
  sm: '8px',
  md: '11px',
  lg: '18px',
  pill: '9999px',
  full: '9999px',
};
```

### 7.2 阴影系统（极简）

```typescript
interface Shadows {
  flat: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  product?: string;  // 仅产品图片使用
}

const shadows: Shadows = {
  flat: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.06)',
    md: '0 2px 8px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.1)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  product: '0 3px 30px rgba(0, 0, 0, 0.22)',  // 仅产品图片
};
```

---

## 8. 无障碍支持

### 8.1 Reduced Motion

```css
/* 尊重系统减少动态效果设置 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 8.2 高对比度模式

```css
/* 增加对比度设置 */
@media (prefers-contrast: more) {
  :root {
    --color-text-primary: #000000;
    --color-text-secondary: #1f2937;
    --color-background-base: #ffffff;
    --color-separator: #000000;
  }
  
  .dark {
    --color-text-primary: #ffffff;
    --color-text-secondary: #ffffff;
    --color-background-base: #000000;
    --color-separator: #ffffff;
  }
}
```

### 8.3 动态字体大小

```css
/* 响应系统文字大小设置 */
html {
  font-size: clamp(14px, calc(100vw * 0.015), 18px);
}

@media (prefers-reduced-motion: no-preference) {
  html {
    transition: font-size 0.3s ease;
  }
}
```

---

## 9. 响应式断点

### 9.1 8 个精细断点

```typescript
interface Breakpoints {
  smallPhone: string;      // 419px
  phone: string;           // 640px
  largePhone: string;      // 735px
  tabletPortrait: string;  // 736px
  tabletLandscape: string; // 834px
  smallDesktop: string;    // 1024px
  desktop: string;         // 1069px
  wideDesktop: string;     // 1441px
}

const breakpoints: Breakpoints = {
  smallPhone: '419px',
  phone: '640px',
  largePhone: '735px',
  tabletPortrait: '736px',
  tabletLandscape: '834px',
  smallDesktop: '1024px',
  desktop: '1069px',
  wideDesktop: '1441px',
};
```

### 9.2 断点使用规范

```css
/* 移动优先 */
.component {
  /* 手机默认样式 */
  padding: var(--space-xs);
}

@media (min-width: 640px) {
  .component {
    /* 平板样式 */
    padding: var(--space-md);
  }
}

@media (min-width: 1024px) {
  .component {
    /* 桌面样式 */
    padding: var(--space-lg);
  }
}
```

---

## 10. 动画与过渡

### 10.1 过渡时间规范

```typescript
interface TransitionDuration {
  instant: string;   // 0ms
  fast: string;      // 100ms
  normal: string;    // 200ms
  slow: string;      // 300ms
  slower: string;    // 400ms
  enter: string;     // 250ms
  exit: string;      // 150ms
}

const transitionDuration: TransitionDuration = {
  instant: '0ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  slower: '400ms',
  enter: '250ms',
  exit: '150ms',  // 退出更快 (进入的 60-70%)
};
```

### 10.2 缓动函数

```typescript
interface Easing {
  easeOut: string;      // cubic-bezier(0.16, 1, 0.3, 1)
  easeIn: string;       // cubic-bezier(0.7, 0, 0.84, 1)
  easeInOut: string;    // cubic-bezier(0.87, 0, 0.13, 1)
  spring: string;       // cubic-bezier(0.175, 0.885, 0.32, 1.275)
  bounce: string;       // cubic-bezier(0.68, -0.55, 0.265, 1.55)
}

const easing: Easing = {
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeIn: 'cubic-bezier(0.7, 0, 0.84, 1)',
  easeInOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};
```

---

## 11. 主题切换机制

### 11.1 主题状态定义

```typescript
interface ThemeState {
  // 主题模式
  mode: 'light' | 'dark' | 'system';
  
  // 当前激活的预设主题
  activeThemeId: PresetThemeId;
  
  // 当前主题配置
  activeTheme: ThemeConfig;
  
  // 辅助功能模式
  accessibilityMode: AccessibilityMode;
  
  // 运动偏好
  motionPreferences: MotionPreferences;
  
  // 过渡类型
  transitionType: TransitionType;
  
  // 是否正在过渡
  isTransitioning: boolean;
}
```

### 11.2 主题预设

```typescript
type PresetThemeId = 
  | 'light-default'   // 默认浅色
  | 'dark-default'    // 默认深色
  | 'apple-light'     // Apple 浅色
  | 'apple-dark'      // Apple 深色
  | 'high-contrast-light'   // 高对比度浅色
  | 'high-contrast-dark'    // 高对比度深色
  | 'reading-light'   // 阅读模式浅色
  | 'reading-dark';   // 阅读模式深色
```

### 11.3 主题应用流程

```typescript
async function applyTheme(theme: ThemeConfig): Promise<void> {
  // 1. 更新 CSS 变量
  generateCSSVariables(theme);
  
  // 2. 设置 data 属性
  document.documentElement.setAttribute('data-theme', theme.id);
  document.documentElement.setAttribute('data-mode', theme.mode);
  
  // 3. 切换 dark class
  if (theme.mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  // 4. 设置颜色方案
  document.documentElement.style.colorScheme = theme.mode;
}
```

---

## 12. 组件规范

### 12.1 按钮组件

```css
/* 主按钮 */
.btn-primary {
  background: var(--color-brand-primary);
  color: var(--color-label-primary-contrast);
  border-radius: var(--radius-pill);  /* 胶囊形 */
  min-height: var(--touch-target-min);  /* 44px */
  padding: var(--space-sm) var(--space-lg);
  transition: all var(--duration-normal) var(--easing-ease-out);
}

.btn-primary:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.btn-primary:active {
  transform: scale(0.98);
}
```

### 12.2 卡片组件

```css
.card {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-lg);  /* 18px */
  padding: var(--space-lg);
  transition: box-shadow var(--duration-normal) var(--easing-ease-out);
}

.card:hover {
  box-shadow: var(--shadow-md);
}
```

### 12.3 输入框组件

```css
.input {
  background: var(--color-fill-primary);
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-md);  /* 11px */
  min-height: var(--touch-target-min);  /* 44px */
  padding: var(--space-sm) var(--space-md);
}

.input:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.2);
}
```

---

## 13. 实施检查清单

### 13.1 颜色系统检查

- [ ] 已定义 Semantic Colors（label, separator, fill）
- [ ] 已定义 Light/Dark 两套颜色
- [ ] 已定义 Increased Contrast 变体
- [ ] 已验证所有颜色对比度达标（WCAG AA/AAA）
- [ ] 已测试 Auto 模式切换

### 13.2 字体系统检查

- [ ] 已配置 Inter 作为 Web 替代字体
- [ ] 已移除 Light (300) 字重使用
- [ ] 已实现动态字体大小适配
- [ ] 已添加 Accessibility Category 映射
- [ ] 已测试系统字体大小设置响应

### 13.3 深色模式检查

- [ ] 已移除纯黑 #000000 作为背景（媒体除外）
- [ ] 已使用感知对比度算法
- [ ] 已测试 Dark + Increase Contrast
- [ ] 已测试 Dark + Reduce Transparency
- [ ] 已验证文字可读性

### 13.4 无障碍检查

- [ ] 已实现 Reduced Motion 支持
- [ ] 已实现高对比度模式支持
- [ ] 已实现动态字体适配
- [ ] 已测试键盘导航
- [ ] 已测试屏幕阅读器

### 13.5 性能检查

- [ ] CSS 变量数量合理（<200）
- [ ] 主题切换无闪烁
- [ ] HMR 正常工作
- [ ] 构建产物大小正常

---

## 附录 A：Apple HIG 参考资源

### 官方文档

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

### WWDC 视频

- [Essential design principles](https://developer.apple.com/videos/play/wwdc2017/802/)
- [Design foundations from idea to interface](https://developer.apple.com/videos/play/wwdc2025/359/)
- [Build adaptive and accessible experiences](https://developer.apple.com/videos/play/wwdc2024/234/)

---

## 附录 B：变更日志

### v2.0 (2026-09-14)

- 新增 Semantic Colors 体系
- 新增 Increased Contrast 变体
- 新增 Material 材质层级定义
- 新增 Liquid Glass 规范
- 新增无障碍支持完整规范
- 新增动态字体适配机制
- 修复深色模式纯黑问题
- 新增组件规范章节
- 新增实施检查清单

### v1.0 (2026-09-13)

- 初始版本
- 基于 Apple 设计分析
- 定义基础颜色、字体、间距系统

---

**文档维护**: RMFOOD Design System Team  
**审核周期**: 每个季度审查一次，跟进 Apple HIG 更新  
**联系方式**: design-team@rmfood.com
