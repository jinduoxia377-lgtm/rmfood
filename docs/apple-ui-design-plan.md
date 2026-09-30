# RMFOOD 小程序 - Apple UI 设计重构方案

> 制定时间: 2026-09-21  
> 版本: 1.0  
> 状态: 设计方案

---

## 一、当前问题分析

### 1.1 现有问题清单

| 类别 | 问题 | 影响程度 |
|:-----|:-----|:--------:|
| **视觉设计** | 颜色系统过于深沉（#2D5A3D） | 高 |
| **导航设计** | 缺少iOS风格Large Title | 高 |
| **卡片设计** | 阴影过重，缺乏层次感 | 中 |
| **表单设计** | 输入框样式不够精致 | 中 |
| **按钮设计** | 圆角和阴影不符合iOS规范 | 中 |
| **列表设计** | 缺少iOS Grouped List风格 | 高 |
| **动画效果** | 过渡效果生硬，缺少spring感 | 中 |
| **图标系统** | 缺少SF Symbols风格 | 中 |
| **深色模式** | 适配不完整 | 低 |

### 1.2 设计缺陷深度分析

```
┌──────────────────────────────────────────────────────────────┐
│                    当前设计 vs Apple Design                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  【颜色系统】                                                 │
│  当前: #2D5A3D (深沉绿色)                                    │
│  Apple: System Blue (#007AFF)                                │
│  问题: 颜色过于深沉，缺乏现代感                              │
│                                                              │
│  【导航栏】                                                   │
│  当前: 固定高度88rpx，渐变背景                               │
│  Apple: Large Title + 折叠效果 + 透明渐变                    │
│  问题: 缺少层级感和交互反馈                                  │
│                                                              │
│  【卡片】                                                     │
│  当前: 固定阴影 shadow-sm/md/lg                              │
│  Apple: 白色卡片 + 细边框 + 浅阴影                           │
│  问题: 视觉层次不够清晰                                      │
│                                                              │
│  【按钮】                                                     │
│  当前: 圆角48rpx，渐变背景                                   │
│  Apple: 大圆角胶囊按钮 / 平铺按钮                            │
│  问题: 按钮样式不够多样化                                    │
│                                                              │
│  【列表】                                                     │
│  当前: 简单列表项                                            │
│  Apple: Grouped Table + 标题分隔                             │
│  问题: 缺少iOS原生列表体验                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、Apple UI 设计原则

### 2.1 Apple 设计三原则

```
┌─────────────────────────────────────────────────────┐
│                                                   │
│   1. CLARITY (清晰)                               │
│      - 界面元素一目了然                            │
│      - 内容优先于装饰                              │
│      - 功能优先于形式                              │
│                                                   │
│   2. DEFERENCE (谦逊)                             │
│      - UI让位于内容                                │
│      - 不抢夺用户注意力                            │
│      - 克制使用动效                                │
│                                                   │
│   3. DEPTH (深度)                                 │
│      - 层级关系通过阴影/透明度表达                  │
│      - 视觉层次清晰                                │
│      - 动态效果增强空间感                          │
│                                                   │
└─────────────────────────────────────────────────────┘
```

### 2.2 Apple Design 核心要素

| 要素 | 描述 | 小程序适配方案 |
|:-----|:-----|:--------------|
| **SF Pro Font** | Apple系统字体 | `-apple-system, BlinkMacSystemFont` |
| **Large Titles** | 导航栏大标题 | `navigationBarTitleText` + 自定义样式 |
| **Translucent** | 半透明毛玻璃效果 | `rgba` + `backdrop-filter` |
| **Rounded Corners** | 大圆角设计 | `border-radius: 12-24rpx` |
| **Segmented Control** | 分段控制器 | Tabs组件改造 |
| **Toggle Switch** | iOS风格开关 | Switch组件定制 |
| **List Group** | 分组列表 | Card组件分组 |
| **Action Sheet** | 操作面板 | Modal组件定制 |

---

## 三、设计令牌系统（Design Tokens）

### 3.1 颜色系统

```css
/* ============================================
   Apple Color System - iOS风格
   ============================================ */

/* 系统色 */
--color-system-blue: #007AFF;
--color-system-green: #34C759;
--color-system-red: #FF3B30;
--color-system-orange: #FF9500;
--color-system-yellow: #FFCC00;
--color-system-purple: #AF52DE;
--color-system-pink: #FF2D55;
--color-system-teal: #5AC8FA;
--color-system-indigo: #5856D6;

/* 语义色 */
--color-primary: var(--color-system-blue);
--color-success: var(--color-system-green);
--color-danger: var(--color-system-red);
--color-warning: var(--color-system-orange);
--color-info: var(--color-system-teal);

