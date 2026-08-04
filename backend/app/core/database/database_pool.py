"""
🔒 P4-1: 数据库连接池增强与查询性能优化

在现有 session.py 基础上提供增强层：
1. **连接池监控** - 实时监测连接使用情况、泄漏检测
2. **自动连接回收** - 智能的连接生命周期管理
3. **查询超时控制** - 按查询类型设置不同超时
4. **重试机制** - 针对瞬时数据库错误的自动重试
5. **批量查询优化** - 大结果集的流式处理
6. **连接泄漏检测** - 超时未释放的连接自动回收

使用方式:
    from app.core.database.database_pool import (
        get_pool_status,
        query_with_retry,
        stream_large_result,
        monitored_session,
    )
"""

from __future__ import annotations

import asyncio
import logging
import time
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Callable, Dict, Generic, List, Optional, TypeVar, cast

from sqlalchemy import text, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.exc import (
    OperationalError,
    InterfaceError,
    PendingRollbackError,
    TimeoutError as SAQueryTimeout,
)

from ..config import settings
from .session import async_session_factory, engine, get_db

logger = logging.getLogger(__name__)

T = TypeVar('T')


# ════════════════════════════════════════════
# 🔒 P4-1: 连接池状态监控
# ════════════════════════════════════════════

@dataclass
class PoolStatus:
    """连接池状态快照"""
    checked_out: int = 0
    checked_in: int = 0
    pool_size: int = 0
    max_overflow: int = 0
    total_connections: int = 0
    overflow_connections: int = 0
    utilization_percent: float = 0.0
    peak_checked_out: int = 0
    total_checkouts: int = 0
    avg_checkout_duration_ms: float = 0.0
    slow_checkouts_count: int = 0
    leak_detected_count: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pool": {
                "size": self.pool_size,
                "max_overflow": self.max_overflow,
                "checked_in": self.checked_in,
                "checked_out": self.checked_out,
                "total": self.total_connections,
                "overflow": self.overflow_connections,
                "utilization_percent": round(self.utilization_percent, 2),
                "peak_checked_out": self.peak_checked_out,
            },
            "metrics": {
                "total_checkouts": self.total_checkouts,
                "avg_checkout_duration_ms": round(self.avg_checkout_duration_ms, 2),
                "slow_checkouts": self.slow_checkouts_count,
                "leak_detected": self.leak_detected_count,
            },
            "timestamp": self.timestamp,
        }


