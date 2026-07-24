"""
PostgreSQL 数据库会话管理

本模块实现安全高效的 PostgreSQL 连接管理，包括:
- 基于 asyncpg 的异步连接池（SQLAlchemy AsyncEngine）
- 连接有效性验证（pool_pre_ping + 启动时连接测试）
- 全面的异常分类与结构化错误信息
- 自动重连机制（断连检测 + 指数退避重试）
- 连接池监控与健康检查

安全注意事项:
- 所有 SQL 语句必须使用参数化查询（防止 SQL 注入）
- 连接凭证通过环境变量注入，不硬编码
- 支持 SSL/TLS 加密连接
- 连接池连接在使用后自动回收，防止泄露

性能优化建议:
- pool_size 设为 CPU核心数*2，max_overflow 设为 pool_size 的 50%
- 启用 pool_pre_ping 避免使用过期连接
- pool_recycle 应小于 PostgreSQL 的 wait_timeout
- 使用 pool_use_lifo=True 优先复用最近释放的连接

故障排除:
- "连接超时": 检查 PostgreSQL 是否运行、pg_hba.conf、防火墙规则
- "认证失败": 确认 POSTGRES_USER/POSTGRES_PASSWORD 正确
- "连接池耗尽": 增大 pool_size/max_overflow，排查未关闭的会话
- "SSL 错误": 检查 ssl_mode 配置与服务器证书
"""
import logging
import asyncio
import time
from typing import Optional

