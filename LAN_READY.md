# 🎉 RMFOOD 配方平台 - 局域网部署完成

## ✅ 部署状态：已就绪

系统已完全配置为支持局域网访问。所有用户可以通过多种 IP 地址访问该项目。

---

## 🌍 网络配置概览

### 可用的访问地址

| IP 地址 | 用途 | 前端 | 后端 | API 文档 |
|---------|------|------|------|---------|
| **192.168.137.1** | **主 IP（推荐）** | :3001 | :8000 | :8000/docs |
| 172.28.128.1 | Docker 网络 1 | :3001 | :8000 | :8000/docs |
| 172.31.80.1 | Docker 网络 2 | :3001 | :8000 | :8000/docs |
| 172.20.3.122 | Docker 网络 3 | :3001 | :8000 | :8000/docs |
| localhost | 本地访问 | :3001 | :8000 | :8000/docs |

---

## 🚀 立即开始使用

### 方式 1：推荐访问方式

**在任何设备上打开浏览器，访问以下地址：**

```
前端应用：http://192.168.137.1:3001
```

### 方式 2：查看 API 文档

```
API 文档：http://192.168.137.1:8000/docs
```

### 方式 3：测试后端 API

```bash
# 获取 API 信息
curl http://192.168.137.1:8000/api/v1

# 查看健康状态
curl http://192.168.137.1:8000/health
```

---

## 📱 不同设备的访问方式

### 同一电脑上

```
浏览器输入：http://localhost:3001
或：http://127.0.0.1:3001
```

### 同一 WiFi 下的其他设备

```
iPhone/iPad：http://192.168.137.1:3001
Android 手机：http://192.168.137.1:3001
其他电脑：http://192.168.137.1:3001
```

### 外网/VPN 访问

```
使用对应的 VPN 分配 IP 或公网 IP
配置防火墙允许访问
使用 HTTPS（推荐）
```

---

## 📋 当前服务状态

### ✅ 前端服务
- **状态**：运行中 ✓
- **框架**：React + Vite
- **端口**：3001（自动选择，3000 被占用）
- **访问**：http://192.168.137.1:3001
- **特性**：热模块替换 (HMR)、实时开发

### ✅ 后端服务
- **状态**：运行中 ✓
- **框架**：FastAPI + Uvicorn
- **端口**：8000
- **访问**：http://192.168.137.1:8000
- **特性**：异步支持、自动 API 文档、WebSocket 支持

### ✅ 数据库服务
- **状态**：运行中 ✓
- **类型**：PostgreSQL 16
- **端口**：5432
- **数据**：本地持久化存储

### ✅ 缓存服务
- **状态**：运行中 ✓
- **类型**：Redis 7
- **端口**：6380
- **用途**：会话、缓存、队列

---

## 🔧 配置信息

### 环境变量

```env
# 前端 API 地址（已配置为主 IP）
VITE_API_BASE_URL=http://192.168.137.1:8000/api

# 后端 CORS 允许列表（已配置多个 IP）
CORS_ORIGINS=http://localhost:3000,http://192.168.137.1:3000,...

# 数据库（使用容器内部地址）
DATABASE_URL=postgresql+asyncpg://rmfood:password@postgres:5432/rmfood_db

# Redis（使用容器内部地址）
REDIS_URL=redis://redis:6379/0
```

### 文件配置

| 文件 | 用途 | 位置 |
|------|------|------|
| docker-compose.lan.yml | 局域网编排配置 | 项目根目录 |
| nginx-lan.conf | Nginx 反向代理 | docker/nginx/ |
| lan-config.ts | 前端动态配置 | frontend/src/config/ |
| .env | 环境变量 | 项目根目录 |

---

## 🎯 典型使用场景

### 1️⃣ 单个开发者本地开发

```
步骤：
1. 打开浏览器
2. 访问 http://localhost:3001
3. 开始开发和测试
```

### 2️⃣ 团队协作开发

```
步骤：
1. 中心开发机运行服务
2. 其他成员在各自设备访问
3. 地址：http://192.168.137.1:3001
4. 共享同一个后端和数据库
```

### 3️⃣ 跨设备测试

```
步骤：
1. 启动本服务（Windows/Mac/Linux）
2. 在手机/平板/其他电脑上访问
3. 测试响应式设计
4. 验证多设备兼容性
```

### 4️⃣ 客户演示

```
步骤：
1. 在演示电脑上运行服务
2. 连接投影仪或大屏幕
3. 其他人从手机/平板访问
4. 实时互动演示应用功能
```

### 5️⃣ 远程访问（通过 VPN）

```
步骤：
1. 员工连接公司 VPN
2. 获取 VPN 内部 IP
3. 使用 VPN IP 访问
4. 享受本地速度和安全
```

---

## 🛠️ 快速命令