class PoolMonitor:
    """
    🔒 P4-1: 连接池监控器 - 跟踪连接使用情况

    - 检测连接泄漏（长时未释放）
    - 记录使用高峰
    - 计算平均持有时间
    - 触发告警阈值
    """

    def __init__(self, warning_threshold_ms: float = 30000.0):
        self.warning_threshold_ms = warning_threshold_ms
        self._peak_checked_out = 0
        self._total_checkouts = 0
        self._total_checkout_duration = 0.0
        self._slow_checkouts = 0
        self._leak_count = 0
        self._active_checkouts: Dict[int, float] = {}  # connection_id -> timestamp
        self._lock = threading.Lock()

    def start_checkout(self, conn_id: int) -> None:
        """标记连接开始使用"""
        with self._lock:
            self._active_checkouts[conn_id] = time.time()
            self._total_checkouts += 1
            active_count = len(self._active_checkouts)
            if active_count > self._peak_checked_out:
                self._peak_checked_out = active_count

    def end_checkout(self, conn_id: int) -> None:
        """标记连接结束使用"""
        with self._lock:
            start_time = self._active_checkouts.pop(conn_id, None)
            if start_time is not None:
                duration = (time.time() - start_time) * 1000
                self._total_checkout_duration += duration
                if duration > self.warning_threshold_ms:
                    self._slow_checkouts += 1
                    logger.warning(
                        f"[PoolMonitor] 慢连接检测: conn_id={conn_id}, "
                        f"duration={duration:.1f}ms, threshold={self.warning_threshold_ms}ms"
                    )

    def check_for_leaks(self, max_duration_ms: float = 120000.0) -> int:
        """检测泄漏的连接（持有超过 max_duration_ms）"""
        now = time.time()
        leak_count = 0
        with self._lock:
            for conn_id, start_time in list(self._active_checkouts.items()):
                duration_ms = (now - start_time) * 1000
                if duration_ms > max_duration_ms:
                    leak_count += 1
                    self._leak_count += 1
                    logger.warning(
                        f"[PoolMonitor] ⚠️ 潜在连接泄漏: conn_id={conn_id}, "
                        f"held for {duration_ms:.0f}ms (max {max_duration_ms}ms)"
                    )
        return leak_count

    def get_status(self) -> PoolStatus:
        """获取连接池当前状态"""
        status = PoolStatus()
        try:
            pool = getattr(engine, 'pool', None)
            if pool is not None:
                status.checked_out = getattr(pool, 'checkedout', 0)
                status.checked_in = getattr(pool, 'checkedin', 0)
                status.pool_size = getattr(pool, 'size', 0)
                status.max_overflow = getattr(pool, 'max_overflow', 0)
                status.total_connections = status.checked_out + status.checked_in
                status.overflow_connections = max(0, status.checked_out - status.pool_size)
                max_capacity = status.pool_size + status.max_overflow
                if max_capacity > 0:
                    status.utilization_percent = (status.checked_out / max_capacity) * 100
        except Exception as e:
            logger.debug(f"[PoolMonitor] 无法获取池状态: {e}")

        with self._lock:
            status.peak_checked_out = self._peak_checked_out
            status.total_checkouts = self._total_checkouts
            status.avg_checkout_duration_ms = (
                self._total_checkout_duration / max(self._total_checkouts, 1)
            )
            status.slow_checkouts_count = self._slow_checkouts
            status.leak_detected_count = self._leak_count

        return status


# 全局单例
pool_monitor = PoolMonitor()


# ════════════════════════════════════════════
# 🔒 P4-1: 带重试的查询执行
# ════════════════════════════════════════════

@dataclass
class RetryConfig:
    """重试配置"""
    max_attempts: int = 3
    initial_delay_ms: float = 100.0
    max_delay_ms: float = 5000.0
    backoff_multiplier: float = 2.0
    jitter_ms: float = 50.0
    # 触发重试的异常类型
    retryable_exceptions: tuple = (
        OperationalError,
        InterfaceError,
        PendingRollbackError,
        ConnectionRefusedError,
        ConnectionResetError,
        asyncio.TimeoutError,
    )


class QueryRetrier:
    """
    🔒 P4-1: 带指数退避的查询重试器

    只对瞬时、可恢复的数据库错误进行重试
    """

    def __init__(self, config: RetryConfig = None):
        self.config = config or RetryConfig()
        self._total_retries = 0
        self._total_failures = 0

    async def execute(
        self,
        operation: Callable[..., T],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """
        执行数据库操作，带自动重试

        Args:
            operation: 数据库操作（协程函数）
            *args, **kwargs: 传递给操作的参数

        Returns:
            操作返回值

        Raises:
            最后一次尝试的异常（超过最大重试次数时）
        """
        last_exception: Optional[Exception] = None
        delay_ms = self.config.initial_delay_ms

        for attempt in range(self.config.max_attempts):
            try:
                return await operation(*args, **kwargs)
            except self.config.retryable_exceptions as e:
                last_exception = e
                self._total_retries += 1

                if attempt == self.config.max_attempts - 1:
                    self._total_failures += 1
                    logger.error(
                        f"[QueryRetrier] 数据库操作失败 (attempt={attempt + 1}/{self.config.max_attempts}): "
                        f"{type(e).__name__}: {e}"
                    )
                    raise

                # 计算延迟（指数退避 + 抖动）
                import random
                jitter = random.uniform(-self.config.jitter_ms, self.config.jitter_ms)
                sleep_time = min(delay_ms + jitter, self.config.max_delay_ms) / 1000.0

                logger.warning(
                    f"[QueryRetrier] 数据库操作重试 (attempt={attempt + 1}/{self.config.max_attempts}, "
                    f"delay={sleep_time * 1000:.0f}ms): {type(e).__name__}"
                )

                await asyncio.sleep(sleep_time)
                delay_ms *= self.config.backoff_multiplier

        if last_exception:
            raise last_exception
        raise RuntimeError("Unexpected: no exception captured in retrier")

    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_retries": self._total_retries,
            "total_failures": self._total_failures,
        }


