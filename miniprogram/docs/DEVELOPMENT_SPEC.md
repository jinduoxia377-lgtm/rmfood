# RMFOOD 小程序 - WXML/View 开发规范

> 基于微信官方文档 https://developers.weixin.qq.com/miniprogram/dev/component/view.html  
> 版本：V1.0 | 更新日期：2026-01-15 | 状态：✅ 生效执行

---

## 一、view 组件属性规范

### 1.1 点击态样式（hover-class）

```xml
<!-- ✅ 正确：为可点击元素添加点击反馈 -->
<view class="quick-item" hover-class="quick-item--active" bindtap="handleTap">
  <icon name="ingredient" size="lg" color="#2D5A3D" />
  <text class="quick-text">配料分析</text>
</view>
```

```css
/* 对应样式 */
.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 16rpx;
}

/* 点击态：缩放 + 半透明遮罩 */
.quick-item--active {
  opacity: 0.8;
  transform: scale(0.96);
}
```

**规范原则：**
- 所有 `bindtap` 元素必须配 `hover-class` 提供视觉反馈
- `hover-class="none"` 禁用点击态（仅用于不可交互元素）
- hover 延迟建议：`hover-start-time="50"`，保持时间：`hover-stay-time="200"`

### 1.2 事件冒泡控制

| 场景 | 绑定方式 | 说明 |
|------|---------|------|
| 普通点击 | `bind:tap` | 事件冒泡至父节点 |
| 阻断冒泡 | `catch:tap` | 事件不向上传递 |
| 长按 | `bind:longpress` | 默认 350ms 触发 |
| 触摸开始 | `bind:touchstart` | 用于手势识别 |

**常见陷阱与修复：**

```xml
<!-- ❌ 错误：modal 内容区 catchtap="" 为空，应绑定实际方法 -->
<view class="modal-overlay" bindtap="closeModal">
  <view class="modal-content" catchtap="stopPropagation">
    <!-- 内容 -->
  </view>
</view>

<!-- ✅ 正确：使用 catch:tap 阻断冒泡 -->
<view class="modal-overlay" bindtap="closeModal">
  <view class="modal-content" catchtap="">
    <!-- 内容不会触发 closeModal -->
  </view>
</view>
```

### 1.3 scroll-view 高度规范

```xml
<!-- ❌ 错误：scroll-view 未设置固定高度，无法滚动 -->
<scroll-view scroll-y class="content">
  <view>内容...</view>
</scroll-view>

<!-- ✅ 正确：使用 calc 或固定高度 -->
<scroll-view 
  scroll-y 
  class="content-scroll"
  refresher-enabled="{{true}}"
  refresher-triggered="{{refreshing}}"
  bindrefresherrefresh="onPullDownRefresh"
  bindscrolltolower="onLoadMore"
>
  <view>内容...</view>
  <view class="bottom-spacing"></view>
</scroll-view>
```

```css
/* ✅ 正确：配合 fixed header 计算高度 */
.content-scroll {
  flex: 1;
  height: calc(100vh - 112rpx); /* 减去 fixed header 高度 */
  /* 或使用 margin-top 方案 */
  /* margin-top: 112rpx; */
}
```

**scroll-view 关键规范：**

| 属性 | 规范值 | 说明 |
|------|--------|------|
| `scroll-y` | `true` | 纵向滚动必须显式开启 |
| `refresher-enabled` | `true` | 开启下拉刷新 |
| `refresher-triggered` | `{{refreshing}}` | 受控刷新状态 |
| `lower-threshold` | `50` | 距底部 50px 触发 loadmore |
| `scroll-with-animation` | `false` | 避免动画干扰用户操作 |

---

## 二、事件绑定规范

### 2.1 bindtap vs catchtap 选择指南

```
事件流：inner → middle → outer（冒泡方向）

bind:tap  = 允许冒泡（默认行为）
catch:tap = 阻断冒泡（事件处理后立即停止）
```

**决策矩阵：**

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 列表项点击，需同时触发父容器 | `bind:tap` | 需要冒泡传递 data |
| Modal 内容区点击 | `catch:tap=""` | 防止触发 overlay 的关闭事件 |
| 按钮点击（独立操作） | `bind:tap` | 无嵌套冲突 |
| 卡片内含多个可点击区域 | `catch:tap` 在外层 | 防止误触父容器 |
| 下拉刷新触发区 | `bind:refresherrefresh` | 组件专用事件 |

### 2.2 data-* 传参规范

