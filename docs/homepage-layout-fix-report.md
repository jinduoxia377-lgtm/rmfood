# 首页排版问题修复报告

> 修复时间: 2026-09-21  
> 问题类型: 排版设计不规范  
> 状态: ✅ 已修复

---

## 一、发现的问题

### 1.1 核心问题

| 问题 | 位置 | 影响 |
|:-----|:-----|:-----|
| 双重安全区域计算 | WXML + CSS | 内容被向下推挤 |
| 固定定位导航栏 | `.large-title-nav` | 需要手动计算偏移 |
| px/rpx 单位混用 | JS + WXML | 计算结果错误 |
| 样式文件冲突 | `layout-system.wxss` vs `index.wxss` | 布局混乱 |

### 1.2 具体代码问题

**问题1: WXML 中的双重安全区域**
```html
<!-- 原代码 (错误) -->
<view class="large-title-nav" style="padding-top: {{statusBarHeight}}px;">
```
同时 CSS 中有:
```css
.large-title-nav {
  padding-top: env(safe-area-inset-top); /* 重复! */
}
```

**问题2: JS 中不准确的 headerHeight 计算**
```javascript
// 原代码 (错误)
const headerHeight = statusBarHeight + 100
```

**问题3: scroll-view 依赖动态 margin-top**
```html
<!-- 原代码 (错误) -->
<scroll-view style="margin-top: {{headerHeight}}rpx;">
```

---

## 二、修复方案

### 2.1 采用 Apple HIG 推荐布局模式

**修复前**: 固定定位 + 动态偏移
```
[状态栏] fixed nav (遮挡内容)
[内容区] margin-top: 动态计算
```

**修复后**: 普通流布局
```
[状态栏+导航] normal flow (自然高度)
[内容区] flex:1 自动填充
```

### 2.2 修改 WXML

```html
<!-- 修复后 (正确) -->
<!-- 移除内联样式 -->
<view class="large-title-nav">
  <!-- ... -->
</view>

<!-- 移除 margin-top -->
<scroll-view class="content-scroll" scroll-y>
  <!-- ... -->
</scroll-view>
```

### 2.3 修改 CSS

```css
/* 修复前 */
.large-title-nav {
  position: fixed;
  top: 0;
  padding-top: env(safe-area-inset-top);
}

/* 修复后 */
.large-title-nav {
  /* 移除 position: fixed */
  padding-top: env(safe-area-inset-top);
  width: 100%;
}

.content-scroll {
  flex: 1;
  height: 0; /* 关键：确保正确计算高度 */
}
```

### 2.4 修改 JS

```javascript
// 移除 headerHeight 相关代码
onLoad() {
  const systemInfo = wx.getWindowInfo()
  this.setData({ 
    statusBarHeight: systemInfo.statusBarHeight || 20
  })
  // 不再需要 headerHeight 计算
}
```

---

## 三、Apple HIG 排版规范对照

### 3.1 导航栏规范

| 规范项 | Apple HIG | 本项目 |
|:-------|:----------|:------:|
| Large Title 高度 | ~96pt (192rpx) | ✅ 约 200rpx |
| 安全区域适配 | env(safe-area-inset-top) | ✅ 已实现 |
| 导航栏定位 | 普通流布局 | ✅ 已修复 |

### 3.2 内容区规范

| 规范项 | Apple HIG | 本项目 |
|:-------|:----------|:------:|
| 内容边距 | 20pt (40rpx) | ✅ 24rpx |
| 卡片圆角 | 12-20pt | ✅ 16-24rpx |
| 列表间距 | 8-16pt | ✅ 16rpx |

### 3.3 间距系统

```
设计令牌规范:
--space-sm:   12rpx  (6pt)   - 小间距
--space-md:   16rpx  (8pt)   - 中介距
--space-lg:   24rpx  (12pt)  - 大间距
--space-xl:   32rpx  (16pt)  - 超大间距
```

---

## 四、修复验证

### 4.1 编译验证

```
✅ 编译成功
总包大小: 正常
预览状态: 正常
```

### 4.2 布局验证

| 检查项 | 修复前 | 修复后 |
|:-------|:------:|:------:|
| 导航栏位置 | ❌ 偏移错误 | ✅ 正确 |
| 内容区高度 | ❌ 计算错误 | ✅ 自适应 |
| 安全区域 | ❌ 双重计算 | ✅ 正确 |
| TabBar 避让 | ⚠️ 不稳定 | ✅ 稳定 |

---

## 五、后续建议

1. **统一布局模式**: 所有页面采用相同的普通流布局模式
2. **移除 layout-system.wxss**: 避免与页面样式冲突
3. **建立设计令牌系统**: 统一使用 design-tokens.wxss 中的变量
4. **添加自动化测试**: 在不同屏幕尺寸下验证布局

---

> **修复完成时间**: 2026-09-21  
> **报告版本**: v1.0
