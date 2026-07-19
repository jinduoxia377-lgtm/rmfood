# ============================================
# RMFOOD 配方平台 - 运维手册
# ============================================

## 1. 服务架构

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (Port 80)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌─────▼─────┐
        │  Frontend  │ │  API   │ │  Health   │
        │  (Static)  │ │Server  │ │ Endpoint  │
        └───────────┘ └───┬────┘ └───────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
        ┌─────▼─────┐ ┌──▼────┐ ┌────▼────┐
        │ PostgreSQL │ │Redis  │ │ Backend │
        │   (DB)     │ │Cache  │ │Services │
        └───────────┘ └───────┘ └─────────┘
```

## 2. 日常运维命令

### 查看服务状态
```bash
docker compose -f docker-compose.prod.yml ps
```

### 查看实时日志
```bash
# 查看所有服务日志
docker compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f db
docker compose -f docker-compose.prod.yml logs -f redis
```

### 重启服务
```bash
# 重启所有服务
docker compose -f docker-compose.prod.yml restart

# 重启特定服务
docker compose -f docker-compose.prod.yml restart frontend
docker compose -f docker-compose.prod.yml restart backend
```

### 停止服务
```bash
docker compose -f docker-compose.prod.yml down
```

### 启动服务
```bash
docker compose -f docker-compose.prod.yml up -d
```

## 3. 监控与告警

### CPU/内存使用
```bash
docker stats
```

### 磁盘使用
```bash
docker system df
```

### 容器健康状态
```bash
docker compose -f docker-compose.prod.yml ps
```

### 数据库连接数
```bash
docker exec rmfood-db psql -U rmfood -c "SELECT count(*) FROM pg_stat_activity;"
```

### Redis 内存使用
```bash
docker exec rmfood-redis redis-cli INFO memory
```

## 4. 故障处理

### 前端无法访问
1. 检查 nginx 配置: `docker exec rmfood-frontend nginx -t`
2. 检查静态文件: `docker exec rmfood-frontend ls -la /usr/share/nginx/html`
3. 查看 nginx 日志: `docker logs rmfood-frontend`

### 后端 API 报错
1. 检查后端日志: `docker logs rmfood-backend`
2. 检查数据库连接: `docker exec rmfood-db pg_isready -U rmfood`
3. 检查 Redis 连接: `docker exec rmfood-redis redis-cli ping`

### 数据库问题
1. 检查数据库状态: `docker exec rmfood-db pg_isready -U rmfood`
2. 查看数据库日志: `docker logs rmfood-db`
3. 进入数据库: `docker exec -it rmfood-db psql -U rmfood`

### Redis 问题
1. 检查 Redis 状态: `docker exec rmfood-redis redis-cli ping`
2. 查看 Redis 日志: `docker logs rmfood-redis`
3. 进入 Redis: `docker exec -it rmfood-redis redis-cli`

## 5. 备份策略

### 数据库备份
```bash
# 每日自动备份
docker exec rmfood-db pg_dump -U rmfood rmfood > backups/db_$(date +%Y%m%d).sql

# 压缩备份
docker exec rmfood-db pg_dump -U rmfood rmfood | gzip > backups/db_$(date +%Y%m%d).sql.gz
```

### Redis 备份
```bash
# 触发 RDB 快照
docker exec rmfood-redis redis-cli BGSAVE

# 查看备份文件
docker exec rmfood-redis ls -la /data/dump.rdb
```

### 配置文件备份
```bash
# 备份所有配置文件
tar -czf backups/config_$(date +%Y%m%d).tar.gz docker-compose.prod.yml .env.production docker/nginx.conf
```

## 6. 安全加固

### 防火墙规则
```bash
# 仅开放必要端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Docker 安全
```bash
# 限制容器资源
docker run --memory=1g --cpus=1.0 rmfood-frontend

# 禁用容器特权模式
docker run --privileged=false rmfood-frontend
```

### 日志审计
```bash
# 查看最近 100 行日志
docker compose -f docker-compose.prod.yml logs --tail=100

# 搜索特定错误
docker compose -f docker-compose.prod.yml logs | grep "ERROR"
```

## 7. 性能优化

### Nginx 缓存
```nginx
# 在 nginx.conf 中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;
```

### 数据库优化
```sql
-- 查看慢查询
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

-- 分析表统计信息
ANALYZE;
```

### Redis 优化
```bash
# 查看内存使用
docker exec rmfood-redis redis-cli INFO memory

# 设置最大内存
docker exec rmfood-redis redis-cli CONFIG SET maxmemory 256mb
docker exec rmfood-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## 8. 应急响应

### 服务崩溃
1. 查看日志定位原因
2. 重启服务: `docker compose -f docker-compose.prod.yml restart`
3. 如持续崩溃，考虑回滚到上一版本

### 数据丢失
1. 停止所有写入: `docker compose -f docker-compose.prod.yml stop backend`
2. 从备份恢复: `docker exec -i rmfood-db psql -U rmfood rmfood < backups/db_YYYYMMDD.sql`
3. 验证数据完整性
4. 重新启动服务

### 安全事件
1. 隔离受影响服务
2. 更改所有密钥和密码
3. 审查日志找出入侵途径
4. 修补漏洞
5. 恢复服务

## 9. 升级流程

### 小版本升级
```bash
# 1. 备份数据
./scripts/deploy.sh backup

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建并部署
./scripts/deploy.sh deploy

# 4. 验证服务
curl http://localhost/health
```

### 大版本升级
```bash
# 1. 在测试环境验证
# 2. 备份生产数据
# 3. 停机窗口内升级
# 4. 逐步恢复服务
# 5. 监控关键指标
```

## 10. 联系人

- **运维负责人**: ops@rmfood.com
- **技术支持**: support@rmfood.com
- **紧急联系**: +86-XXX-XXXX-XXXX
