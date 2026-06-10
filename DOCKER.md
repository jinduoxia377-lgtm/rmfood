# RMFOOD Docker 部署指南

本文档介绍如何使用 Docker 和 Docker Compose 部署 RMFOOD 配方平台。

---

## 1. 快速开始

### 1.1 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB RAM

### 1.2 启动所有服务

```bash
# 克隆项目后，在项目根目录执行
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

访问 http://localhost:3000 查看前端界面。

---

## 2. 架构说明

### 2.1 服务组件

```
┌─────────────┐     ┌─────────────┐
│   Frontend  │     │   Backend   │
│   (Nginx)   │────▶│  (FastAPI)  │
│   Port 3000 │     │   Port 8000 │
└─────────────┘     └─────────────┘
       │                   │
       │            ┌──────┴──────┐
       │            │   SQLite    │
       │            │  Database   │
       │            └─────────────┘
       │
┌──────┴──────┐
│   Nginx     │
│  (Reverse   │
│   Proxy)    │
│   Port 80   │
└─────────────┘
```

### 2.2 配置文件

- `Dockerfile.frontend` - 前端构建配置
- `Dockerfile.backend` - 后端构建配置
- `docker-compose.yml` - 服务编排配置
- `nginx.conf` - Nginx 配置

---

## 3. 开发环境使用

### 3.1 本地开发（不使用 Docker）

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

### 3.2 使用 Docker 进行开发

```bash
# 仅启动后端
docker-compose up -d backend

# 启动后端和前端
docker-compose up -d backend frontend

# 查看实时日志
docker-compose logs -f backend
```

---

## 4. 生产环境部署

### 4.1 构建镜像

```bash
# 构建所有镜像
docker-compose build

# 仅构建后端镜像
docker-compose build backend

# 仅构建前端镜像
docker-compose build frontend
```

### 4.2 配置环境变量

创建 `.env` 文件：

```env
SECRET_KEY=your-super-secret-key-here-min-64-chars
DATABASE_URL=sqlite+aiosqlite:///./data/rmfood.db
DEBUG=false
CORS_ORIGINS=https://your-domain.com
```

### 4.3 启动生产服务

```bash
# 启动所有服务
docker-compose up -d

# 启动并限制资源
docker-compose up -d --memory=1g --cpus=1.0
```

### 4.4 配置 Nginx SSL

1. 获取 SSL 证书（使用 Let's Encrypt）：

```bash
# 安装 certbot
apt-get install certbot python3-certbot-nginx

# 生成证书
certbot --nginx -d your-domain.com
```

2. 更新 `nginx.conf` 添加 SSL 配置：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # ... 其他配置
}
```

---

## 5. 数据管理

### 5.1 数据持久化

数据存储在 Docker volumes 中：

```bash
# 查看 volumes
docker volume ls | grep rmfood

# 备份数据
docker run --rm -v rmfood_backend-data:/data -v $(pwd):/backup alpine tar czf /backup/rmfood-backup.tar.gz /data

# 恢复数据
docker run --rm -v rmfood_backend-data:/data -v $(pwd):/backup alpine tar xzf /backup/rmfood-backup.tar.gz -C /
```

### 5.2 数据库迁移

```bash
# 进入后端容器
docker-compose exec backend bash

# 运行迁移
alembic upgrade head

# 创建新迁移
alembic revision --autogenerate -m "Add new table"
```

---

## 6. 监控和日志

### 6.1 查看日志

```bash
# 所有服务日志
docker-compose logs -f

# 特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 最近 100 行日志
docker-compose logs --tail=100
```

### 6.2 监控容器状态

```bash
# 容器健康状态
docker-compose ps

# 资源使用
docker stats

# 详细检查
docker inspect rmfood-backend
```

---

## 7. 故障排查

### 7.1 常见问题

#### 端口冲突

如果端口被占用：

```bash
# 查看端口占用
lsof -i :3000
lsof -i :8000

# 修改 docker-compose.yml 中的端口映射
```

#### 后端无法连接数据库

```bash
# 检查数据库文件权限
docker-compose exec backend ls -la /app/data/

# 修复权限
docker-compose exec backend chown -R appuser:appuser /app/data
```

#### 前端无法访问后端 API

```bash
# 检查网络连接
docker-compose exec frontend ping backend

# 检查 nginx 代理配置
docker-compose exec nginx cat /etc/nginx/conf.d/default.conf
```

### 7.2 完全重建

```bash
# 停止并删除所有容器
docker-compose down

# 删除 volumes（会丢失数据！）
docker-compose down -v

# 重新构建并启动
docker-compose up -d --build
```

---

## 8. CI/CD 集成

### 8.1 GitHub Actions 自动部署

项目已配置 GitHub Actions 工作流（`.github/workflows/ci.yml`），包括：

- 代码检查（Lint、Type Check、Tests）
- Docker 镜像构建和推送
- 自动部署到服务器

### 8.2 手动部署流程

```bash
# 1. 在服务器上拉取代码
git pull origin main

# 2. 重新构建镜像
docker-compose build

# 3. 重启服务
docker-compose up -d

# 4. 运行数据库迁移
docker-compose exec backend alembic upgrade head
```

---

## 9. 安全建议

### 9.1 生产环境检查清单

- [ ] 修改默认的 `SECRET_KEY`
- [ ] 启用 HTTPS/SSL
- [ ] 配置防火墙规则
- [ ] 限制容器资源使用
- [ ] 定期更新依赖版本
- [ ] 启用日志审计
- [ ] 配置定期备份

### 9.2 容器安全

```bash
# 以非 root 用户运行（已配置）
# 使用只读 root 文件系统（可选）
read_only: true

# 限制容器的 capabilities
cap_drop:
  - ALL

# 只允许必要的端口
expose:
  - "8000"
```

---

## 10. 扩展阅读

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 官方文档](https://docs.docker.com/compose/)
- [Nginx 官方文档](https://nginx.org/en/docs/)
- [Let's Encrypt 证书](https://letsencrypt.org/)

---

*最后更新: 2026-05-01*
