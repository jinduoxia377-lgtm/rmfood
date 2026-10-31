#!/bin/bash
# RMFOOD 后端启动脚本
# 1. 等待 PostgreSQL 就绪
# 2. 运行 Alembic 迁移（确保 schema 最新）
# 3. 启动 Uvicorn 服务

set -e

echo "[启动] 等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
    if python -c "
import os, sys, asyncio
try:
    import asyncpg
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        sys.exit(1)
    async def check():
        conn = await asyncpg.connect(url.replace('postgresql+asyncpg://', 'postgres://'))
        await conn.fetchval('SELECT 1')
        await conn.close()
    asyncio.run(check())
    sys.exit(0)
except Exception as e:
    sys.exit(1)
" 2>/dev/null; then
        echo "[启动] PostgreSQL 连接成功"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "[启动] 警告: 数据库连接超时，继续启动"
    fi
    sleep 2
done

echo "[启动] 运行 Alembic 数据库迁移..."
cd /app
export PYTHONPATH=/app:$PYTHONPATH
alembic upgrade head 2>&1 || echo "[启动] 警告: Alembic 迁移失败（可能无需迁移）"

echo "[启动] 启动 Uvicorn 服务..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --timeout-keep-alive 30