/* 背景色 - iOS风格 */
--color-bg-page: #F2F2F7;           /* iOS系统背景 */
--color-bg-card: #FFFFFF;           /* 白色卡片 */
--color-bg-secondary: #F2F2F7;      /* 次级背景 */
--color-bg-tertiary: #E5E5EA;       /* 三级背景 */

/* 分组背景 */
--color-grouped-bg: #F2F2F7;
--color-grouped-separator: #C6C6C8;

/* 文字色 */
--color-text-primary: #000000;
--color-text-secondary: #3C3C43;
--color-text-tertiary: #8E8E93;
--color-text-quaternary: #AEAEB2;
--color-text-placeholder: #C7C7CC;

/* 分隔线 */
--color-separator: rgba(60, 60, 67, 0.1);
--color-divider: rgba(60, 60, 67, 0.2);

/* 毛玻璃效果 */
--color-blur-bg: rgba(252, 252, 254, 0.94);
--color-blur-bg-secondary: rgba(242, 242, 247, 0.94);

/* 深色模式 */
--color-bg-page-dark: #000000;
--color-bg-card-dark: #1C1C1E;
--color-bg-secondary-dark: #2C2C2E;
--color-text-primary-dark: #FFFFFF;
--color-text-secondary-dark: #EBEBF5;
```

### 3.2 字体系统

```css
/* ============================================
   Apple Typography System
   ============================================ */

/* SF Pro 字体栈 */
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", 
             "SF Pro Display", "Helvetica Neue", "PingFang SC", 
             sans-serif;

/* 标题层级 */
--font-size-display: 48rpx;     /* Display */
--font-size-large-title: 34rpx; /* Large Title */
--font-size-title-1: 28rpx;     /* Title 1 */
--font-size-title-2: 22rpx;     /* Title 2 */
--font-size-title-3: 17rpx;     /* Title 3 */
--font-size-body: 17rpx;        /* Body */
--font-size-callout: 16rpx;     /* Callout */
--font-size-caption: 12rpx;     /* Caption */
--font-size-caption-strong: 13rpx;

/* 字重 */
--font-weight-light: 300;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* 行高 */
--line-height-tight: 1.15;
--line-height-default: 1.47;
--line-height-relaxed: 1.7;
```

### 3.3 间距系统

```css
/* ============================================
   Apple Spacing System (基于8pt网格)
   ============================================ */

--space-xxs: 4rpx;    /* 0.5pt */
--space-xs: 8rpx;     /* 1pt */
--space-sm: 12rpx;    /* 1.5pt */
--space-md: 16rpx;    /* 2pt */
--space-lg: 20rpx;    /* 2.5pt */
--space-xl: 24rpx;    /* 3pt */
--space-2xl: 32rpx;   /* 4pt */
--space-3xl: 40rpx;   /* 5pt */
--space-4xl: 48rpx;   /* 6pt */
```

### 3.4 圆角系统

```css
/* ============================================
   Apple Corner Radius System
   ============================================ */

--radius-none: 0rpx;
--radius-xs: 4rpx;
--radius-sm: 8rpx;
--radius-md: 12rpx;
--radius-lg: 16rpx;
--radius-xl: 20rpx;
--radius-2xl: 24rpx;
--radius-full: 999rpx;

/* iOS组件圆角 */
--radius-button: 12rpx;      /* 按钮 */
--radius-card: 14rpx;        /* 卡片 */
--radius-list: 12rpx;        /* 列表项 */
--radius-input: 10rpx;       /* 输入框 */
```

### 3.5 阴影系统

```css
/* ============================================
   Apple Shadow System
   ============================================ */

/* 轻量阴影 */
--shadow-sm: 0 1rpx 3rpx rgba(0,0,0,0.04), 
            0 1rpx 2rpx rgba(0,0,0,0.06);
--shadow-md: 0 4rpx 12rpx rgba(0,0,0,0.06), 
            0 2rpx 4rpx rgba(0,0,0,0.04);
--shadow-lg: 0 12rpx 28rpx rgba(0,0,0,0.08), 
            0 4rpx 10rpx rgba(0,0,0,0.04);
--shadow-xl: 0 20rpx 40rpx rgba(0,0,0,0.12);

/* 内部阴影 */
--shadow-inset: inset 0 1rpx 0 rgba(255,255,255,0.5);
```

---

## 四、组件设计规范

### 4.1 导航栏

```css
/* ============================================
   Apple-style Navigation Bar
   ============================================ */

.navbar-apple {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: calc(var(--status-bar-height) + 44pt);
  background: var(--color-blur-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5rpx solid var(--color-separator);
  z-index: 1000;
}

.navbar-apple .navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44pt;
  padding: 0 16pt;
}

