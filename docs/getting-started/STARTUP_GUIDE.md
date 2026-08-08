# RMFOOD 配方平台 - 启动指南

## 概述
本指南说明了如何启动 RMFOOD 配方平台的前端、后端和数据库服务。所有服务端口已固定：
- **前端 (Vite): `http://localhost:3000`**
- **后端 (FastAPI): `http://localhost:8000`** (含 Swagger API 文档: `/docs`)
- **数据库 (PostgreSQL): `localhost:5432`**

---

## 前置条件

### 1. 数据库 (PostgreSQL)
RMFOOD 需要 PostgreSQL 16+ 运行在默认端口 5432。

**方式 A: 使用 Docker (推荐)**
```bash
# 进入 deploy 目录
cd deploy

# 设置环境变量 (如果 .env 文件存在)
export POSTGRES_PASSWORD=your_secure_password

# 启动数据库和 Redis
docker-compose up -d postgres redis
```

**方式 B: 本地安装**
- 下载并安装 PostgreSQL: https://www.postgresql.org/download/
- 创建用户和数据库:
  ```sql
  CREATE USER postgres WITH PASSWORD 'password';
  CREATE DATABASE rmfood OWNER postgres;
  ```
- 确保 PostgreSQL 允许本地连接 (修改 `pg_hba.conf`)

**验证:**
```bash
psql -h localhost -U postgres -rmfood
# 或检查端口
netstat | grep :5432
```

### 2. Redis
项目使用 Redis 作为缓存和消息队列。Docker Compose 会自动启动它，或安装本地 Redis:
```bash
# Docker
docker-compose up -d redis

# 或者本地安装后确保
redis-server --port 6379
```

### 3. Node.js (前端开发)
Node.js v18+ 和 npm/pnpm:
```bash
nvm use 18  # 如果使用 nvm
cd frontend
npm install  # 或 pnpm install
```

### 4. Python (后端开发)
Python 3.10+ 和虚拟环境:
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
```

---

## 启动服务

### Linux/macOS (Bash)

### 方法 1: 使用控制脚本 (推荐)
```bash
# 启动所有服务
./control.sh start

# 查看状态
./control.sh status

# 停止所有服务
./control.sh stop

# 重启所有服务
./control.sh restart
```

### 方法 2: 单独启动每个服务
```bash
# 终端 1: 启动后端 (端口 8000)
./start_backend.sh

# 终端 2: 启动前端 (端口 3000)
./start_frontend.sh
```

### Windows (CMD/PowerShell)

### 方法 1: 使用控制批处理
```cmd
# 启动所有服务
control.bat start

# 查看状态
control.bat status

# 停止所有服务
control.bat stop
```

### 方法 2: 单独启动每个服务
```cmd
:: 终端 1: 启动后端 (端口 8000)
start_backend.bat

:: 终端 2: 启动前端 (端口 3000)
start_frontend.bat
```

---

## 访问地址

| 服务 | URL | 说明 |
|------|-----|------|
| **前端应用** | `http://localhost:3000` | Web 界面 |
| **后端 API** | `http://localhost:8000` | FastAPI 健康检查 |
| **API 文档** | `http://localhost:8000/docs` | Swagger UI |
| **数据库** | `localhost:5432` | PostgreSQL |
| **Redis** | `localhost:6379` | Redis 缓存 |

---

## 常见问题

### 1. 端口被占用
如果提示端口已被占用，请确认是否有旧实例仍在运行:
```bash
# Linux/Mac
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 2. 数据库连接失败
- 确认 PostgreSQL 正在运行 (`pg_isready`)
- 检查 `.env` 中的 `DATABASE_URL` 配置
- 确认防火墙允许本地连接 (5432 端口)

### 3. 前端构建失败
确保 Node 版本符合要求:
```bash
node --version  # 应 >= v18
pnpm version    # 推荐使用 pnpm
```

### 4. 依赖安装问题
清除缓存重新安装:
```bash
# 前端
cd frontend
rm -rf node_modules package-lock.json
pnpm install

# 后端
cd backend
pip cache purge
pip install -r requirements.txt -r requirements-dev.txt
```

---

## 日志查看

日志存储在 `logs/` 目录下:
```bash
# 查看实时日志
tail -f logs/backend.log
tail -f logs/frontend.log

# Windows (PowerShell)
Get-Content logs/backend.log -Tail 10 -Wait
```

---

## 生产部署说明

生产环境建议使用 Docker Compose:
```bash
cd deploy
cp .env.example .env
# 编辑 .env 设置生产配置
docker-compose up -d --build
```

生产配置文件位置:
- `.env` - 环境配置
- `deploy/docker-compose.yml` - 完整部署配置
- `deploy/Dockerfile` - 多阶段构建 Dockerfile
