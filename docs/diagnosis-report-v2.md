# 小程序配方列表获取失败诊断报告

> 诊断时间: 2026-09-23  
> 状态: 🔍 正在诊断中

---

## 一、问题现象

用户在微信小程序首页看到错误提示：
```
获取配方列表失败
```

---

## 二、已验证的事实

### 2.1 后端服务状态 ✅

| 检查项 | 结果 |
|:-------|:----:|
| 后端进程 | ✅ PID 11568 运行中 |
| 端口8000 | ✅ 正在监听 |
| 健康检查 | ✅ HTTP 200 |
| 配方API | ✅ 返回12条数据 |

### 2.2 API测试结果

```
✅ GET /api/v1/formulas?page=1&page_size=5 → 200 OK, 12条
✅ GET /api/v1/formulas?page=1&pageSize=10 → 200 OK, 12条
✅ GET /api/v1/formulas → 200 OK, 12条
❌ GET /api/v1/formulas?status=approved → 200 OK, 0条
❌ GET /api/v1/formulas?status=DRAFT → 500 ERROR
```

### 2.3 代码检查

| 文件 | 状态 |
|:-----|:----:|
| `config/env.js` | ✅ baseUrl 正确 |
| `utils/api.js` | ✅ API封装正确 |
| `utils/request.js` | ✅ 请求逻辑正确 |
| `pages/index/index.js` | ⚠️ 已添加调试日志 |

---

## 三、已添加的调试日志

### 3.1 request.js

```javascript
console.log('[Request] baseURL:', this.baseUrl)
console.log('[Request] fullUrl:', fullUrl)
console.log('[Request] method:', method)
// fail时输出
console.log('[Request] fail:', JSON.stringify(err))
```

### 3.2 api.js

```javascript
console.log('[API] 开始请求:', errorMsg)
console.log('[API] 请求成功:', errorMsg)
console.error('[API] 请求失败:', errorMsg, 'error:', JSON.stringify(error))
```

### 3.3 index.js

```javascript
console.log('[首页] 开始加载数据')
console.log('[首页] 调用api.formulas.getFormulas')
console.log('[首页] formulasRes:', JSON.stringify(formulasRes))
console.error('[首页] 错误详情:', JSON.stringify(e))
```

---

## 四、可能的原因分析

### 4.1 网络问题（最可能）

小程序运行在微信客户端中，可能存在以下网络问题：

1. **localhost无法访问**
   - 微信开发者工具的模拟器可能无法访问localhost
   - 真机测试时localhost完全无法访问
   
2. **CORS配置问题**
   - 虽然后端返回了正确的CORS头，但小程序可能有额外的限制

3. **微信域名白名单**
   - 小程序需要在后台配置合法域名
   - 开发工具可能跳过了这个检查

### 4.2 环境问题

```javascript
// env.js中的环境检测
const getEnv = () => {
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync().environment === 'develop') {
    return 'development'
  }
  return 'production'  // 如果检测失败，会指向生产环境
}
```

如果环境检测失败，会尝试连接 `https://api.rmfood.com`，这会导致失败。

### 4.3 请求超时

小程序的请求超时设置为10秒，如果网络慢可能会超时。

---

## 五、调试步骤

### 步骤1: 查看控制台日志

打开微信开发者工具的控制台，查找以下日志：
```
[Request] baseURL: ...
[Request] fullUrl: ...
[Request] fail: ...
[API] 请求失败: ...
[首页] 错误详情: ...
```

### 步骤2: 确认环境

检查控制台输出的 `baseURL` 是否是 `http://localhost:8000/api/v1`

### 步骤3: 手动测试

在控制台执行：
```javascript
wx.request({
  url: 'http://localhost:8000/api/v1/formulas?page=1&page_size=5',
  success: (res) => console.log('success:', res),
  fail: (err) => console.log('fail:', err)
})
```

---

## 六、解决方案建议

### 方案A: 确保使用开发环境

修改 `config/env.js`，强制使用开发环境：

```javascript
const getEnv = () => {
  // 强制使用开发环境
  return 'development'
}
```

### 方案B: 使用内网穿透

如果使用真机测试，需要：
1. 获取电脑的内网IP（如 `192.168.1.100`）
2. 修改baseUrl为 `http://192.168.1.100:8000/api/v1`
3. 确保手机和电脑在同一WiFi

### 方案C: 添加本地Mock数据

在API请求失败时使用Mock数据，确保页面可以正常显示：

```javascript
// 在api.js中添加fallback
async function safeRequest(apiFn, errorMsg = '请求失败') {
  try {
    return await apiFn()
  } catch (error) {
    console.warn('[API] 使用Mock数据:', errorMsg)
    return getMockData()  // 返回模拟数据
  }
}
```

---

## 七、下一步

请扫描二维码测试，并在微信开发者工具控制台中查看日志输出，然后告诉我：

1. `[Request] baseURL` 输出的是什么？
2. `[Request] fullUrl` 输出的是什么？
3. 是否有 `[Request] fail` 或 `[API] 请求失败` 的日志？
4. 错误详情是什么？

---

> **诊断时间**: 2026-09-23  
> **报告版本**: v2.0
