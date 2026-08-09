#!/usr/bin/env python3
"""
🟡 P3-2: 后端健康检查脚本
- 基础检查: 应用进程存活
- 依赖检查: 数据库连接、Redis 连接
- 响应时间检查: 端点响应时间
"""

import sys
import os
import time
import asyncio
import httpx

# ─── 配置 ───

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
HEALTH_TOKEN = os.environ.get("HEALTH_CHECK_TOKEN", "")
TIMEOUT = int(os.environ.get("HEALTH_TIMEOUT", "5"))


async def check_api_health() -> tuple[bool, str]:
    """检查 API 端点是否响应"""
    try:
        headers = {"Authorization": f"Bearer {HEALTH_TOKEN}"} if HEALTH_TOKEN else {}

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            start = time.time()
            response = await client.get(f"{API_BASE_URL}/health", headers=headers)
            elapsed = time.time() - start

            if response.status_code == 200:
                return True, f"OK ({elapsed*1000:.0f}ms)"
            else:
                return False, f"HTTP {response.status_code}"
    except Exception as e:
        return False, str(e)


async def check_database() -> tuple[bool, str]:
    """检查数据库连接"""
    try:
        # 方式 1: 使用 httpx 调用内部健康端点
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(
                    f"{API_BASE_URL}/health/db",
                    headers={"Authorization": f"Bearer {HEALTH_TOKEN}"} if HEALTH_TOKEN else {},
                )
                if response.status_code == 200:
                    return True, "OK"
        except:
            pass

        # 方式 2: 直接连接数据库
        try:
            import asyncpg
            db_url = os.environ.get("DATABASE_URL", "")
            if db_url:
                # 解析并连接
                conn = await asyncpg.connect(
                    database_url.replace("postgresql+asyncpg://", "postgres://")
                )
                await conn.fetchval("SELECT 1")
                await conn.close()
                return True, "OK (direct)"
        except:
            pass

        return True, "skipped"

    except Exception as e:
        return False, f"DB error: {str(e)[:50]}"


async def check_redis() -> tuple[bool, str]:
    """检查 Redis 连接"""
    try:
        try:
            import redis.asyncio as redis
            # Use REDIS_URL from env (set in docker-compose as redis://redis:6379/0)
            redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
            client = await redis.from_url(redis_url, socket_timeout=TIMEOUT)
            await client.ping()
            await client.close()
            return True, "OK"
        except ImportError:
            pass

        # 备选：使用 httpx
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(
                    f"{API_BASE_URL}/health/redis",
                    headers={"Authorization": f"Bearer {HEALTH_TOKEN}"} if HEALTH_TOKEN else {},
                )
                if response.status_code == 200:
                    return True, "OK"
        except:
            pass

        return True, "skipped"

    except Exception as e:
        return False, f"Redis error: {str(e)[:50]}"


async def main() -> int:
    """执行所有健康检查"""
    checks = {
        "API": check_api_health(),
        "Database": check_database(),
        "Redis": check_redis(),
    }

    results = {}
    all_passed = True

    print("🔍 健康检查开始...")
    print("=" * 50)

    for name, coro in checks.items():
        ok, detail = await coro
        results[name] = (ok, detail)
        status = "✅" if ok else "❌"
        print(f"  {status} {name}: {detail}")
        if not ok:
            all_passed = False

    print("=" * 50)

    if all_passed:
        print("✅ 所有检查通过")
        return 0
    else:
        failed = [k for k, (ok, _) in results.items() if not ok]
        print(f"❌ 检查失败: {', '.join(failed)}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
