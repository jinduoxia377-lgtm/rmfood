# RMFOOD 配方平台 — 运维 Runbook

**Last Updated:** 2026-06-10
**系统版本:** v1.0.0
**技术栈:** FastAPI + PostgreSQL + Redis + Nginx + Docker Compose

---

## 目录

1. [Service Health Check](#1-service-health-check)
2. [Common Issues & Solutions](#2-common-issues--solutions)
3. [Database Operations](#3-database-operations)
4. [Log Analysis](#4-log-analysis)
5. [Performance Troubleshooting](#5-performance-troubleshooting)
6. [Emergency Procedures](#6-emergency-procedures)

---

## 1. Service Health Check

### 1.1 Health Check Endpoint

后端暴露 `/health` 端点，返回所有依赖服务的健康状态：

```bash
curl -s http://localhost:8000/health | python -m json.tool
```

正常响应示例：

```json
{
  "status": "healthy",
  "app": "RMFOOD配方设计平台",
  "version": "1.0.0",
  "database": {
    "type": "postgresql",
    "status": "healthy",
    "latency_ms": 2.5,
    "pool": { "active": 3, "idle": 17, "total": 20 }
  },
  "redis": {
    "status": "healthy",
    "latency_ms": 0.8,
    "used_memory_mb": 12.3
  }
}
```

`status` 字段取值：
- `healthy` — 所有服务正常
- `degraded` — 部分非关键服务不可用（Redis/Neo4j/ES）
- `unhealthy` — 数据库连接失败，系统不可用

### 1.2 Docker Container Status

```bash
# 查看所有容器运行状态
docker compose -f docker-compose.yml ps

# 查看各容器资源使用情况（CPU/内存/网络）
docker stats --no-stream

# 检查单个容器日志（最近 50 行）
docker logs --tail 50 rmfood-backend
docker logs --tail 50 rmfood-postgres
docker logs --tail 50 rmfood-redis
```

### 1.3 服务端口清单

| 服务 | 容器名 | 端口 | 用途 |
|------|--------|------|------|
| Backend (FastAPI) | rmfood-backend | 8000 | API 服务 |
| PostgreSQL | rmfood-postgres | 5432 | 主数据库 |
| PgBouncer | rmfood-pgbouncer | 6432 | 连接池代理 |
| PostgreSQL Replica | rmfood-postgres-replica | 5433 | 只读副本（生产） |
| Redis | rmfood-redis | 6379 | 缓存 |
| Frontend (Nginx) | rmfood-frontend | 3000 | 前端静态资源 |
| Nginx | rmfood-nginx | 80/443 | 反向代理入口 |

### 1.4 Prometheus Metrics

```bash
# 获取 Prometheus 格式指标
curl -s http://localhost:8000/metrics/prometheus
```

### 1.5 懒加载模块状态

```bash
# 查看所有懒加载服务的加载状态
curl -s http://localhost:8000/api/v1/system/modules
```

---

## 2. Common Issues & Solutions

### 2.1 Database Connection Failures

**症状：** `/health` 返回 `database.status: "unhealthy"`，API 请求返回 500。

**诊断步骤：**

```bash
# 1. 检查 PostgreSQL 容器是否运行
docker ps --filter name=rmfood-postgres

# 2. 检查 PostgreSQL 日志
docker logs --tail 100 rmfood-postgres

# 3. 测试数据库连通性
docker exec rmfood-postgres pg_isready -U rmfood -d rmfood

# 4. 运行诊断脚本
cd backend && python scripts/diagnose_pg.py
```

**常见原因与处理：**

| 原因 | 处理方式 |
|------|----------|
| 容器未启动 | `docker compose up -d postgres` |
| 连接池耗尽 | 重启后端容器释放连接 |
| 认证失败 | 检查 `.env` 中 `POSTGRES_PASSWORD` 是否正确 |
| 磁盘空间不足 | 清理日志/旧备份，扩展磁盘 |
| `pg_hba.conf` 拒绝连接 | 检查容器内 `/var/lib/postgresql/data/pg_hba.conf` |

### 2.2 Redis Connection Issues

**症状：** `/health` 返回 `redis.status: "unhealthy"`，缓存命中率下降。

```bash
# 检查 Redis 容器状态
docker exec rmfood-redis redis-cli ping
# 预期输出: PONG

# 查看 Redis 内存使用
docker exec rmfood-redis redis-cli info memory | grep used_memory_human

# 检查连接数
docker exec rmfood-redis redis-cli info clients | grep connected_clients
```

**处理：** Redis 配置了自动降级，Redis 不可用时系统会回退到 L1 内存缓存，不会完全中断服务。但应尽快恢复 Redis 以保证性能。

### 2.3 High Memory Usage

```bash
# 查看容器内存使用
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 进入后端容器查看进程级内存
docker exec rmfood-backend ps aux --sort=-%mem | head -10
```

**阈值：**
- 后端容器限制：2GB（docker-compose 配置）
- PostgreSQL 限制：1GB
- Redis 限制：256MB（maxmemory 配置）

**处理：**
- 后端内存持续增长：检查是否有内存泄漏，考虑重启容器
- PostgreSQL 内存高：检查 `shared_buffers` 和连接数
- Redis 内存满：已配置 `allkeys-lru` 淘汰策略，会自动清理

### 2.4 High CPU Usage

```bash
# 查看容器 CPU 使用
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}"

# 查看后端进程 CPU 占用
docker exec rmfood-backend top -bn1 | head -15
```

**常见原因：**
- AI 推理请求过多（LLM 调用）— 检查 `/api/v1/ai` 相关请求量
- 数据库慢查询 — 见 [3.3 Slow Query Identification](#33-slow-query-identification)
- 批量数据处理任务 — 检查 ETL 或肽分析任务

### 2.5 Slow API Responses

```bash
# 查看 Prometheus 指标中的延迟分布
curl -s http://localhost:8000/metrics/prometheus | grep http_request_duration

# 查看 Nginx 访问日志中的慢请求
docker exec rmfood-nginx cat /var/log/nginx/access.log | awk '$NF > 2' | tail -20
```

**排查顺序：**
1. 检查 `/health` 中数据库延迟（`latency_ms`）
2. 检查 Redis 命中率（缓存失效会导致数据库压力增大）
3. 检查 PostgreSQL 连接池状态（`pool.active` 是否接近上限）
4. 检查 Nginx `proxy_read_timeout` 是否过短（当前配置 60s）

### 2.6 Authentication Failures

**症状：** API 返回 401 Unauthorized，用户无法登录。

```bash
# 检查 JWT 配置
docker exec rmfood-backend env | grep -E "JWT|SECRET|TOKEN"

# 查看认证相关日志
docker logs --tail 200 rmfood-backend 2>&1 | grep -i "auth\|token\|login"

# 重置管理员密码
cd backend && python scripts/reset_admin_password.py
```

**常见原因：**
- `SECRET_KEY` 未设置或被修改 — 生产环境必须设置且长度 >= 32
- Token 过期 — 默认 Access Token 30 分钟，Refresh Token 7 天
- 账号被锁定 — 连续 5 次登录失败自动锁定 15 分钟
- CORS 配置问题 — 检查 `CORS_ORIGINS` 是否包含前端域名

---

## 3. Database Operations

### 3.1 Check Database Status

```bash
# PostgreSQL 容器内检查
docker exec rmfood-postgres psql -U rmfood -d rmfood -c "
  SELECT
    pg_database_size('rmfood') AS db_size,
    (SELECT count(*) FROM pg_stat_activity WHERE datname='rmfood') AS active_connections,
    (SELECT setting FROM pg_settings WHERE name='max_connections') AS max_connections;
"

# 连接池状态（通过 PgBouncer）
docker exec rmfood-pgbouncer psql -h localhost -p 5432 -U pgbouncer pgbouncer -c "SHOW POOLS;"
docker exec rmfood-pgbouncer psql -h localhost -p 5432 -U pgbouncer pgbouncer -c "SHOW STATS;"
```

### 3.2 Connection Pool Monitoring

后端使用 SQLAlchemy 连接池，配置参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `database_pool_size` | 20 | 常驻连接数 |
| `database_max_overflow` | 10 | 高峰溢出连接 |
| `database_pool_timeout` | 30s | 获取连接超时 |
| `database_pool_recycle` | 1800s | 连接回收时间 |
| `database_pool_pre_ping` | True | 使用前健康检查 |

PgBouncer 配置（事务级池化）：

| 参数 | 值 | 说明 |
|------|-----|------|
| `POOL_MODE` | transaction | 事务级池化 |
| `DEFAULT_POOL_SIZE` | 25 | 默认池大小 |
| `MAX_CLIENT_CONN` | 100 | 最大客户端连接 |
| `RESERVE_POOL_SIZE` | 5 | 高峰保留连接 |

```bash
# 检查 PgBouncer 连接池状态
docker exec rmfood-pgbouncer psql -h localhost -p 5432 -U pgbouncer pgbouncer -c "SHOW POOLS;"
```

### 3.3 Slow Query Identification

```bash
# 查看当前正在执行的慢查询（超过 5 秒）
docker exec rmfood-postgres psql -U rmfood -d rmfood -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
    AND state = 'active'
  ORDER BY duration DESC;
"

# 查看表统计信息（扫描行数多的查询可能需要优化）
docker exec rmfood-postgres psql -U rmfood -d rmfood -c "
  SELECT relname, seq_scan, seq_tup_read, idx_scan, n_tup_ins, n_tup_upd, n_tup_del
  FROM pg_stat_user_tables
  ORDER BY seq_tup_read DESC
  LIMIT 10;
"
```

### 3.4 Backup and Restore

**备份：**

```bash
# 使用项目备份脚本（支持 Docker 和本地 PostgreSQL）
bash scripts/db-backup.sh

# 自定义备份目录和保留天数
bash scripts/db-backup.sh --dir /data/backups --retention 14

# 试运行（不实际执行）
bash scripts/db-backup.sh --dry-run

# 使用 Python 脚本备份
cd backend && python scripts/backup_database.py
```

备份文件存储在 `backups/` 目录，默认保留最近 7 个备份。

**恢复：**

```bash
# 从 gzip 备份恢复
gunzip < backups/rmfood_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i rmfood-postgres psql -U rmfood -d rmfood

# 使用 Python 脚本恢复
cd backend && python scripts/backup_database.py --restore backup_YYYYMMDD_HHMMSS.sql.gz
```

**数据库迁移（Alembic）：**

```bash
cd backend

# 查看当前迁移版本
alembic current

# 执行所有待定迁移
alembic upgrade head

# 回滚到上一个版本
alembic downgrade -1

# 查看迁移历史
alembic history --verbose
```

---

## 4. Log Analysis

### 4.1 Log File Locations

| 日志 | 路径 | 格式 | 说明 |
|------|------|------|------|
| 应用日志 | `backend/logs/rmfood.log` | JSON | 所有 INFO 及以上级别 |
| 错误日志 | `backend/logs/rmfood_error.log` | JSON | 仅 ERROR 及以上级别 |
| Nginx 访问日志 | Docker volume `nginx-logs` | 文本 | HTTP 请求记录 |
| PostgreSQL 日志 | Docker 容器日志 | 文本 | 数据库操作日志 |
| Redis 日志 | Docker 容器日志 | 文本 | Redis 运行日志 |

### 4.2 How to Search Logs

```bash
# 查看后端容器实时日志
docker logs -f --tail 100 rmfood-backend

# 搜索错误日志
grep -i "error\|exception\|traceback" backend/logs/rmfood.log | tail -20

# 按请求 ID 追踪完整链路
grep "request_id\":\"<UUID>" backend/logs/rmfood.log

# 搜索特定时间段的日志（JSON 格式）
grep '"timestamp"' backend/logs/rmfood.log | \
  python -c "import sys,json; [print(l) for l in sys.stdin if '2026-06-10T14:' in l]"

# 查看错误日志（仅 ERROR 级别）
tail -50 backend/logs/rmfood_error.log
```

### 4.3 Common Error Patterns

| 错误模式 | 含义 | 处理方式 |
|----------|------|----------|
| `DatabaseConnectionError` | 数据库连接断开 | 检查 PostgreSQL 容器状态 |
| `OperationalError: connection refused` | PostgreSQL 未运行 | `docker compose up -d postgres` |
| `InterfaceError: connection is closed` | 连接池中的连接已过期 | 自动重连，如频繁出现需调整 `pool_recycle` |
| `IntegrityError: duplicate key` | 唯一约束冲突 | 检查业务逻辑是否重复插入 |
| `RateLimitExceeded` | 请求频率超限 | 检查客户端调用频率 |
| `JWTError: token has expired` | Token 过期 | 引导用户刷新 Token |
| `CircuitBreakerOpen` | 断路器触发（服务不可用） | 检查下游服务健康状态 |
| `LLM service unavailable` | AI 服务不可用 | 检查 API Key 和网络连通性 |

---

## 5. Performance Troubleshooting

### 5.1 How to Identify Bottlenecks

```bash
# 1. 检查系统资源
docker stats --no-stream

# 2. 查看 Prometheus 指标（请求延迟分布）
curl -s http://localhost:8000/metrics/prometheus | grep -E "http_request|cache_hit|db_query"

# 3. 查看数据库连接池饱和度
curl -s http://localhost:8000/health | python -m json.tool | grep -A5 "pool"

# 4. 查看缓存命中率
curl -s http://localhost:8000/health | python -m json.tool | grep -A5 "cache"

# 5. 检查 PostgreSQL 活跃查询
docker exec rmfood-postgres psql -U rmfood -d rmfood -c "
  SELECT count(*) AS active_queries FROM pg_stat_activity WHERE state = 'active';"
```

### 5.2 Prometheus Metrics

后端暴露标准 Prometheus 指标端点：

```
GET /metrics/prometheus
```

关键指标：

| 指标名 | 类型 | 说明 |
|--------|------|------|
| `http_requests_total` | Counter | HTTP 请求总数（按 method/path/status 分） |
| `http_request_duration_seconds` | Histogram | 请求延迟分布（P50/P95/P99） |
| `cache_hit_total` | Counter | 缓存命中次数 |
| `cache_miss_total` | Counter | 缓存未命中次数 |
| `db_query_duration_seconds` | Histogram | 数据库查询延迟 |
| `active_connections` | Gauge | 当前活跃连接数 |

### 5.3 Grafana Dashboard Setup

推荐的 Grafana Dashboard 配置：

1. **添加 Prometheus 数据源**
   - URL: `http://backend:8000/metrics/prometheus`
   - 或通过 Prometheus server 中转采集

2. **推荐 Dashboard 面板**

| 面板 | 查询 | 说明 |
|------|------|------|
| 请求速率 | `rate(http_requests_total[5m])` | 每秒请求数 |
| 延迟 P95 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | 95 分位延迟 |
| 错误率 | `rate(http_requests_total{status=~"5.."}[5m])` | 5xx 错误比例 |
| 缓存命中率 | `cache_hit_total / (cache_hit_total + cache_miss_total)` | 缓存效率 |
| 数据库连接 | `active_connections` | 当前连接数 |

3. **告警规则建议**

| 告警 | 条件 | 级别 |
|------|------|------|
| 高错误率 | 5xx 错误率 > 5% 持续 5 分钟 | Critical |
| 高延迟 | P95 延迟 > 5 秒持续 3 分钟 | Warning |
| 连接池饱和 | active 连接 > 80% 上限 | Warning |
| 缓存命中率低 | 命中率 < 50% 持续 10 分钟 | Info |
| 磁盘空间 | 使用率 > 85% | Warning |

---

## 6. Emergency Procedures

### 6.1 Service Restart Procedures

**重启单个服务：**

```bash
# 重启后端（不影响数据库和缓存）
docker compose restart backend

# 重启 Redis（后端会自动降级到内存缓存）
docker compose restart redis

# 重启 Nginx（短暂中断前端访问）
docker compose restart nginx
```

**重启全部服务：**

```bash
# 停止所有服务
docker compose down

# 启动所有服务（使用生产配置）
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 验证健康状态
sleep 15 && curl -s http://localhost:8000/health
```

**强制重建：**

```bash
# 强制重建镜像并启动（代码变更后）
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate
```

### 6.2 Database Failover

**主库不可用时的处理：**

1. 确认主库故障：
   ```bash
   docker exec rmfood-postgres pg_isready -U rmfood -d rmfood
   # 如果失败，检查容器状态
   docker inspect rmfood-postgres --format='{{.State.Status}}'
   ```

2. 如果有只读副本（生产环境 `--profile production`），临时将读请求指向副本：
   - 修改 `.env` 中 `DATABASE_READ_REPLICA_URL` 指向副本地址 (端口 5433)
   - 注意：副本为只读，写操作仍需主库

3. 如果主库数据损坏，从最近备份恢复：
   ```bash
   # 停止后端（防止写入）
   docker compose stop backend

   # 恢复数据库
   gunzip < backups/rmfood_LATEST.sql.gz | \
     docker exec -i rmfood-postgres psql -U rmfood -d rmfood

   # 重启后端
   docker compose start backend
   ```

### 6.3 Rollback Procedures

**代码回滚（使用 Git）：**

```bash
# 查看最近的部署记录
git log --oneline -10

# 回滚到指定版本
git checkout <commit-hash>

# 重建并部署
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**数据库迁移回滚：**

```bash
cd backend

# 查看当前迁移版本
alembic current

# 查看迁移历史（找到要回滚到的版本）
alembic history

# 回滚到指定版本
alembic downgrade <revision>

# 或回滚最近一次迁移
alembic downgrade -1
```

**完整回滚流程（代码 + 数据库）：**

1. 停止后端服务：`docker compose stop backend`
2. 回滚数据库迁移：`alembic downgrade <target_revision>`
3. 回滚代码：`git checkout <previous-tag>`
4. 重建镜像：`docker compose build backend`
5. 启动服务：`docker compose start backend`
6. 验证健康：`curl http://localhost:8000/health`

---

## Appendix: Environment Variables

关键环境变量（`.env` 文件）：

| 变量 | 必填 | 说明 |
|------|------|------|
| `SECRET_KEY` | 生产必填 | JWT 签名密钥，>= 32 字符 |
| `ADMIN_PASSWORD` | 生产必填 | 管理员密码，>= 12 字符，含大小写+数字+特殊字符 |
| `POSTGRES_USER` | 是 | PostgreSQL 用户名 |
| `POSTGRES_PASSWORD` | 是 | PostgreSQL 密码 |
| `POSTGRES_DB` | 是 | 数据库名 |
| `DATABASE_URL` | 是 | 完整数据库连接串 |
| `REDIS_URL` | 否 | Redis 连接串（不设置则禁用 Redis） |
| `CORS_ORIGINS` | 否 | 允许的前端域名（逗号分隔） |
| `OPENAI_API_KEY` | 否 | LLM API Key |
| `OPENAI_BASE_URL` | 否 | LLM 自定义端点 |
| `DEBUG` | 否 | 设为 `false` 启用生产模式 |

## Appendix: Useful Commands

```bash
# 进入后端容器 Shell
docker exec -it rmfood-backend /bin/bash

# 进入 PostgreSQL Shell
docker exec -it rmfood-postgres psql -U rmfood -d rmfood

# 进入 Redis CLI
docker exec -it rmfood-redis redis-cli

# 查看 Docker 磁盘使用
docker system df

# 清理未使用的 Docker 资源
docker system prune -f

# 查看容器资源限制
docker inspect rmfood-backend --format='{{.HostConfig.Memory}}'
```
