"""
数据库会话管理
异步引擎 + 依赖注入 + 连接池优化 + 异常处理

P2-1 优化:
- SQLite 与 PostgreSQL 分离配置（SQLite 不支持连接池）
- PostgreSQL 增大连接池 + 连接健康检查
- 添加连接事件监听器

Phase PG 升级:
- 数据库异常分类（连接错误 vs 查询错误）
- 自动重连机制（断连检测 + 恢复）
- 连接健康检查端点
"""
import logging
import asyncio
from typing import Optional

from sqlalchemy import event, text
from sqlalchemy.exc import (
    DBAPIError,
    OperationalError,
    InterfaceError,
    PendingRollbackError,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from .config import settings
from .database import Base

logger = logging.getLogger(__name__)

# ── 数据库异常分类 ──

class DatabaseError(Exception):
    """数据库操作基础异常"""
    def __init__(self, message: str, original: Optional[Exception] = None, recoverable: bool = True):
        self.message = message
        self.original = original
        self.recoverable = recoverable
        super().__init__(message)


class DatabaseConnectionError(DatabaseError):
    """数据库连接异常（网络中断、认证失败等）— 通常可恢复"""
    pass


class DatabaseQueryError(DatabaseError):
    """查询执行异常（语法错误、约束违反等）— 通常不可恢复"""
    def __init__(self, message: str, original: Optional[Exception] = None):
        super().__init__(message, original, recoverable=False)


def _classify_db_error(e: Exception) -> DatabaseError:
    """
    将 SQLAlchemy/DBAPI 异常分类为可操作的 DatabaseError 子类

    可恢复 (DatabaseConnectionError):
    - OperationalError: 连接超时、服务不可达、认证失败
    - InterfaceError: 连接已关闭、底层 cursor 失效
    - PendingRollbackError: 事务状态不一致（PostgreSQL 特有）

    不可恢复 (DatabaseQueryError):
    - IntegrityError: 唯一约束冲突、外键违反
    - ProgrammingError: SQL 语法错误、表不存在
    """
    if isinstance(e, (OperationalError, InterfaceError, PendingRollbackError)):
        return DatabaseConnectionError(
            message=f"数据库连接异常: {str(e)}",
            original=e,
            recoverable=True,
        )
    # IntegrityError, DataError, ProgrammingError → QueryError
    return DatabaseQueryError(
        message=f"数据库查询异常: {str(e)}",
        original=e,
    )


def _build_database_url_with_encoding(url: str) -> str:
    """智能构建数据库URL，确保包含正确的字符集编码"""
    if not url:
        return url

    if url.startswith('sqlite'):
        if 'charset=' not in url and '?' not in url:
            return f"{url}?charset=utf8mb4"
        elif '?' in url and 'charset=' not in url:
            return f"{url}&charset=utf8mb4"
        return url

    elif url.startswith('postgresql') or url.startswith('postgres'):
        # PostgreSQL 编码通过 server_settings 传递，不附加到 URL
        # (asyncpg 不支持 client_encoding 作为 URL 参数)
        return url

    elif url.startswith('mysql'):
        if 'charset=' not in url:
            if '?' in url:
                return f"{url}&charset=utf8mb4"
            else:
                return f"{url}?charset=utf8mb4"
        return url

    return url


def _create_engine():
    """
    根据数据库类型创建最优配置的引擎。

    - SQLite: 不使用连接池（单文件数据库，pool_size 无效）
    - PostgreSQL: 使用连接池 + 健康检查
    """
    database_url = _build_database_url_with_encoding(settings.database.url)
    is_sqlite = database_url.startswith('sqlite')

    if is_sqlite:
        # SQLite 不支持真正的连接池，使用 NullPool
        engine = create_async_engine(
            database_url,
            echo=settings.debug,
            future=True,
            connect_args={"check_same_thread": False},
        )
        logger.info("📦 SQLite 引擎已创建（无连接池）")
    else:
        # PostgreSQL/MySQL 使用连接池
        engine = create_async_engine(
            database_url,
            echo=settings.debug,
            future=True,
            # ── 连接池配置 ──
            pool_size=settings.database.pool_size,          # 常驻连接数（默认20）
            max_overflow=settings.database.max_overflow,     # 溢出连接数（默认10）
            pool_timeout=settings.database.pool_timeout,     # 获取连接超时（秒）
            pool_recycle=settings.database.pool_recycle,     # 连接回收时间（秒）
            pool_pre_ping=True,                            # 连接健康检查
            # ── 连接参数 ──
            connect_args={
                "server_settings": {
                    "application_name": "rmfood",
                    "jit": "off",           # 关闭 JIT（短查询更快）
                    "client_encoding": "UTF8",  # 客户端编码
                },
            },
        )
        logger.info(
            f"📦 PostgreSQL 引擎已创建 | "
            f"pool_size={settings.database.pool_size} | "
            f"max_overflow={settings.database.max_overflow} | "
            f"pool_pre_ping=True"
        )

    return engine


engine = _create_engine()

# 创建异步会话工厂
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,       # 禁用自动刷新，提高性能
)


