# 🌐 RMFOOD 配方平台 - 局域网部署指南

## ✅ 局域网访问已配置完成！

### 📍 本机 IP 地址

系统检测到以下可用的 IP 地址：

| 网络类型 | IP 地址 | 说明 |
|---------|---------|------|
| Docker Bridge | 172.28.128.1 | WSL/Docker 内部网络 |
| Docker Bridge | 172.31.80.1 | WSL/Docker 内部网络 |
| Docker Bridge | 172.20.3.122 | WSL/Docker 内部网络 |
| **主要网络** | **192.168.137.1** | **局域网主 IP（推荐）** |

---

## 🚀 快速访问

### 推荐访问地址（使用主 IP）

| 应用 | URL | 说明 |
|------|-----|------|
| **前端应用** | http://192.168.137.1:3001 | 用户界面（Vite 开发服务器）|
| **后端 API** | http://192.168.137.1:8000 | REST API 服务 |
| **API 文档** | http://192.168.137.1:8000/docs | Swagger UI 文档 |
| **API 根端点** | http://192.168.137.1:8000/api/v1 | API 基地址 |
| **健康检查** | http://192.168.137.1:8000/health | 服务健康状态 |

### 备用访问地址（所有 IP）

**使用其他 IP 地址访问**：
- http://172.28.128.1:3001 (前端)
- http://172.28.128.1:8000 (后端)
- http://172.31.80.1:3001 (前端)
- http://172.31.80.1:8000 (后端)
- http://172.20.3.122:3001 (前端)
- http://172.20.3.122:8000 (后端)

---

## 📱 在局域网中的其他设备上访问

### 步骤 1：确认网络连接

```bash
# Windows 中查看本机 IP
ipconfig

# Linux/Mac 中查看本机 IP
ifconfig
# 或
ip addr show
```

### 步骤 2：在其他设备上访问

**同局域网设备**（如同 WiFi 中的手机、平板、其他电脑）：

1. 打开浏览器
2. 输入主 IP 地址：`http://192.168.137.1:3001`
3. 或其他可用 IP

### 步骤 3：在 VPN 环境中访问

如果在 VPN 中，使用对应的 VPN 内部 IP 地址访问

---

## 🔧 部署配置详情

### 环境变量配置

```env
# 前端 API 地址
VITE_API_BASE_URL=http://192.168.137.1:8000/api

# 后端 CORS 跨域允许列表
CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://192.168.137.1:3000,http://172.28.128.1:3000,http://172.31.80.1:3000,http://172.20.3.122:3000

# 其他配置...
```

### 支持的网络访问方式

✅ **本地访问**：
- `http://localhost:3001` (前端)
- `http://127.0.0.1:8000` (后端)

✅ **局域网访问**：
- `http://192.168.137.1:3001` (主 IP)
- `http://172.28.128.1:3001` (备用 IP)
- 等其他 IP 地址

✅ **跨网络访问**：
- 支持多 IP 地址并发访问
- 自动 CORS 跨域处理

---

## 📊 当前服务状态

### 前端服务

```
✅ 状态：运行中 (Vite 开发服务器)
📍 地址：0.0.0.0:3001
🌐 网络：开放给所有本地网络接口
⚡ 性能：HMR (热模块替换) 已启用
```

### 后端服务

```
✅ 状态：运行中 (FastAPI + Uvicorn)
📍 地址：0.0.0.0:8000
🌐 网络：开放给所有本地网络接口
🔗 CORS：多 IP 跨域已配置
```

### 数据库服务

```
✅ 状态：运行中 (PostgreSQL 16)
📍 地址：localhost:5432
💾 数据：持久化存储
🔐 用户：rmfood (密码已配置)
```

### 缓存服务

```
✅ 状态：运行中 (Redis 7)
📍 地址：localhost:6380
⚡ 性能：内存缓存
🔒 安全：本地访问
```

---

## 🧪 测试局域网连接

### 测试后端 API

```bash
# 查看 API 信息
curl http://192.168.137.1:8000/api/v1

# 查看健康状态
curl http://192.168.137.1:8000/health

# 查看 API 文档
# 浏览器打开：http://192.168.137.1:8000/docs
```

### 测试前端应用

```bash
# 使用 curl 检查前端
curl http://192.168.137.1:3001

# 或在浏览器中打开
# http://192.168.137.1:3001
```

### 使用 PowerShell 测试（Windows）

```powershell
# 测试后端
(Invoke-WebRequest -Uri http://192.168.137.1:8000/api/v1).StatusCode

# 测试前端
(Invoke-WebRequest -Uri http://192.168.137.1:3001).StatusCode

# 测试健康状态
(Invoke-WebRequest -Uri http://192.168.137.1:8000/health).StatusCode
```

---

## 🛡️ 局域网安全建议

### 已启用的安全功能

✅ **CORS 防护**
- 仅允许配置的源访问 API
- 前端和后端分离

✅ **速率限制**
- API 速率限制中间件已实现
- 防止滥用

✅ **输入验证**
- Pydantic 自动验证请求
- XSS 和 SQL 注入防护

