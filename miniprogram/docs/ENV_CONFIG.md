# RMFOOD 小程序环境配置指南

## 📁 配置文件位置

```
miniprogram/
├── app.js              # 应用入口（引入env配置）
├── env.js              # 默认环境配置（开发环境）
├── utils/
│   └── request.js      # 请求封装（使用全局配置）
```

---

## 🔧 配置说明

### 1. 修改 API 地址

编辑 `miniprogram/env.js`，修改 `baseUrl`：

```javascript
// 开发环境（本地后端）
module.exports = {
  baseUrl: 'http://localhost:8000/api/v1',
  wsUrl: 'ws://localhost:8000',
  uploadUrl: 'http://localhost:8000',
  debug: true
}

// 生产环境（远程服务器）
// module.exports = {
//   baseUrl: 'https://api.rmfood.com/api/v1',
//   wsUrl: 'wss://api.rmfood.com',
//   uploadUrl: 'https://api.rmfood.com',
//   debug: false
// }
```

### 2. 多环境配置（可选）

创建不同的环境配置文件：

```
miniprogram/
├── env.js              # 默认（开发环境）
├── env.development.js  # 开发环境
├── env.testing.js      # 测试环境
└── env.production.js   # 生产环境
```

然后在 `app.js` 中动态加载：

```javascript
const env = require(`./env.${process.env.NODE_ENV || 'development'}.js`)
```

---

## 🚀 环境切换方法

### 方法1：直接修改 env.js（推荐）

开发阶段保持 `http://localhost:8000/api/v1`

部署时改为：
```javascript
baseUrl: 'https://api.rmfood.com/api/v1'
```

### 方法2：使用环境变量

在微信开发者工具中：

1. 点击「详情」→「本地设置」
2. 添加环境变量：
   - `NODE_ENV` = `production`

3. 修改 `app.js`：
```javascript
const env = require(`./env.${process.env.NODE_ENV || 'development'}.js`)
```

---

## 📋 配置项说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `baseUrl` | String | API基础地址 |
| `wsUrl` | String | WebSocket地址（AI对话） |
| `uploadUrl` | String | 文件上传地址 |
| `debug` | Boolean | 是否启用调试模式 |
| `mockEnabled` | Boolean | 是否启用Mock数据 |
| `env` | String | 环境标识（development/testing/production） |
| `appName` | String | 应用名称 |
| `appVersion` | String | 应用版本 |

---

## 🔍 查看当前配置

在开发者工具控制台输入：

```javascript
// 查看全局配置
console.log(getApp().globalData)

// 查看环境配置
console.log(require('./env.js'))
```

---

## ⚠️ 注意事项

1. **不要提交敏感信息**
   - AppSecret 不要写入代码
   - 生产环境地址使用环境变量管理

2. **部署前检查**
   - 确认 baseUrl 已修改为生产地址
   - 关闭 debug 模式
   - 测试核心功能是否正常

3. **调试技巧**
   - 开启 `debug: true` 可在控制台查看详细日志
   - 开启 `mockEnabled: true` 可本地测试无需后端

---

## 📝 示例：完整配置流程

### 开发阶段
```javascript
// env.js
module.exports = {
  baseUrl: 'http://localhost:8000/api/v1',
  wsUrl: 'ws://localhost:8000',
  uploadUrl: 'http://localhost:8000',
  debug: true,
  mockEnabled: false,
  env: 'development'
}
```

### 测试阶段
```javascript
// env.testing.js
module.exports = {
  baseUrl: 'https://test-api.rmfood.com/api/v1',
  wsUrl: 'wss://test-api.rmfood.com',
  uploadUrl: 'https://test-api.rmfood.com',
  debug: true,
  mockEnabled: false,
  env: 'testing'
}
```

### 生产阶段
```javascript
// env.production.js
module.exports = {
  baseUrl: 'https://api.rmfood.com/api/v1',
  wsUrl: 'wss://api.rmfood.com',
  uploadUrl: 'https://api.rmfood.com',
  debug: false,
  mockEnabled: false,
  env: 'production'
}
```

---

*最后更新：2026-09-06 | 版本：V1.0.0*