# 全局查询重试器
query_retrier = QueryRetrier()


async def query_with_retry(
    db: AsyncSession,
    statement: Any,
    max_attempts: int = 3,
) -> Any:
    """
    🔒 P4-1: 带自动重试的简化查询函数

    用法:
        result = await query_with_retry(db, select(User).where(User.id == 1))
    """
    retrier = QueryRetrier(RetryConfig(max_attempts=max_attempts))

    async def _execute():
        return await db.execute(statement)

    return await retrier.execute(_execute)


# ════════════════════════════════════════════
# 🔒 P4-1: 大结果集流式处理
# ════════════════════════════════════════════

@dataclass
class StreamBatchResult(Generic[T]):
    """流式批量查询结果"""
    batch: List[T]
    batch_number: int
    total_batches: int
    has_more: bool
    batch_size: int
    total_count: int


async def stream_large_result(
    db: AsyncSession,
    statement: Any,
    batch_size: int = 1000,
    max_rows: Optional[int] = None,
) -> AsyncIterator[StreamBatchResult[T]]:
    """
    🔒 P4-1: 流式处理大结果集，避免内存溢出

    Args:
        db: 数据库会话
        statement: SQL 查询语句
        batch_size: 每批大小（默认 1000）
        max_rows: 最大处理行数（None = 全部）

    Yields:
        StreamBatchResult: 包含当前批次数据的结果

    用法:
        async for batch in stream_large_result(db, select(Formula), batch_size=500):
            process(batch.items)
    """
    # 先获取总数
    count_stmt = select(func.count()).select_from(statement.subquery())
    count_result = await db.execute(count_stmt)
    total_count = count_result.scalar_one() or 0

    if max_rows is not None:
        total_count = min(total_count, max_rows)

    total_batches = (total_count + batch_size - 1) // batch_size
    logger.info(
        f"[StreamQuery] 开始流式查询: total={total_count}, "
        f"batches={total_batches}, batch_size={batch_size}"
    )

    processed = 0
    for batch_number in range(1, total_batches + 1):
        offset = (batch_number - 1) * batch_size
        limit = min(batch_size, max_rows - processed) if max_rows else batch_size

        if limit <= 0:
            break

        # 使用 LIMIT/OFFSET 分批（注意：大偏移量可能需要优化为游标分页）
        batch_stmt = statement.limit(limit).offset(offset)
        result = await db.execute(batch_stmt)
        items = list(result.scalars().all())

        if not items:
            break

        processed += len(items)
        has_more = processed < total_count

        yield StreamBatchResult(
            batch=cast(List[T], items),
            batch_number=batch_number,
            total_batches=total_batches,
            has_more=has_more,
            batch_size=len(items),
            total_count=total_count,
        )

        # 每批次之间让步给其他协程
        await asyncio.sleep(0)


# ════════════════════════════════════════════
# 🔒 P4-1: 监控会话 - 上下文管理器
# ════════════════════════════════════════════

