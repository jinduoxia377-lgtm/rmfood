"""
轻量事件总线 (v1.0)

基于 asyncio 的轻量级发布/订阅事件总线，用于：
- AI 任务完成通知
- 配方生成 → 合规检查 → 实验方案 的异步链路
- 插件系统事件通信

不依赖外部消息队列（Celery/RabbitMQ），仅在单进程内有效。
后续可替换为 Redis Streams 或 Kafka 实现多实例支持。
"""
from __future__ import annotations

import asyncio
import inspect
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger(__name__)


class EventPriority(int, Enum):
    HIGH = 0
    NORMAL = 5
    LOW = 10


@dataclass
class Event:
    """事件单元"""
    event_type: str
    payload: dict = field(default_factory=dict)
    source: str = ""
    timestamp: float = field(default_factory=time.time)
    priority: EventPriority = EventPriority.NORMAL
    event_id: str = field(default_factory=lambda: f"evt-{int(time.time()*1000)}")

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "payload": self.payload,
            "source": self.source,
            "timestamp": self.timestamp,
            "priority": self.priority.value,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Event":
        return cls(
            event_type=data["event_type"],
            payload=data.get("payload", {}),
            source=data.get("source", ""),
            timestamp=data.get("timestamp", time.time()),
            priority=EventPriority(data.get("priority", 5)),
            event_id=data.get("event_id", f"evt-{int(time.time()*1000)}"),
        )


# 处理器类型：同步函数或异步协程
HandlerFunc = Callable[..., Any] | Callable[..., Coroutine[Any, Any, Any]]


class EventBus:
    """
    轻量级异步事件总线

    用法：
        bus = EventBus()
        bus.subscribe("formula.generated", handler_func)
        await bus.publish(Event("formula.generated", {"formula_id": 1}))
    """

    def __init__(self, max_buffer_size: int = 1000):
        self._handlers: Dict[str, List[HandlerFunc]] = defaultdict(list)
        self._listener_tasks: Dict[str, List[asyncio.Task]] = {}
        self._event_buffer: asyncio.Queue = asyncio.Queue(maxsize=max_buffer_size)
        self._buffer_task: Optional[asyncio.Task] = None
        self._running = False
        self._stats: Dict[str, int] = defaultdict(int)
        self._last_emit: float = 0.0

    async def start(self) -> None:
        """启动事件总线（buffer 消费协程）"""
        if self._running:
            return
        self._running = True
        self._buffer_task = asyncio.create_task(self._buffer_loop())
        logger.info("[EventBus] 事件总线已启动")

    async def stop(self) -> None:
        """停止事件总线"""
        if not self._running:
            return
        self._running = False
        if self._buffer_task:
            self._buffer_task.cancel()
            try:
                await self._buffer_task
            except asyncio.CancelledError:
                pass
        # 取消所有监听任务
        for tasks in self._listener_tasks.values():
            for t in tasks:
                t.cancel()
        self._listener_tasks.clear()
        logger.info("[EventBus] 事件总线已停止")

    def subscribe(
        self,
        event_type: str,
        handler: HandlerFunc,
        listener_id: Optional[str] = None,
    ) -> None:
        """
        订阅事件

        Args:
            event_type: 事件类型，如 "formula.generated"
            handler: 处理函数（同步或异步均可）
            listener_id: 可选，用于同一 handler 多次订阅时区分
        """
        key = f"{event_type}:{listener_id}" if listener_id else event_type
        self._handlers[event_type].append(handler)
        logger.debug("[EventBus] 订阅: %s → %s", event_type, handler.__name__)

    def unsubscribe(self, event_type: str, handler: HandlerFunc) -> None:
        """取消订阅"""
        if event_type in self._handlers:
            self._handlers[event_type] = [
                h for h in self._handlers[event_type] if h is not handler
            ]
            logger.debug("[EventBus] 取消订阅: %s → %s", event_type, handler.__name__)

    async def publish(self, event: Event) -> None:
        """
        发布事件（异步，不阻塞调用方）

        事件通过 buffer 队列交由 _buffer_loop 分发。
        """
        self._stats[event.event_type] = self._stats.get(event.event_type, 0) + 1
        self._last_emit = time.time()

        try:
            self._event_buffer.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning(
                "[EventBus] 事件缓冲区已满，丢弃事件: %s", event.event_type
            )

    async def publish_sync(self, event: Event) -> None:
        """同步发布（等待所有处理器完成，适用于测试）"""
        self._stats[event.event_type] = self._stats.get(event.event_type, 0) + 1
        await self._dispatch(event)

    async def _dispatch(self, event: Event) -> None:
        """分派事件到所有处理器"""
        handlers = self._handlers.get(event.event_type, [])
        if not handlers:
            return

        tasks: List[asyncio.Task] = []
        for handler in handlers:
            task = asyncio.create_task(self._invoke_handler(handler, event))
            tasks.append(task)
            if event.event_type not in self._listener_tasks:
                self._listener_tasks[event.event_type] = []
            self._listener_tasks[event.event_type].append(task)

        # 清理已完成的任务
        self._listener_tasks[event.event_type] = [
            t for t in tasks if not t.done()
        ]

    async def _invoke_handler(
        self, handler: HandlerFunc, event: Event
    ) -> None:
        """调用单个处理器"""
        try:
            if inspect.iscoroutinefunction(handler):
                await handler(event)
            else:
                result = handler(event)
                if inspect.isawaitable(result):
                    await result
        except Exception as e:
            logger.error(
                "[EventBus] 处理器异常: handler=%s event=%s error=%s",
                handler.__name__, event.event_type, e,
                exc_info=True,
            )

    async def _buffer_loop(self) -> None:
        """事件缓冲区消费协程（节流用）"""
        while self._running:
            try:
                event = await asyncio.wait_for(
                    self._event_buffer.get(), timeout=0.1
                )
                await self._dispatch(event)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug("[EventBus] buffer loop error: %s", e)

    def get_stats(self) -> Dict[str, Any]:
        """获取总线统计信息"""
        return {
            "running": self._running,
            "buffer_size": self._event_buffer.qsize(),
            "buffer_capacity": self._event_buffer.maxsize,
            "event_counts": dict(self._stats),
            "subscriptions": {
                et: len(hs) for et, hs in self._handlers.items()
            },
            "last_emit_age_s": time.time() - self._last_emit if self._last_emit else None,
        }