```xml
<!-- ✅ 规范：使用 data-* 传递标识数据 -->
<view 
  class="formula-item" 
  bindtap="goToDetail" 
  data-id="{{item.id}}"
  data-index="{{index}}"
  data-type="formula"
>
  <text>{{item.title}}</text>
</view>

<!-- JS 中接收 -->
goToDetail(e) {
  const { id, index, type } = e.currentTarget.dataset
  console.log(`点击了 ${type} #${id}, index=${index}`)
  wx.navigateTo({ url: `/pages/detail/index?id=${id}` })
}
```

**data-* 命名规范：**
- 使用 kebab-case：`data-formula-id` → `e.currentTarget.dataset.formulaId`
- 避免数字开头：`data-1id` ❌ → `data-item-id` ✅
- 单值用 `data-id`，多值用 `data-xxx data-yyy`

### 2.3 事件处理函数规范

```javascript
// ✅ 规范：统一事件处理命名
Page({
  // 页面导航
  goToSearch() { ... },
  goToProfile() { ... },
  goToFormulas() { ... },
  
  // 交互操作
  toggleMenu() { ... },
  startIngredientAnalysis() { ... },
  startAiChat() { ... },
  
  // 数据操作
  onLoadMore() { ... },
  onPullDownRefresh() { ... },
  
  // 用户交互
  handleFavorite(e) { ... },  // e.currentTarget.dataset.id
  handleShare() { ... },
})
```

---

## 三、组件设计规范

### 3.1 自定义组件属性定义

```javascript
// components/HealthScore/index.js
Component({
  options: {
    multipleSlots: true,  // 支持多个 slot
    styleIsolation: 'isolated'  // 样式隔离
  },
  
  properties: {
    // 必填属性
    score: {
      type: Number,
      value: 0,
      observer: '_onScoreChange'
    },
    // 可选属性
    size: {
      type: String,
      value: 'medium',  // small | medium | large
      observer: '_onSizeChange'
    },
    // 布尔属性
    showText: {
      type: Boolean,
      value: true
    },
    // 回调事件
    onChange: {
      type: String,
      value: ''
    }
  },
  
  data: {
    scoreLetter: 'B',
    scoreColor: '#2D5A3D'
  },
  
  methods: {
    _onScoreChange(newVal) {
      const level = this.getScoreLevel(newVal)
      this.setData({
        scoreLetter: level.letter,
        scoreColor: level.color
      })
    },
    
    getScoreLevel(score) {
      if (score >= 90) return { letter: 'A', color: '#07c160' }
      if (score >= 80) return { letter: 'B', color: '#2D5A3D' }
      if (score >= 60) return { letter: 'C', color: '#ff976a' }
      return { letter: 'D', color: '#ee0a24' }
    }
  }
})
```

### 3.2 组件 Slot 使用规范

```xml
<!-- components/HealthScore/index.wxml -->
<view class="health-score {{sizeClass}}">
  <!-- 默认 slot -->
  <view class="score-circle" style="background: conic-gradient(...)">
    <text class="score-value">{{scoreLetter}}</text>
  </view>
  
  <!-- 命名 slot -->
  <slot name="extra"></slot>
  <slot name="footer"></slot>
</view>
```

```xml
<!-- 页面中使用 -->
<health-score score="{{85}}" size="large">
  <view slot="extra">
    <text>得分说明</text>
  </view>
</health-score>
```

---

## 四、样式规范

### 4.1 rpx 响应式单位

```css
/* ✅ 规范：统一使用 rpx 单位 */
.page-container {
  min-height: 100vh;
  padding: 0 32rpx;
}

.header {
  height: 112rpx;  /* 约 56px */
  padding: 24rpx 32rpx;
}

.icon-lg {
  width: 96rpx;
  height: 96rpx;
  font-size: 48rpx;
}
```

### 4.2 颜色变量体系

```css
/* app.wxss - 全局变量 */
page {
  --color-primary: #2D5A3D;      /* 草本绿 - 主色 */
  --color-primary-light: #4A7C5C; /* 浅绿 */
  --color-accent: #1976D2;       /* AI蓝 - 强调色 */
  --color-warning: #F59E0B;      /* 琥珀色 - 警告 */
  --color-danger: #EF4444;       /* 红色 - 危险 */
  --color-success: #22C55E;      /* 绿色 - 成功 */
  
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #666666;
  --color-text-muted: #999999;
  
  --color-bg-primary: #F5F7FA;
  --color-bg-secondary: #FFFFFF;
  
  --color-border: #E5E7EB;
  
  --radius-sm: 8rpx;
  --radius-md: 16rpx;
  --radius-lg: 24rpx;
  --radius-full: 50%;
}
```

### 4.3 BEM 命名规范

```css
/* 格式：block__element--modifier */
.quick-section {}           /* block */
.quick-section__grid {}     /* element */
.quick-section__item {}     /* element */
.quick-section__item--active {}  /* modifier */

/* ❌ 避免过度嵌套 */
.quick-section .quick-item .quick-icon-wrap .quick-icon {}

/* ✅ 扁平化命名 */
.quick-item {}
.quick-icon-wrap {}
.quick-icon {}
```

---

## 五、性能优化规范

### 5.1 列表渲染优化

```xml
<!-- ✅ 规范：使用 wx:key 提升渲染性能 -->
<view wx:for="{{list}}" wx:key="id" class="item">
  <text>{{item.name}}</text>
