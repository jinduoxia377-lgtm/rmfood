# RMFOOD 小程序配置变更日志

## V1.0.0 (2026-09-06)

### 新增配置

1. **环境配置文件** `env.js`
   - API基础地址配置
   - WebSocket地址配置
   - 文件上传地址配置
   - 调试模式开关
   - Mock数据开关

2. **全局配置** `app.js`
   - 引入 env.js 配置
   - globalData 统一管理
   - 启动时打印配置（调试模式）

3. **请求封装** `utils/request.js`
   - 支持 baseUrl 动态读取
   - 上传接口使用 uploadUrl

### 修改记录

- `app.js`: 添加 env.js 引入和 globalData 配置
- `request.js`: 上传接口改用 uploadUrl
- `project.config.json`: 更新 AppID

---

*最后更新：2026-09-06*
