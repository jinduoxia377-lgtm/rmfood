"""
AI 推理服务独立化 — 异步推理队列

院士级修复[P1]: 将 AI 推理任务从 API Worker 主事件循环中解耦
院士级升级[Phase 4-A]: 支持可插拔存储后端（内存/Redis），多实例部署时结果共享

问题根源：
    当前 AI 配方生成/优化接口直接在 FastAPI 的 asyncio 事件循环中
    同步运行 PyTorch / 遗传算法 / 贝叶斯优化，导致：
    ① 首次请求延迟 >5s（模型冷加载）
    ② 长运行任务占用 uvicorn worker，其他 CRUD 请求饥饿
    ③ CPU 密集型计算阻塞 asyncio 事件循环（即使用 async def 也无效）

解决方案：异步推理队列 + ThreadPoolExecutor + 可插拔存储
    ① 路由接收请求 → 创建 InferenceTask，写入 AsyncInferenceQueue → 立即返回 task_id
    ② InferenceQueueWorker 从队列取任务 → 使用 loop.run_in_executor 在线程池中执行
    ③ 执行完成后结果写入 ResultStore（内存或 Redis），同时通过 WebSocket 推送通知客户端
    ④ 客户端可通过 GET /api/v1/ai/tasks/{task_id} 轮询或 WebSocket 订阅结果

多实例支持（Phase 4-A）：
    - ResultStore 可插拔：MemoryResultStore（单实例开发）/ RedisResultStore（多实例生产）
    - 实例心跳注册：每个实例向 Redis 注册，支持健康追踪
    - 任务队列暂保持单实例（Phase 4-B 迁移到 Redis Streams 实现多实例负载均衡）
"""
from __future__ import annotations

import asyncio
import json
import logging
import socket
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger("rmfood.ai.queue")

# ── 推理队列参数 ───────────────────────────────────────────────
MAX_QUEUE_SIZE: int = 100          # 最大等待队列深度（超出时返回 503）
MAX_CONCURRENT_WORKERS: int = 4   # 最大并发推理任务数（对应 CPU 核心数）
TASK_TIMEOUT_SECONDS: int = 300   # 单任务超时（5分钟）

# 🔒 P2-3: 重试 + 死信队列（DLQ）配置
MAX_TASK_RETRIES: int = 3          # 任务最大重试次数
RETRY_DELAY_SECONDS: int = 5       # 重试前等待时间（指数退避：5s, 10s, 20s）
DLQ_TTL_SECONDS: int = 86400       # DLQ 任务保留时间（24小时）
DLQ_KEY_PREFIX: str = "rmfood:inference:dlq:"  # Redis DLQ 键前缀

RESULT_TTL_SECONDS: int = 3600   # 结果缓存 TTL（1小时）
INSTANCE_HEARTBEAT_TTL: int = 60  # 实例心跳 TTL（秒，过期自动摘除）
INSTANCE_HEARTBEAT_INTERVAL: int = 30  # 心跳间隔（秒）


# ── 数据模型（从 inference_store 导入，保持单一定义）────────────────────

# 说明：InferenceTaskStatus 和 InferenceResult 的 authoritative 定义在 inference_store.py
from .inference_store import InferenceTaskStatus as TaskStatus
from .inference_store import InferenceResult, InferenceResultStore
from .inference_store import MemoryResultStore, RedisResultStore, create_result_store


@dataclass
class InferenceTask:
    """
    AI 推理任务单元

    🔒 P2-3 增强：添加重试相关字段

    task_id: 全局唯一任务 ID（返回给客户端用于轮询）
    task_type: 任务类型标识（如 "formula.generate" / "formula.optimize"）
    payload: 任务输入参数（可序列化）
    priority: 优先级（0=最高，越大优先级越低）
    retry_count: 当前重试次数（初始为 0）
    max_retries: 最大允许重试次数（覆盖全局配置）
    """
    task_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    task_type: str = "unknown"
    payload: Dict[str, Any] = field(default_factory=dict)
    priority: int = 5
    created_at: float = field(default_factory=time.time)
    submitted_by: Optional[str] = None   # user_id
    org_id: Optional[int] = None
    retry_count: int = 0  # 🔒 P2-3: 当前重试次数
    max_retries: int = MAX_TASK_RETRIES  # 🔒 P2-3: 最大重试次数（可覆盖）

    def __lt__(self, other: "InferenceTask") -> bool:
        """使 PriorityQueue 按优先级排序（priority 小的先执行）"""
        return (self.priority, self.created_at) < (other.priority, other.created_at)

    def with_retry(self, new_retry_count: int) -> "InferenceTask":
        """创建新的任务实例（增加重试次数）"""
        return InferenceTask(
            task_id=self.task_id,
            task_type=self.task_type,
            payload=self.payload,
            priority=self.priority,
            created_at=self.created_at,
            submitted_by=self.submitted_by,
            org_id=self.org_id,
            retry_count=new_retry_count,
            max_retries=self.max_retries,
        )