# ── 预定义事件类型常量 ─────────────────────────────────────────────────

class EventType(str, Enum):
    """预定义事件类型"""
    # AI 任务事件
    FORMULA_GENERATED = "formula.generated"
    FORMULA_OPTIMIZED = "formula.optimized"
    AI_TASK_COMPLETED = "ai.task.completed"
    AI_TASK_FAILED = "ai.task.failed"

    # 合规事件
    COMPLIANCE_CHECKED = "compliance.checked"
    COMPLIANCE_RESULT = "compliance.result"

    # 实验事件
    EXPERIMENT_PLAN_GENERATED = "experiment.plan.generated"

    # 数据飞轮事件
    DATA_QUALITY_ISSUE = "data.quality.issue"
    DATA_QUALITY_FIXED = "data.quality.fixed"

    # Agent 事件
    AGENT_STEP_STARTED = "agent.step.started"
    AGENT_STEP_COMPLETED = "agent.step.completed"
    AGENT_EXECUTION_DONE = "agent.execution.done"


# ── 全局单例 ────────────────────────────────────────────────────────────

_event_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    """获取全局 EventBus 单例"""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


async def publish(event: Event) -> None:
    """快捷发布"""
    await get_event_bus().publish(event)


async def subscribe(event_type: str, handler: HandlerFunc) -> None:
    """快捷订阅"""
    get_event_bus().subscribe(event_type, handler)


# ── 示例：配方生成完成事件处理器 ────────────────────────────────────────

async def _example_formula_handler(event: Event) -> None:
    """示例：配方生成完成后自动触发合规检查"""
    formula_id = event.payload.get("formula_id")
    logger.info(
        "[EventBus] 配方 %s 生成完成，触发后续流程", formula_id
    )