from sqlalchemy import event, text
from sqlalchemy.exc import (
    DBAPIError,
    OperationalError,
    InterfaceError,
    PendingRollbackError,
    IntegrityError,
    ProgrammingError,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from ..config import settings
from .database import Base

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════
# 数据库异常分类
# ═════════════════════════════════════════════


class DatabaseError(Exception):
    """
    数据库操作基础异常

    Attributes:
        message: 人类可读的错误描述
        original: 原始异常对象
        recoverable: 是否可自动恢复（用于重试决策）
        error_code: 结构化错误码（用于前端/监控分类）
    """

    def __init__(
        self,
        message: str,
        original: Optional[Exception] = None,
        recoverable: bool = True,
        error_code: str = "DB_ERROR",
    ):
        self.message = message
        self.original = original
        self.recoverable = recoverable
        self.error_code = error_code
        super().__init__(message)


class DatabaseConnectionError(DatabaseError):
    """
    数据库连接异常（可恢复）

    触发场景: 网络中断、认证失败、连接超时、服务不可达
    建议处理: 自动重试（指数退避）
    """

    def __init__(self, message: str, original: Optional[Exception] = None):
        super().__init__(
            message=message,
            original=original,
            recoverable=True,
            error_code="DB_CONNECTION_ERROR",
        )


class DatabaseQueryError(DatabaseError):
    """
    数据库查询异常（通常不可恢复）

    触发场景: SQL 语法错误、约束违反、表不存在
    建议处理: 修正查询逻辑，不需要重试
    """

    def __init__(self, message: str, original: Optional[Exception] = None):
        super().__init__(
            message=message,
            original=original,
            recoverable=False,
            error_code="DB_QUERY_ERROR",
        )


class DatabasePoolExhaustedError(DatabaseError):
    """
    连接池耗尽异常

    触发场景: 并发请求超过 pool_size + max_overflow，且全部连接被占用
    建议处理: 增大连接池参数，排查长事务或慢查询
    """

    def __init__(self, message: str, original: Optional[Exception] = None):
        super().__init__(
            message=message,
            original=original,
            recoverable=True,
            error_code="DB_POOL_EXHAUSTED",
        )


def _classify_db_error(e: Exception) -> DatabaseError:
    """
    将 SQLAlchemy/DBAPI 异常分类为可操作的 DatabaseError 子类

    分类规则:
    - OperationalError → DatabaseConnectionError（连接超时、服务不可达）
    - InterfaceError → DatabaseConnectionError（连接已关闭、cursor 失效）
    - PendingRollbackError → DatabaseConnectionError（事务状态不一致）
    - IntegrityError → DatabaseQueryError（约束违反）
    - ProgrammingError → DatabaseQueryError（SQL 语法错误）
    - 其他 DBAPIError → DatabaseQueryError
    """
    if isinstance(e, (OperationalError, InterfaceError, PendingRollbackError)):
        # 检查是否为连接池耗尽
        error_msg = str(e).lower()
        if "pool" in error_msg and ("exhausted" in error_msg or "timeout" in error_msg):
            return DatabasePoolExhaustedError(
                message="连接池耗尽，请稍后重试",
                original=e,
            )
        return DatabaseConnectionError(
            message=f"数据库连接异常: {e}",
            original=e,
        )
    if isinstance(e, (IntegrityError, ProgrammingError)):
        return DatabaseQueryError(
            message=f"数据库查询异常: {e}",
            original=e,
        )
    # 其他 DBAPI 异常
    return DatabaseQueryError(
        message=f"数据库操作异常: {e}",
        original=e,
    )


# ═════════════════════════════════════════════
# PostgreSQL 连接引擎创建
# ═════════════════════════════════════════════


def _create_engine():
    """
    创建 PostgreSQL 专用异步引擎

    使用 asyncpg 驱动（高性能 PostgreSQL 异步驱动）:
    - 纯 Python 实现，无 C 扩展依赖
    - 支持准备语句缓存，减少解析开销
    - 支持 PostgreSQL 特有类型（JSONB、ARRAY、HSTORE 等）

    连接池配置:
    - pool_size: 常驻连接数（默认 20）
    - max_overflow: 溢出连接数（默认 10，总最大 30）
    - pool_timeout: 获取连接超时 30s
    - pool_recycle: 连接回收 3600s（1小时）
    - pool_pre_ping: 使用前验证连接有效性
    - pool_use_lifo: 优先复用最近释放的连接

    安全配置:
    - SSL 模式通过 ssl_mode 参数控制
    - statement_timeout 防止慢查询阻塞连接池
    - application_name 标识应用来源（便于 DBA 追踪）

    Raises:
        ValueError: 如果数据库 URL 不是 PostgreSQL 协议
    """
    database_url = settings.database.url

    # 安全检查：确保 URL 是 PostgreSQL 协议
    if not database_url or not database_url.startswith(("postgresql", "postgres")):
        raise ValueError(
            f"仅支持 PostgreSQL 数据库。当前 URL 协议无效: "
            f"{database_url[:30]}... " if database_url else "未配置数据库 URL"
        )

    # 构建 asyncpg 连接参数
    connect_args = {
        "server_settings": {
            "application_name": "rmfood",          # 便于 PostgreSQL 追踪连接来源
            "jit": "off",                          # 关闭 JIT（短查询更快）
            "client_encoding": "UTF8",             # 客户端编码
            "statement_timeout": str(settings.database.statement_timeout_ms),  # 慢查询保护
        },
        "command_timeout": settings.database.pool_timeout,  # 单条命令超时
    }

    # SSL 配置
    ssl_mode = settings.database.ssl_mode
    if ssl_mode != "disable":
        connect_args["ssl"] = ssl_mode

    engine = create_async_engine(
        database_url,
        echo=settings.debug,
        echo_pool=settings.database.echo_pool,
        future=True,
        # ── 连接池配置 ──
        pool_size=settings.database.pool_size,          # 常驻连接数
        max_overflow=settings.database.max_overflow,     # 溢出连接数
        pool_timeout=settings.database.pool_timeout,     # 获取连接超时（秒）
        pool_recycle=settings.database.pool_recycle,     # 连接回收时间（秒）
        pool_pre_ping=True,                              # 使用前验证连接有效性
        pool_use_lifo=True,                              # 优先复用最近释放的连接
        # ── 连接参数 ──
        connect_args=connect_args,
    )

    logger.info(
        f"[DB] PostgreSQL 引擎已创建 | "
        f"pool_size={settings.database.pool_size} | "
        f"max_overflow={settings.database.max_overflow} | "
        f"pool_recycle={settings.database.pool_recycle}s | "
        f"pool_pre_ping=True | "
        f"ssl_mode={ssl_mode} | "
        f"statement_timeout={settings.database.statement_timeout_ms}ms"
    )

    return engine


# ── 创建全局引擎实例 ──
engine = _create_engine()

# ── 创建异步会话工厂 ──
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,    # 提交后不刷新对象（避免额外查询）
    autoflush=False,           # 禁用自动刷新（显式控制，提高性能）
)


