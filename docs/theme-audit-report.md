# RMFOOD 主题系统规范化核查报告

> 时间: 2026-09-21
> 依据: 微信官方文档 [DarkMode 适配指南](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/darkmode.html)

---

## 一、问题总览

| 类别 | 问题数 | 状态 |
|:-----|:-----:|:----:|
| 组件 WXSS 硬编码颜色 | ~45 | ✅ 已修复 |
| 页面 WXSS 硬编码颜色 | ~120 | ✅ 已修复 |
| WXML 内联硬编码颜色 | 3 | ✅ 已修复 |
| app.wxss 缺少语义别名 | 15+ | ✅ 已补充 |
| theme.json 平台变量 | 0 | ✅ 已新增 |

---

## 二、已完成修复

### 2.1 app.wxss 增强

新增 **CSS 语义化别名**（兼容现有页面代码的 `var(--primary, #fallback)` 写法）：
```
--primary / --primary-light / --primary-dark
--bg-primary / --bg-secondary / --bg-tertiary
--text-primary / --text-secondary / --text-tertiary / --text-muted / --text-placeholder / --text-inverse
--border-color / --border-light
--shadow-color
```

新增 **功能图标渐变色变量**（供首页6个功能入口使用）：
```
--color-feature-ingredient-bg   (草本绿渐变)
--color-feature-chat-bg         (AI蓝渐变)
--color-feature-formula-bg      (琥珀渐变)
--color-feature-history-bg      (紫罗兰渐变)
--color-feature-database-bg     (青绿渐变)
--color-feature-compliance-bg   (粉红渐变)
--color-feature-warning-bg      (警告渐变)
```

### 2.2 组件 WXSS 修复清单

| 组件 | 修复前 | 修复后 |
|:-----|:-----:|:-----:|
| Button | 11个硬编码 | 全部使用品牌/状态色变量 |
| Input | 12个硬编码 | 全部使用边框/文本色变量 |
| Modal | 11个硬编码 | 全部使用卡片/边框/文本色变量 |
| NutritionLabel | 7个硬编码 | 全部使用语义化变量 |
| ProgressBar | 2个硬编码 | `#979797` → `var(--color-text-tertiary)` |
| Switch | 1个硬编码 | `#FFFFFF` → `var(--color-bg-card)` |
| Toast | 1个硬编码 | `#FFFFFF` → `var(--color-text-inverse)` |
| VirtualList | 2个硬编码 | `#FFFFFF`/`#F5F5F5` → 语义变量 |

### 2.3 页面 WXSS 修复清单

| 页面 | 修复前 | 修复后 |
|:-----|:-----:|:-----:|
| compliance | ~51个硬编码 | 全部使用语义变量 |
| database | ~24个硬编码 | 全部使用语义变量 |
| herb-detail | ~43个硬编码 | 全部使用语义变量 |
| index (首页) | 6个渐变硬编码 | 使用功能图标渐变变量 |
| compare | ~20个硬编码 | 全部使用语义变量 |
| agreement/privacy | 各6-8个硬编码 | 全部使用语义变量 |
| profile/history | 4个硬编码 | 全部使用语义变量 |
| profile/index | 1个硬编码 | 使用语义变量 |
| test | 2个硬编码 | 全部使用语义变量 |

### 2.4 WXML 内联样式修复

| 文件 | 修复 |
|:-----|:-----|
| HealthScore/index.wxml | `#e0e0e0` → `var(--color-border)` |
| NavBar/index.wxml | `#FFFFFF` → `var(--color-text-inverse)` |
| compare/index.wxml | `#4CAF50` → `var(--color-success)` |

### 2.5 新增文件

| 文件 | 说明 |
|:-----|:-----|
| `theme.json` | 平台级主题变量（导航栏/TabBar） |
| `utils/theme.js` | 运行时主题管理器（system/light/dark三种模式） |

---

## 三、最终验证结果

```
JS 语法检查:     72/72 文件通过 ✅
WXSS 硬编码颜色:  2 个（TCM性质色 #FF4500 + disease节点色，功能专用）
NPM 编译:        成功 ✅
预览二维码:      已生成 ✅
```

> **注**: 2个剩余硬编码颜色为功能性专用色：
> - `#FF4500` (nature-re 热性) — TCM性质分类色，需与冷色系区分
> - 无其他通用硬编码颜色

---

## 四、主题系统架构

```
┌─────────────────────────────────────────────────────┐
│  app.json                                           │
│    darkmode: true                                   │
│    themeLocation: theme.json                        │
│    window/tabBar 引用 @变量名                          │
├─────────────────────────────────────────────────────┤
│  theme.json                                         │
│    light: { navBgColor, tabFontColor, ... }         │
│    dark:  { navBgColor, tabFontColor, ... }         │
├─────────────────────────────────────────────────────┤
│  app.wxss                                           │
│    :root, page {                                     │
│      --color-brand-50~900, --color-accent-50~900    │
│      --color-success/warning/danger/info            │
│      --color-text-*-*, --color-bg-*-*, --color-border-*│
│      --font-size-*-*, --space-*-*, --radius-*-*,    │
│      --shadow-*-*, --transition-*                   │
│      语义别名 (--primary, --bg-primary, ...)        │
│      功能渐变 (--color-feature-*)                   │
│    }                                                │
│    @media (prefers-color-scheme: dark) { ... }      │
│    工具类 (.text-primary, .card, .btn, ...)         │
├─────────────────────────────────────────────────────┤
│  utils/theme.js                                     │
│    ThemeManager 单例                                │
│    getTheme() / isDark() / setMode() / onChange()   │
└─────────────────────────────────────────────────────┘
```
