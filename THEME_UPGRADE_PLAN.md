# RMFOOD 主题系统专业级别改造升级方案

**文档版本**: v2.0  
**制定日期**: 2026-07-09  
**依据规范**: DESIGN.md Apple Design Analysis

---

## 📊 现状分析

### 一、当前主题系统架构

```
frontend/src/
├── stores/
│   ├── themeStore.ts          # Zustand 状态管理 (608行)
│   ├── theme.presets.ts       # 预设主题配置 (958行)
│   ├── ThemeProvider.tsx      # React Context Provider (369行)
│   └── theme.storage.ts       # 持久化存储
├── styles/
│   ├── tokens/
│   │   ├── base.css           # 浅色主题变量 (453行)
│   │   └── dark.css           # 深色主题变量 (364行)
│   ├── index.css              # 入口文件 (291行)
│   └── components/
│       └── semantic-utils.css # 语义化工具类
└── components/
    └── theme/
        └── ThemeSwitcher.tsx  # 主题切换器组件 (292行)
```

### 二、与 DESIGN.md 的核心差距

| 维度 | DESIGN.md 规范 | 当前实现 | 差距等级 |
|------|---------------|---------|---------|
| **品牌色** | Action Blue (#0066cc) 单一品牌色 | Emerald (#10b981) + Ocean Blue + Bio Purple 三色并存 | 🔴 严重 |
| **字体栈** | SF Pro Display/Text + system-ui | Inter + Noto Sans SC + system-ui | 🟡 次要 |
| **正文字号** | 17px | 15px (0.9375rem) | 🔴 严重 |
| **字重体系** | 300/400/600/700 (无500) | 300/400/500/600/700 | 🟡 次要 |
| **圆角系统** | xs=5px, sm=8px, md=11px, lg=18px | xs=4px, sm=6px, md=8px, lg=12px | 🔴 严重 |
| **间距系统** | xxs=4px, xs=8px, sm=12px, **md=17px**, lg=24px | 4pt 基础单位 0-24rem | 🔴 严重 |
| **阴影系统** | 扁平化，仅产品图阴影 | 9级阴影层级 | 🔴 严重 |
| **Glassmorphism** | acrylic/frosted glass | ❌ 缺失 | 🔴 严重 |
| **Hairline** | 0.5px 发丝线边框 | ❌ 缺失 | 🟡 次要 |
| **负字间距** | display sizes 使用 -0.28px | ❌ 缺失 | 🟡 次要 |

---

## 🎯 升级目标

### 核心原则
1. **单一品牌色** - 完全对齐 DESIGN.md 的 Action Blue (#0066cc)
2. **Apple 设计语言** - 字体、间距、圆角全面对标 Apple 设计规范
3. **扁平化设计** - 移除冗余阴影，使用表面色差实现层级
4. **完整特性** - 补充 Glassmorphism、Hairline、Negative Tracking 等缺失特性

### 预期效果
- 主题切换体验流畅，响应式完美
- 视觉风格与 Apple 设计语言高度一致
- 无障碍 WCAG 2.1 AA/AAA 标准全面达标
- TypeScript 类型安全，零运行时错误

---

## 📋 实施计划（分阶段）

### 阶段一：颜色系统重构（预计 2小时）

#### 1.1 更新品牌色

**文件**: `theme.presets.ts`

```typescript
// 修改前（错误）
const lightColors: SemanticColors = {
  primary: { main: '#10b981', ... },  // Emerald - 错误
  secondary: { main: '#007AFF', ... }, // Ocean Blue - 多余
  tertiary: { main: '#8b5cf6', ... },  // Bio Purple - 多余
  ...
};

// 修改后（正确）
const lightColors: SemanticColors = {
  primary: {
    main: '#0066cc',     // Action Blue - DESIGN.md 规范
    light: '#4da6ff',    // Light variant
    dark: '#0052a3',     // Dark variant
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#0066cc',     // 与 primary 统一
    light: '#4da6ff',
    dark: '#0052a3',
    contrastText: '#ffffff',
  },
  // 移除 tertiary
  ...
};
```

#### 1.2 更新暗色模式品牌色

```typescript
const darkColors: SemanticColors = {
  primary: {
    main: '#2997ff',     // Action Blue on dark (DESIGN.md)
    light: '#4da6ff',
    dark: '#0066cc',
    contrastText: '#000000',
  },
  ...
};
```

#### 1.3 更新 CSS 变量文件

**文件**: `base.css` 和 `dark.css`

```css
/* base.css */
:root {
  /* Brand Primary: Action Blue (#0066cc) */
  --color-primary-50: #e8f4fd;
  --color-primary-100: #cce7fa;
  --color-primary-200: #99cfe8;
  --color-primary-300: #66b7d6;
  --color-primary-400: #339fc4;
  --color-primary-500: #0066cc; /* Action Blue */
  --color-primary-600: #0052a3;
  --color-primary-700: #003d7a;
  --color-primary-800: #002951;
  --color-primary-900: #001428;
  --color-primary-950: #000a14;

  --color-primary: #0066cc;
  --color-primary-hover: #0052a3;
}

/* dark.css */
.dark {
  --color-primary-50: #001428;
  --color-primary-100: #002951;
  --color-primary-200: #003d7a;
  --color-primary-300: #0052a3;
  --color-primary-400: #339fc4;
  --color-primary-500: #2997ff; /* Action Blue on dark */
  --color-primary-600: #4da6ff;
  --color-primary-700: #66b7d6;
  --color-primary-800: #99cfe8;
  --color-primary-900: #cce7fa;
  --color-primary-950: #e8f4fd;

  --color-primary: #2997ff;
  --color-primary-hover: #4da6ff;
}
```

---

### 阶段二：Typography 系统重构（预计 1.5小时）

#### 2.1 更新字体栈

**文件**: `theme.presets.ts`

```typescript
const typography: Typography = {
  fontFamily: {
    // DESIGN.md 规范: SF Pro Display/Text + system-ui fallback
    heading: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  },
  fontSize: {
    // Apple 风格字号体系
    xs: '0.75rem',    // 12px - fine print
    sm: '0.875rem',   // 14px - captions
    base: '1.0625rem', // 17px - BODY (DESIGN.md 规范)
    lg: '1.125rem',   // 18px - lead
    xl: '1.5rem',     // 24px - tagline
    '2xl': '2rem',    // 32px - display-md
    '3xl': '2.5rem',  // 40px - display-lg
    '4xl': '3.5rem',  // 56px - hero-display
  },
  lineHeight: {
    tight: '1.07',   // Hero display
    normal: '1.47',  // Body text
    relaxed: '1.5',  // Lead
  },
  fontWeight: {
    // DESIGN.md: 300/400/600/700 (移除 500)
    light: 300,
    regular: 400,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    // Apple 风格负字间距
    tight: '-0.02em',      // Display sizes
    normal: '0em',
    wide: '0.05em',
  },
};
```

#### 2.2 更新 CSS 排版变量

**文件**: `base.css`

```css
:root {
  /* ═══ Font Family — DESIGN.md v1.0 ═══ */
  --font-sans: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  --font-serif: 'SF Pro Display', Georgia, 'Times New Roman', serif;

  /* ═══ Typography Scale — DESIGN.md v1.0 ═══ */
  --text-h1: 3.5rem;    /* 56px — hero display */
  --text-h2: 2.5rem;    /* 40px — display-lg */
  --text-h3: 2rem;      /* 32px — display-md */
  --text-h4: 1.5rem;    /* 24px — tagline */
  --text-body-lg: 1.125rem; /* 18px — lead */
  --text-body: 1.0625rem;   /* 17px — body (DESIGN.md) */
  --text-body-sm: 0.875rem; /* 14px — caption */
  --text-caption: 0.75rem;  /* 12px — fine print */
}
```

---

### 阶段三：间距与圆角系统重构（预计 1小时）

#### 3.1 更新间距系统

**文件**: `theme.presets.ts`

```typescript
const spacing: Spacing = {
  unit: 4,
  // Apple 风格间距系统（DESIGN.md 规范）
  xxs: '0.25rem',    // 4px
  xs: '0.5rem',      // 8px
  sm: '0.75rem',     // 12px
  md: '1.0625rem',   // 17px (关键!)
  lg: '1.5rem',      // 24px
  xl: '2rem',        // 32px
  xxl: '3rem',       // 48px
  section: '5rem',   // 80px
};
```

#### 3.2 更新圆角系统

**文件**: `theme.presets.ts`

```typescript
const borderRadius: BorderRadius = {
  // Apple 风格圆角系统（DESIGN.md 规范）
  none: '0',
  xs: '0.3125rem',   // 5px
  sm: '0.5rem',      // 8px
  md: '0.6875rem',   // 11px
  lg: '1.125rem',    // 18px
  pill: '9999px',    // 药丸形
};
```

---

### 阶段四：阴影系统扁平化（预计 0.5小时）

#### 4.1 简化阴影系统

**文件**: `theme.presets.ts`

```typescript
const shadows: Shadows = {
  // DESIGN.md: 扁平化设计，仅保留产品阴影
  flat: {
    // 移除所有 UI 阴影
    // 仅保留产品图阴影（如果需要）
  },
  // 产品阴影（如需使用）
  product: '0 3px 30px rgba(0, 0, 0, 0.22)',
};
```

#### 4.2 更新 CSS 变量

**文件**: `base.css` 和 `dark.css`

```css
/* 移除所有 UI 阴影变量，仅保留必要的 */
:root {
  --shadow-none: none;
  --shadow-product: 0 3px 30px rgba(0, 0, 0, 0.22);
}
```

---

### 阶段五：新增设计特性（预计 2小时）

#### 5.1 Glassmorphism/Acrylic 系统

**文件**: `base.css` 新增

```css
:root {
  /* ═══ Glassmorphism (Acrylic) — DESIGN.md ═══ */
  --material-acrylic: rgba(255, 255, 255, 0.72);
  --material-acrylic-blur: 20px;
  --material-acrylic-border: rgba(255, 255, 255, 0.2);
  --material-vibrancy: rgba(255, 255, 255, 0.5);

  --glass-bg: rgba(255, 255, 255, 0.75);
  --glass-border: rgba(255, 255, 255, 0.3);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}
```

**文件**: `dark.css` 新增

```css
.dark {
  --material-acrylic: rgba(30, 30, 30, 0.72);
  --material-acrylic-blur: 20px;
  --material-acrylic-border: rgba(255, 255, 255, 0.08);
  --material-vibrancy: rgba(40, 40, 40, 0.5);

  --glass-bg: rgba(30, 30, 30, 0.65);
  --glass-border: rgba(255, 255, 255, 0.05);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

#### 5.2 Hairline 边框系统

**文件**: `base.css` 新增

```css
:root {
  /* ═══ Hairline Borders — DESIGN.md ═══ */
  --hairline: 0.5px;
  --hairline-light: rgba(0, 0, 0, 0.08);
  --hairline-dark: rgba(255, 255, 255, 0.08);
}
```

#### 5.3 产品卡片布局样式

**文件**: `semantic-utils.css` 新增

```css
/* 产品卡片交替明暗布局 */
.product-tile {
  background: var(--bg-canvas);
  border-bottom: 1px solid var(--hairline-light);
}

.product-tile--dark {
  background: var(--surface-tile-dark);
  border-bottom: none;
}
```

---

### 阶段六：无障碍增强（预计 1小时）

#### 6.1 高对比度模式优化

**文件**: `environment.css` 优化

```css
[data-a11y-mode="high-contrast"] {
  --color-primary: #0052a3;
  --text-primary: #000000;
  --bg-primary: #ffffff;
  --border-default: #000000;
  
  /* 强制高对比度 */
  * {
    border-color: currentColor !important;
  }
}

[data-a11y-mode="high-contrast"].dark {
  --text-primary: #ffffff;
  --bg-primary: #000000;
  --border-default: #ffffff;
}
```

#### 6.2 减少动画模式

**文件**: `index.css` 优化

```css
/* 减少动画模式下的主题过渡 */
:root.reduce-motion *,
:root.reduce-motion *::before,
:root.reduce-motion *::after {
  transition-duration: 0.01ms !important;
  animation-duration: 0.01ms !important;
}
```

---

### 阶段七：代码质量与性能优化（预计 1.5小时）

#### 7.1 优化 generateCSSVariables()

**文件**: `theme.presets.ts`

- 使用更高效的变量生成算法
- 添加变量值缓存机制
- 减少重复计算

#### 7.2 优化 applyThemeToDOM()

**文件**: `theme.presets.ts`

- 使用 requestAnimationFrame 批量更新
- 添加主题切换防抖机制
- 优化 DOM 操作性能

#### 7.3 添加类型安全检查

**文件**: `themeStore.ts`

- 完善 TypeScript 类型定义
- 添加运行时类型验证
- 消除潜在的类型错误

---

## 📈 实施时间表

| 阶段 | 内容 | 预计时间 | 优先级 |
|------|------|---------|--------|
| 阶段一 | 颜色系统重构 | 2小时 | P0 - 最高 |
| 阶段二 | Typography 重构 | 1.5小时 | P0 - 最高 |
| 阶段三 | 间距与圆角重构 | 1小时 | P1 - 高 |
| 阶段四 | 阴影扁平化 | 0.5小时 | P1 - 高 |
| 阶段五 | 新增设计特性 | 2小时 | P2 - 中 |
| 阶段六 | 无障碍增强 | 1小时 | P2 - 中 |
| 阶段七 | 代码优化 | 1.5小时 | P3 - 低 |
| **总计** | | **10小时** | |

---

## ✅ 验收标准

### 功能性验收
- [ ] 主题切换流畅，无闪烁
- [ ] 深色/浅色/系统模式正常工作
- [ ] 无障碍模式（高对比度、减少动画）正常
- [ ] localStorage 持久化正确

### 视觉验收
- [ ] 品牌色为 Action Blue (#0066cc)
- [ ] 正文字号为 17px
- [ ] 字体栈为 SF Pro + system-ui
- [ ] 圆角符合 Apple 规范（5/8/11/18px）
- [ ] 间距符合 Apple 规范（含 md=17px）
- [ ] UI 扁平化，无多余阴影
- [ ] Glassmorphism 效果正常
- [ ] Hairline 边框正常

### 无障碍验收
- [ ] WCAG 2.1 AA 对比度达标
- [ ] 键盘导航正常
- [ ] 屏幕阅读器友好
- [ ] 减少动画模式生效

### 性能验收
- [ ] 主题切换延迟 < 100ms
- [ ] 内存占用无泄漏
- [ ] HMR 热更新正常

---

## 🚨 风险与注意事项

### 风险 1: CSS 变量名变更
- **影响**: 所有使用旧变量名的组件需要更新
- **缓解**: 保留别名映射，逐步迁移

### 风险 2: 第三方组件兼容性
- **影响**: shadcn/ui、Radix UI 等可能依赖特定变量
- **缓解**: 在 index.css 中保留 shadcn 别名映射

### 风险 3: 浏览器兼容
- **影响**: backdrop-filter 在 Safari 15.4 以下不支持
- **缓解**: 提供降级方案（纯色背景）

---

## 📝 文件变更清单

| 文件 | 变更类型 | 预计行数变化 |
|------|---------|-------------|
| `theme.presets.ts` | 重构 | +50 / -30 |
| `base.css` | 更新 | +80 / -20 |
| `dark.css` | 更新 | +60 / -15 |
| `index.css` | 更新 | +40 / -10 |
| `semantic-utils.css` | 新增 | +100 |
| `environment.css` | 优化 | +30 / -10 |
| **总计** | | **+360 / -85** |

---

## 🎉 预期成果

完成本次升级后，RMFOOD 主题系统将：

1. **完全符合 DESIGN.md Apple 设计规范**
2. **提供企业级的主题管理能力**
3. **支持完整的无障碍访问**
4. **具备出色的性能和用户体验**
5. **为未来扩展预留良好架构**

---

**报告人**: Agnes-2.5-Flash  
**审核状态**: 待用户确认