# ═════════════════════════════════════════════
# 连接事件监听器
# ═════════════════════════════════════════════


@event.listens_for(engine.sync_engine, "connect")
def _on_connect(dbapi_conn, connection_record):
    """新连接创建时触发：记录连接事件"""
    logger.debug(f"[DB] 新连接已建立: {id(dbapi_conn)}")


# NOTE: Removed redundant _on_checkout event listener.
# pool_pre_ping=True on create_async_engine already handles connection validation
# on checkout. The empty pass listener was dead code.


@event.listens_for(engine.sync_engine, "checkin")
def _on_checkin(dbapi_conn, connection_record):
    """连接归还到池中时触发"""
    pass


# ═════════════════════════════════════════════
# 依赖注入：获取数据库会话
# ═════════════════════════════════════════════


async def get_db() -> AsyncSession:
    """
    FastAPI 依赖注入：获取数据库会话

    增强特性:
    - 条件 commit（仅在存在变更时提交）
    - 异常分类与结构化错误信息
    - 断连检测 + 会话自动回收
    - 详细的错误日志（包含异常分类和原始错误）

    使用方式:
        @app.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async with async_session_factory() as session:
        try:
            yield session
            # 仅在存在未提交的变更时才 commit（避免无意义的事务提交）
            if session.dirty or session.new:
                await session.commit()
        except (OperationalError, InterfaceError, PendingRollbackError) as conn_err:
            # 连接级异常：回滚并标记为可恢复
            await session.rollback()
            db_err = _classify_db_error(conn_err)
            logger.error(
                f"[DB] 连接异常 ({db_err.error_code}): {db_err.message} | "
                f"原始: {type(conn_err).__name__}: {conn_err}"
            )
            raise db_err
        except (IntegrityError, ProgrammingError) as query_err:
            # 查询级异常：回滚后抛出分类异常
            await session.rollback()
            db_err = _classify_db_error(query_err)
            logger.warning(
                f"[DB] 查询异常 ({db_err.error_code}): {db_err.message}"
            )
            raise db_err
        except DBAPIError as dbapi_err:
            # 其他 DBAPI 异常
            await session.rollback()
            db_err = _classify_db_error(dbapi_err)
            logger.error(
                f"[DB] DBAPI 异常 ({db_err.error_code}): {db_err.message}"
            )
            raise db_err
        except Exception as e:
            # 未分类异常：安全回滚后重新抛出
            await session.rollback()
            logger.error(f"[DB] 未预期异常: {type(e).__name__}: {e}")
            raise
        finally:
            await session.close()


# ═════════════════════════════════════════════
# 数据库健康检查
# ═════════════════════════════════════════════


async def check_database_health() -> dict:
    """
    数据库连接健康检查（用于 /health 端点和监控）

    检查内容:
    1. 执行 SELECT 1 验证连接可用性
    2. 查询 PostgreSQL 版本号
    3. 获取连接池状态
    4. 计算连接延迟
    5. 判断健康等级

    Returns:
        dict: {
            "status": "healthy" | "degraded" | "unhealthy",
            "database": str,          # PostgreSQL 版本
            "latency_ms": float,      # ping 延迟
            "pool": dict,             # 连接池状态
            "error": str | None,     # 错误信息
        }
    """
    result = {
        "status": "unknown",
        "database": "unknown",
        "latency_ms": -1,
        "pool": {},
        "error": None,
    }

    start = time.perf_counter()

    try:
        # 1. 执行简单查询验证连接可用性
        async with engine.connect() as conn:
            # 查询 PostgreSQL 版本
            db_result = await conn.execute(text("SELECT version()"))
            version_row = db_result.scalar()
            result["database"] = f"PostgreSQL {version_row}" if version_row else "PostgreSQL"

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
        result["error"] = f"无法连接 PostgreSQL: {e}"
        result["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
        logger.error(f"[DB-Health] PostgreSQL 连接失败: {e}")
    except Exception as e:
        result["status"] = "unhealthy"
        result["error"] = f"健康检查异常: {e}"
        result["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
        logger.error(f"[DB-Health] 健康检查异常: {e}")

    return result


# ═════════════════════════════════════════════
# 启动时连接验证（自动重连）
# ═════════════════════════════════════════════


async def ensure_connection() -> bool:
    """
    启动时验证数据库连接可用性

    采用指数退避重试策略:
    - 最多重试 5 次
    - 间隔: 1s → 2s → 4s → 8s → 16s
    - 每次重试前执行连接测试

    Returns:
        True: 连接验证成功
        False: 连接验证失败（应用应拒绝启动或降级运行）

    故障排除建议（连接失败时）:
    1. 检查 PostgreSQL 服务是否运行: systemctl status postgresql
    2. 检查连接参数: DATABASE_URL 或 POSTGRES_* 环境变量
    3. 检查防火墙规则: 是否允许 5432 端口
    4. 检查 pg_hba.conf: 是否允许应用 IP 连接
    5. 检查 SSL 配置: ssl_mode 是否与服务器匹配
    """
    max_retries = 5

    for attempt in range(1, max_retries + 1):
        try:
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                result.scalar()  # 确保结果被消费

            logger.info(
                f"[DB] PostgreSQL 连接验证成功 (第{attempt}次尝试) | "
                f"host={settings.database_host}:{settings.database_port} | "
                f"database={settings.database_name}"
            )
            return True

        except OperationalError as e:
            wait = 2 ** (attempt - 1)  # 指数退避: 1, 2, 4, 8, 16
            if attempt < max_retries:
                logger.warning(
                    f"[DB] PostgreSQL 连接验证失败 (第{attempt}/{max_retries}次), "
                    f"{wait}s 后重试 | 错误: {e}"
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    f"[DB] PostgreSQL 连接验证最终失败 (已重试{max_retries}次) | "
                    f"错误: {e}\n"
                    f"故障排除:\n"
                    f"  1. 检查 PostgreSQL 服务是否运行\n"
                    f"  2. 检查 DATABASE_URL 或 POSTGRES_* 环境变量\n"
                    f"  3. 检查防火墙是否允许 {settings.database_port} 端口\n"
                    f"  4. 检查 pg_hba.conf 是否允许应用连接\n"
                    f"  5. 检查 SSL 配置 (ssl_mode={settings.database.ssl_mode})"
                )
                return False

        except Exception as e:
            logger.error(
                f"[DB] PostgreSQL 连接验证异常 (第{attempt}次): "
                f"{type(e).__name__}: {e}"
            )
            if attempt < max_retries:
                await asyncio.sleep(2 ** (attempt - 1))
            else:
                return False

    return False


# ═════════════════════════════════════════════
# 数据库初始化
# ═════════════════════════════════════════════


async def init_database():
    """
    初始化数据库：创建所有表

    注意：此方法使用 metadata.create_all() 作为开发环境兜底。
    生产环境应使用 Alembic 迁移：
        cd backend && alembic upgrade head

    如果 Alembic 迁移链断裂（KeyError），请先修复：
        cd backend && alembic check
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("[DB] 数据库表结构已同步（fallback: create_all）")
    except Exception as e:
        logger.warning(f"[DB] create_all 失败，请检查 Alembic 迁移: {e}")


# ═════════════════════════════════════════════
# 连接池监控
# ═════════════════════════════════════════════


async def get_pool_status() -> dict:
    """
    获取连接池状态（用于监控端点）

    Returns:
        dict: {
            "pool_size": int,       # 连接池大小
            "checked_in": int,      # 空闲连接数
            "checked_out": int,     # 使用中连接数
            "overflow": int,        # 溢出连接数
            "utilization_pct": float, # 连接池使用率
        }
    """
    pool = engine.pool
    pool_size = pool.size()
    checked_out = pool.checkedout()
    total_capacity = pool_size + settings.database.max_overflow
    utilization = (checked_out / total_capacity * 100) if total_capacity > 0 else 0

    return {
        "pool_size": pool_size,
        "checked_in": pool.checkedin(),
        "checked_out": checked_out,
        "overflow": pool.overflow(),
        "utilization_pct": round(utilization, 1),
    }


async def close_database():
    """
    关闭数据库连接池（应用关闭时调用）

    安全地释放所有连接，确保没有资源泄露。
    """
    await engine.dispose()
    logger.info("[DB] PostgreSQL 连接池已关闭")
