# RMFOOD 配方平台 - 部署文档

## 概述

本文档说明如何将 RMFOOD 配方平台部署到生产环境。

## 系统要求

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **内存**: 至少 4GB RAM
- **磁盘**: 至少 20GB 可用空间
- **网络**: 开放端口 80 (HTTP) 和/或 443 (HTTPS)

## 快速部署

### 1. 克隆项目

```bash
cd D:\RMFOOD配方平台\frontend
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env.production

# 编辑配置文件，填入实际值
# 至少需要修改:
# - SECRET_KEY (生成随机密钥)
# - POSTGRES_PASSWORD (设置强密码)
# - DATABASE_URL (指向实际数据库)
# - REDIS_URL (指向实际 Redis)
```

### 3. 一键部署

```bash
# Linux/Mac
chmod +x scripts/deploy.sh
./scripts/deploy.sh deploy

# Windows (通过 Git Bash 或 WSL)
bash scripts/deploy.sh deploy
```

### 4. 验证部署

```bash
# 检查服务状态
docker compose -f docker-compose.prod.yml ps

# 访问前端
curl http://localhost

# 访问后端 API
curl http://localhost:8000/health

# 访问 API 文档
curl http://localhost:8000/docs
```

## 手动部署步骤

### 构建 Docker 镜像

```bash
docker build -t rmfood-frontend:latest -f docker/Dockerfile.prod .
```

### 启动服务

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 查看日志

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### 停止服务

```bash
docker compose -f docker-compose.prod.yml down
```

### 重启服务

```bash
docker compose -f docker-compose.prod.yml restart
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_BACKEND_URL` | 后端 API 地址 | `http://backend:8000` |
| `VITE_PORT` | 前端端口 | `80` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://rmfood:rmfood_password@db:5432/rmfood` |
| `REDIS_URL` | Redis 连接字符串 | `redis://redis:6379/0` |
| `SECRET_KEY` | 应用密钥 | `change-me-in-production` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | `rmfood_password` |
| `HTTPS_ENABLED` | 是否启用 HTTPS | `false` |
| `CORS_ORIGINS` | CORS 允许的域名 | `https://your-domain.com` |
| `LOG_LEVEL` | 日志级别 | `WARNING` |

## 健康检查

### 前端健康检查

```bash
curl http://localhost/health
# 预期返回: "healthy\n"
```

### 后端健康检查

```bash
curl http://localhost:8000/health
# 预期返回: {"status": "ok", "database": "connected", "redis": "connected"}
```

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose -f docker-compose.prod.yml logs

# 检查端口占用
netstat -tlnp | grep :80
```

### 数据库连接失败

```bash
# 检查数据库容器状态
docker compose -f docker-compose.prod.yml ps db

# 进入数据库容器
docker exec -it rmfood-db psql -U rmfood -d rmfood
```

### 静态资源 404

```bash
# 重新构建前端
docker compose -f docker-compose.prod.yml up -d --build frontend

# 检查 nginx 配置
docker exec -it rmfood-frontend nginx -t
```

## 安全建议

1. **更改默认密钥**: 生产环境必须更改 `SECRET_KEY` 和 `POSTGRES_PASSWORD`
2. **启用 HTTPS**: 配置 SSL 证书并设置 `HTTPS_ENABLED=true`
3. **限制 CORS**: 将 `CORS_ORIGINS` 设置为实际域名
4. **定期更新**: 保持 Docker 镜像和依赖包更新
5. **备份数据**: 定期备份 PostgreSQL 和 Redis 数据

## 备份与恢复

### 备份数据库

```bash
docker exec rmfood-db pg_dump -U rmfood rmfood > backup.sql
```

### 恢复数据库

```bash
docker exec -i rmfood-db psql -U rmfood rmfood < backup.sql
```

### 备份 Redis

```bash
docker exec rmfood-redis redis-cli BGSAVE
```

## 监控

### 查看资源使用

```bash
docker stats
```

### 查看服务日志

```bash
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f db
docker compose -f docker-compose.prod.yml logs -f redis
```

## 升级

### 拉取最新代码

```bash
git pull origin main
```

### 重新部署

```bash
./scripts/deploy.sh deploy
```

### 回滚

```bash
# 恢复到上一个版本
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

## 联系支持

如有问题，请联系:
- **技术支持**: support@rmfood.com
- **文档**: https://docs.rmfood.com
- **GitHub Issues**: https://github.com/rmfood/rmfood/issues