# ── 任务执行器注册表 ────────────────────────────────────────────

_EXECUTORS: Dict[str, Callable] = {}


def register_executor(task_type: str):
    """
    注册任务执行函数装饰器

    用法：
        @register_executor("formula.generate")
        def run_formula_generation(payload: dict) -> dict:
            ...
            return {"candidates": [...]}
    """
    def decorator(func: Callable) -> Callable:
        _EXECUTORS[task_type] = func
        logger.info("[InferenceQueue] 注册执行器: %s → %s", task_type, func.__qualname__)
        return func
    return decorator


def get_executor(task_type: str) -> Optional[Callable]:
    return _EXECUTORS.get(task_type)


# ── 异步推理队列 ────────────────────────────────────────────────

class AsyncInferenceQueue:
    """
    异步 AI 推理队列（院士级独立化推理服务核心）

    架构：
    - asyncio.PriorityQueue：低延迟任务调度（单实例内）
    - ThreadPoolExecutor：CPU 密集型 AI 推理（在独立线程运行，不阻塞事件循环）
    - InferenceResultStore：可插拔结果存储（MemoryResultStore / RedisResultStore）
    - 实例心跳：向 Redis 注册实例信息，支持健康追踪
    - WebSocket 推送：任务完成后通知客户端（可选）

    Phase 4-A 多实例支持：
    - 结果存储使用 Redis 时，多实例可共享任务结果
    - 任务队列暂保持单实例（后续迁移到 Redis Streams）
    - 实例心跳注册支持健康检查和负载均衡决策
    """

    def __init__(
        self,
        result_store: Optional[InferenceResultStore] = None,
        redis_url: Optional[str] = None,
    ):
        """
        初始化推理队列

        Args:
            result_store: 可选的结果存储实例。不提供时：
                - 有 redis_url → 自动创建 RedisResultStore
                - 无 redis_url → 使用 MemoryResultStore（单实例开发）
            redis_url: Redis 连接 URL（用于实例心跳注册和可选的 Redis 存储）
        """
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=MAX_QUEUE_SIZE)
        self._redis_url = redis_url
        self._instance_id = uuid.uuid4().hex[:12]

        # 结果存储：优先使用传入的实例，否则按 redis_url 自动选择
        if result_store is not None:
            self._result_store = result_store
        elif redis_url:
            self._result_store = RedisResultStore(
                redis_url=redis_url, ttl_seconds=RESULT_TTL_SECONDS,
            )
            logger.info(
                "[InferenceQueue] 自动选择 Redis 存储后端 (instance=%s)",
                self._instance_id,
            )
        else:
            self._result_store = MemoryResultStore(ttl_seconds=RESULT_TTL_SECONDS)
            logger.info(
                "[InferenceQueue] 使用内存存储后端 (instance=%s)",
                self._instance_id,
            )

        self._executor = ThreadPoolExecutor(
            max_workers=MAX_CONCURRENT_WORKERS,
            thread_name_prefix="rmfood-inference",
        )
        self._worker_tasks: list = []
        self._running = False
        self._ws_notifier: Optional[Any] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._redis_heartbeat = None  # Redis 连接（心跳专用）

    @property
    def instance_id(self) -> str:
        """当前实例 ID"""
        return self._instance_id

    @property
    def result_store(self) -> InferenceResultStore:
        """当前结果存储后端"""
        return self._result_store

    def set_ws_notifier(self, notifier) -> None:
        """注入 WebSocket 通知器（用于任务完成推送）"""
        self._ws_notifier = notifier

    async def start(self, num_workers: int = MAX_CONCURRENT_WORKERS) -> None:
        """启动推理队列 Worker + 实例心跳"""
        if self._running:
            return
        self._running = True
        self._worker_tasks = [
            asyncio.create_task(self._worker(worker_id=i))
            for i in range(num_workers)
        ]
        # 定期清理过期结果（内存后端需要，Redis 后端自动 TTL）
        asyncio.create_task(self._cleanup_loop())
        # 启动实例心跳（如果 Redis 可用）
        if self._redis_url:
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info(
            "[InferenceQueue] 推理队列已启动，Worker 数: %d，队列上限: %d，"
            "instance: %s，存储: %s",
            num_workers, MAX_QUEUE_SIZE, self._instance_id,
            type(self._result_store).__name__,
        )

    async def stop(self) -> None:
        """优雅停止队列（等待当前任务完成）"""
        if not self._running:
            return
        self._running = False

        # 停止 Worker
        for task in self._worker_tasks:
            task.cancel()
        self._executor.shutdown(wait=False)

        # 停止心跳
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        await self._deregister_instance()

        # 关闭 Redis 存储（如果使用 Redis）
        if isinstance(self._result_store, RedisResultStore):
            await self._result_store.close()
        if self._redis_heartbeat:
            await self._redis_heartbeat.close()

        logger.info("[InferenceQueue] 推理队列已停止 (instance=%s)", self._instance_id)

    async def submit(
        self,
        task_type: str,
        payload: Dict[str, Any],
        priority: int = 5,
        submitted_by: Optional[str] = None,
        org_id: Optional[int] = None,
    ) -> str:
        """
        提交推理任务（非阻塞，立即返回 task_id）

        Returns:
            task_id: 用于后续轮询/订阅结果的任务 ID

        Raises:
            QueueFullError: 队列已满（HTTP 503）
        """
        if self._queue.full():
            raise QueueFullError(
                f"推理队列已满 ({MAX_QUEUE_SIZE} 个待处理任务)，请稍后重试"
            )

        task = InferenceTask(
            task_type=task_type,
            payload=payload,
            priority=priority,
            submitted_by=submitted_by,
            org_id=org_id,
        )

        # 写入结果存储（状态: PENDING）
        result = InferenceResult(
            task_id=task.task_id,
            status=TaskStatus.PENDING,
            submitted_by=submitted_by,
            org_id=org_id,
        )
        await self._result_store.put(result)

        # 入队（PriorityQueue 使用 (priority, task) 元组排序）
        await self._queue.put((task.priority, task))

        logger.info(
            "[InferenceQueue] 任务已提交: id=%s type=%s user=%s queue_size=%d",
            task.task_id, task_type, submitted_by,
            self._queue.qsize(),
        )
        return task.task_id

    async def get_result(self, task_id: str) -> Optional[InferenceResult]:
        """获取任务结果（None 表示任务不存在或已过期）"""
        return await self._result_store.get(task_id)

    async def get_stats(self) -> Dict[str, Any]:
        """获取队列统计信息"""
        store_stats = await self._result_store.get_stats()
        return {
            "instance_id": self._instance_id,
            "queue_size": self._queue.qsize(),
            "queue_limit": MAX_QUEUE_SIZE,
            "max_workers": MAX_CONCURRENT_WORKERS,
            "registered_executors": list(_EXECUTORS.keys()),
            "result_store": store_stats,
        }

    async def get_cluster_status(self) -> Dict[str, Any]:
        """
        获取推理集群状态（多实例健康追踪）

        需要 Redis 可用。返回所有注册实例的心跳信息。
        """
        if not self._redis_url:
            return {
                "mode": "single_instance",
                "instance_id": self._instance_id,
                "instances": [],
            }

        redis = await self._get_heartbeat_redis()
        pattern = "rmfood:inference:instances:*"
        instances = []
        cursor = 0
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=50)
            for key in keys:
                data = await redis.hgetall(key)
                if data:
                    instances.append({
                        "instance_id": data.get("instance_id", "unknown"),
                        "hostname": data.get("hostname", "unknown"),
                        "started_at": data.get("started_at"),
                        "last_heartbeat": data.get("last_heartbeat"),
                        "workers": int(data.get("workers", 0)),
                        "store_backend": data.get("store_backend", "unknown"),
                    })
            if cursor == 0:
                break

        return {
            "mode": "cluster",
            "current_instance": self._instance_id,
            "total_instances": len(instances),
            "instances": instances,
        }

    # ── 实例心跳 ──────────────────────────────────────────────

    async def _get_heartbeat_redis(self):
        """获取心跳专用 Redis 连接（延迟初始化）"""
        if self._redis_heartbeat is None:
            import redis.asyncio as aioredis
            self._redis_heartbeat = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_timeout=3.0,
                socket_connect_timeout=3.0,
            )
        return self._redis_heartbeat

    async def _register_instance(self) -> None:
        """注册当前实例到 Redis（心跳机制）"""
        try:
            redis = await self._get_heartbeat_redis()
            key = f"rmfood:inference:instances:{self._instance_id}"
            data = {
                "instance_id": self._instance_id,
                "hostname": socket.gethostname(),
                "pid": str(uuid.getnode()),
                "started_at": datetime.now(timezone.utc).isoformat(),
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "workers": str(MAX_CONCURRENT_WORKERS),
                "store_backend": type(self._result_store).__name__,
            }
            await redis.hset(key, mapping=data)
            await redis.expire(key, INSTANCE_HEARTBEAT_TTL)
            logger.debug("[InferenceQueue] 实例心跳注册: %s", self._instance_id)
        except Exception as e:
            logger.warning("[InferenceQueue] 心跳注册失败: %s", e)

    async def _deregister_instance(self) -> None:
        """注销当前实例"""
        if not self._redis_url:
            return
        try:
            redis = await self._get_heartbeat_redis()
            key = f"rmfood:inference:instances:{self._instance_id}"
            await redis.delete(key)
            logger.debug("[InferenceQueue] 实例已注销: %s", self._instance_id)
        except Exception as e:
            logger.debug("[InferenceQueue] 实例注销失败: %s", e)

    async def _heartbeat_loop(self) -> None:
        """定期发送心跳（保持实例在 Redis 中的注册状态）"""
        await self._register_instance()
        while self._running:
            await asyncio.sleep(INSTANCE_HEARTBEAT_INTERVAL)
            if not self._running:
                break
            try:
                redis = await self._get_heartbeat_redis()
                key = f"rmfood:inference:instances:{self._instance_id}"
                await redis.hset(
                    key,
                    "last_heartbeat",
                    datetime.now(timezone.utc).isoformat(),
                )
                await redis.expire(key, INSTANCE_HEARTBEAT_TTL)
            except Exception as e:
                logger.debug("[InferenceQueue] 心跳发送失败: %s", e)

    # ── 内部 Worker ────────────────────────────────────────────

    async def _worker(self, worker_id: int) -> None:
        """推理 Worker 协程（每个 Worker 对应一个独立线程槽）"""
        logger.info("[InferenceQueue] Worker-%d 已启动", worker_id)
        while self._running:
            try:
                # 等待任务（超时避免死锁）
                try:
                    _priority, task = await asyncio.wait_for(
                        self._queue.get(), timeout=5.0
                    )
                except asyncio.TimeoutError:
                    continue

                await self._execute_task(task, worker_id)
                self._queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[InferenceQueue] Worker-%d 异常: %s", worker_id, e, exc_info=True)

        logger.info("[InferenceQueue] Worker-%d 已停止", worker_id)

    async def _execute_task(self, task: InferenceTask, worker_id: int) -> None:
        """
        执行单个推理任务

        🔒 P2-3 增强：重试 + 死信队列（DLQ）

        执行流程：
        1. 标记为 RUNNING
        2. 在线程池执行（超时控制）
        3. 成功 → SUCCESS
        4. 超时 → 判断是否可重试 → 指数退避重试 或 进入 DLQ
        5. 异常 → 判断是否可重试 → 重试 或 进入 DLQ
        """
        task_id = task.task_id
        start_time = time.time()

        # 标记为 RUNNING
        await self._result_store.update_status(
            task_id, TaskStatus.RUNNING,
            metadata={"retry_count": task.retry_count},
        )
        logger.info(
            "[InferenceQueue] Worker-%d 开始执行: id=%s type=%s retry=%d/%d",
            worker_id, task_id, task.task_type,
            task.retry_count, task.max_retries,
        )

        executor_fn = get_executor(task.task_type)
        if executor_fn is None:
            error_msg = f"未找到任务执行器: {task.task_type}"
            logger.error("[InferenceQueue] %s", error_msg)
            await self._result_store.update_status(
                task_id, TaskStatus.FAILED,
                error=error_msg,
                completed_at=time.time(),
                duration_ms=(time.time() - start_time) * 1000,
            )
            # 执行器不存在，不重试，直接进入 DLQ
            await self._move_to_dlq(task, error_msg, "executor_not_found")
            return

        try:
            loop = asyncio.new_event_loop()

            # 在线程池中执行 CPU 密集型推理（不阻塞事件循环）
            result_data = await asyncio.wait_for(
                loop.run_in_executor(self._executor, executor_fn, task.payload),
                timeout=TASK_TIMEOUT_SECONDS,
            )

            duration_ms = (time.time() - start_time) * 1000
            await self._result_store.update_status(
                task_id, TaskStatus.SUCCESS,
                result=result_data,
                completed_at=time.time(),
                duration_ms=duration_ms,
            )

            logger.info(
                "[InferenceQueue] ✅ 任务完成: id=%s type=%s duration=%.0fms retry=%d",
                task_id, task.task_type, duration_ms, task.retry_count,
            )

            # 推送 WebSocket 通知
            await self._notify_completion(task, TaskStatus.SUCCESS)

        except asyncio.TimeoutError:
            # 🔒 P2-3: 超时 → 触发重试逻辑
            duration_ms = (time.time() - start_time) * 1000
            error_msg = f"推理超时（>{TASK_TIMEOUT_SECONDS}s）"
            logger.warning(
                "[InferenceQueue] ⏰ 任务超时: id=%s type=%s retry=%d/%d",
                task_id, task.task_type, task.retry_count, task.max_retries,
            )
            await self._handle_retry_or_dlq(task, error_msg, "timeout", duration_ms)

        except Exception as e:
            # 🔒 P2-3: 异常 → 触发重试逻辑
            duration_ms = (time.time() - start_time) * 1000
            error_str = str(e)
            logger.error(
                "[InferenceQueue] ❌ 任务失败: id=%s type=%s error=%s retry=%d/%d",
                task_id, task.task_type, error_str, task.retry_count, task.max_retries,
                exc_info=True,
            )
            await self._handle_retry_or_dlq(task, error_str, "exception", duration_ms)

    async def _handle_retry_or_dlq(
        self,
        task: InferenceTask,
        error_msg: str,
        error_type: str,
        duration_ms: float,
    ) -> None:
        """
        🔒 P2-3: 判断是否重试或进入 DLQ

        策略：
        - retry_count < max_retries → 指数退避重试
        - retry_count >= max_retries → 进入 DLQ
        """
        if task.retry_count < task.max_retries:
            # 计算退避时间（指数退避）
            delay = RETRY_DELAY_SECONDS * (2 ** task.retry_count)
            new_retry_count = task.retry_count + 1

            logger.info(
                "[InferenceQueue] 🔄 计划重试: id=%s retry=%d/%d delay=%.0fs",
                task.task_id, new_retry_count, task.max_retries, delay,
            )

            # 更新任务状态为 RETRYING
            await self._result_store.update_status(
                task.task_id, TaskStatus.RETRYING,
                error=f"{error_msg}（将在 {delay:.0f}s 后重试）",
                completed_at=time.time(),
                duration_ms=duration_ms,
                metadata={"retry_count": new_retry_count, "next_retry_in": delay},
            )

            # 延迟后将任务重新入队
            asyncio.create_task(self._delayed_retry(task, new_retry_count, delay))
        else:
            # 🔒 P2-3: 达到最大重试次数 → 进入 DLQ
            logger.error(
                "[InferenceQueue] 🚫 任务达到最大重试次数: id=%s type=%s retries=%d",
                task.task_id, task.task_type, task.retry_count,
            )
            await self._result_store.update_status(
                task.task_id, TaskStatus.FAILED,
                error=f"{error_msg}（已重试 {task.retry_count} 次，仍失败）",
                completed_at=time.time(),
                duration_ms=duration_ms,
            )
            await self._move_to_dlq(task, error_msg, error_type)

    async def _delayed_retry(self, task: InferenceTask, new_retry_count: int, delay: float) -> None:
        """🔒 P2-3: 延迟重试任务（指数退避）"""
        await asyncio.sleep(delay)

        if not self._running:
            logger.warning("[InferenceQueue] 队列已停止，取消重试: id=%s", task.task_id)
            return

        # 创建重试任务（继承原始 task_id，重试计数 +1）
        retry_task = task.with_retry(new_retry_count)

        # 重新入队（优先队列保持原优先级）
        try:
            await self._queue.put((retry_task.priority, retry_task))
            logger.info(
                "[InferenceQueue] 🔄 重试任务已入队: id=%s retry=%d/%d",
                retry_task.task_id, retry_task.retry_count, retry_task.max_retries,
            )
        except Exception as e:
            logger.error("[InferenceQueue] 重试任务入队失败: id=%s error=%s", task.task_id, e)
            await self._move_to_dlq(task, f"重试入队失败: {e}", "retry_queue_error")

    async def _move_to_dlq(
        self,
        task: InferenceTask,
        error_msg: str,
        error_type: str,
    ) -> None:
        """
        🔒 P2-3: 将任务移动到死信队列（DLQ）

        DLQ 用于：
        1. 保存失败任务的完整信息（供后续分析和人工干预）
        2. 监控 DLQ 积压情况
        3. 支持手动重放失败任务

        存储位置：
        - Redis: 使用 DLQ_KEY_PREFIX + task_id 作为键
        - Memory: 使用内存字典
        """
        try:
            dlq_entry = {
                "task_id": task.task_id,
                "task_type": task.task_type,
                "payload": task.payload,
                "priority": task.priority,
                "created_at": task.created_at,
                "submitted_by": task.submitted_by,
                "org_id": task.org_id,
                "retry_count": task.retry_count,
                "max_retries": task.max_retries,
                "error_msg": error_msg,
                "error_type": error_type,
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "hostname": socket.gethostname(),
                "instance_id": self._instance_id,
            }

            # 写入 DLQ
            if self._redis_url:
                await self._push_to_redis_dlq(task.task_id, dlq_entry)
            else:
                await self._push_to_memory_dlq(task.task_id, dlq_entry)

            logger.warning(
                "[InferenceQueue] 📦 任务已进入 DLQ: id=%s type=%s error=%s",
                task.task_id, task.task_type, error_msg[:100],
            )

            # 推送 WebSocket 通知（失败通知）
            await self._notify_completion(task, TaskStatus.FAILED)

        except Exception as e:
            logger.error(
                "[InferenceQueue] 🚨 DLQ 写入失败: id=%s error=%s",
                task.task_id, e, exc_info=True,
            )

    async def _push_to_redis_dlq(self, task_id: str, entry: dict) -> None:
        """🔒 P2-3: Redis DLQ 写入"""
        try:
            import redis.asyncio as aioredis
            async with aioredis.from_url(
                self._redis_url,
                socket_timeout=3.0,
            ) as redis_client:
                key = f"{DLQ_KEY_PREFIX}{task_id}"
                await redis_client.set(
                    key,
                    json.dumps(entry, default=str),
                    ex=DLQ_TTL_SECONDS,
                )
                # 同时记录 DLQ 索引（方便批量查询）
                await redis_client.zadd(
                    f"{DLQ_KEY_PREFIX}index",
                    {task_id: time.time()},
                )
        except Exception as e:
            logger.error("[InferenceQueue] Redis DLQ 写入失败: %s", e)

    async def _push_to_memory_dlq(self, task_id: str, entry: dict) -> None:
        """🔒 P2-3: 内存 DLQ（单实例开发使用）"""
        if not hasattr(self, "_dlq"):
            self._dlq: Dict[str, dict] = {}
        self._dlq[task_id] = entry

    async def get_dlq_stats(self) -> Dict[str, Any]:
        """
        🔒 P2-3: 获取 DLQ 统计信息

        用于监控 DLQ 积压情况，触发告警
        """
        total = 0
        by_type: Dict[str, int] = {}
        by_error: Dict[str, int] = {}

        if self._redis_url:
            try:
                import redis.asyncio as aioredis
                async with aioredis.from_url(
                    self._redis_url,
                    socket_timeout=3.0,
                ) as redis_client:
                    keys = await redis_client.zrange(f"{DLQ_KEY_PREFIX}index", 0, -1)
                    total = len(keys)
            except Exception as e:
                logger.warning("[InferenceQueue] DLQ 统计获取失败: %s", e)
        elif hasattr(self, "_dlq"):
            entries = self._dlq.values()
            total = len(entries)
            for entry in entries:
                task_type = entry.get("task_type", "unknown")
                error_type = entry.get("error_type", "unknown")
                by_type[task_type] = by_type.get(task_type, 0) + 1
                by_error[error_type] = by_error.get(error_type, 0) + 1

        return {
            "total": total,
            "by_type": by_type,
            "by_error": by_error,
            "has_new": total > 0,  # 是否有新的 DLQ 条目
        }

    async def _notify_completion(self, task: InferenceTask, status: TaskStatus) -> None:
        """通知客户端任务完成（通过 WebSocket 推送）"""
        if self._ws_notifier and task.submitted_by:
            try:
                await self._ws_notifier.broadcast_to_user(
                    task.submitted_by,
                    {
                        "type": "inference_complete",
                        "task_id": task.task_id,
                        "task_type": task.task_type,
                        "status": status.value,
                    }
                )
            except Exception as e:
                logger.debug("[InferenceQueue] WebSocket 通知失败: %s", e)

    async def _cleanup_loop(self) -> None:
        """定期清理过期结果（内存后端需要，Redis 后端自动 TTL 无需手动清理）"""
        while self._running:
            await asyncio.sleep(600)  # 每10分钟清理一次
            try:
                cleaned = await self._result_store.cleanup_expired()
                if cleaned > 0:
                    logger.info("[InferenceQueue] 清理过期结果 %d 条", cleaned)
            except Exception as e:
                logger.debug("[InferenceQueue] 清理异常: %s", e)


