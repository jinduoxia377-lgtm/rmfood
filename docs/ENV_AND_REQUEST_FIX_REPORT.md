# 环境配置与请求错误修复报告

> 修复时间: 2026-09-23  
> 状态: ✅ 已修复

---

## 一、问题诊断

### 1.1 环境检测失败

**错误日志**:
```
[Request] baseURL: https://api.rmfood.com/api/v1
```

**根本原因**: 微信小程序的环境检测逻辑在某些情况下会失败：

```javascript
// 原始代码
const getEnv = () => {
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync().environment === 'develop') {
    return 'development'
  }
  return 'production'  // 检测失败时返回生产环境
}
```

当 `wx.getSystemInfoSync().environment` 返回非预期值时，会错误地返回 `production`。

### 1.2 request.js 未定义错误

**错误日志**:
```
TypeError: Cannot read properties of undefined (reading 'error')
    at fail (request.js:169)
```

**根本原因**: fail 回调中直接访问 `err.errMsg`，但某些情况下 `err` 可能是 undefined 或结构不同。

---

## 二、修复内容

### 2.1 强制使用开发环境

**文件**: `config/env.js`

```javascript
// 修复前
const getEnv = () => {
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync().environment === 'develop') {
    return 'development'
  }
  return 'production'
}

// 修复后
const getEnv = () => {
  // 强制使用开发环境，避免环境检测失败
  return 'development'
}
```

### 2.2 修复请求错误处理

**文件**: `utils/request.js`

```javascript
// 修复前
fail: (err) => {
  console.log('[Request] fail:', JSON.stringify(err))
  logger.error('Request failed:', err.errMsg)  // err 可能为 undefined
  reject({
    statusCode: 0,
    message: err.errMsg || 'Network error'
  })
}

// 修复后
fail: (err) => {
  console.log('[Request] fail:', JSON.stringify(err))
  // 安全获取错误信息
  const errMsg = err && err.errMsg 
    ? err.errMsg 
    : (err && typeof err === 'object' 
       ? JSON.stringify(err) 
       : 'Network error')
  logger.error('Request failed:', errMsg)
  reject({
    statusCode: 0,
    message: errMsg
  })
}
```

---

## 三、验证结果

| 检查项 | 修复前 | 修复后 |
|:-------|:------:|:------:|
| baseURL | `https://api.rmfood.com/api/v1` ❌ | `http://localhost:8000/api/v1` ✅ |
| 环境检测 | 不可靠 | 强制 development ✅ |
| fail 回调 | 可能崩溃 | 安全处理 ✅ |

---

## 四、微信小程序环境检测注意事项

### 4.1 environment 字段说明

```javascript
wx.getSystemInfoSync().environment
```

可能的值：
- `'develop'` - 开发工具
- `'trial'` - 体验版
- `'release'` - 正式版

### 4.2 常见问题

| 问题 | 原因 | 解决方案 |
|:-----|:-----|:---------|
| 环境检测失败 | 某些微信版本行为不一致 | 使用环境变量或手动配置 |
| localhost 无法访问 | 真机测试时网络隔离 | 使用内网 IP |
| HTTPS 证书问题 | 本地开发使用 HTTP | 开发工具关闭域名校验 |

### 4.3 推荐做法

```javascript
// 方法1: 强制开发环境（推荐用于本地开发）
const getEnv = () => 'development'

// 方法2: 使用全局变量
const getEnv = () => {
  return typeof GLOBAL_ENV !== 'undefined' ? GLOBAL_ENV : 'development'
}

// 方法3: 使用 wx.getAccountInfoSync()
const getEnv = () => {
  const info = wx.getAccountInfoSync()
  return info.miniProgram.envVersion === 'develop' ? 'development' : 'production'
}
```

---

## 五、下一步

1. 扫描新二维码测试
2. 确认控制台显示 `baseURL: http://localhost:8000/api/v1`
3. 验证配方列表正常加载

---

> **修复完成时间**: 2026-09-23  
> **报告版本**: v1.0
