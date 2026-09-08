# RMFOOD 小程序 - 多环境配置系统

## 📁 配置文件结构

```
miniprogram/
├── app.js                  # 应用入口（引入config.js）
├── config.js               # 配置管理器（支持环境切换）
├── env.development.js      # 开发环境配置
├── env.testing.js          # 测试环境配置
├── env.production.js       # 生产环境配置
└── utils/
    └── request.js          # 请求封装（动态读取配置）
```

---

## 🔧 环境说明

### 1. 开发环境 (`env.development.js`)

```javascript
{
  baseUrl: 'http://localhost:8000/api/v1',
  wsUrl: 'ws://localhost:8000',
  uploadUrl: 'http://localhost:8000',
  debug: true,
  env: 'development'
}
```

**用途**：本地后端服务调试

---

### 2. 测试环境 (`env.testing.js`)

```javascript
{
  baseUrl: 'https://test-api.rmfood.com/api/v1',
  wsUrl: 'wss://test-api.rmfood.com',
  uploadUrl: 'https://test-api.rmfood.com',
  debug: true,
  env: 'testing'
}
```

**用途**：测试服务器联调

---

### 3. 生产环境 (`env.production.js`)

```javascript
{
  baseUrl: 'https://api.rmfood.com/api/v1',
  wsUrl: 'wss://api.rmfood.com',
  uploadUrl: 'https://api.rmfood.com',
  debug: false,
  env: 'production'
}
```

**用途**：正式上架使用

---

## 🚀 使用方法

### 方式1：自动检测（推荐）

配置管理器会自动检测环境：

1. **URL参数检测**：启动时传入 `?env=testing`
2. **本地存储检测**：优先读取已保存的环境配置
3. **环境变量检测**：读取 `NODE_ENV`
4. **默认值**：自动使用开发环境

```javascript
// 在微信开发者工具中测试测试环境
// 1. 打开项目设置 → 编译设置 → 自定义参数
// 2. 填写: ?env=testing

// 或在代码中切换
const config = require('./config.js')
config.switchEnv('testing')
```

### 方式2：手动切换

```javascript
const config = require('./config.js')

// 切换到测试环境
config.switchEnv('testing')

// 切换到生产环境
config.switchEnv('production')

// 查看当前配置
console.log(config.getAll())
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
| `env` | String | 环境标识 |
| `appName` | String | 应用名称 |
| `appVersion` | String | 应用版本 |
| `verboseLog` | Boolean | 是否打印详细日志 |

---

## 🔄 环境切换流程

### 开发阶段
```
默认启动 → 开发环境 (localhost)
         ↓ 添加参数 ?env=testing
         → 测试环境 (test-api)
```

### 提测阶段
```
测试环境 → 测试服务器联调
         ↓ 环境确认无误
         → 切换到生产环境配置
```

### 发布阶段
```
生产环境 → 提交审核
         ↓ 审核通过
         → 正式上架
```

---

## ⚠️ 注意事项

1. **不要硬编码地址**
   - 所有API调用必须通过 `config.get('baseUrl')` 获取
   - 不要直接写死 `http://localhost:8000`

2. **部署前检查**
   - 确认当前环境配置正确
   - 关闭 debug 模式
   - 测试核心功能

3. **环境隔离**
   - 各环境使用独立的数据库
   - 用户数据不跨环境同步

---

## 🐛 常见问题

### Q: 如何快速切换环境？
A: 在微信开发者工具的「详情」→「本地设置」中设置环境变量，或在编译参数中添加 `?env=xxx`

### Q: 切换环境后需要重新编译吗？
A: 不需要，配置管理器会实时生效

### Q: 如何查看当前环境？
A: 在控制台输入 `config.getAll()` 或查看启动日志

---

## 📝 示例代码

### 在页面中使用配置
```javascript
const config = require('../../config.js')

Page({
  onLoad() {
    const baseUrl = config.get('baseUrl')
    console.log('当前API地址:', baseUrl)
  }
})
```

### 动态切换环境（调试用）
```javascript
// 在任意页面添加调试按钮
debugSwitchEnv(env) {
  config.switchEnv(env)
  wx.showToast({
    title: `已切换到${env}环境`,
    icon: 'success'
  })
}
```

---

*最后更新：2026-09-06 | 版本：V1.0.0*