class QueueFullError(Exception):
    """推理队列已满异常"""
    pass


# ── 全局推理队列单例 ───────────────────────────────────────────
# Phase 4-A: 延迟初始化，在 main.py lifespan 中根据配置创建
# 此处保留默认内存版单例，确保向后兼容
inference_queue = AsyncInferenceQueue()


# ── 内置执行器：贝叶斯配方生成 ─────────────────────────────────

@register_executor("formula.bayesian_generate")
def _exec_bayesian_generate(payload: dict) -> dict:
    """
    贝叶斯优化配方生成执行器（在 ThreadPoolExecutor 中运行）

    payload:
        target_effects: list[str]
        constraints: dict
        max_iterations: int
    """
    import asyncio as _asyncio
    from .bayesian_formula_optimizer import BayesianFormulaOptimizer, BayesianConfig

    target_effects = payload.get("target_effects", ["抗氧化"])
    constraints = payload.get("constraints", {})
    max_iter = payload.get("max_iterations", 30)

    config = BayesianConfig(n_iterations=min(max_iter, 100))
    optimizer = BayesianFormulaOptimizer(config=config)

    # 在同步上下文中运行异步方法（ThreadPoolExecutor 内无 event loop）
    loop = _asyncio.new_event_loop()
    try:
        candidates = loop.run_until_complete(
            optimizer.generate(target_effects, constraints)
        )
    finally:
        loop.close()

    return {
        "candidates": [c.to_dict() if hasattr(c, "to_dict") else str(c) for c in candidates[:5]],
        "total_found": len(candidates),
        "algorithm": "bayesian",
    }


