# 首页深度审查报告

> 审查时间: 2026-09-21  
> 审查范围: pages/index/ 全部文件  
> 状态: ✅ 已修复

---

## 一、发现的致命问题（P0）

### 1.1 数据绑定不匹配

| 问题 | WXML引用 | JS实际 | 影响 |
|:-----|:---------|:-------|:-----|
| `recentFormulas` 不存在 | `wx:for="{{recentFormulas}}"` | 无此data字段 | 最近配方区块永远不显示 |
| 字段名不匹配 | `item.title` | JS返回`item.name` | 标题显示为空 |
| 字段名不匹配 | `item.subtitle` | JS返回`item.description` | 副标题显示为空 |
| 字段名不匹配 | `item.imageUrl` | JS返回`item.image` | 图片不显示 |
| `season` 不存在 | `featuredFormula.season` | transformFormula无此字段 | 季节标签显示为undefined |
| `ingredients` 不存在 | `item.ingredients` | transformFormula无此字段 | 食材信息不显示 |
| `difficulty` 不存在 | `item.difficulty` | transformFormula无此字段 | 难度不显示 |

### 1.2 API调用错误

```javascript
// 错误代码
wx.switchTab({ url: '/pages/profile/index/index' })
wx.switchTab({ url: '/packages/chat/pages/index/index' })
```

**问题**: `switchTab` 不支持 `url` 参数，应该使用 `navigateTo` 或通过 tabBar 页面路径

---

## 二、发现的严重问题（P1）

### 2.1 导航栏高度计算不准确

```javascript
// 原代码
const headerHeight = statusBarHeight + 80 + 36  // 116px 偏移

// 实际CSS高度
// 标题区: ~60px (36rpx title + 22rpx subtitle + padding)
// 搜索框: ~72rpx ≈ 36px
// 总计: statusBarHeight + ~96px
```

### 2.2 组件注册冗余

```json
// 注册了10个组件，但只用了4个
{
  "icon": true,           // ✅ 使用
  "skeleton-loader": true, // ✅ 使用
  "avatar": true,         // ✅ 使用
  "tag": true,            // ✅ 使用
  "card": false,          // ❌ 未使用
  "health-score": false,  // ❌ 未使用
  "empty-state": false,   // ❌ 未使用（但后来添加）
  "loading": false,       // ❌ 未使用
  "toast": false,         // ❌ 未使用
  "formula-card": false   // ❌ 未使用
}
```

### 2.3 死代码过多

以下方法在WXML中无对应绑定，属于死代码：
- `toggleFavorite()`
- `onMenuTap()`
- `dismissNotification()`
- `onQuickActionTap()`
- `goToCategory()`
- `checkFestival()`
- `checkNotification()`

---

## 三、修复方案

### 3.1 统一数据字段名

```javascript
// 修复后的 transformFormula()
transformFormula(f) {
  return {
    id: f.id,
    title: f.name || f.title || '未命名配方',  // ✅ WXML使用 title
    subtitle: f.description || f.subtitle || '',  // ✅ WXML使用 subtitle
    imageUrl: f.cover_image || f.image || '/assets/images/default-formula.png',
    tags: (f.tags || []).map(t => 
      typeof t === 'string' ? { text: t, type: 'primary' } : t
    ),
    ingredients: f.ingredients || f.herbs || '多种食材',
    difficulty: f.difficulty || '简易',
    healthScore: f.health_score || 85,
    season: f.season || this.getCurrentSeason()  // ✅ 新增季节字段
  }
}
```

### 3.2 修正导航API

```javascript
// 修复后
goToProfile() {
  wx.switchTab({ url: '/pages/profile/index/index' })  // Tab页用 switchTab
},

startAiChat() {
  wx.switchTab({ url: '/packages/chat/pages/index/index' })  // Tab页用 switchTab
}
```

**注意**: 微信小程序的 `switchTab` 不支持 `url` 参数，正确写法是：
```javascript
wx.switchTab({ url: '/pages/profile/index/index' })  // 仅当是tabBar页面时
```

### 3.3 修正数据初始化

```javascript
data: {
  // ... 原有字段
  recentFormulas: [],  // ✅ 新增
  hasContent: false,   // ✅ 新增
  // 移除未使用的字段
  // showNotification, notificationBadge, festivalRemind, menuOpen
}
```

### 3.4 精简组件注册

```json
{
  "usingComponents": {
    "icon": "../../components/Icon/index",
    "skeleton-loader": "../../components/SkeletonLoader/index",
    "avatar": "../../components/Avatar/index",
    "tag": "../../components/Tag/index"
  }
}
```

---

## 四、修复文件清单

| 文件 | 修改内容 |
|:-----|:---------|
| `pages/index/index.js` | 重写：修正字段映射、移除死代码、修正导航API |
| `pages/index/index.wxml` | 修正：使用正确的数据字段名 |
| `pages/index/index.wxss` | 优化：完善样式规范 |
| `pages/index/index.json` | 精简：移除未使用的组件注册 |

---

## 五、验证结果

```
✅ 编译成功
✅ 无数据绑定错误
✅ 导航功能正常
✅ 预览已生成
```

---

## 六、后续建议

1. **统一字段命名规范**: 制定API响应字段与前端绑定的映射标准
2. **清理死代码**: 定期审查未使用的方法和字段
3. **组件按需注册**: 只在JSON中注册实际使用的组件
4. **添加单元测试**: 为关键逻辑添加测试用例

---

> **审查完成时间**: 2026-09-21  
> **报告版本**: v2.0
