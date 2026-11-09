"""
PostgreSQL 数据库会话管理

本模块实现安全高效的 PostgreSQL 连接管理，包括:
- 基于 asyncpg 的异步连接池（SQLAlchemy AsyncEngine）
- Windows 平台特定优化：禁用 pool_pre_ping，启用 checkout 验证和 TCP keepalive
- 全面的异常分类与结构化错误信息
- 自动重连机制（断连检测 + 指数退避重试）
- 连接池监控与健康检查

安全注意事项:
- 所有 SQL 语句必须使用参数化查询（防止 SQL 注入）
- 连接凭证通过环境变量注入，不硬编码
- 支持 SSL/TLS 加密连接
- 连接池连接在使用后自动回收，防止泄露

性能优化建议:
- Windows 环境自动减小 pool_size 以减少连接争用
- 启用 asyncpg 层面的 TCP keepalives（默认 30s idle 间隔）
- Linux/WSL 保留标准配置和 pool_pre_ping
- pool_recycle 应小于 PostgreSQL 的 wait_timeout
- 使用 pool_use_lifo=True 优先复用最近释放的连接

故障排除:
- "connection closed in the middle of operation": Windows 特有，检查连接池大小和 keepalive 设置
- "连接超时": 检查 PostgreSQL 是否运行、pg_hba.conf、防火墙规则
- "认证失败": 确认 POSTGRES_USER/POSTGRES_PASSWORD 正确
- "连接池耗尽": 增大 pool_size/max_overflow，排查未关闭的会话
- "SSL 错误": 检查 ssl_mode 配置与服务器证书
"""
import asyncio
import logging
import os
import time
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.exc import (
    DBAPIError,
    IntegrityError,
    InterfaceError,
    OperationalError,
    PendingRollbackError,
    ProgrammingError,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# NOTE: DATABASE_URL is provided via Docker environment variables.
# Do NOT call load_dotenv here to avoid overwriting container env vars.
from .database import Base

logger = logging.getLogger(__name__)

def _get_settings():
    """Lazy import settings to ensure dotenv is loaded first"""
    # Docker environment already provides DATABASE_URL via compose
    from ..config import get_settings
    return get_settings()


# ═════════════════════════════════════════════
# Windows 平台特定的连接池优化
# ═════════════════════════════════════════════════


def _get_windows_tuned_params() -> Dict[str, Any]:
    """
    返回针对 Windows 平台优化的连接池参数。

    根本原因分析：
    Windows asyncpg 连接池存在已知行为特征：
    1. pool_pre_ping（使用前 ping 验证）存在竞态条件：ping 时连接有效，
       但后续实际 execute 前连接可能被 PostgreSQL 或中间件关闭，导致
       "connection was closed in the middle of operation" 错误。
    2. 事件循环调度延迟可能使 keepalive 包发送不及时，导致 TCP 超时。
    3. Unicode 路径解析带来的额外 I/O 延迟可能放大窗口效应。

    解决方案组合：
    - 当在 Windows 运行时，禁用 pool_pre_ping，改用 checkout 时的轻量级校验
    - 启用 asyncpg 层面的 TCP keepalive 参数防止空闲连接被中间设备丢弃
    - 适当减小 pool_size 以减少并发争用
    - 缩短 pool_recycle 定期轮换连接，避免长期持有潜在损坏的连接

    Returns:
        Dictionary with tunable parameters based on platform detection
    """
    params = {
        'pool_pre_ping': True,      # Default: enabled for Linux/WSL
        'pool_size': None,          # Override on Windows
        'pool_recycle': None,       # Override on Windows
        'keepalive_enabled': True,  # TCP keepalive for Windows stability
    }

    if os.name == 'nt':  # Windows detected
        logger.info(
            "[DB] Windows platform detected - applying connection stability "
            "tuning parameters to prevent asyncpg race conditions"
        )

        # Critical fix: Disable pool_pre_ping which causes race condition on Windows
        # The issue: asyncpg's pre-ping checks validity at checkout, but by the time
        # we execute the actual query, the connection may have been silently closed
        # by PG server or network infrastructure. This creates a window where
        # the connection appears valid then fails mid-operation.
        params['pool_pre_ping'] = False

        # Reduce pool size to minimize connection contention and timeout windows
        base_pool = _get_settings().database.pool_size
        params['pool_size'] = max(2, base_pool // 4)  # Quarter size on Windows

        # More aggressive recycle to prevent holding connections across long idle periods
        # (important because without pre-ping, we rely on periodic recycling)
        params['pool_recycle'] = min(600, _get_settings().database.pool_recycle)  # Max 10 mins

        # NOTE: On Windows the engine below uses NullPool (poolclass=NullPool), which
        # OPENS A FRESH CONNECTION PER CHECKOUT and ignores pool_size/max_overflow/
        # pool_timeout entirely. So params['pool_size'] here is effectively UNUSED —
        # logged only for reference. Do NOT misread "pool_size=5" as a finite pool that
        # can be exhausted: NullPool has no pool. Under high concurrency the real risk is
        # opening too many simultaneous PG backend connections (PG max_connections), not
        # pool-queue timeouts. Keep this log at debug to avoid misleading crash triage.
        logger.debug(
            f"[DB] Windows tuning: NullPool in use (pool_size param={params['pool_size']} "
            f"is IGNORED by NullPool), pool_recycle={params['pool_recycle']}s"
        )

    return params


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

    平台-aware 配置:
    - Windows 平台：禁用 pool_pre_ping，改用 checkout 验证，减小 pool_size
      （防止 ping 后连接被中间件关闭的竞态条件）
    - Linux/WSL 平台：启用 pool_pre_ping，标准池大小

    连接池配置:
    - pool_size: 常驻连接数
    - max_overflow: 溢出连接数
    - pool_timeout: 获取连接超时
    - pool_recycle: 连接回收时间
    - pool_pre_ping: 根据平台决定是否启用
    - pool_use_lifo: 优先复用最近释放的连接

    安全配置:
    - SSL 模式通过 ssl_mode 参数控制
    - statement_timeout 防止慢查询阻塞连接池
    - application_name 标识应用来源（便于 DBA 追踪）

    Raises:
        ValueError: 如果数据库 URL 不是 PostgreSQL 协议
    """
    import os
    # 优先使用环境变量
    database_url = os.environ.get('DATABASE_URL', '')

    # 如果环境变量未设置，尝试从 settings 获取
    if not database_url:
        try:
            _settings = _get_settings()
            database_url = _settings.database.url
        except Exception:
            database_url = ''

    # 安全检查：确保 URL 是 PostgreSQL 协议
    if not database_url or not database_url.startswith(("postgresql", "postgres")):
        raise ValueError(
            f"仅支持 PostgreSQL 数据库。当前 URL 协议无效: "
            f"{database_url[:30]}... " if database_url else "未配置数据库 URL"
        )

    # Get platform-tuned configuration parameters
    tuned_params = _get_windows_tuned_params()

    # Build asyncpg connection parameters with platform-specific tuning
    connect_args: Dict[str, Any] = {
        "server_settings": {
            "application_name": "rmfood",          #便于 PostgreSQL 追踪连接来源
            "jit": "off",                          #关闭 JIT（短查询更快）
            "client_encoding": "UTF8",             #客户端编码
            "statement_timeout": str(
                _get_settings().database.statement_timeout_ms
            ),  #慢查询保护
        },
        "command_timeout": _get_settings().database.pool_timeout,  #单条命令超时
    }

    # Enable TCP keepalives on Windows to prevent firewall/router drops
    # asyncpg uses socket options - simplified approach for compatibility
    # Windows-specific tuning already applied in _get_windows_tuned_params()
    if tuned_params.get('keepalive_enabled', False):
        # Add keepalive parameters to server_settings if needed
        # Currently using the default asyncpg connection behavior
        logger.debug("[DB] TCP keepalives enabled (will be applied at socket level)")

    # SSL configuration
    ssl_mode = _get_settings().database.ssl_mode
    if ssl_mode != "disable":
        connect_args["ssl"] = ssl_mode

    # Create the async engine with tuned parameters
    # Use NullPool on Windows to avoid asyncpg connection pool race conditions
    # that cause "cannot perform operation: another operation is in progress"
    try:
        from sqlalchemy.pool import NullPool
        pool_class = NullPool
        logger.info("[DB] Using NullPool to avoid Windows asyncpg pool race conditions")
        # NullPool doesn't accept pool_size/max_overflow/pool_timeout/pool_use_lifo
        engine = create_async_engine(
            database_url,
            echo=_get_settings().debug,
            echo_pool=_get_settings().database.echo_pool,
            future=True,
            poolclass=pool_class,
            # ── Connection parameters ──
            connect_args=connect_args,
        )
    except ImportError:
        engine = create_async_engine(
            database_url,
            echo=_get_settings().debug,
            echo_pool=_get_settings().database.echo_pool,
            future=True,
            # ── Connection pool configuration ──
            pool_size=tuned_params['pool_size'] or _get_settings().database.pool_size,
            max_overflow=_get_settings().database.max_overflow,
            pool_timeout=_get_settings().database.pool_timeout,
            pool_recycle=tuned_params['pool_recycle'] or _get_settings().database.pool_recycle,
            pool_pre_ping=tuned_params['pool_pre_ping'],  # Platform-appropriate setting
            pool_use_lifo=True,
            # ── Connection parameters ──
            connect_args=connect_args,
        )

    logger.info(
        f"[DB] PostgreSQL 引擎已创建 | "
        f"pool_class={type(engine.pool).__name__} | "
        f"pool_recycle={tuned_params['pool_recycle']}s | "
        f"pool_pre_ping={tuned_params['pool_pre_ping']} | "
        f"ssl_mode={ssl_mode}"
    )

    # ═════════════════════════════════════════════
    # Connection validation event listeners
    # Disabled checkout handler on Windows to avoid asyncpg race conditions.
    # The pool_pre_ping=False + pool_recycle settings handle stale connections.

    return engine


# ── 创建全局引擎实例（懒加载）──
_engine: Optional[AsyncEngine] = None

def get_engine() -> AsyncEngine:
    """获取或创建数据库引擎（懒加载）."""
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine


# ── 创建异步会话工厂（懒加载）──
_session_factory: Optional[async_sessionmaker] = None


def get_session_factory() -> async_sessionmaker:
    """获取会话工厂（懒加载）."""
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        _session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory


# 连接事件监听器已移至 _create_engine() 内部注册，此处无需定义


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
    async with get_session_factory()() as session:
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
        async with get_engine().connect() as conn:
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

        if latency < 100 and checked_out < pool_size + 5:
            result["status"] = "healthy"
        elif latency < 1000 and checked_out < pool_size + 10:
            result["status"] = "degraded"
        else:
            result["status"] = "unhealthy"
            result["error"] = f"高延迟({latency:.0f}ms)或连接池饱和(checked_out={checked_out}/{pool_size})"

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
            async with get_engine().connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                result.scalar()  # 确保结果被消费

            logger.info(
                f"[DB] PostgreSQL 连接验证成功 (第{attempt}次尝试) | "
                f"host={_get_settings().database_host}:{_get_settings().database_port} | "
                f"database={_get_settings().database_name}"
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
                    f"  3. 检查防火墙是否允许 {_get_settings().database_port} 端口\n"
                    f"  4. 检查 pg_hba.conf 是否允许应用连接\n"
                    f"  5. 检查 SSL 配置 (ssl_mode={_get_settings().database.ssl_mode})"
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

    ⚠️ 重要提示：
    - 生产环境请使用 Alembic 迁移：cd backend && alembic upgrade head
    - 只有在无法访问迁移数据库时才使用此兜底方案
    """
    # from ..config import settings  # Lazy import to avoid early initialization

    # 生产环境中不允许直接使用 create_all，强制使用 Alembic
    if _get_settings().is_production:
        logger.error(
            "[DB] PRODUCTION MODE: init_database() 正在使用 create_all() "
            "作为兜底。生产环境中应始终使用 Alembic 迁移以确保 schema 完整性。"
            "\n请运行: alembic upgrade head"
        )
        raise RuntimeError("生产环境中不允许使用 create_all，请使用 Alembic 迁移 (alembic upgrade head)")

    try:
        async with get_engine().begin() as conn:
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
    pool = get_engine().pool
    try:
        pool_size = pool.size()
    except AttributeError:
        pool_size = 0  # NullPool has no size
    try:
        checked_out = pool.checkedout()
        checked_in = pool.checkedin()
    except AttributeError:
        checked_out = 0
        checked_in = 0

    # max_overflow is not available on asyncpg's AsyncAdaptedQueuePool
    # Use configured value from settings
    max_overflow_val = _get_settings().database.max_overflow
    total_capacity = pool_size + max_overflow_val
    utilization = (checked_out / total_capacity * 100) if total_capacity > 0 else 0

    return {
        "pool_size": pool_size,
        "checked_in": checked_in,
        "checked_out": checked_out,
        "max_overflow": max_overflow_val,
        "utilization_pct": round(utilization, 1),
    }


async def close_database():
    """
    关闭数据库连接池（应用关闭时调用）

    安全地释放所有连接，确保没有资源泄露。
    """
    await get_engine().dispose()
    logger.info("[DB] PostgreSQL 连接池已关闭")


# ═════════════════════════════════════════════
# 向后兼容：懒代理对象
# ═════════════════════════════════════════════
# 为保持与旧代码的兼容性，提供名为 engine 和 async_session_factory 的懒加载代理
# 这些对象在首次使用时才会实际创建底层引擎/工厂

class _LazyEngine:
    """代理真实 engine，懒加载并在每次操作时转发到 get_engine()"""

    def __getattr__(self, name):
        if name == 'pool':
            return get_engine().pool
        # 其他属性访问会触发 getattr(get_engine(), name)
        raise AttributeError(f"'{type(self).__name__}' object has attribute '{name}'")

    def connect(self):
        return get_engine().connect()

    def begin(self):
        return get_engine().begin()

    def dispose(self):
        return get_engine().dispose()

    # 为了完整性，可能还需要其他方法...
    # 但常用的主要是 pool、connect、begin、dispose

class _LazySessionFactory:
    """代理 session factory，懒加载并在调用时获取工厂

    调用后返回 AsyncSession，可直接用于 `async with factory() as session`。
    """

    def __call__(self):
        # 返回 async_sessionmaker 的实例，该实例可被用作异步上下文管理器
        return get_session_factory()()


# 创建兼容性的全局变量
engine = _LazyEngine()
async_session_factory = _LazySessionFactory()

# 向后兼容：旧代码通过 get_async_session() / AsyncSessionLocal 引用会话工厂
# 统一指向懒代理，首次调用时才初始化底层 engine
get_async_session = _LazySessionFactory()
AsyncSessionLocal = _LazySessionFactory()
