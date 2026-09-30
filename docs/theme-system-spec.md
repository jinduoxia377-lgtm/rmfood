# RMFOOD 小程序主题系统规范文档

> 符合微信官方规范: [DarkMode 适配指南](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/darkmode.html)
> 生成时间: 2026-09-21

---

## 一、设计规范概述

### 1.1 设计原则

| 原则 | 说明 |
|:-----|:-----|
| **语义化命名** | 颜色使用 `text-primary`、`bg-card` 等语义，而非 `gray-900` |
| **单一真相源** | 所有变量通过 `app.wxss` 的 CSS 变量定义，禁止硬编码颜色 |
| **深色模式兼容** | 通过 `@media (prefers-color-scheme: dark)` 和 `theme.json` 双重适配 |
| **rpx 单位** | 所有尺寸使用 `rpx`（750rpx = 屏幕宽度），非 px |
| **BEM 命名** | 工具类遵循 `block-element-modifier` 规范 |

### 1.2 系统架构

```
app.json
  ├── darkmode: true          ← 启用深色模式支持
  ├── themeLocation: theme.json  ← 平台级主题变量文件
  └── window / tabBar 属性引用 @变量名

theme.json
  ├── light.{变量}             ← 浅色模式平台变量
  └── dark.{变量}              ← 深色模式平台变量
     (导航栏背景、文字颜色、TabBar图标等)

app.wxss
  ├── :root, page {            ← 基础 CSS 变量定义
  │     --color-brand-500,
  │     --font-size-base,
  │     --space-md, ...
  │   }
  ├── @media (prefers-color-scheme: dark) {
  │     /* 深色模式覆盖 */
  │   }
  └── 工具类 (.text-primary, .btn, .card ...)

utils/theme.js
  └── ThemeManager 单例         ← 运行时主题切换管理
      ├── getTheme()           → 'light' | 'dark'
      ├── isDark()             → boolean
      ├── setMode(mode)        → 切换模式
      └── onChange(callback)   → 监听变化
```

---

## 二、色彩系统

### 2.1 品牌色板 (Brand Scale)

| Shade | 色值 | 用途 |
|:------|:-----|:-----|
| brand-50  | `#f0f7f2` | 极浅绿背景 |
| brand-100 | `#d9ece1` | 浅绿背景 |
| brand-200 | `#b3d9c3` | 淡绿边框 |
| brand-300 | `#7dbfa3` | 浅绿强调 |
| brand-400 | `#4a7c5c` | 辅助主色 |
| **brand-500** | `#2D5A3D` | **主色 - 草本绿** |
| brand-600 | `#244a33` | 深绿悬停 |
| brand-700 | `#1e3d2a` | 深色变体 |
| brand-800 | `#183022` | 暗色背景 |
| brand-900 | `#112319` | 最深背景 |

### 2.2 AI 强调色板 (Accent Scale)

| Shade | 色值 | 用途 |
|:------|:-----|:-----|
| accent-500 | `#1976D2` | **AI蓝 - 聊天、链接** |

### 2.3 状态色 (Semantic Colors)

| 变量 | 色值 | 用途 |
|:-----|:-----|:-----|
| `--color-success` | `#22C55E` | 成功、通过、健康 |
| `--color-warning` | `#F59E0B` | 警告、注意、限额 |
| `--color-danger` | `#EF4444` | 错误、禁用、危险 |
| `--color-info` | `#3B82F6` | 信息、提示 |

### 2.4 中性色 (Neutrals)

| 语义 | 亮色 | 深色调用 |
|:-----|:-----|:---------|
| text-primary | `#1A1A1A` | `#e6edf3` |
| text-secondary | `#333333` | `#c9d1d9` |
| text-tertiary | `#666666` | `#8b949e` |
| text-placeholder | `#999999` | `#484f58` |
| bg-page | `#F5F7FA` | `#0D1117` |
| bg-card | `#FFFFFF` | `#161B22` |
| border | `#E5E7EB` | `#30363d` |

---

## 三、排版系统

| Token | 值 | 用途 |
|:------|:---|:-----|
| `--font-size-xs` | 20rpx | 辅助说明、时间戳 |
| `--font-size-sm` | 24rpx | 次要信息、标签 |
| `--font-size-base` | 28rpx | 正文、默认字号 |
| `--font-size-md` | 32rpx | 卡片标题 |
| `--font-size-lg` | 40rpx | 页面标题 |
| `--font-size-xl` | 48rpx | 大标题 |
| `--font-size-2xl` | 64rpx | Hero 区域 |