async def get_db() -> AsyncSession:
    """
    FastAPI 依赖注入：获取数据库会话

    增强特性:
    - 自动 commit/rollback
    - 异常分类与日志记录
    - 断连检测 + 会话自动回收
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except (OperationalError, InterfaceError, PendingRollbackError) as conn_err:
            # 连接级异常：回滚并标记为可恢复
            await session.rollback()
            db_err = _classify_db_error(conn_err)
            logger.error(
                f"[DB] 连接异常 ({type(db_err).__name__}): {db_err.message} | "
                f"原始: {type(conn_err).__name__}: {conn_err}"
            )
            raise db_err
        except DBAPIError as query_err:
            # 查询级异常：回滚后抛出分类异常
            await session.rollback()
            db_err = _classify_db_error(query_err)
            logger.warning(
                f"[DB] 查询异常 ({type(db_err).__name__}): {db_err.message}"
            )
            raise db_err
        except Exception as e:
            # 未分类异常：安全回滚后重新抛出
            await session.rollback()
            logger.error(f"[DB] 未预期异常: {type(e).__name__}: {e}")
            raise
        finally:
            await session.close()


async def check_database_health() -> dict:
    """
    数据库连接健康检查（用于 /health 端点和监控）

    Returns:
        dict: {
            "status": "healthy" | "degraded" | "unhealthy",
            "database": str,          # 数据库类型和版本
            "latency_ms": float,      # ping 延迟
            "pool": dict,             # 连接池状态
            "error": str | None,     # 错误信息（如有）
        }
    """
    result = {
        "status": "unknown",
        "database": "unknown",
        "latency_ms": -1,
        "pool": {},
        "error": None,
    }

    import time
    start = time.perf_counter()

    try:
        # 1. 执行简单查询验证连接可用性
        async with engine.connect() as conn:
            is_pg = not settings.database.url.startswith("sqlite")
            if is_pg:
                db_result = await conn.execute(text("SELECT version()"))
                version_row = db_result.scalar()
                result["database"] = f"PostgreSQL {version_row}" if version_row else "PostgreSQL"
            else:
                db_result = await conn.execute(text("SELECT sqlite_version()"))
                version_row = db_result.scalar()
                result["database"] = f"SQLite {version_row}" if version_row else "SQLite"

        latency = (time.perf_counter() - start) * 1000
        result["latency_ms"] = round(latency, 2)

        # 2. 获取连接池状态
        pool_status = await get_pool_status()
        result["pool"] = pool_status

        # 3. 判断健康等级
        checked_out = pool_status.get("checked_out", 0)
        pool_size = pool_status.get("pool_size", 0)
        overflow = pool_status.get("overflow", 0)

        if latency < 100 and overflow == 0:
            result["status"] = "healthy"
        elif latency < 1000 and checked_out < pool_size + 5:
            result["status"] = "degraded"
        else:
            result["status"] = "unhealthy"
            result["error"] = f"高延迟({latency:.0f}ms)或连接池饱和(checked_out={checked_out})"

    except OperationalError as e:
        result["status"] = "unhealthy"
        result["error"] = f"无法连接数据库: {e}"
        result["latency_ms"] = (time.perf_counter() - start) * 1000
        logger.error(f"[DB-Health] 数据库连接失败: {e}")
    except Exception as e:
        result["status"] = "unhealthy"
        result["error"] = f"健康检查异常: {e}"
        result["latency_ms"] = (time.perf_counter() - start) * 1000
        logger.error(f"[DB-Health] 健康检查异常: {e}")

    return result


async def ensure_connection():
    """
    确保数据库连接可用（启动时调用）

    最多重试 3 次，每次间隔递增（1s → 2s → 4s）
    成功返回 True，失败返回 False
    """
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info(f"[DB] 连接验证成功 (第{attempt}次尝试)")
            return True
        except Exception as e:
            if attempt < max_retries:
                wait = 2 ** (attempt - 1)
                logger.warning(
                    f"[DB] 连接验证失败 (第{attempt}/{max_retries}次), "
                    f"{wait}s 后重试... 错误: {e}"
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    f"[DB] 连接验证最终失败 (已重试{max_retries}次): {e}"
                )
                return False
    return False


async def init_database():
    """初始化数据库：创建所有表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_pool_status() -> dict:
    """
    获取连接池状态（用于监控端点）

    Returns:
        dict: 连接池统计信息
    """
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }
