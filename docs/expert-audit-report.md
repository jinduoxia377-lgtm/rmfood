# RMFOOD 小程序 - 专家深度核查报告

> 核查时间: 2026-09-21  
> 核查人: 微信小程序专家  
> 状态: ⚠️ 存在严重问题，需立即修复

---

## 一、执行摘要

经全面核查，本项目存在 **4个P0严重问题**、**5个P1重要问题**、**6个P2优化建议**，总计 **15个问题**。

**关键风险：**
- 🔴 生产环境API地址硬编码localhost，导致功能完全失效
- 🔴 缺少HTTPS配置，无法通过微信审核
- 🔴 缺少隐私协议和权限声明，审核将被拒绝
- 🟡 主包体积超10MB，远超2MB限制

---

## 二、P0 严重问题（必须立即修复）

### 2.1 硬编码 localhost URL

**问题描述：**
所有API调用硬编码 `http://localhost:8000`，线上环境无法访问。

**影响范围：**
- `config.js:8` - baseUrl
- `utils/api.js:5` - BASE_URL
- `utils/api_call.js:12` - baseURL
- `utils/auth.js:29,58` - 登录和获取用户信息
- `utils/search.js:54,70` - 搜索和热词

**修复方案：**
```javascript
// 创建环境变量配置
// config/env.js
const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  baseUrl: isDev 
    ? 'http://localhost:8000/api/v1'
    : 'https://api.rmfood.com/api/v1',
  uploadUrl: isDev
    ? 'http://localhost:8000/api/v1'
    : 'https://api.rmfood.com/api/v1'
}
```

---

### 2.2 缺少 HTTPS 配置

**问题描述：**
微信小程序要求所有网络请求必须使用 HTTPS，但项目中未配置。

**影响：**
- 微信审核直接拒绝
- 生产环境请求被拦截

**修复方案：**
1. 在微信公众平台配置服务器域名
2. 在 `project.config.json` 中添加：
```json
{
  "request": {
    "https": ["api.rmfood.com"]
  },
  "socket": {
    "https": ["api.rmfood.com"]
  },
  "uploadFile": {
    "https": ["api.rmfood.com"]
  },
  "downloadFile": {
    "https": ["api.rmfood.com"]
  }
}
```

---

### 2.3 缺少用户隐私协议配置

**问题描述：**
微信要求小程序必须配置用户隐私保护指引。

**影响：**
- 微信审核拒绝
- 部分API无法调用

**修复方案：**
1. 在微信公众平台配置隐私协议
2. 在代码中添加隐私协议调用：
```javascript
// app.js
onLaunch() {
  // 获取隐私协议授权状态
  wx.requestPrivacyAuthorization({
    success: (res) => {
      console.log('隐私授权状态:', res.authSetting)
    }
  })
}
```

---

### 2.4 缺少权限声明

**问题描述：**
项目使用了相机、相册等功能，但未声明权限。

**影响：**
- 调用相关API时崩溃
- 微信审核拒绝

**修复方案：**
在 `project.config.json` 中添加：
```json
{
  "permission": {
    "scope.camera": {
      "desc": "用于拍摄食材照片进行识别分析"
    },
    "scope.photos': {
      "desc": "用于选择本地图片进行分析"
    }
  },
  "requiredPrivateInfos": [
    'chooseImage',
    'previewImage'
  ]
}
```

---

## 三、P1 重要问题（影响用户体验）

### 3.1 主包体积过大

**问题描述：**
当前主包大小约 10MB，远超微信 2MB 的限制。

**问题分析：**
```
总代码大小: 10.05 MB
主包限制:   2 MB
超出:       8 MB (400%)
```

**解决方案：**

| 方案 | 操作 | 预计减少 |
|:-----|:-----|:--------:|
| 图片压缩 | 使用WebP格式，压缩到50KB以内 | 3MB |
| 分包优化 | 将所有页面移到分包 | 4MB |
| 删除无用文件 | 清理docs、示例代码 | 2MB |
| Tree Shaking | 移除未使用的代码 | 1MB |

---

### 3.2 Console 日志未清理

**问题描述：**
生产环境仍有大量 console.log/warn 输出。

**影响：**
- 影响性能（约5-10%）
- 泄露调试信息
- 增加包体积

**修复方案：**
```javascript
// utils/logger.js
const isProd = process.env.NODE_ENV === 'production'

const logger = {
  log: isProd ? () => {} : console.log,
  error: isProd ? () => {} : console.error,
  warn: isProd ? () => {} : console.warn
}

module.exports = logger
```