@register_executor("formula.genetic_optimize")
def _exec_genetic_optimize(payload: dict) -> dict:
    """
    遗传算法配方优化执行器（在 ThreadPoolExecutor 中运行）

    payload:
        target_effects: list[str]
        exclude_herbs: list[str]
        population_size: int
        generations: int
    """
    import asyncio as _asyncio
    from .genetic_formula_optimizer import GeneticFormulaOptimizer, GAConfig

    target_effects = payload.get("target_effects", ["抗氧化"])
    exclude_herbs = set(payload.get("exclude_herbs", []))
    pop_size = min(payload.get("population_size", 50), 200)
    generations = min(payload.get("generations", 30), 100)

    config = GAConfig(population_size=pop_size, generations=generations)
    optimizer = GeneticFormulaOptimizer(config=config)

    loop = _asyncio.new_event_loop()
    try:
        individuals, history = loop.run_until_complete(
            optimizer.optimize(target_effects, exclude_herbs)
        )
    finally:
        loop.close()

    top5 = individuals[:5] if individuals else []
    return {
        "candidates": [
            {
                "genes": ind.genes,
                "fitness": round(ind.fitness, 4),
                "efficacy": round(ind.efficacy, 4),
                "safety": round(ind.safety, 4),
            }
            for ind in top5
        ],
        "generations_run": len(history),
        "algorithm": "genetic",
    }
