# 运行时错误修复报告

> 修复时间: 2026-09-21  
> 问题类型: 编译错误 + 运行时错误  
> 状态: ✅ 已修复

---

## 一、发现的问题

### 1.1 WXSS 编译错误

```
[WXSS 文件编译错误] ./components/Toast/index.wxss
(1:1): unexpected `�` at pos 1
```

**原因**: 22个WXSS文件包含BOM (Byte Order Mark) 字符，导致编译失败。

### 1.2 JavaScript 运行时错误

| 错误信息 | 文件 | 原因 |
|:---------|:-----|:-----|
| `getCacheManager is not a function` | `app.js:101` | `cache_manager.js` 导出格式不匹配 |
| `Cannot read properties of undefined (reading 'querySelectorAll')` | `app.js:126` | `image_lazy_loader.js` 使用了 DOM API |
| `getOfflineCacheManager is not a function` | `app.js:175` | `offline_cache.js` 导出格式不匹配 |

---

## 二、修复内容

### 2.1 移除 WXSS 文件 BOM

**修复文件数**: 22 个

| 组件/页面 | 文件路径 |
|:----------|:---------|
| Toast | components/Toast/index.wxss |
| Checkbox | components/Checkbox/index.wxss |
| Modal | components/Modal/index.wxss |
| Radio | components/Radio/index.wxss |
| Stepper | components/Stepper/index.wxss |
| Switch | components/Switch/index.wxss |
| Tabs | components/Tabs/index.wxss |
| 聊天页 | packages/chat/pages/index/index.wxss |
| 配方详情 | packages/formulas/pages/detail/index.wxss |
| 配方列表 | packages/formulas/pages/index/index.wxss |
| 配料分析 | packages/ingredient/pages/analysis/index.wxss |
| 协议页 | pages/agreement/index.wxss |
| 对比页 | pages/compare/index.wxss |
| 合规标准 | pages/compliance/index.wxss |
| 体质测试 | pages/constitution/index.wxss |
| 数据库 | pages/database/index.wxss |
| 药材详情 | pages/database/herb-detail/index.wxss |
| 图标展示 | pages/icon-showcase/index.wxss |
| 登录页 | pages/login/index.wxss |
| 隐私政策 | pages/privacy/index.wxss |
| 历史记录 | pages/profile/history/index.wxss |
| 测试页 | pages/test/index.wxss |

**修复方法**: 移除每个文件开头的 3 字节 BOM (`EF BB BF`)，确保纯 UTF-8 无 BOM 编码。

### 2.2 修复 cache_manager.js 导出格式

**原代码** (错误):
```javascript
module.exports = new CacheManager();
```

**修复后** (正确):
```javascript
module.exports = {
  getCacheManager: function() {
    return new CacheManager()
  },
  CacheManager: CacheManager
}
```

**原因**: `app.js` 使用解构导入 `const { getCacheManager } = require('./utils/cache_manager')`，需要导出对象格式。

### 2.3 修复 image_lazy_loader.js

**原代码** (错误):
```javascript
observeAllImages() {
  const images = document.querySelectorAll('image[data-src]')
  images.forEach(img => this.observeImage(img))
}
```

**修复后** (正确):
```javascript
init(page) {
  this._page = page
  // 小程序中没有 document.querySelectorAll
  // 需要在页面中手动注册图片节点
  console.log('[ImageLazyLoader] Initialized for page')
}

registerImage(imageNode) {
  if (!imageNode) return
  this._imageNodes.push(imageNode)
  // 使用小程序的 IntersectionObserver
  if (wx.createIntersectionObserver) {
    const observer = wx.createIntersectionObserver(this._page, {...})
    // ...
  }
}
```

**修改**:
1. 移除 `document.querySelectorAll` 调用（小程序不支持 DOM API）
2. 改用小程序原生 `wx.createIntersectionObserver`
3. 改为 CommonJS 导出格式
4. 使用 `wx.getImageInfo` 进行图片预加载

### 2.4 修复 offline_cache.js 导出格式

**原代码** (错误 - ES6 export):
```javascript
export function getOfflineCache() {
  if (!instance) {
    instance = new OfflineCache()
  }
  return instance
}
```

**修复后** (正确):
```javascript
module.exports = {
  getOfflineCacheManager: function() {
    if (!this._instance) {
      this._instance = new OfflineCache()
    }
    return this._instance
  },
  OfflineCache: OfflineCache
}
```

**原因**: 小程序不支持 ES6 `export/import`，必须使用 CommonJS `module.exports`。

---

## 三、微信小程序规范对照

### 3.1 支持的 API

| 功能 | 小程序 API | 原生 Web API |
|:-----|:-----------|:-------------|
|  Intersection Observer | `wx.createIntersectionObserver` | `IntersectionObserver` |
|  图片加载 | `wx.getImageInfo` | `new Image()` |
|  本地存储 | `wx.setStorageSync` | `localStorage` |
|  选择器 | 页面 `setData` 管理节点 | `document.querySelectorAll` |

### 3.2 禁止使用的 API

| 禁止的 API | 原因 |
|:-----------|:-----|
| `document.*` | 小程序无 DOM |
| `window.*` | 小程序无 window 对象 |
| `new Image()` | 不支持 HTML Image 对象 |
| `export/import` | 不支持 ES6 模块 |

### 3.3 文件编码规范

| 要求 | 说明 |
|:-----|:-----|
| ✅ UTF-8 无 BOM | 所有源代码文件必须使用 |
| ❌ UTF-8 with BOM | 禁止使用 |
| ❌ GBK/GB2312 | 禁止使用 |

---

## 四、验证结果

### 4.1 编译验证

```
✅ build-npm  耗时 4.6s
总包大小     900.0 KB (正常)

警告:
  weui-wxss entry file not found (无害，可忽略)

✅ 无编译错误
```

### 4.2 预览验证

```
✅ preview 二维码已生成
✅ 小程序可正常启动
```

### 4.3 运行时验证

| 检查项 | 状态 |
|:-------|:----:|
| 缓存管理器初始化 | ✅ 正常 |
| 图片懒加载初始化 | ✅ 正常 |
| 离线缓存初始化 | ✅ 正常 |
| WebSocket 连接 | ✅ 正常 |

---

## 五、文件修改清单

| 文件 | 修改内容 |
|:-----|:---------|
| `utils/cache_manager.js` | 修复导出格式为 CommonJS |
| `utils/image_lazy_loader.js` | 移除 DOM API，改用小程序 API |
| `utils/offline_cache.js` | 修复导出格式为 CommonJS |
| 22个 WXSS 文件 | 移除 BOM 字符 |

---

## 六、后续建议

1. **统一导出格式**: 所有工具类统一使用 CommonJS `module.exports`
2. **避免 DOM API**: 小程序开发中不使用任何 `document`/`window` API
3. **使用 Linter**: 配置 ESLint 规则检查 CommonJS 导出和小程序 API 使用
4. **编码检查**: 在 CI/CD 流程中添加文件编码检查

---

> **修复完成时间**: 2026-09-21  
> **报告版本**: v1.0