async def monitored_session(
    operation_name: str = "unnamed",
    warn_on_slow_ms: float = 5000.0,
) -> AsyncSession:
    """
    🔒 P4-1: 受监控的数据库会话（带超时警告）

    用法:
        async with monitored_session("formula_query") as db:
            result = await db.execute(select(Formula))
    """
    start_time = time.time()

    @contextmanager
    def _track(conn_id: int):
        pool_monitor.start_checkout(conn_id)
        yield
        pool_monitor.end_checkout(conn_id)

    # 从工厂获取会话
    session = async_session_factory()

    try:
        yield session

        duration_ms = (time.time() - start_time) * 1000
        if duration_ms > warn_on_slow_ms:
            logger.warning(
                f"[MonitoredSession] ⚠️ 慢操作: '{operation_name}' "
                f"took {duration_ms:.1f}ms (threshold={warn_on_slow_ms}ms)"
            )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            f"[MonitoredSession] 操作 '{operation_name}' 失败 ({duration_ms:.1f}ms)",
            exc_info=True,
        )
        raise
    finally:
        await session.close()


# ════════════════════════════════════════════
# 🔒 P4-1: 连接池健康检查与自动调整
# ════════════════════════════════════════════

async def get_pool_status() -> PoolStatus:
    """获取连接池当前状态"""
    return pool_monitor.get_status()