### 启动所有服务

```bash
# 使用启动脚本（Windows）
start-lan.bat

# 或手动启动
docker-compose -f docker-compose.lan.yml up -d

# 或本地启动（开发模式）
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
cd frontend && npm run dev -- --host 0.0.0.0 --port 3000
```

### 停止所有服务

```bash
# 使用停止脚本（Windows）
stop-lan.bat

# 或手动停止
docker-compose -f docker-compose.lan.yml down

# 或按 Ctrl+C 停止手动启动的服务
```

### 查看服务状态

```bash
# Docker 状态
docker-compose -f docker-compose.lan.yml ps

# Windows 查询端口占用
netstat -ano | findstr ":8000"
netstat -ano | findstr ":3001"

# 查询进程
Get-Process | Where-Object {$_.ProcessName -match "python|node"}
```

### 查看日志

```bash
# 后端日志
docker-compose -f docker-compose.lan.yml logs -f backend

# 前端日志（Vite 输出）
# 在前端窗口查看实时输出

# 数据库日志
docker-compose -f docker-compose.lan.yml logs -f postgres
```

---

## 🔒 安全建议

### 局域网内已配置的安全措施

✅ CORS 跨域防护  
✅ 速率限制中间件  
✅ 输入验证和 XSS 防护  
✅ JWT 认证机制  
✅ SQL 参数化查询  

### 如果要暴露到互联网

⚠️ 配置 SSL/TLS 证书（HTTPS）  
⚠️ 启用防火墙规则  
⚠️ 配置 API 密钥认证  
⚠️ 使用 VPN 隧道  
⚠️ 启用审计日志  
⚠️ 定期安全更新  

---

## 📞 故障排除

### 问题：无法访问前端

**原因可能**：
- Vite 服务未启动
- 端口被占用
- 防火墙阻止

**解决方案**：
```bash
# 查看是否运行
netstat -ano | findstr ":3001"

# 强制停止占用进程
taskkill /F /PID <PID>

# 重新启动
npm run dev -- --host 0.0.0.0 --port 3000
```

### 问题：后端 API 无法连接

**原因可能**：
- FastAPI 服务未启动
- 8000 端口被占用
- 数据库未启动

**解决方案**：
```bash
# 检查后端进程
Get-Process | Where-Object {$_.ProcessName -eq "python"}

# 查看是否监听 8000
netstat -ano | findstr ":8000"

# 重新启动
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 问题：其他设备无法连接

**原因可能**：
- 不在同一网络
- IP 地址错误
- 防火墙阻止

**解决方案**：
```bash
# 确认本机 IP
ipconfig | findstr "IPv4"

# 检查 ping 连接
ping 192.168.137.1

# 检查防火墙
# Windows：控制面板 > Windows Defender 防火墙 > 允许应用通过防火墙
```

### 问题：前端显示"无法连接到后端"

**原因可能**：
- API 地址配置错误
- CORS 未正确配置
- 后端服务异常

**解决方案**：
```javascript
// 在浏览器控制台查看
console.log('API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)

// 测试 API 连接
fetch('http://192.168.137.1:8000/api/v1')
  .then(r => r.json())
  .then(d => console.log('API OK:', d))
```

---

## 📊 性能信息

### 预期性能

| 指标 | 值 |
|------|-----|
| 前端首屏加载 | < 2s |
| API 响应时间 | < 100ms |
| 数据库查询 | < 500ms |
| 支持并发用户 | 100-500+ |

### 监控方式

```bash
# 实时查看 Docker 资源使用
docker stats

# 查看系统资源
tasklist /v

# 浏览器开发者工具
# F12 查看网络、性能、控制台
```

---

## 🎓 学习和文档

### 相关文档

- [LAN_DEPLOYMENT.md](./LAN_DEPLOYMENT.md) - 详细的局域网部署指南
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - 生产环境部署
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - 部署就绪评估

### 技术栈文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [React 文档](https://react.dev/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [Redis 文档](https://redis.io/documentation)
- [Docker 文档](https://docs.docker.com/)

---

## ✨ 总结

🎉 **RMFOOD 配方平台已完全配置用于局域网部署**

**您可以立即**：
- ✅ 在本地开发和测试
- ✅ 与团队成员共享服务
- ✅ 在多设备上进行跨平台测试
- ✅ 向客户进行现场演示
- ✅ 通过 VPN 进行远程访问

**推荐访问方式**：
- 📱 打开浏览器
- 🌐 访问 http://192.168.137.1:3001
- 🚀 开始使用应用

---

**配置完成**：2024-06-18  
**系统状态**：✅ 局域网就绪  
**服务状态**：✅ 全部运行中  
**支持 IP**：4+ 个地址同时访问  

**立即访问：http://192.168.137.1:3001** 🚀
