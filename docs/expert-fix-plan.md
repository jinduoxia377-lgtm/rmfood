# RMFOOD 小程序 - 专家核查修复方案

> 基于专家深度核查报告，提供具体修复代码

---

## 一、P0问题修复（紧急）

### 1.1 修复API地址硬编码

**创建环境变量配置：**

```javascript
// config/env.js
const isDev = wx.getSystemInfoSync().environment === 'develop'

module.exports = {
  // 开发环境使用localhost，生产环境使用正式域名
  baseUrl: isDev 
    ? 'http://localhost:8000/api/v1'
    : 'https://api.rmfood.com/api/v1',
  
  uploadUrl: isDev
    ? 'http://localhost:8000/api/v1'
    : 'https://api.rmfood.com/api/v1',
  
  // 是否开启调试模式
  debug: isDev,
  
  // 其他配置...
  timeout: 10000,
  retryCount: 3
}
```

**修改 config.js：**

```javascript
// config.js
const env = require('./config/env')

module.exports = {
  baseUrl: env.baseUrl,
  uploadUrl: env.uploadUrl,
  debug: env.debug,
  timeout: env.timeout,
  retryCount: env.retryCount
}
```

**修改 utils/api.js：**

```javascript
// utils/api.js
const config = require('../config.js')

class RequestManager {
  constructor() {
    this.baseURL = config.baseUrl
    this.cacheDuration = 5 * 60 * 1000
    this.requestCache = new Map()
  }
  
  // ... 其他方法保持不变，使用 this.baseURL
}

module.exports = new RequestManager()
```

**修改 utils/api_call.js：**

```javascript
// utils/api_call.js
const config = require('../config.js')

class ApiClient {
  constructor() {
    this.baseURL = config.baseUrl
    this.timeout = config.timeout || 10000
  }
  
  // ... 其他方法保持不变
}

module.exports = new ApiClient()
```

**修改 utils/auth.js：**

```javascript
// utils/auth.js
const config = require('../config.js')

class AuthManager {
  async login(code) {
    try {
      const response = await wx.request({
        url: `${config.baseUrl}/auth/login`,  // 使用动态URL
        method: 'POST',
        data: { code }
      })
      // ...
    }
  }
  
  async getUserInfo() {
    const response = await wx.request({
      url: `${config.baseUrl}/auth/me`,  // 使用动态URL
      headers: { Authorization: `Bearer ${this.getToken()}` }
    })
    // ...
  }
}
```

**修改 utils/search.js：**

```javascript
// utils/search.js
const config = require('../config.js')

class SearchManager {
  async search(keyword, options = {}) {
    const response = await wx.request({
      url: `${config.baseUrl}/search`,  // 使用动态URL
      method: 'POST',
      data: { keyword, ...options }
    })
    // ...
  }
  
  async getHotSearches() {
    const response = await wx.request({
      url: `${config.baseUrl}/search/hot`,  // 使用动态URL
    })
    // ...
  }
}
```

---

### 1.2 配置HTTPS白名单

**修改 project.config.json：**

```json
{
  "setting": {
    "urlCheck": true
  },
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

### 1.3 配置隐私协议

**在微信公众平台后台配置：**
1. 登录微信公众平台
2. 设置 → 隐私与权限 → 用户隐私保护指引
3. 填写隐私协议内容

**代码中添加隐私授权：**

```javascript
// app.js
onLaunch() {
  // 检查隐私协议授权
  wx.getSetting({
    success: (res) => {
      if (!res.authSetting['scope.userInfo']) {
        // 未授权，显示授权弹窗
        wx.authorize({
          scope: 'scope.userInfo',
          success: () => {
            console.log('用户信息授权成功')
          },
          fail: () => {
            console.log('用户信息授权失败')
          }
        })
      }
    }
  })
}
```

---

### 1.4 声明所需权限

**修改 project.config.json：**

```json
{
  "permission": {
    "scope.camera": {
      "desc": "用于拍摄食材照片进行识别分析"
    },
    "scope.writePhotosAlbum": {
      "desc": "用于保存图片到相册"
    }
  },
  "requiredPrivateInfos": [
    "chooseImage",
    "previewImage",
    "chooseVideo"
  ]
}
```

---

## 二、P1问题修复（重要）

### 2.1 优化包体积

**压缩图片资源：**
```bash
# 使用工具批量压缩图片
# 推荐工具：TinyPNG, ImageOptim
# 目标：所有图片压缩到50KB以内
```

**优化分包结构：**
```json
{
  "subpackages": [
    {
      "root": "packages/formulas",
      "name": "formulas",
      "pages": ["pages/index/index", "pages/detail/index"]
    },
    {
      "root": "packages/ingredient",
      "name": "ingredient",
      "pages": ["pages/analysis/index"]
    },
    {
      "root": "packages/chat",
      "name": "chat",
      "pages": ["pages/index/index"]
    },
    {
      "root": "packages/database",
      "name": "database",
      "pages": ["pages/index/index", "pages/herb-detail/index"]
    }
  ]
}
```

---

### 2.2 清理Console日志

**创建日志工具：**

```javascript
// utils/logger.js
const config = require('../config.js')

