# URLSearchParams 兼容性修复报告

> 修复时间: 2026-09-23  
> 问题: 微信小程序环境不支持 URLSearchParams  
> 状态: ✅ 已修复

---

## 一、问题诊断

### 1.1 错误现象

```
ReferenceError: URLSearchParams is not defined
    at api.js:174
```

### 1.2 根本原因

微信小程序的 JavaScript 运行环境与浏览器不同，**不支持 `URLSearchParams` API**。

虽然小程序支持大部分 ES6 特性，但某些 Web API（如 `URLSearchParams`、`fetch` 等）在小程序环境中不可用。

---

## 二、受影响的功能

| 功能 | 状态 | 说明 |
|:-----|:----:|:-----|
| 获取配方列表 | ❌ | 使用 URLSearchParams 构建查询参数 |
| 搜索中药材 | ❌ | 使用 URLSearchParams 构建查询参数 |
| 搜索活性肽 | ❌ | 使用 URLSearchParams 构建查询参数 |
| 获取GB2760数据 | ❌ | 使用 URLSearchParams 构建查询参数 |
| 获取GB14880数据 | ❌ | 使用 URLSearchParams 构建查询参数 |

---

## 三、修复方案

### 3.1 添加兼容函数

在 `utils/api.js` 中添加 `buildQueryString` 函数：

```javascript
/**
 * 构建查询字符串（兼容小程序环境，不使用URLSearchParams）
 */
function buildQueryString(params) {
  if (!params || Object.keys(params).length === 0) return ''
  return Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}
```

### 3.2 替换所有调用

将 6 处 `new URLSearchParams(params).toString()` 替换为 `buildQueryString(params)`

---

## 四、修改文件

### 4.1 utils/api.js

| 行号 | 修改前 | 修改后 |
|:-----|:-------|:-------|
| 174 | `new URLSearchParams(params).toString()` | `buildQueryString(params)` |
| 274 | `new URLSearchParams(params).toString()` | `buildQueryString(params)` |
| 293 | `new URLSearchParams(params).toString()` | `buildQueryString(params)` |
| 382 | `new URLSearchParams(params).toString()` | `buildQueryString(params)` |
| 392 | `new URLSearchParams(params).toString()` | `buildQueryString(params)` |

---

## 五、验证结果

### 5.1 编译验证

```
✅ 编译成功
✅ 无 URLSearchParams 引用
✅ buildQueryString 函数已添加
```

### 5.2 功能验证

测试以下功能是否正常：
- [ ] 首页配方列表加载
- [ ] 搜索中药材
- [ ] 搜索活性肽
- [ ] 合规标准查询

---

## 六、微信小程序兼容性注意事项

### 6.1 不可用的 Web API

以下 API 在微信小程序环境中**不可用**：

| API | 替代方案 |
|:---|:----------|
| `URLSearchParams` | 手动构建查询字符串 |
| `fetch` | 使用 `wx.request` |
| `localStorage` | 使用 `wx.setStorageSync` |
| `document` | 使用小程序 DOM API |
| `window` | 使用 `wx.getWindowInfo` |
| `console.log` (部分格式) | 使用基础类型输出 |

### 6.2 可用的 ES6 特性

以下 ES6 特性在小程序中**可用**：

- `const` / `let`
- 箭头函数
- 模板字符串
- 展开运算符 `...`
- `Promise`
- `async` / `await`
- `Map` / `Set`
- `Object.keys` / `Object.values`

---

## 七、后续建议

1. **代码审查**: 检查其他文件是否也有类似的 Web API 使用
2. **测试覆盖**: 在真机上测试所有API功能
3. **错误处理**: 添加更详细的错误信息便于调试
4. **兼容性检查**: 使用小程序官方兼容性检测工具

---

> **修复完成时间**: 2026-09-23  
> **报告版本**: v1.0
