# RMFOOD 配方平台 - 生产部署指南

## 📋 部署检查清单

### ✅ 当前项目可部署性评估

| 项目 | 状态 | 说明 |
|------|------|------|
| **Docker 配置** | ✅ 完整 | 已有完整的 Dockerfile 多阶段构建 |
| **Docker Compose** | ✅ 完整 | 已配置数据库、缓存、监控等完整栈 |
| **数据库迁移** | ✅ 完整 | 15+ Alembic 迁移文件已准备 |
| **环境配置** | ✅ 完整 | 环境变量模板已配置 |
| **健康检查** | ✅ 完整 | 已配置服务健康检查 |
| **启动脚本** | ⚠️ 需优化 | 缺少生产级启动脚本 |
| **SSL/HTTPS** | ⚠️ 需配置 | Nginx 反向代理已配置，需手动添加证书 |
| **监控告警** | ✅ 可选 | Prometheus + Grafana 已配置 |

---

## 🚀 快速部署（推荐）

### 方案1：使用 Docker Compose（推荐用于生产）

**优点**：
- 完整的服务栈（数据库、缓存、监控）
- 自动化部署和管理
- 支持水平扩展
- 内置健康检查

**步骤**：

#### 1. 准备服务器环境

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 添加用户到 docker 组（可选）
sudo usermod -aG docker $USER
```

#### 2. 克隆项目

```bash
git clone <your-repo-url> /opt/rmfood
cd /opt/rmfood
```

#### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，设置关键变量
nano .env
```

**必须配置的环境变量**：
```env
# 生产环境必配
ENV=production
DEBUG=false

# 数据库（生产环境使用强密码）
POSTGRES_USER=rmfood_user
POSTGRES_PASSWORD=<生成强密码>  # 至少16字符，包含大小写字母、数字、特殊字符
POSTGRES_DB=rmfood_prod

# Redis
REDIS_PASSWORD=<生成强密码>

# JWT密钥（必须更改）
SECRET_KEY=<生成长随机密钥>  # 至少32字符

# CORS 源（根据实际域名配置）
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# AI 服务（可选）
AI_API_KEY=<如果使用AI功能>
AI_BASE_URL=<如果使用AI功能>

# 监控（可选）
GRAFANA_ADMIN_PASSWORD=<生成强密码>
```

#### 4. 生成安全密钥

```bash
# 生成 SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# 生成数据库密码
openssl rand -base64 16

# 生成 Redis 密码
openssl rand -base64 16
```

#### 5. 构建和启动服务

```bash
# 不使用监控的标准部署
docker-compose -f docker-compose.yml up -d

# 或者包含监控的完整部署
docker-compose -f docker-compose.yml --profile monitoring --profile proxy up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

#### 6. 数据库迁移

```bash
# 在后端容器中运行迁移
docker-compose exec backend alembic upgrade head

# 验证迁移
docker-compose exec postgres psql -U rmfood_user -d rmfood_prod -c "\\dt"
```

#### 7. 验证部署

```bash
# 检查后端 API
curl http://localhost:8000/api/v1

# 检查前端
curl http://localhost/

# 检查健康状态
curl http://localhost:8000/health
```

---

### 方案2：手动部署到单个服务器

**适用场景**：已有现成的开发环境

#### 1. 安装依赖

```bash
# Python 依赖
cd backend
pip install -r requirements.txt

# Node.js 依赖
cd ../frontend
npm install
npm run build
```

#### 2. 配置 PostgreSQL

```bash
# 创建数据库和用户
psql -U postgres
CREATE DATABASE rmfood_prod;
CREATE USER rmfood_user WITH PASSWORD '<strong-password>';
ALTER ROLE rmfood_user SET client_encoding TO 'utf8';
ALTER ROLE rmfood_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE rmfood_user SET default_transaction_deferrable TO ON;
GRANT ALL PRIVILEGES ON DATABASE rmfood_prod TO rmfood_user;
\q
```

#### 3. 运行数据库迁移

```bash
cd backend
alembic upgrade head
```

#### 4. 启动后端服务

```bash
# 使用 Gunicorn + Uvicorn
cd backend
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

#### 5. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/rmfood`:

```nginx
upstream backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com;

    # 前端
    location / {
        root /var/www/rmfood/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 健康检查
    location /health {
        proxy_pass http://backend/health;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/rmfood /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 生产环境安全配置

### 1. SSL/HTTPS 配置

```bash
# 使用 Let's Encrypt + Certbot
sudo certbot certonly --webroot -w /var/www/rmfood/frontend/dist -d yourdomain.com