.navbar-apple .navbar-title {
  font-size: 17pt;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
  flex: 1;
}

/* Large Title 模式 */
.navbar-apple.large-title .navbar-title {
  font-size: 34pt;
  font-weight: 700;
  padding: 8pt 16pt;
}
```

### 4.2 搜索栏

```css
/* ============================================
   Apple-style Search Bar
   ============================================ */

.searchbar-apple {
  background: rgba(118, 118, 128, 0.12);
  border-radius: 10rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  padding: 0 8rpx;
  margin: 8rpx 16rpx;
}

.searchbar-apple .search-icon {
  width: 24rpx;
  height: 24rpx;
  opacity: 0.5;
}

.searchbar-apple .search-input {
  flex: 1;
  font-size: 17rpx;
  background: transparent;
  border: none;
  outline: none;
}

.searchbar-apple .search-input::placeholder {
  color: var(--color-text-tertiary);
}
```

### 4.3 分段控制器（Segmented Control）

```css
/* ============================================
   Apple-style Segmented Control
   ============================================ */

.segmented-control {
  display: flex;
  background: rgba(118, 118, 128, 0.12);
  border-radius: 9rpx;
  padding: 2rpx;
  margin: 16rpx;
}

.segmented-control .segment-item {
  flex: 1;
  text-align: center;
  padding: 6rpx 0;
  font-size: 13rpx;
  font-weight: 500;
  color: var(--color-text-primary);
  border-radius: 7rpx;
  transition: all 0.2s ease;
}

.segmented-control .segment-item.active {
  background: var(--color-bg-card);
  box-shadow: 0 1rpx 3rpx rgba(0,0,0,0.08),
              0 1rpx 2rpx rgba(0,0,0,0.04);
}
```

### 4.4 列表组件（List）

```css
/* ============================================
   Apple-style List
   ============================================ */

.list-group {
  background: var(--color-bg-card);
  margin: 20rpx 16rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 14rpx 16rpx;
  background: var(--color-bg-card);
  position: relative;
}

.list-item:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 56rpx;  /* 留出图标空间 */
  right: 0;
  height: 0.5rpx;
  background: var(--color-separator);
}

