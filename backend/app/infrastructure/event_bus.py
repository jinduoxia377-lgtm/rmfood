"""
事件总线适配器实现

提供两种适配器：
1. RedisStreamsEventBus - 基于 Redis Streams 的生产实现
2. InMemoryEventBus - 基于 asyncio.Queue 的测试/开发实现

遵循 ADR-002 的事件驱动架构选型。
"""
from __future__ import annotations

import json
import logging
import uuid
from abc import ABC
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine

from ..core.observability.domain_events import DomainEvent

logger = logging.getLogger(__name__)


# ──────────── 事件序列化 ────────────


def serialize_event(event: DomainEvent) -> dict:
    """将领域事件序列化为可传输的字典"""
    # 通过 event_class 和 event_data 重建事件，不依赖 pickle
    return {
        "event_type": type(event).__name__,
        "event_data": _to_serializable(event),
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _to_serializable(obj: Any) -> Any:
    """递归将对象转换为 JSON 可序列化格式"""
    if hasattr(obj, "__dataclass_fields__"):
        return {f: _to_serializable(getattr(obj, f)) for f in obj.__dataclass_fields__}
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, Enum):
        return obj.name
    elif isinstance(obj, Decimal):
        return str(obj)
    elif isinstance(obj, list):
        return [_to_serializable(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: _to_serializable(v) for k, v in obj.items()}
    return obj


# ──────────── 事件处理器类型 ────────────

EventHandler = Callable[[dict], Coroutine[Any, Any, None]]
"""事件处理器：接收反序列化的事件数据，异步执行"""


# ──────────── InMemory 适配器（测试用） ────────────


class InMemoryEventBus(ABC):
    """
    内存事件总线（测试/开发用）

    基于 asyncio.Queue，支持主题路由和消费者注册。
    不依赖 Redis，可在测试中独立使用。
    """

    def __init__(self):
        self._handlers: dict[str, list[EventHandler]] = {}
        self._published_events: list[dict] = []
        self._running = False
        self._queue = None

    async def start(self) -> None:
        """启动事件处理循环"""
        self._running = True
        logger.info("InMemoryEventBus 已启动")

    async def stop(self) -> None:
        """停止事件处理循环"""
        self._running = False
        logger.info("InMemoryEventBus 已停止")

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """订阅指定类型的事件"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
        logger.debug(f"订阅事件: {event_type}")

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """取消订阅"""
        if event_type in self._handlers:
            self._handlers[event_type] = [
                h for h in self._handlers[event_type] if h is not handler
            ]

    async def publish(self, event: DomainEvent) -> None:
        """发布事件到内存总线"""
        serialized = serialize_event(event)
        event_type = serialized["event_type"]
        self._published_events.append(serialized)

        # 同步调用已注册的处理器
        handlers = self._handlers.get(event_type, []) + self._handlers.get("*", [])
        for handler in handlers:
            try:
                await handler(serialized)
            except Exception as e:
                logger.error(f"事件处理器异常 [{event_type}]: {e}")

        logger.debug(f"事件已发布 (InMemory): {event_type}")

    @property
    def published_events(self) -> list[dict]:
        """已发布的事件列表（测试用）"""
        return list(self._published_events)

    def clear(self) -> None:
        """清空已发布事件（测试用）"""
        self._published_events.clear()


# ──────────── Redis Streams 适配器（生产用） ────────────


class RedisStreamsEventBus(ABC):
    """
    基于 Redis Streams 的事件总线（生产用）

    特性：
    - 消费者组支持：多个消费者实例负载均衡
    - 消息持久化：Redis Streams 持久化到 AOF/RDB
    - 至少一次投递：通过消费者组 ACK 机制
    - 死信队列：处理失败的消息进入死信流
    """

    STREAM_PREFIX = "events:"
    CONSUMER_GROUP = "rmfood-event-bus"
    MAXLEN = 10000  # 每个流最多保留的消息数

    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._redis = None
        self._running = False
        self._tasks: list = []

    async def start(self) -> None:
        """初始化 Redis 连接和消费者组"""
        import redis.asyncio as aioredis

        self._redis = await aioredis.from_url(
            self._redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            retry_on_timeout=True,
        )
        self._running = True
        logger.info(f"RedisStreamsEventBus 已连接: {self._redis_url}")

    async def stop(self) -> None:
        """停止事件总线"""
        self._running = False
        for task in self._tasks:
            task.cancel()
        if self._redis:
            await self._redis.close()
        logger.info("RedisStreamsEventBus 已停止")

    async def publish(self, event: DomainEvent) -> None:
        """发布事件到 Redis Stream

        每条消息以事件类型为流键名，便于消费者按类型订阅。
        流自动裁剪到 MAXLEN 条，防止无限增长。
        """
        if not self._redis:
            logger.warning("RedisStreamsEventBus 未就绪，事件被丢弃")
            return

        serialized = serialize_event(event)
        event_type = serialized["event_type"]
        stream_key = f"{self.STREAM_PREFIX}{event_type}"

        try:
            await self._redis.xadd(
                stream_key,
                fields={"data": json.dumps(serialized)},
                maxlen=self.MAXLEN,
                approximate=True,
            )
            logger.debug(f"事件已发布到 Redis Stream [{stream_key}]: {event_type}")
        except Exception as e:
            logger.error(f"Redis Stream 发布失败 [{stream_key}]: {e}")
            raise

    async def create_consumer_group(self, stream_key: str) -> None:
        """创建消费者组（幂等）"""
        try:
            await self._redis.xgroup_create(
                stream_key,
                self.CONSUMER_GROUP,
                id="0",  # 从最早的消息开始
                mkstream=True,  # 流不存在则创建
            )
        except Exception as e:
            # XGROUP 已存在时抛出 BUSYGROUP 错误，忽略
            if "BUSYGROUP" not in str(e):
                logger.warning(f"创建消费者组异常: {e}")

    async def consume(
        self,
        event_types: list[str],
        handler: EventHandler,
        consumer_name: str = "worker-1",
        batch_size: int = 10,
        poll_seconds: float = 1.0,
    ) -> None:
        """消费指定类型的事件

        使用 Redis Streams 消费者组模式：
        - 同一消费者组的消费者负载均衡
        - 每条消息只投递给一个消费者
        - 消息处理后需 ACK 确认
        """
        import asyncio

        streams = [f"{self.STREAM_PREFIX}{et}" for et in event_types]

        for stream in streams:
            await self.create_consumer_group(stream)

        while self._running:
            try:
                # 从消费者组读取待处理消息
                results = await self._redis.xreadgroup(
                    groupname=self.CONSUMER_GROUP,
                    consumername=consumer_name,
                    streams={s: ">" for s in streams},
                    count=batch_size,
                    block=int(poll_seconds * 1000),
                )

                if not results:
                    continue

                for stream_key, messages in results:
                    for msg_id, msg_data in messages:
                        await self._process_message(stream_key, msg_id, msg_data, handler)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"消费事件异常: {e}", exc_info=True)
                await asyncio.sleep(poll_seconds)

    async def _process_message(
        self,
        stream_key: str,
        msg_id: str,
        msg_data: dict,
        handler: EventHandler,
    ) -> None:
        """处理单条消息"""
        try:
            raw_data = msg_data.get("data", "{}")
            event_data = json.loads(raw_data)
            await handler(event_data)
            # 处理成功，ACK 确认
            await self._redis.xack(stream_key, self.CONSUMER_GROUP, msg_id)
        except Exception as e:
            logger.error(f"消息处理失败 [{stream_key}:{msg_id}]: {e}")
            # 将失败消息移至死信流
            dlq_key = f"{stream_key}:dlq"
            await self._redis.xadd(dlq_key, fields={
                "original_stream": stream_key,
                "original_id": msg_id,
                "data": msg_data.get("data", "{}"),
                "error": "事件总线异常",
            }, maxlen=1000)
            # ACK 原始消息（避免阻塞队列）
            await self._redis.xack(stream_key, self.CONSUMER_GROUP, msg_id)


# 导入辅助修复（序列化中用到的类型）
from decimal import Decimal
from enum import Enum