</view>

<!-- ✅ 简单列表使用 index 作为 key -->
<view wx:for="{{array}}" wx:key="*this" class="item">
  <text>{{item}}</text>
</view>

<!-- ❌ 避免：无 key 或 key 使用 index（动态列表） -->
<view wx:for="{{list}}" class="item">  <!-- 缺少 wx:key -->
<view wx:for="{{list}}" wx:key="index" class="item">  <!-- 动态列表用 index 会导致错乱 -->
```

### 5.2 条件渲染优化

```xml
<!-- ✅ 使用 wx:if 控制显隐（低频切换） -->
<view wx:if="{{showDetail}}" class="detail">
  <!-- 详细內容 -->
</view>

<!-- ✅ 使用 hidden 控制显隐（高频切换） -->
<view hidden="{{!isLoading}}" class="loading">
  <view class="spinner"></view>
</view>
```

**wx:if vs hidden 选择：**
| 场景 | 推荐 | 原因 |
|------|------|------|
| 很少切换 | `wx:if` | 节省渲染开销 |
| 频繁切换 | `hidden` | 避免反复创建/销毁节点 |
| 条件复杂 | `wx:if` + `wx:else` | 结构清晰 |

### 5.3 图片懒加载

```xml
<!-- ✅ 规范：启用 lazy-load -->
<image 
  src="{{item.imageUrl}}" 
  lazy-load 
  mode="aspectFill"
  class="ingredient-img"
></image>
```

---

## 六、安全检查清单

### 6.1 WXML 模板检查

```bash
# 检查清单
□ 所有 bindtap 都有对应的 handler 方法
□ 所有 data-* 属性命名符合规范
□ 列表渲染有 wx:key
□ scroll-view 设置了固定高度
□ 无 Emoji 作为图标使用
□ 无多余的空标签
□ 所有 icon 组件使用 SVG 实现
```

### 6.2 常见 Bug 预防

| Bug 现象 | 原因 | 解决方案 |
|---------|------|---------|
| 搜索框被 Header 遮挡 | scroll-view 高度计算错误 | 使用 margin-top 或 calc 正确计算 |
| 点击事件重复触发 | bindtap 冒泡未阻断 | 内层使用 catch:tap |
| 下拉刷新不生效 | scroll-view 无法触发页面刷新 | 改用页面级 onPullDownRefresh |
| 列表顺序错乱 | wx:key 使用 index | 改用唯一 ID 作为 key |
| 弹窗点击穿透 | catchtap 绑定空字符串 | 正确阻断冒泡 |

---

## 七、代码示例库

### 7.1 标准页面模板

```xml
<!-- pages/example/index.wxml -->
<view class="page-container">
  <!-- 自定义导航栏 -->
  <view class="custom-header" style="padding-top: {{statusBarHeight}}px;">
    <view class="back-btn" bindtap="goBack">
      <icon name="arrow-left" size="md" color="#FFFFFF" />
    </view>
    <view class="header-title">{{pageTitle}}</view>
    <view class="header-action" bindtap="onAction">
      <icon name="share" size="md" color="#FFFFFF" />
    </view>
  </view>

  <!-- 滚动内容区 -->
  <scroll-view 
    class="content-scroll" 
    scroll-y
    refresher-enabled
    refresher-triggered="{{refreshing}}"
    bindrefresherrefresh="onPullDownRefresh"
    bindscrolltolower="onLoadMore"
  >
    <!-- 加载状态 -->
    <view wx:if="{{loading}}" class="loading-state">
      <view class="spinner"></view>
      <text>加载中...</text>
    </view>

    <!-- 内容区域 -->
    <view wx:else class="content">
      <view wx:for="{{list}}" wx:key="id" class="item">
        <text>{{item.name}}</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view wx:if="{{!loading && list.length === 0}}" class="empty-state">
      <icon name="search" size="xxl" color="#CCCCCC" />
      <text>暂无数据</text>
    </view>

    <view class="bottom-spacing"></view>
  </scroll-view>
</view>
```

### 7.2 标准组件模板

```xml
<!-- components/Card/index.wxml -->
<view class="card {{className}}" hover-class="card--active">
  <view class="card__header">
    <slot name="header"></slot>
  </view>
  <view class="card__body">
    <slot></slot>
  </view>
  <view class="card__footer" wx:if="{{showFooter}}">
    <slot name="footer"></slot>
  </view>
</view>
```

---

## 八、附录：官方文档参考

| 文档 | 链接 |
|------|------|
| view 组件 | https://developers.weixin.qq.com/miniprogram/dev/component/view.html |
| scroll-view 组件 | https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html |
| 事件系统 | https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html |
| 自定义组件 | https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/ |
| 性能优化 | https://developers.weixin.qq.com/miniprogram/dev/framework/performance/ |