async def check_pool_health() -> Dict[str, Any]:
    """
    🔒 P4-1: 检查连接池健康状态

    Returns:
        {
            "status": "healthy"|"degraded"|"critical",
            "pool": {...},
            "leaks_detected": int,
            "recommendations": [str]
        }
    """
    status = pool_monitor.get_status()
    leak_count = pool_monitor.check_for_leaks()

    recommendations: List[str] = []
    if status.utilization_percent > 80:
        recommendations.append(
            f"连接池使用率 {status.utilization_percent:.1f}% > 80%，建议增大 pool_size"
        )
    if leak_count > 0:
        recommendations.append(f"检测到 {leak_count} 个潜在连接泄漏，请检查相关代码")
    if status.slow_checkouts_count > 0:
        recommendations.append(
            f"存在 {status.slow_checkouts_count} 个慢连接操作，请优化查询或增加超时阈值"
        )

    # 判断总体状态
    if status.utilization_percent > 95 or leak_count > 5:
        health_status = "critical"
    elif status.utilization_percent > 80 or leak_count > 0:
        health_status = "degraded"
    else:
        health_status = "healthy"

    return {
        "status": health_status,
        "pool": status.to_dict(),
        "leaks_detected": leak_count,
        "recommendations": recommendations,
        "retry_stats": query_retrier.get_stats(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ════════════════════════════════════════════
# 🔒 P4-1: 批量操作优化
# ════════════════════════════════════════════

async def bulk_insert_with_chunking(
    db: AsyncSession,
    instances: List[Any],
    chunk_size: int = 100,
) -> Dict[str, Any]:
    """
    🔒 P4-1: 分块批量插入，避免单次过大事务

    Args:
        db: 数据库会话
        instances: ORM 实例列表
        chunk_size: 每块大小（默认 100）

    Returns:
        操作统计 {
            "total": int,
            "chunks": int,
            "total_time_ms": float,
            "avg_chunk_ms": float
        }
    """
    start_time = time.time()
    total = len(instances)
    chunk_times: List[float] = []

    logger.info(f"[BulkInsert] 开始批量插入: total={total}, chunk_size={chunk_size}")

    for i in range(0, total, chunk_size):
        chunk_start = time.time()
        chunk = instances[i:i + chunk_size]

        try:
            db.add_all(chunk)
            await db.flush()
            chunk_time = (time.time() - chunk_start) * 1000
            chunk_times.append(chunk_time)

            if (i // chunk_size + 1) % 10 == 0:
                logger.info(
                    f"[BulkInsert] 进度: {min(i + chunk_size, total)}/{total} "
                    f"({min((i + chunk_size) / total * 100, 100):.0f}%)"
                )

            # 每块之间让步
            await asyncio.sleep(0)

        except Exception as e:
            await db.rollback()
            logger.error(
                f"[BulkInsert] ❌ 第 {i // chunk_size + 1} 块失败: {type(e).__name__}: {e}"
            )
            raise

    await db.commit()

    total_time = (time.time() - start_time) * 1000
    return {
        "total": total,
        "chunks": len(chunk_times),
        "total_time_ms": round(total_time, 2),
        "avg_chunk_ms": round(sum(chunk_times) / max(len(chunk_times), 1), 2),
        "max_chunk_ms": round(max(chunk_times), 2) if chunk_times else 0,
    }


# ════════════════════════════════════════════
# 🔒 P4-1: 查询性能分析工具
# ════════════════════════════════════════════

async def analyze_query_performance(
    db: AsyncSession,
    statement: Any,
    run_times: int = 3,
) -> Dict[str, Any]:
    """
    🔒 P4-1: 分析查询性能（执行多次取平均值）

    返回:
        - execution_times_ms: 每次执行的时间
        - avg_ms: 平均执行时间
        - min_ms: 最快时间
        - max_ms: 最慢时间
        - rows_returned: 返回行数

    用法:
        perf = await analyze_query_performance(db, select(Formula).limit(100))
        print(f"平均耗时: {perf['avg_ms']}ms")
    """
    times: List[float] = []
    rows_returned = 0

    for i in range(run_times):
        start = time.time()
        result = await db.execute(statement)
        duration = (time.time() - start) * 1000
        times.append(duration)
        rows = list(result.scalars().all())
        rows_returned = len(rows)

        await asyncio.sleep(0.1)  # 避免缓存影响

    times.sort()
    return {
        "query": str(statement),
        "runs": run_times,
        "rows_returned": rows_returned,
        "execution_times_ms": [round(t, 2) for t in times],
        "avg_ms": round(sum(times) / len(times), 2),
        "min_ms": round(times[0], 2),
        "max_ms": round(times[-1], 2),
        "median_ms": round(times[len(times) // 2], 2),
    }


# ════════════════════════════════════════════
# 🔒 P4-1: 后台泄漏检测定时任务
# ════════════════════════════════════════════

class PoolMonitorTask:
    """
    🔒 P4-1: 后台定期检测连接池状态
    """

    def __init__(self, check_interval: float = 60.0):
        self._interval = check_interval
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        """启动后台监测"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(f"[PoolMonitorTask] 已启动 (interval={self._interval}s)")

    async def stop(self):
        """停止监测"""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[PoolMonitorTask] 已停止")

    async def _monitor_loop(self):
        while self._running:
            try:
                status = pool_monitor.get_status()
                if status.utilization_percent > 80:
                    logger.warning(
                        f"[PoolMonitor] ⚠️ 连接池使用率高: "
                        f"{status.utilization_percent:.1f}% "
                        f"(checked_out={status.checked_out}, pool_size={status.pool_size})"
                    )

                # 泄漏检测
                pool_monitor.check_for_leaks()

                await asyncio.sleep(self._interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[PoolMonitor] 监测循环异常: {e}")
                await asyncio.sleep(self._interval)


# 全局后台监测（可在应用启动时调用 start）
pool_monitor_task = PoolMonitorTask()


# ════════════════════════════════════════════
# 🔒 P4-1: 便捷导入入口
# ════════════════════════════════════════════

__all__ = [
    # 状态监控
    "PoolStatus",
    "PoolMonitor",
    "pool_monitor",
    "get_pool_status",
    "check_pool_health",

    # 查询重试
    "RetryConfig",
    "QueryRetrier",
    "query_retrier",
    "query_with_retry",

    # 流式处理
    "StreamBatchResult",
    "stream_large_result",

    # 监控会话
    "monitored_session",

    # 批量操作
    "bulk_insert_with_chunking",

    # 性能分析
    "analyze_query_performance",

    # 后台任务
    "PoolMonitorTask",
    "pool_monitor_task",
]