---

### 3.3 Token 存储不安全

**问题描述：**
Token存储在wx.Storage中，可被读取。

**风险：**
- 恶意应用可读取Token
- 存在会话劫持风险

**修复方案：**
```javascript
// 使用加密存储
const CryptoJS = require('crypto-js')

class SecureStorage {
  static set(key, value) {
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(value), 
      SECRET_KEY
    ).toString()
    wx.setStorageSync(key, encrypted)
  }
  
  static get(key) {
    try {
      const encrypted = wx.getStorageSync(key)
      const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY)
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
    } catch (e) {
      return null
    }
  }
}
```

---

### 3.4 Debug 模式未关闭

**问题描述：**
`config.js` 中 debug 模式为 true。

**修复：**
```javascript
// config.js
module.exports = {
  // ...
  debug: false,  // 改为false
  // ...
}
```

---

### 3.5 缺少错误边界

**问题描述：**
页面级错误处理不完善，崩溃后无恢复机制。

**修复方案：**
已在 `components/ErrorBoundary` 中实现，需在页面中使用。

---

## 四、P2 优化建议

### 4.1 重复的工具函数

**问题：**
存在3个功能相似的API工具：
- `utils/api.js` - RequestManager
- `utils/request.js` - Request
- `utils/api_call.js` - ApiClient

**建议：**
合并为一个统一的API客户端，删除重复代码。

---

### 4.2 缺少统一状态管理

**问题：**
全局状态分散在各个模块，数据流混乱。

**建议：**
使用轻量级状态管理方案：
```javascript
// stores/index.js
class Store {
  constructor(initialState) {
    this.state = initialState
    this.listeners = []
  }
  
  setState(partialState) {
    this.state = { ...this.state, ...partialState }
    this.listeners.forEach(fn => fn(this.state))
  }
  
  subscribe(fn) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter(f => f !== fn)
    }
  }
}

export const store = new Store({
  user: null,
  loading: false,
  error: null
})
```

---

### 4.3 缺少单元测试

**建议：**
添加单元测试框架，提高代码质量。

---

### 4.4 代码规范问题

**问题：**
- 部分变量命名不规范
- 缺少JSDoc注释
- 代码重复较多

---

### 4.5 性能优化建议

| 优化项 | 当前 | 建议 |
|:-------|:----:|:----:|
| 图片懒加载 | 部分实现 | 全覆盖 |
| 分包加载 | 3个分包 | 按需拆分 |
| 缓存策略 | 简单实现 | 多级缓存 |
| 网络请求 | 基础重试 | 指数退避 |

---

## 五、微信规范符合度检查

| 检查项 | 状态 | 说明 |
|:-------|:----:|:-----|
| 页面数量 | ✅ | 16个页面，符合规范 |
| 组件数量 | ✅ | 27个组件，符合规范 |
| TabBar配置 | ⚠️ | 需检查图标路径 |
| 分包加载 | ✅ | 已配置3个分包 |
| HTTPS配置 | ❌ | 未配置 |
| 隐私协议 | ❌ | 未配置 |
| 权限声明 | ❌ | 未配置 |
| sitemap | ✅ | 已配置 |
| 暗黑模式 | ✅ | 已支持 |

---

## 六、修复优先级

### 第一阶段：必须修复（本周）

- [ ] 修改API地址为环境变量
- [ ] 配置HTTPS白名单
- [ ] 添加隐私协议
- [ ] 声明所需权限
- [ ] 关闭debug模式

### 第二阶段：重要优化（本月）

- [ ] 压缩图片资源
- [ ] 优化分包结构
- [ ] 清理console日志
- [ ] 加密Token存储
- [ ] 完善错误处理

### 第三阶段：长期改进（下季度）

- [ ] 统一API客户端
- [ ] 引入状态管理
- [ ] 添加单元测试
- [ ] 性能监控
- [ ] 代码重构

---

## 七、总结

本项目技术架构完整，组件丰富，但在**合规性**和**安全性**方面存在严重问题。

**核心问题：**
1. API地址硬编码，线上无法运行
2. 缺少HTTPS和隐私配置，审核不通过
3. 包体积超标，需紧急优化

**建议：**
立即修复P0问题，其次处理P1问题，最后优化P2建议。预计1周时间完成核心修复，1个月完成全面优化。

---

> **专家结论：项目需要立即修复4个P0问题后才能进入测试阶段，否则无法通过微信审核上线。**