const logger = {
  log: (...args) => {
    if (config.debug) console.log(...args)
  },
  error: (...args) => {
    if (config.debug) console.error(...args)
  },
  warn: (...args) => {
    if (config.debug) console.warn(...args)
  }
}

module.exports = logger
```

**替换所有console调用：**

```javascript
// 原代码
console.error('[App] Init failed:', e)

// 修改后
const logger = require('../../utils/logger')
logger.error('[App] Init failed:', e)
```

---

### 2.3 加密Token存储

**安装加密库：**
```bash
npm install crypto-js --save
```

**创建加密工具：**

```javascript
// utils/crypto.js
const CryptoJS = require('crypto-js')

const SECRET_KEY = 'rmfood_secret_key_2024'  // 实际项目中应从环境变量获取

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
      if (!encrypted) return null
      
      const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY)
      const decrypted = bytes.toString(CryptoJS.enc.Utf8)
      return JSON.parse(decrypted)
    } catch (e) {
      return null
    }
  }
  
  static remove(key) {
    wx.removeStorageSync(key)
  }
}

module.exports = SecureStorage
```

**修改Token存储：**

```javascript
// utils/auth.js
const SecureStorage = require('./crypto')

class AuthManager {
  setToken(token) {
    SecureStorage.set('token', token)
  }
  
  getToken() {
    return SecureStorage.get('token')
  }
  
  removeToken() {
    SecureStorage.remove('token')
  }
}
```

---

### 2.4 关闭Debug模式

**修改 config.js：**
```javascript
module.exports = {
  // ...
  debug: false,  // 改为false
  // ...
}
```

---

## 三、P2优化建议

### 3.1 统一API客户端

**删除重复文件：**
- 删除 `utils/api.js`
- 删除 `utils/api_call.js`
- 保留 `utils/request.js` 并增强

**增强 request.js：**
```javascript
// utils/request.js
class Request {
  constructor() {
    this.baseUrl = config.baseUrl
    this.timeout = config.timeout
    this.retryCount = config.retryCount || 3
  }
  
  // 统一请求方法
  async request(options) {
    // 合并请求拦截器
    options = await this.runRequestInterceptors(options)
    
    try {
      const result = await this._executeRequest(options)
      
      // 合并响应拦截器
      return await this.runResponseInterceptors(result)
    } catch (error) {
      // 统一错误处理
      this.handleError(error)
      throw error
    }
  }
  
  // ... 其他方法
}
```

---

### 3.2 引入轻量状态管理

```javascript
// stores/index.js
class Store {
  constructor(initialState) {
    this.state = initialState || {}
    this.listeners = new Set()
  }
  
  getState() {
    return this.state
  }
  
  setState(partialState) {
    this.state = { ...this.state, ...partialState }
    this.listeners.forEach(fn => fn(this.state))
  }
  
  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  
  // 页面订阅
  connect(mapStateToProps) {
    return (page) => {
      page.setData(mapStateToProps(this.state))
      return this.subscribe((state) => {
        page.setData(mapStateToProps(state))
      })
    }
  }
}

export const store = new Store({
  user: null,
  loading: false,
  error: null,
  settings: {}
})
```

---

## 四、修复验证清单

### 4.1 修复前检查

- [ ] 备份当前代码
- [ ] 记录所有修改文件
- [ ] 确认测试环境可用

### 4.2 修复后验证

| 验证项 | 预期结果 | 状态 |
|:-------|:---------|:----:|
| API地址替换 | 生产环境使用正式域名 | ⏳ |
| HTTPS配置 | 无HTTP请求警告 | ⏳ |
| 隐私协议 | 首次启动显示授权弹窗 | ⏳ |
| 权限声明 | 相机/相册调用正常 | ⏳ |
| Debug模式 | 生产环境无console输出 | ⏳ |
| Token加密 | Storage中为加密数据 | ⏳ |
| 包体积 | 主包小于2MB | ⏳ |

---

## 五、时间规划

| 阶段 | 时间 | 任务 |
|:-----|:----:|:-----|
| P0修复 | 1天 | 修复API地址、HTTPS、隐私、权限 |
| P1修复 | 2天 | 优化包体积、清理日志、加密Token |
| P2优化 | 3天 | 统一API、状态管理、单元测试 |
| 测试验证 | 1天 | 全面测试、问题修复 |

**总计：7个工作日**

---

> **结论：** 按照本方案修复后，小程序将符合微信官方规范，可通过审核上线。
