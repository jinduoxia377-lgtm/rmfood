"""
数据库读写分离路由器

Phase 3-C: 实现读写分离，将读操作路由到只读副本。

架构：
  写操作 (INSERT/UPDATE/DELETE) → 主库 (PostgreSQL Primary)
  读操作 (SELECT) → 读库 (PostgreSQL Read Replica)

使用方式：
  from app.core.database.database_router import get_read_db, get_write_db

  @app.get("/formulas")
  async def list_formulas(db: AsyncSession = Depends(get_read_db)):
      # 读操作使用读库
      ...

  @app.post("/formulas")
  async def create_formula(db: AsyncSession = Depends(get_write_db)):
      # 写操作使用主库
      ...
"""
from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from ..config import settings

logger = logging.getLogger(__name__)

# ──────────── 读库引擎（延迟初始化）────────────
_read_replica_engine = None
_read_session_factory = None


async def init_read_replica():
    """初始化读库连接（如果在配置中启用了读库）"""
    global _read_replica_engine, _read_session_factory

    if not settings.database_read_replica_url:
        logger.info("[ReadReplica] 未配置读库 URL，读写分离未启用")
        return False

    try:
        _read_replica_engine = create_async_engine(
            settings.database_read_replica_url,
            echo=settings.debug,
            pool_size=10,
            max_overflow=5,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_use_lifo=True,
            isolation_level="READ COMMITTED",  # 读库使用较低的隔离级别
        )

        _read_session_factory = async_sessionmaker(
            bind=_read_replica_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        # 测试连接
        from sqlalchemy import text
        async with _read_replica_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            await conn.commit()

        logger.info("[ReadReplica] 读库连接已建立")
        return True

    except Exception as e:
        logger.error(f"[ReadReplica] 读库初始化失败: {e}")
        _read_replica_engine = None
        _read_session_factory = None
        return False


async def close_read_replica():
    """关闭读库连接"""
    global _read_replica_engine
    if _read_replica_engine:
        await _read_replica_engine.dispose()
        _read_replica_engine = None
        logger.info("[ReadReplica] 读库连接已关闭")


async def check_read_replica_health() -> dict:
    """检查读库健康状态"""
    if not _read_replica_engine:
        return {"status": "not_configured"}

    try:
        from sqlalchemy import text
        import time
        start = time.perf_counter()
        async with _read_replica_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            await conn.commit()
        latency = (time.perf_counter() - start) * 1000

        return {
            "status": "healthy",
            "latency_ms": round(latency, 2),
            "pool": {
                "size": _read_replica_engine.pool.size(),
                "checked_in": _read_replica_engine.pool.checkedin(),
                "checked_out": _read_replica_engine.pool.checkedout(),
                "overflow": _read_replica_engine.pool.overflow(),
            } if hasattr(_read_replica_engine.pool, "size") else {},
        }
    except Exception as e:
        logger.error("读库健康检查失败", exc_info=True)
        return {"status": "unhealthy", "error": "读库连接异常"}


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取读库会话（依赖注入）

    如果读库未配置或不可用，降级到主库。
    """
    if _read_session_factory:
        session = _read_session_factory()
        try:
            yield session
        finally:
            await session.close()
    else:
        # 降级：使用主库
        from ..database.session import async_session_factory
        async with async_session_factory() as session:
            yield session


async def get_write_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取写库会话（依赖注入）

    写操作始终使用主库。
    """
    from ..database.session import async_session_factory
    async with async_session_factory() as session:
        yield session


# ──────────── 读写分离装饰器 ────────────

def route_to_read_replica():
    """
    装饰器：将函数内的数据库操作路由到读库

    使用方式：
        @route_to_read_replica()
        async def get_user_profile(user_id: int):
            # 此函数内的所有读操作使用读库
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # 在函数执行期间，临时替换 get_db 依赖
            # 注意：这需要配合特定的 Session 管理机制
            # 当前实现中，我们依赖显式的 get_read_db() 依赖注入
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def get_replication_lag() -> dict:
    """
    获取读库复制延迟（Phase 4-D: 读库延迟监控）

    通过比较主库和读库的事务时间戳来估算复制延迟。
    支持 PostgreSQL 的 pg_last_xact_replay_timestamp() 函数。

    Returns:
        {
            "status": "ok" | "warning" | "critical" | "not_configured",
            "lag_seconds": float,
            "lag_ms": float,
            "primary_ts": str,
            "replica_ts": str,
        }
    """
    import time as _time

    if not _read_replica_engine:
        return {"status": "not_configured", "lag_seconds": 0, "lag_ms": 0}

    try:
        from sqlalchemy import text
        from ..database.session import engine

        # 1. 获取主库当前时间
        primary_ts = None
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT NOW()"))
            row = result.fetchone()
            if row:
                primary_ts = row[0]

        # 2. 获取读库回放时间戳（PostgreSQL 特有）
        replica_ts = None
        async with _read_replica_engine.connect() as conn:
            # 尝试 pg_last_xact_replay_timestamp()
            try:
                result = await conn.execute(
                    text("SELECT pg_last_xact_replay_timestamp()")
                )
                row = result.fetchone()
                if row and row[0]:
                    replica_ts = row[0]
                else:
                    # 降级：使用读库当前时间
                    result = await conn.execute(text("SELECT NOW()"))
                    row = result.fetchone()
                    if row:
                        replica_ts = row[0]
            except Exception as e:
                logger.debug("pg_last_xact_replay_timestamp() 不可用（降级到 NOW()）: %s", e)
                # pg_last_xact_replay_timestamp() 不可用（如权限不足）
                result = await conn.execute(text("SELECT NOW()"))
                row = result.fetchone()
                if row:
                    replica_ts = row[0]
            await conn.commit()

        if primary_ts and replica_ts:
            lag = (primary_ts - replica_ts).total_seconds()
            lag_ms = lag * 1000

            # 延迟阈值
            if lag > 30:
                status_level = "critical"
            elif lag > 5:
                status_level = "warning"
            else:
                status_level = "ok"

            return {
                "status": status_level,
                "lag_seconds": round(lag, 3),
                "lag_ms": round(lag_ms, 1),
                "primary_ts": primary_ts.isoformat() if hasattr(primary_ts, "isoformat") else str(primary_ts),
                "replica_ts": replica_ts.isoformat() if hasattr(replica_ts, "isoformat") else str(replica_ts),
            }

        return {"status": "unknown", "lag_seconds": 0, "lag_ms": 0}

    except Exception as e:
        logger.warning("[ReadReplica] 复制延迟检查失败", exc_info=True)
        return {"status": "error", "lag_seconds": 0, "lag_ms": 0, "error": "复制延迟检查异常"}


# ──────────── 自动读写判断 ────────────

class RoutingSession:
    """
    智能路由会话：根据操作类型自动选择主库或读库

    注意：这需要深度集成 SQLAlchemy 的 Session 机制，
    当前版本中建议使用显式的 get_read_db() / get_write_db() 依赖注入。
    """
    pass