---

## 四、间距系统

| Token | 值 | 用途 |
|:------|:---|:-----|
| `--space-1` | 8rpx | 超紧凑间距 |
| `--space-2` | 16rpx | 紧凑间距 |
| `--space-3` | 24rpx | 常规间距 |
| `--space-4` | 32rpx | 宽松间距 |
| `--space-6` | 48rpx | 页面级间距 |
| `--space-8` | 64rpx | 大间距 |

---

## 五、圆角与阴影

| 圆角 | 值 | 阴影 | 值 |
|:-----|:---|:-----|:---|
| radius-sm | 8rpx | shadow-xs | 0 2rpx 4rpx rgba(0,0,0,0.04) |
| radius-md | 16rpx | shadow-sm | 0 2rpx 8rpx rgba(0,0,0,0.05) |
| radius-lg | 24rpx | shadow-md | 0 4rpx 16rpx rgba(0,0,0,0.08) |
| radius-xl | 32rpx | shadow-lg | 0 8rpx 32rpx rgba(0,0,0,0.12) |
| radius-full | 50% | shadow-xl | 0 16rpx 48rpx rgba(0,0,0,0.15) |

---

## 六、深色模式适配方案

### 6.1 微信官方 DarkMode 适配（已启用）

**app.json 配置：**
```json
{
  "darkmode": true,
  "themeLocation": "theme.json"
}
```

**theme.json 配置（导航栏/TabBar等平台级变量）：**
```json
{
  "light": {
    "navBgColor": "#2D5A3D",
    "navTxtStyle": "white",
    "tabFontColor": "#999999",
    "tabSelectedColor": "#2D5A3D",
    ...
  },
  "dark": {
    "navBgColor": "#1A2F20",
    "navTxtStyle": "white",
    "tabFontColor": "#8B949E",
    "tabSelectedColor": "#4ADE80",
    ...
  }
}
```

### 6.2 CSS 变量深色模式适配（已实现）

**app.wxss 中：**
```css
/* 浅色默认值 */
page {
  --color-bg-page: #F5F7FA;
  --color-text-primary: #1A1A1A;
  /* ... */
}

/* 深色模式媒体查询 */
@media (prefers-color-scheme: dark) {
  page {
    --color-bg-page: #0D1117;
    --color-text-primary: #e6edf3;
    /* ... */
  }
}
```

### 6.3 运行时主题切换

**theme.js API：**
```javascript
const { getThemeManager } = require('../../utils/theme')
const theme = getThemeManager()

// 获取当前主题
const isDark = theme.isDark()

// 监听主题变化
theme.onChange((t) => {
  console.log('主题变为:', t)
})

// 切换模式
theme.setMode('system')  // 跟随系统
theme.setMode('light')   // 强制浅色
theme.setMode('dark')    // 强制深色
theme.toggle()           // 切换深浅
```

---

## 七、样式使用规范

### ✅ 正确用法

```css
/* 使用 CSS 变量 */
.card {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3);
}

/* 使用工具类 */
/* WXML: <view class="text-primary fw-semibold fs-md"> */
```

### ❌ 禁止用法

```css
/* 禁止硬编码颜色 */
.card { color: #333333; }
.card { background: #fff; }

/* 禁止硬编码 rpx 数值 */
.card { font-size: 28rpx; padding: 24rpx; }
```

---

## 八、文件清单

| 文件 | 用途 | 状态 |
|:-----|:-----|:----:|
| `app.json` | darkmode + themeLocation 配置 | ✅ 已更新 |
| `theme.json` | 平台级主题变量（导航栏/TabBar） | ✅ 新增 |
| `app.wxss` | CSS 变量体系 + 工具类 + 动画 | ✅ 重写 |
| `utils/design_tokens.js` | Token 数据源（供构建工具使用） | ✅ 更新 |
| `utils/theme.js` | 运行时主题管理器 | ✅ 更新 |

---

## 九、编译验证

```
NPM 编译: 10.5s
JS 语法: 72/72 文件通过
DarkMode: 已启用
```
