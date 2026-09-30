# RMFOOD 配方平台 - 云服务器一键部署指南
# 适用环境: Ubuntu 24.04 LTS | 2核CPU | 4GB 内存

## 一、前置条件

### 1.1 服务器要求
- 操作系统: Ubuntu 24.04 LTS (已确认)
- vCPU: 2核
- 内存: 4GB
- 公网 IP: 106.12.20.131
- 带宽: 3Mbps
- 磁盘: 建议 40GB 以上

### 1.2 准备部署包
将 `deploy/` 目录完整上传到服务器:
```bash
# 在本地开发机执行
scp -r deploy/ root@106.12.20.131:/opt/rmfood/
```

或直接克隆 Git 仓库:
```bash
ssh root@106.12.20.131
git clone <your-repo-url> /opt/rmfood
cd /opt/rmfood
```

---

## 二、一键部署

### 2.1 执行部署脚本
```bash
ssh root@106.12.20.131
bash /opt/rmfood/deploy/deploy.sh
```

脚本会自动完成:
1. 检查并安装 Docker（如需）
2. 配置 UFW 防火墙
3. 构建 Docker 镜像（首次约 5-10 分钟）
4. 启动所有服务
5. 初始化数据库

### 2.2 访问服务
部署完成后访问:
- 主页: http://106.12.20.131
- API 文档: http://106.12.20.131/docs
- 后台管理: http://106.12.20.131/admin

默认管理员:
- 用户名: `admin`
- 密码: `RmF0dPr0d2024!sec`

---

## 三、常用运维命令

### 3.1 查看状态
```bash
# 查看所有容器
docker compose -f /opt/rmfood/docker-compose.deploy.yml ps

# 查看后端日志
docker logs -f rmfood_backend

# 查看数据库日志
docker logs rmfood_postgres
```

### 3.2 重启服务
```bash
# 重启全部
docker compose -f /opt/rmfood/docker-compose.deploy.yml restart

# 重启单个服务
docker compose -f /opt/rmfood/docker-compose.deploy.yml restart backend
```

### 3.3 停止服务
```bash
docker compose -f /opt/rmfood/docker-compose.deploy.yml down
```

### 3.4 更新代码
```bash
cd /opt/rmfood
git pull
bash deploy/deploy.sh
```

---

## 四、配置说明

### 4.1 环境变量文件
配置文件位于: `/opt/rmfood/.env`

核心配置项:
| 变量 | 说明 | 默认值 |
|------|------|--------|
| POSTGRES_PASSWORD | 数据库密码 | 随机生成 |
| SECRET_KEY | JWT签名密钥 | 随机生成 |
| OPENAI_API_KEY | AI API Key | 需自行填写 |
| ADMIN_PASSWORD | 管理员密码 | RmF0dPr0d2024!sec |

### 4.2 修改管理员密码
```bash
# 进入数据库容器
docker exec -it rmfood_postgres psql -U rmfood -d rmfood

# 执行 SQL（替换新密码）
UPDATE admin_users SET password_hash = '新密码的bcrypt哈希' WHERE username = 'admin';
```

或者通过 API:
```bash
# 登录后调用
curl -X POST http://106.12.20.131/api/v1/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "你的新密码"}'
```

### 4.3 配置 AI 服务
编辑 `/opt/rmfood/.env`:
```bash
OPENAI_API_KEY=sk-your-actual-api-key
OPENAI_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

然后重启后端:
```bash
docker compose -f /opt/rmfood/docker-compose.deploy.yml restart backend
```

---

## 五、服务架构

```
                    ┌──────────────┐
                    │   Nginx 80   │  ← 统一入口
                    │  (rmfood_web)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
        │ Frontend  │ │ Backend │ │ Postgres │
        │ (Nginx)   │ │ :8000   │ │  :5432   │
        └───────────┘ └────┬────┘ └──────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │  ← 缓存/队列
                    │   :6379     │
                    └─────────────┘
```

---

## 六、常见问题

### Q1: 构建失败，提示 "requirements.txt not found"
**原因**: Dockerfile 中的 COPY 路径不正确
**解决**: 确保在项目根目录执行构建:
```bash
cd /opt/rmfood
docker compose -f docker-compose.deploy.yml build
```

### Q2: 后端启动失败，提示 "数据库连接失败"
**原因**: PostgreSQL 尚未完全启动
**解决**: 等待 30 秒后重试:
```bash
docker compose -f docker-compose.deploy.yml restart backend
docker logs rmfood_backend -f
```

### Q3: 访问页面 502 Bad Gateway
**原因**: 后端服务未就绪或 nginx 配置问题
**解决**:
```bash
# 检查后端状态
docker ps | grep backend
docker logs rmfood_backend

# 重启服务
docker compose -f docker-compose.deploy.yml restart backend web
```

### Q4: 内存不足（OOM）
**原因**: 服务占用超过 4GB
**解决**: 关闭可选服务
```bash
# 编辑 .env 文件
SKIP_CHROMADB=true
SKIP_PROMETHEUS=true

# 重启
docker compose -f docker-compose.deploy.yml down
docker compose -f docker-compose.deploy.yml up -d
```

### Q5: 如何备份数据库
```bash
# 备份
docker exec rmfood_postgres pg_dump -U rmfood rmfood > /backup/rmfood_$(date +%Y%m%d).sql

# 恢复
docker exec -i rmfood_postgres psql -U rmfood rmfood < /backup/rmfood_20240101.sql
```

---

## 七、性能优化建议

### 7.1 开启 Swap（推荐）
```bash
# 创建 2GB swap 文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 7.2 限制 PostgreSQL 内存
已在 `.env` 中配置:
```bash
POSTGRES_SHARED_BUFFERS=128MB
POSTGRES_WORK_MEM=2MB
POSTGRES_MAX_CONNECTIONS=50
```

### 7.3 定期清理日志
```bash
# 查看磁盘使用
df -h

# 清理 Docker 日志
docker logs rmfood_backend > /dev/null 2>&1
truncate -s 0 /var/lib/docker/containers/*/backend.log 2>/dev/null || true
```

---

## 八、安全建议

1. **修改默认密码**: 部署后立即修改管理员密码
2. **启用 HTTPS**: 生产环境建议配置 SSL 证书
3. **定期更新**: `apt update && apt upgrade -y`
4. **监控日志**: 定期检查 `/var/log/nginx/` 和后端日志
5. **备份数据**: 定期备份 PostgreSQL 数据库