.list-item .item-icon {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  margin-right: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-item .item-content {
  flex: 1;
}

.list-item .item-title {
  font-size: 17rpx;
  color: var(--color-text-primary);
}

.list-item .item-subtitle {
  font-size: 15rpx;
  color: var(--color-text-secondary);
  margin-top: 2rpx;
}

.list-item .item-accessory {
  color: var(--color-text-tertiary);
  margin-left: 8rpx;
}
```

### 4.5 按钮组件

```css
/* ============================================
   Apple-style Buttons
   ============================================ */

/* 主要按钮 - 填充样式 */
.btn-apple-primary {
  background: var(--color-system-blue);
  color: #FFFFFF;
  height: 50rpx;
  border-radius: 12rpx;
  font-size: 17rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease;
}

.btn-apple-primary:active {
  opacity: 0.8;
}

/* 次要按钮 - 描边样式 */
.btn-apple-secondary {
  background: transparent;
  color: var(--color-system-blue);
  height: 50rpx;
  border-radius: 12rpx;
  font-size: 17rpx;
  font-weight: 600;
  border: 1.5rpx solid var(--color-system-blue);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 链接按钮 */
.btn-apple-link {
  background: transparent;
  color: var(--color-system-blue);
  font-size: 17rpx;
  font-weight: 400;
  padding: 14rpx 0;
}
```

### 4.6 开关组件（Toggle）

```css
/* ============================================
   Apple-style Toggle Switch
   ============================================ */

.toggle-apple {
  width: 52rpx;
  height: 32rpx;
  background: rgba(120, 120, 120, 0.24);
  border-radius: 16rpx;
  position: relative;
  transition: background 0.3s ease;
}

.toggle-apple.active {
  background: var(--color-system-green);
}

.toggle-apple .toggle-thumb {
  position: absolute;
  top: 2rpx;
  left: 2rpx;
  width: 28rpx;
  height: 28rpx;
  background: #FFFFFF;
  border-radius: 50%;
  box-shadow: 0 2rpx 4rpx rgba(0,0,0,0.15);
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.toggle-apple.active .toggle-thumb {
  transform: translateX(20rpx);
}
```

---

## 五、页面设计方案

### 5.1 首页（Apple Style）

```
┌─────────────────────────────────────────┐
│  [状态栏 20pt]                          │
├─────────────────────────────────────────┤
│  药食同源         [🔍] [👤]          │ ← Large Title
│  (34pt)                                   │
├─────────────────────────────────────────┤
│  [🔍 搜索食材、配方...]                 │ ← SearchBar
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  🤖 AI顾问    🥗 配料分析       │   │
│  │  智能配方    拍照识别          │   │
│  ├─────────────────────────────────┤   │
│  │  📚 配方库    📊 数据检索       │   │
│  │  精选配方    药材查询          │   │
│  └─────────────────────────────────┘   │ ← Feature Grid
├─────────────────────────────────────────┤
│  今日推荐                                │
│  ┌─────────────────────────────────┐   │
│  │  [图片] 安神助眠汤              │   │
│  │         适合失眠人群            │   │
│  │         ★★★★☆                  │   │
│  └─────────────────────────────────┘   │ ← Card
├─────────────────────────────────────────┤
│  [Tab Bar: 首页 | AI | 搜索 | 我的]    │
└─────────────────────────────────────────┘
```

### 5.2 个人中心（Apple Settings Style）

```
┌─────────────────────────────────────────┐
│  [返回]         我的          [⚙️]    │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  [头像]  用户名                  │   │
│  │          ID: 123456              │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  📊 我的配方           ›        │   │
│  ├─────────────────────────────────┤   │
│  │  ❤️ 我的收藏           ›        │   │
│  ├─────────────────────────────────┤   │
│  │  📝 分析历史           ›        │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  ⚙️ 设置                 ›      │   │
│  ├─────────────────────────────────┤   │
│  │  📖 关于我们             ›      │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 5.3 搜索页面（Apple Search Style）

```
┌─────────────────────────────────────────┐
│  [取消]  [🔍 搜索...]        [🎤]    │
├─────────────────────────────────────────┤
│  ┌─ 分段控制 ───────────────────────┐  │
│  │  [全部] [食材] [配方] [知识]    │  │
│  └──────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  热门搜索                                │
│  枸杞  黄芪  山药  茯苓  红枣          │
├─────────────────────────────────────────┤
│  搜索历史                                │
│  安神助眠汤              [删除]        │
│  健脾养胃方              [删除]        │
└─────────────────────────────────────────┘
```

---

## 六、实施计划

### 6.1 阶段划分

| 阶段 | 内容 | 工时 | 优先级 |
|:----:|:-----|:----:|:------:|
| **Phase 1** | 设计令牌 + 基础组件 | 2天 | P0 |
| **Phase 2** | 导航栏 + TabBar改造 | 1天 | P0 |
| **Phase 3** | 首页Apple化 | 1天 | P1 |
| **Phase 4** | 个人中心改造 | 1天 | P1 |
| **Phase 5** | 搜索页改造 | 0.5天 | P2 |
| **Phase 6** | 深色模式完善 | 0.5天 | P2 |

### 6.2 文件修改清单

```
新增文件:
├── design-tokens.wxss        # 设计令牌
├── components/AppleNavBar/    # Apple导航栏
├── components/AppleSearchBar/ # Apple搜索栏
├── components/AppleButton/    # Apple按钮
├── components/AppleList/      # Apple列表
├── components/AppleToggle/    # Apple开关
└── components/AppleCard/      # Apple卡片

修改文件:
├── app.wxss                  # 全局样式
├── pages/index/index.wxss    # 首页
├── pages/profile/index.wxss  # 个人中心
├── pages/search/index.wxss   # 搜索页
└── components/NavBar/        # 导航栏组件
```

---

## 七、设计亮点

### 7.1 iOS 17 风格特性

1. **Dynamic Island 风格导航**
   - 折叠/展开动画
   - 透明渐变背景

2. **Vision Pro 风格卡片**
   - 多层阴影
   - 微妙的光照效果

3. **iOS 17 列表风格**
   - Grouped List
   - 标题组
   - 分割线

4. **SF Symbols 风格图标**
   - 线性/填充双模式
   - 统一视觉语言

### 7.2 差异化设计

| 特性 | 说明 |
|:-----|:-----|
| **药食同源主题色** | 在iOS蓝色基础上，融入中药绿色作为强调色 |
| **中式现代化** | Apple设计语言 + 中国传统元素融合 |
| **无障碍优化** | 高对比度模式、动态类型支持 |

---

## 八、预期效果

```
┌─────────────────────────────────────────────────────────┐
│                     预期效果对比                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  【视觉效果】                                           │
│  当前: 深沉绿色主题，视觉压力大                         │
│  目标: 清爽白色主题，iOS原生感                          │
│                                                         │
│  【交互体验】                                           │
│  当前: 普通点击反馈                                     │
│  目标: Spring动画 + 触觉反馈                            │
│                                                         │
│  【品牌认知】                                           │
│  当前: 传统中式风格                                     │
│  目标: 现代简约 + 专业医疗感                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

> **结论：Apple UI重构将显著提升用户体验，使RMFOOD小程序具有现代、专业、易用的界面风格。**
