"""
基于优先级的异步 LLM 请求队列

提供并发控制 + 优先级调度能力，
确保高优先级请求（如交互式对话）优先执行。

用法:
    from app.services.ai.shared.request_queue import get_request_queue, Priority

    queue = get_request_queue()

    # 提交高优先级对话请求
    result = await queue.submit(
        request_id="chat-001",
        priority=Priority.HIGH,
        messages=[{"role": "user", "content": "你好"}],
        task_type="chat",
        executor=my_llm_call_fn,
    )

    # 查看队列统计
    logger.info(queue.stats)
"""
from __future__ import annotations

import asyncio
import time
import logging
from dataclasses import dataclass
from enum import IntEnum
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
# 数据类型
# ══════════════════════════════════════════════


class Priority(IntEnum):
    """请求优先级（数值越小优先级越高）"""
    HIGH = 0      # 交互式对话 — 即时响应
    MEDIUM = 1    # 配方生成 — 中等延迟可接受
    LOW = 2       # 批量任务 — 可排队等待


@dataclass
class PendingRequest:
    """队列中的待处理请求"""
    request_id: str
    priority: Priority
    messages: list      # 对话消息列表
    task_type: str      # chat / generate / optimize / recommend
    future: asyncio.Future  # 用于返回结果或异常


# ══════════════════════════════════════════════
# 请求队列
# ══════════════════════════════════════════════


class LLMRequestQueue:
    """基于优先级的异步请求队列 + 并发控制

    内部机制:
    - PriorityQueue: 按优先级排序的异步队列
    - Semaphore: 控制最大并发数（默认 5）
    - 统计信息: 记录提交/完成/拒绝数、平均等待时间
    """

    def __init__(self, max_concurrent: int = 5) -> None:
        self._queue: asyncio.PriorityQueue[
            tuple[int, float, PendingRequest]
        ] = asyncio.PriorityQueue()
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._max_concurrent = max_concurrent
        self._stats: dict[str, Any] = {
            "total_submitted": 0,
            "total_completed": 0,
            "total_rejected": 0,
            "avg_wait_ms": 0.0,
            "active_count": 0,
        }
        self._lock = asyncio.Lock()

    @property
    def stats(self) -> dict:
        """返回队列统计快照（只读副本）"""
        return dict(self._stats)

    @property
    def queue_size(self) -> int:
        """当前队列中的待处理请求数"""
        return self._queue.qsize()

    @property
    def available_slots(self) -> int:
        """剩余可用并发槽位数"""
        return self._semaphore._value  # type: ignore[attr-defined]

    async def submit(
        self,
        request_id: str,
        priority: Priority,
        messages: list,
        task_type: str,
        executor: Callable[[list, str], Awaitable[Any]],
    ) -> Any:
        """提交请求到队列，等待执行结果

        Args:
            request_id: 请求唯一标识
            priority: 请求优先级
            messages: 对话消息列表
            task_type: 任务类型 (chat/generate/optimize/recommend)
            executor: 实际执行 LLM 调用的异步函数，签名为 (messages, task_type) -> result

        Returns:
            executor 的返回值

        Raises:
            executor 抛出的任何异常
        """
        self._stats["total_submitted"] += 1
        enqueue_time = time.monotonic()
        loop = asyncio.get_running_loop()
        future: asyncio.Future = loop.create_future()

        req = PendingRequest(
            request_id=request_id,
            priority=priority,
            messages=messages,
            task_type=task_type,
            future=future,
        )

        # 入队：(优先级, 入队时间, 请求对象)
        # 使用入队时间作为 tie-breaker，保证同优先级 FIFO
        await self._queue.put((priority.value, enqueue_time, req))

        logger.debug(
            "请求入队: id=%s priority=%s task=%s qsize=%d",
            request_id, priority.name, task_type, self._queue.qsize(),
        )

        # 获取信号量 → 执行 → 释放
        async with self._semaphore:
            wait_ms = (time.monotonic() - enqueue_time) * 1000
            try:
                async with self._lock:
                    self._stats["active_count"] += 1

                result = await executor(req.messages, req.task_type)
                req.future.set_result(result)
            except Exception as exc:
                req.future.set_exception(exc)
                raise
            finally:
                async with self._lock:
                    self._stats["total_completed"] += 1
                    self._stats["active_count"] -= 1
                    self._update_avg_wait(wait_ms)

        return await future

    def _update_avg_wait(self, wait_ms: float) -> None:
        """增量更新平均等待时间（指数移动平均近似）"""
        n = self._stats["total_completed"]
        prev = self._stats["avg_wait_ms"]
        self._stats["avg_wait_ms"] = prev + (wait_ms - prev) / n

    async def clear(self) -> None:
        """清空队列中未处理的请求（不取消正在执行的）"""
        cleared = 0
        while not self._queue.empty():
            try:
                _, _, req = self._queue.get_nowait()
                req.future.cancel()
                cleared += 1
            except asyncio.QueueEmpty:
                break
        self._stats["total_rejected"] += cleared
        logger.info("清空队列: 已移除 %d 个等待中的请求", cleared)


# ══════════════════════════════════════════════
# 全局单例
# ══════════════════════════════════════════════

_request_queue = LLMRequestQueue()


def get_request_queue() -> LLMRequestQueue:
    """获取全局 LLMRequestQueue 单例"""
    return _request_queue