# 更新 Nginx 配置
sudo certbot --nginx -d yourdomain.com
```

### 2. 防火墙配置

```bash
# Ubuntu UFW
sudo ufw enable
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
```

### 3. 数据库备份

```bash
# 创建备份脚本 /opt/rmfood/backup.sh
#!/bin/bash
BACKUP_DIR="/backups/rmfood"
mkdir -p $BACKUP_DIR
pg_dump -U rmfood_user -h localhost rmfood_prod | gzip > $BACKUP_DIR/rmfood_$(date +%Y%m%d_%H%M%S).sql.gz

# 保留最近 30 天的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

```bash
# 添加到 crontab 每日备份
0 2 * * * /opt/rmfood/backup.sh
```

### 4. 日志管理

```bash
# 配置日志轮转 /etc/logrotate.d/rmfood
/opt/rmfood/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 appuser appuser
}
```

---

## 📊 生产监控

### 启用监控栈（Prometheus + Grafana）

```bash
# 使用 monitoring 配置文件
docker-compose -f docker-compose.yml --profile monitoring up -d

# 访问地址
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3030 (admin/admin123)
```

---

## 🐛 常见生产问题

### 问题1：数据库连接失败

```bash
# 检查数据库状态
docker-compose exec postgres pg_isready -U rmfood_user

# 查看数据库日志
docker-compose logs postgres
```

### 问题2：内存溢出

```bash
# 在 docker-compose.yml 中增加内存限制
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### 问题3：高并发超时

```bash
# 调整 worker 数
# 对于 N 核 CPU，建议 (2N + 1) workers
# 例如 4 核：9 workers

docker-compose down
# 编辑 docker-compose.yml 中的 workers 参数
docker-compose up -d
```

---

## 📈 性能优化

### 1. 数据库优化

```sql
-- 创建关键索引
CREATE INDEX idx_formulas_status ON formulas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_experiments_user_id ON experiments(user_id) WHERE deleted_at IS NULL;

-- 分析表
ANALYZE formulas;
ANALYZE experiments;
```

### 2. Redis 优化

```bash
# 在 docker-compose.yml 中调整内存政策
command: >
  redis-server
  --maxmemory 1gb
  --maxmemory-policy allkeys-lru
```

### 3. Nginx 优化

```nginx
# 启用 gzip 压缩
gzip on;
gzip_types text/plain text/css text/javascript application/json;
gzip_min_length 1024;

# 连接复用
keepalive_timeout 65;
```

---

## 📋 部署前检查清单

在部署到生产环境前，请逐项确认：

```
□ Docker 和 Docker Compose 已安装
□ .env 文件已配置且所有必需变量已设置
□ 数据库密码已更改为强密码
□ SECRET_KEY 已更改
□ SSL 证书已配置
□ 防火墙已配置
□ 日志目录权限已设置
□ 备份策略已实施
□ 监控告警已配置
□ 负载均衡器已配置（如需要）
□ 灾难恢复计划已制定
□ 性能基准测试已完成
```

---

## 🚀 自动化部署（CI/CD）

### GitHub Actions 示例

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: docker-compose -f docker-compose.yml build
      
      - name: Push to Registry
        run: |
          docker login -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }}
          docker-compose -f docker-compose.yml push
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_IP }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/rmfood
            git pull origin main
            docker-compose -f docker-compose.yml pull
            docker-compose -f docker-compose.yml up -d
            docker-compose exec backend alembic upgrade head
```

---

## 📞 技术支持

- 文档：[FastAPI](https://fastapi.tiangolo.com/) | [PostgreSQL](https://www.postgresql.org/docs/) | [Redis](https://redis.io/documentation)
- 问题排查：查看 `/opt/rmfood/logs` 目录下的日志文件
- 性能监控：访问 Grafana 仪表板

---

## 总结

**项目当前状态**：✅ **可以部署到生产环境**

**部署前需要**：
1. 配置 `.env` 文件中的敏感信息
2. 设置强密码和密钥
3. 配置 SSL 证书
4. 准备数据备份策略
5. 配置监控告警

**推荐部署方案**：使用 Docker Compose（方案1），最快 15 分钟内完成部署。

---

**最后更新**: 2024-06-18  
**部署难度**: ⭐⭐☆☆☆ (中等偏低)  
**预计部署时间**: 15-30 分钟
