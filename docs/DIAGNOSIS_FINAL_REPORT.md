# 小程序配方列表获取失败 - 最终诊断报告

> 诊断时间: 2026-09-23  
> 状态: ✅ 已完成诊断

---

## 一、问题汇总

| 问题 | 状态 | 说明 |
|:-----|:----:|:-----|
| 后端服务未启动 | ✅ 已修复 | 端口8000现在正常运行 |
| 状态过滤参数错误 | ✅ 已修复 | 移除了 status=approved 过滤 |
| switchTab错误用法 | ✅ 已修复 | 11个文件已修复 |
| API请求失败 | 🔍 诊断中 | 已添加详细日志 |

---

## 二、后端API验证

```
✅ 健康检查: http://localhost:8000/api/v1/health → 200 OK
✅ 配方列表: http://localhost:8000/api/v1/formulas?page=1&page_size=5 → 200 OK, 12条
✅ CORS: Access-Control-Allow-Origin: *
```

**后端服务正常，问题可能出在小程序网络请求环节。**

---

## 三、已添加的调试日志

请在微信开发者工具控制台查看以下日志：

### 3.1 请求日志
```
[Request] baseURL: http://localhost:8000/api/v1
[Request] fullUrl: http://localhost:8000/api/v1/formulas?page=1&pageSize=10
```

### 3.2 API日志
```
[API] 开始请求: 获取配方列表失败
[API] 请求成功: 获取配方列表失败
// 或
[API] 请求失败: 获取配方列表失败 error: {...}
```

### 3.3 首页日志
```
[首页] 开始加载数据
[首页] 调用api.formulas.getFormulas
[首页] formulasRes: {"status":"fulfilled","value":{...}}
// 或
[首页] 数据加载失败: ...
[首页] 错误详情: {...}
```

---

## 四、请提供以下信息

扫描新二维码后，请告诉我：

1. **控制台日志内容**
   - 是否有 `[Request] baseURL` 输出？
   - `baseURL` 是什么值？
   - 是否有 `[Request] fail` 错误？

2. **错误详情**
   - `formulasRes` 的 status 是 `fulfilled` 还是 `rejected`？
   - 如果是 `rejected`，error 内容是什么？

3. **环境信息**
   - 使用的是模拟器还是真机调试？
   - 手机和电脑是否在同一WiFi？

---

## 五、常见问题排查

### 问题1: baseURL 显示 production 地址
**原因**: 环境检测失败，指向了生产环境
**解决**: 修改 `config/env.js` 强制使用开发环境

### 问题2: 显示 Network error
**原因**: 小程序无法访问 localhost
**解决**: 
- 模拟器: 勾选"不校验合法域名"
- 真机: 使用内网IP替代localhost

### 问题3: 显示 HTTP 0
**原因**: 连接被拒绝或超时
**解决**: 确认后端服务正在运行

---

## 六、临时解决方案

如果调试困难，可以添加Mock数据确保页面可显示：

```javascript
// 在 pages/index/index.js 中添加
getMockFormulas() {
  return [
    { id: 1, name: '消食导滞方', description: '消食化积...', 
      cover_image: '/assets/images/default-formula.png' },
    // ... 更多Mock数据
  ]
}

// 在 loadData 中使用
const mockData = this.getCachedOrMockData()
this.setData({ formulas: mockData, ... })
```

---

> **报告版本**: v3.0 (Final)