✅ **认证机制**
- JWT Token 验证
- 会话管理

### 建议的额外安全措施

⚠️ **如果要在互联网中部署**：
1. 配置 SSL/HTTPS 证书
2. 启用防火墙规则
3. 使用 VPN 访问
4. 配置 API 密钥认证
5. 启用审计日志

---

## 📋 常见问题

### Q1：为什么前端在 3001 而不是 3000？

**A**：3000 端口已被占用，Vite 自动使用 3001。这是正常的开发行为。

### Q2：我在另一台电脑上访问不了？

**A**：检查以下几点：
1. 两台电脑是否在同一局域网
2. 防火墙是否阻止了访问
3. 是否使用了正确的 IP 地址
4. 后端服务是否在运行

### Q3：如何从手机访问？

**A**：
1. 手机连接到同一 WiFi
2. 在浏览器中输入：`http://192.168.137.1:3001`
3. 或 `http://192.168.137.1:8000/docs`（查看 API）

### Q4：如何改变访问端口？

**A**：在启动前设置环境变量：
```bash
# 改变前端端口为 5000
# 改变后端端口为 9000
# 修改 docker-compose.lan.yml 中的 ports 配置
```

### Q5：如何在 VPN 中访问？

**A**：
1. 确保 VPN 已连接
2. 使用 VPN 分配的 IP 地址
3. 或使用 `localhost` 加本地 IP 的组合

---

## 🔄 启动/停止服务

### 启动所有服务

```bash
# 方式 1：使用 Docker Compose（推荐用于生产）
docker-compose -f docker-compose.lan.yml up -d

# 方式 2：手动启动（开发模式）
# 后端
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 前端（新终端）
cd frontend
npm run dev -- --host 0.0.0.0 --port 3000
```

### 停止所有服务

```bash
# 使用 Docker Compose
docker-compose -f docker-compose.lan.yml down

# 或手动停止（Ctrl+C）
```

### 查看服务状态

```bash
# Docker Compose
docker-compose -f docker-compose.lan.yml ps

# Windows 命令行
netstat -ano | findstr ":8000"
netstat -ano | findstr ":3001"
```

---

## 📈 性能监控

### 查看应用日志

```bash
# 后端日志
docker-compose -f docker-compose.lan.yml logs -f backend

# 前端日志
docker-compose -f docker-compose.lan.yml logs -f frontend

# 数据库日志
docker-compose -f docker-compose.lan.yml logs -f postgres
```

### 监控资源使用

```bash
# 查看 Docker 容器资源使用
docker stats

# 查看 Windows 进程
Get-Process | Where-Object {$_.Handles -gt 1000}
```

---

## 🎯 典型使用场景

### 场景 1：团队协作开发

**需求**：团队成员都需要访问同一个开发服务器

**解决方案**：
1. 在中心电脑上运行本服务
2. 其他成员通过 IP 访问：`http://192.168.137.1:3001`
3. 共享数据，实时同步

### 场景 2：本地测试

**需求**：在多台设备上测试应用兼容性

**解决方案**：
1. 启动本地服务
2. 在手机、平板、其他电脑上访问
3. 测试响应式设计和跨平台兼容性

### 场景 3：演示展示

**需求**：向客户展示系统功能

**解决方案**：
1. 连接投影仪到中心电脑
2. 其他人通过手机/平板访问：`http://192.168.137.1:3001`
3. 实时互动演示

### 场景 4：VPN 远程访问

**需求**：远程员工需要访问开发服务

**解决方案**：
1. 连接到公司 VPN
2. 使用 VPN 内部 IP 地址访问
3. 享受与局域网相同的速度

---

## 📚 文件结构

```
RMFOOD配方平台/
├── docker-compose.lan.yml       # 局域网 Docker 编排配置
├── docker/nginx/nginx-lan.conf  # 局域网 Nginx 配置
├── frontend/src/config/
│   └── lan-config.ts            # 前端局域网配置
├── .env                         # 环境变量（已配置局域网）
├── backend/
│   ├── app/
│   │   ├── main.py             # 后端入口
│   │   ├── core/               # 核心模块
│   │   ├── api/                # API 路由
│   │   └── services/           # 业务逻辑
│   └── requirements.txt         # Python 依赖
└── frontend/
    ├── src/
    ├── package.json
    └── vite.config.ts
```

---

## 🎉 总结

✅ **RMFOOD 配方平台已完全配置用于局域网部署**

**关键特点**：
- ✅ 支持多 IP 地址访问
- ✅ CORS 跨域已配置
- ✅ 数据库和缓存已准备
- ✅ 所有服务正常运行
- ✅ 可立即在团队内部使用

**推荐访问方式**：
- **前端**：http://192.168.137.1:3001
- **后端 API**：http://192.168.137.1:8000
- **API 文档**：http://192.168.137.1:8000/docs

**下一步**：
1. 其他设备连接到同一网络
2. 打开浏览器输入推荐 URL
3. 开始使用应用！

---

**配置完成时间**：2024-06-18  
**环境**：Windows 开发环境 + Docker  
**状态**：✅ 局域网访问已就绪
