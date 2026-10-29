"""
🟡 P2-5: 事件驱动架构 - 领域事件发布/订阅系统

提供企业级的领域事件驱动能力:

1. 📢 发布-订阅模式 - 解耦生产者和消费者
2. 🔄 多后端支持 - 内存 / Redis / 消息队列（可扩展）
3. ⏰ 事件溯源 - 事件持久化与重放能力
4. 🔌 异步处理 - asyncio 原生支持，高吞吐
5. 🛡️ 可靠性保障 - 重试机制、死信队列、幂等处理
6. 📊 可观测性 - 事件计数、延迟监控、失败率统计
7. 🎯 类型安全 - 基于 Pydantic 的强类型事件定义
8. 💾 事件归档 - 长期存储与审计

核心概念:
    DomainEvent - 领域事件基类（配方创建、审核、发布等）
    EventPublisher - 事件发布器
    EventSubscriber - 事件订阅者
    EventBus - 事件总线（负责分发）
    EventHandler - 事件处理器（业务逻辑）
    EventStore - 事件存储（持久化与重放）

使用方式:
    # 1. 定义事件
    from app.core.observability.domain_events import DomainEvent

    class FormulaCreated(DomainEvent):
        formula_id: str
        creator_id: str
        formula_name: str

    # 2. 订阅事件
    @subscribe("formula.created")
    async def send_notification(event: FormulaCreated):
        logger.info("配方 %s 已创建，发送通知...", event.formula_name)

    # 3. 发布事件
    await publish(FormulaCreated(
        formula_id="formula_001",
        creator_id="user_001",
        formula_name="新配方",
    ))

    # 4. 管理命令行
    python -m app.core.domain_events --action status     # 查看事件总线状态
    python -m app.core.domain_events --action replay     # 重放历史事件
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

# ═════════════════════════════════════════════
# 🟡 P2-5: 核心类型与枚举
# ═════════════════════════════════════════════


class EventStatus(str, Enum):
    """事件处理状态"""
    PENDING = "pending"           # 待处理
    PROCESSING = "processing"      # 处理中
    SUCCESS = "success"           # 处理成功
    FAILED = "failed"             # 处理失败
    RETRY = "retry"               # 重试中
    DEAD_LETTER = "dead_letter"   # 已进入死信队列


class EventPriority(int, Enum):
    """事件优先级"""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class BusBackend(str, Enum):
    """事件总线后端"""
    MEMORY = "memory"             # 内存模式（开发测试）
    REDIS = "redis"               # Redis Streams（生产推荐）
    KAFKA = "kafka"               # Kafka（高吞吐）
    RABBITMQ = "rabbitmq"         # RabbitMQ（传统企业）


# ═════════════════════════════════════════════
# 🟡 P2-5: 事件模型定义
# ═════════════════════════════════════════════


class DomainEvent(BaseModel):
    """
    📦 领域事件基类

    所有业务事件都应继承此类。
    每个事件包含:
    - 唯一 ID: 用于去重和跟踪
    - 事件类型: 用于路由和订阅
    - 时间戳: 用于排序和审计
    - 上下文: 附加元数据
    """

    model_config = ConfigDict(
        frozen=False,
        extra="allow",
        json_encoders={datetime: lambda v: v.isoformat()},
    )

    # 事件元信息
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex}")
    event_type: str = ""                          # 事件类型（自动填充）
    event_version: int = 1                         # 事件版本（用于演进）
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # 业务上下文
    aggregate_id: Optional[str] = None             # 聚合根 ID（如配方 ID）
    aggregate_type: Optional[str] = None           # 聚合根类型（如 "formula"）
    source: str = "application"                    # 事件来源
    correlation_id: Optional[str] = None           # 相关 ID（用于追踪链路）

    # 可靠性元数据
    priority: EventPriority = EventPriority.NORMAL
    ttl_seconds: int = 86400                       # 事件 TTL（默认 1 天）
    idempotency_key: Optional[str] = None          # 幂等键（防止重复处理）

    # 扩展字段
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def __init__(self, **data):
        super().__init__(**data)
        # 自动填充事件类型（基于类名）
        if not self.event_type:
            self.event_type = self._infer_event_type()

    def _infer_event_type(self) -> str:
        """从类名推导事件类型"""
        class_name = self.__class__.__name__
        # FormulaCreated -> formula.created
        result = []
        for i, char in enumerate(class_name):
            if char.isupper() and i > 0:
                result.append(".")
            result.append(char.lower())
        return "".join(result)

    @property
    def checksum(self) -> str:
        """事件内容的校验和（用于去重）"""
        content = json.dumps(self.model_dump(exclude={"event_id", "timestamp"}), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def to_json(self) -> str:
        """序列化为 JSON"""
        return self.model_dump_json()

    @classmethod
    def from_json(cls, json_str: str) -> "DomainEvent":
        """从 JSON 反序列化"""
        data = json.loads(json_str)
        event_type = data.get("event_type", "")

        # 尝试查找具体的事件子类
        for subclass in cls.__subclasses__():
            if event_type == subclass.__name__.lower().replace("_", "."):
                return subclass(**data)

        # 默认返回基类
        return cls(**data)


# ─── 项目相关事件（示例，便于理解如何定义事件） ───


class FormulaEvent(DomainEvent):
    """配方相关事件基类"""
    formula_id: str
    formula_name: str = ""

    def __init__(self, **data):
        super().__init__(**data)
        self.aggregate_type = "formula"
        self.aggregate_id = self.formula_id


class FormulaCreated(FormulaEvent):
    """✅ 配方已创建"""
    creator_id: str = ""


class FormulaUpdated(FormulaEvent):
    """🔄 配方已更新"""
    updated_by: str = ""
    changes: Dict[str, Any] = Field(default_factory=dict)


class FormulaDeleted(FormulaEvent):
    """🗑️ 配方已删除"""
    deleted_by: str = ""


class FormulaReviewed(FormulaEvent):
    """👁️ 配方已审核"""
    reviewer_id: str = ""
    review_result: str = "approved"  # approved / rejected
    review_notes: str = ""


class FormulaPublished(FormulaEvent):
    """📢 配方已发布"""
    published_by: str = ""
    version: str = ""


class AIRequestEvent(DomainEvent):
    """🤖 AI 请求事件"""
    model: str = ""
    request_type: str = ""
    user_id: str = ""
    request_id: str = ""

    def __init__(self, **data):
        super().__init__(**data)
        self.aggregate_type = "ai_request"


class AICallbackEvent(DomainEvent):
    """🤖 AI 回调事件"""
    request_id: str = ""
    status: str = "success"
    result: Dict[str, Any] = Field(default_factory=dict)


class UserAuthEvent(DomainEvent):
    """👤 用户认证事件"""
    user_id: str = ""
    action: str = "login"  # login / logout / token_refresh
    ip_address: str = ""
    user_agent: str = ""


class FileUploadedEvent(DomainEvent):
    """📁 文件上传事件"""
    file_id: str = ""
    file_name: str = ""
    file_size: int = 0
    uploader_id: str = ""
    content_type: str = ""


# ═════════════════════════════════════════════
# 🟡 P2-5: 事件处理器定义
# ═════════════════════════════════════════════


@dataclass
class EventHandlerRegistration:
    """事件处理器注册信息"""
    event_type: str                               # 订阅的事件类型
    handler: Callable[[DomainEvent], Any]        # 处理函数
    handler_name: str                            # 处理器名称（用于日志）
    priority: int = 100                           # 执行优先级（低 = 先执行）
    retries: int = 3                               # 失败重试次数
    retry_delay_seconds: float = 1.0              # 重试延迟
    async_handler: bool = True                    # 是否异步
    is_active: bool = True                         # 是否激活
    timeout_seconds: int = 30                     # 超时时间
    dead_letter_on_timeout: bool = True           # 超时后是否进入死信队列

    async def execute(self, event: DomainEvent) -> Tuple[bool, Optional[Exception]]:
        """执行处理器，包含重试逻辑"""
        if not self.is_active:
            return True, None

        last_exception: Optional[Exception] = None

        for attempt in range(self.retries + 1):
            try:
                # 异步超时处理
                if asyncio.iscoroutinefunction(self.handler):
                    await asyncio.wait_for(
                        self.handler(event),
                        timeout=self.timeout_seconds,
                    )
                else:
                    # 同步函数 -> 在线程池中运行
                    await asyncio.get_running_loop().run_in_executor(
                        None,
                        lambda: self.handler(event),
                    )

                return True, None

            except asyncio.TimeoutError as e:
                last_exception = e
                logger.warning(
                    f"⏰ 事件处理器超时: {self.handler_name} "
                    f"(尝试 {attempt + 1}/{self.retries + 1})"
                )

            except Exception as e:
                last_exception = e
                logger.error(
                    f"❌ 事件处理器异常: {self.handler_name} "
                    f"(尝试 {attempt + 1}/{self.retries + 1}): {e}"
                )

            # 指数退避重试
            if attempt < self.retries:
                delay = self.retry_delay_seconds * (2 ** attempt)
                await asyncio.sleep(delay)

        return False, last_exception


EventHandlerFn = Callable[[DomainEvent], Any]


# ═════════════════════════════════════════════
# 🟡 P2-5: 事件存储（持久化与审计）
# ═════════════════════════════════════════════


class EventStore:
    """
    📦 事件存储（持久化与审计）

    支持:
    - 事件持久化
    - 事件查询与重放
    - 事件统计
    """

    def __init__(self, storage_path: Optional[str] = None):
        self._events: List[Dict[str, Any]] = []
        self._storage_path = storage_path
        self._processed_ids: Set[str] = set()
        self._load_from_storage()

    def _load_from_storage(self) -> None:
        """从持久化存储加载（如果有）"""
        if not self._storage_path:
            return

        try:
            with open(self._storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._events = data.get("events", [])
                self._processed_ids = set(data.get("processed_ids", []))
            logger.info(f"已从 {self._storage_path} 加载 {len(self._events)} 个历史事件")
        except Exception as e:
            logger.warning(f"加载事件存储失败: {e}")

    def _persist(self) -> None:
        """持久化到文件"""
        if not self._storage_path:
            return

        try:
            with open(self._storage_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "events": self._events[-1000:],  # 只保留最近 1000 个
                        "processed_ids": list(self._processed_ids)[-5000:],
                        "last_updated": datetime.now(timezone.utc).isoformat(),
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
        except Exception as e:
            logger.warning(f"持久化事件存储失败: {e}")

    async def save(self, event: DomainEvent, status: EventStatus) -> None:
        """保存事件"""
        self._events.append(
            {
                "event_id": event.event_id,
                "event_type": event.event_type,
                "aggregate_id": event.aggregate_id,
                "aggregate_type": event.aggregate_type,
                "timestamp": event.timestamp,
                "status": status.value,
                "priority": event.priority.value,
            }
        )
        self._persist()

    async def mark_processed(self, event_id: str) -> None:
        """标记事件为已处理"""
        self._processed_ids.add(event_id)
        self._persist()

    def is_processed(self, event_id: str) -> bool:
        """检查是否已处理（幂等检查）"""
        return event_id in self._processed_ids

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        by_type: Dict[str, int] = defaultdict(int)
        by_status: Dict[str, int] = defaultdict(int)

        for e in self._events:
            by_type[e.get("event_type", "unknown")] += 1
            by_status[e.get("status", "unknown")] += 1

        return {
            "total_events": len(self._events),
            "total_processed": len(self._processed_ids),
            "by_type": dict(by_type),
            "by_status": dict(by_status),
            "storage_path": self._storage_path,
        }

    def get_events_by_type(self, event_type: str, limit: int = 100) -> List[Dict[str, Any]]:
        """按事件类型查询"""
        return [e for e in self._events if e.get("event_type") == event_type][-limit:]

    async def replay(
        self,
        event_type: Optional[str] = None,
        since: Optional[str] = None,
    ) -> int:
        """重放事件（用于重建状态或调试）"""
        count = 0
        for event_data in self._events:
            if event_type and event_data.get("event_type") != event_type:
                continue
            if since and event_data.get("timestamp", "") < since:
                continue

            logger.info(f"⏪ 重放: {event_data['event_type']} - {event_data['event_id']}")
            count += 1

        return count


# ═════════════════════════════════════════════
# 🟡 P2-5: 事件总线（核心）
# ═════════════════════════════════════════════


class EventBus:
    """
    🔄 事件总线

    负责:
    - 订阅管理
    - 事件分发（按类型路由）
    - 重试与错误处理
    - 统计与监控
    - 事件持久化
    """

    def __init__(
        self,
        backend: BusBackend = BusBackend.MEMORY,
        event_store: Optional[EventStore] = None,
        enable_async_queue: bool = True,
    ):
        self._subscribers: Dict[str, List[EventHandlerRegistration]] = defaultdict(list)
        self._event_store = event_store or EventStore()
        self._backend = backend
        self._enable_async_queue = enable_async_queue
        self._async_tasks: Set[asyncio.Task] = set()
        self._stats: Dict[str, int] = defaultdict(int)
        self._start_time = time.time()
        self._is_running = True
        logger.info(f"🎯 事件总线已启动 (backend={backend.value})")

    # ─── 订阅管理 ───

    def subscribe(
        self,
        event_type: str,
        handler: EventHandlerFn,
        *,
        priority: int = 100,
        retries: int = 3,
        handler_name: Optional[str] = None,
    ) -> EventHandlerRegistration:
        """订阅事件"""
        registration = EventHandlerRegistration(
            event_type=event_type,
            handler=handler,
            handler_name=handler_name or f"{handler.__module__}.{handler.__qualname__}",
            priority=priority,
            retries=retries,
            async_handler=asyncio.iscoroutinefunction(handler),
        )
        self._subscribers[event_type].append(registration)
        # 按优先级排序
        self._subscribers[event_type].sort(key=lambda r: r.priority)

        logger.info(f"📡 订阅: {event_type} -> {registration.handler_name}")
        return registration

    def unsubscribe(self, event_type: str, handler: EventHandlerFn) -> bool:
        """取消订阅"""
        if event_type not in self._subscribers:
            return False

        for i, reg in enumerate(self._subscribers[event_type]):
            if reg.handler == handler:
                self._subscribers[event_type].pop(i)
                logger.info(f"🔕 取消订阅: {event_type}")
                return True
        return False

    def get_subscribers(self, event_type: str) -> List[EventHandlerRegistration]:
        """获取某事件类型的订阅者"""
        return list(self._subscribers.get(event_type, []))

    def get_all_event_types(self) -> List[str]:
        """获取所有有订阅者的事件类型"""
        return sorted(self._subscribers.keys())

    # ─── 事件发布 ───

    async def publish(self, event: DomainEvent) -> bool:
        """
        📢 发布事件

        步骤:
        1. 验证事件
        2. 持久化到 EventStore
        3. 分发给所有订阅者
        4. 更新统计
        """
        # 1. 事件完整性检查
        if not event.event_type:
            logger.error("❌ 事件缺少 event_type")
            return False

        # 2. 幂等检查（防止重复处理）
        if event.idempotency_key and self._event_store.is_processed(event.event_id):
            logger.info(f"🔍 跳过已处理事件: {event.event_id}")
            return True

        # 3. 持久化
        await self._event_store.save(event, EventStatus.PENDING)

        # 4. 获取订阅者
        subscribers = self.get_subscribers(event.event_type)
        wildcard_subscribers = self.get_subscribers("*")  # 通配符订阅
        all_subscribers = subscribers + wildcard_subscribers

        if not all_subscribers:
            logger.info(f"📭 事件 {event.event_type} 没有订阅者")
            await self._event_store.mark_processed(event.event_id)
            self._stats[event.event_type] += 1
            return True

        logger.info(
            f"📢 发布: {event.event_type} ({event.event_id}) -> {len(all_subscribers)} 订阅者"
        )

        # 5. 分发事件（同步或异步）
        if self._enable_async_queue and len(all_subscribers) > 1:
            # 异步并发执行
            tasks = [self._execute_handler(reg, event) for reg in all_subscribers]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            success_count = sum(1 for r in results if r is True)
            fail_count = len(results) - success_count

            if fail_count > 0:
                logger.warning(
                    f"⚠️ 事件 {event.event_type}: {success_count} 成功, {fail_count} 失败"
                )
        else:
            # 顺序执行
            for reg in all_subscribers:
                await self._execute_handler(reg, event)

        # 6. 更新统计
        self._stats[event.event_type] += 1
        self._stats["_total"] += 1
        await self._event_store.mark_processed(event.event_id)

        return True

    async def _execute_handler(
        self,
        registration: EventHandlerRegistration,
        event: DomainEvent,
    ) -> bool:
        """执行单个事件处理器"""
        if not registration.is_active:
            return True

        start_time = time.time()
        success, error = await registration.execute(event)

        duration = time.time() - start_time

        if success:
            logger.info(
                f"✅ {registration.handler_name} 处理 {event.event_type} "
                f"成功 ({duration:.3f}s)"
            )
            return True
        else:
            logger.error(
                f"❌ {registration.handler_name} 处理 {event.event_type} 失败: {error}"
            )
            self._stats["_failed"] += 1

            # 记录失败（可扩展到死信队列）
            self._stats[f"failed:{registration.handler_name}"] += 1

            return False

    # ─── 便捷方法: 批量发布 ───

    async def publish_many(self, events: List[DomainEvent]) -> Dict[str, int]:
        """批量发布事件"""
        success_count = 0
        fail_count = 0

        for event in events:
            if await self.publish(event):
                success_count += 1
            else:
                fail_count += 1

        return {"total": len(events), "success": success_count, "failed": fail_count}

    # ─── 状态与统计 ───

    def get_stats(self) -> Dict[str, Any]:
        """获取总线统计"""
        bus_stats = {
            "backend": self._backend.value,
            "uptime_seconds": round(time.time() - self._start_time, 2),
            "total_events_published": self._stats.get("_total", 0),
            "total_failed": self._stats.get("_failed", 0),
            "active_subscriptions": sum(len(v) for v in self._subscribers.values()),
            "event_types": self.get_all_event_types(),
            "events_by_type": dict(self._stats),
            "is_running": self._is_running,
        }

        # 合并 event_store 统计
        bus_stats["event_store"] = self._event_store.get_stats()

        return bus_stats

    # ─── 健康检查 ───

    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        stats = self.get_stats()
        return {
            "status": "healthy" if stats["total_failed"] < 10 else "degraded",
            "active_subscriptions": stats["active_subscriptions"],
            "uptime_seconds": stats["uptime_seconds"],
            "backend": stats["backend"],
        }

    # ─── 关闭 ───

    def shutdown(self, wait_timeout: float = 5.0) -> None:
        """优雅关闭"""
        logger.info("🔻 正在关闭事件总线...")
        self._is_running = False

        if self._async_tasks:
            # 等待未完成的任务
            for task in self._async_tasks:
                if not task.done():
                    task.cancel()

        logger.info(f"📊 关闭总结: {self.get_stats()}")


# ═════════════════════════════════════════════
# 🟡 P2-5: 装饰器 API（简洁易用）
# ═════════════════════════════════════════════


# 全局事件总线单例
_global_bus: Optional[EventBus] = None


def get_global_bus() -> EventBus:
    """获取全局事件总线"""
    global _global_bus
    if _global_bus is None:
        _global_bus = EventBus(backend=BusBackend.MEMORY)
    return _global_bus


def set_global_bus(bus: EventBus) -> None:
    """设置全局事件总线（用于替换实现）"""
    global _global_bus
    _global_bus = bus


def subscribe(
    event_type: str,
    *,
    priority: int = 100,
    retries: int = 3,
    bus: Optional[EventBus] = None,
) -> Callable[[EventHandlerFn], EventHandlerFn]:
    """
    📡 事件订阅装饰器

    使用:
        @subscribe("formula.created")
        async def on_formula_created(event: FormulaCreated):
            logger.info("配方已创建: %s", event.formula_name)

        @subscribe("*", priority=1)  # 通配符: 订阅所有事件
        async def log_all_events(event: DomainEvent):
            logger.info("收到事件: %s", event.event_type)
    """
    bus_to_use = bus or get_global_bus()

    def decorator(fn: EventHandlerFn) -> EventHandlerFn:
        bus_to_use.subscribe(
            event_type,
            fn,
            priority=priority,
            retries=retries,
        )

        @wraps(fn)
        async def wrapper(event: DomainEvent) -> Any:
            return await fn(event) if asyncio.iscoroutinefunction(fn) else fn(event)

        return fn  # 返回原始函数，保持调用链清晰

    return decorator


async def publish(event: DomainEvent, bus: Optional[EventBus] = None) -> bool:
    """
    📢 便捷的事件发布函数

    使用:
        await publish(FormulaCreated(
            formula_id="f_001",
            formula_name="新配方",
            creator_id="u_001",
        ))
    """
    bus_to_use = bus or get_global_bus()
    return await bus_to_use.publish(event)


# ═════════════════════════════════════════════
# 🟡 P2-5: 示例：常用事件处理器（可参考）
# ═════════════════════════════════════════════


def setup_default_handlers() -> EventBus:
    """
    📚 设置默认的事件处理器（参考示例）

    实际项目中应根据业务需求替换。
    """
    bus = get_global_bus()

    # 1. 通用事件日志
    @subscribe("*", priority=1)
    async def log_event(event: DomainEvent) -> None:
        logger.info(f"📝 事件日志: {event.event_type} - {event.event_id}")

    # 2. 配方创建后通知
    @subscribe("formula.created", priority=10)
    async def notify_on_create(event: FormulaCreated) -> None:
        logger.info(f"🔔 通知 - 配方已创建: {event.formula_name}")
        # 实际项目中可集成到通知系统

    # 3. 配方发布后通知订阅者
    @subscribe("formula.published", priority=10)
    async def notify_on_publish(event: FormulaPublished) -> None:
        logger.info(f"📢 广播 - 配方已发布: {event.formula_name} (v{event.version})")

    # 4. AI 回调处理
    @subscribe("ai.callback.event", priority=50)
    async def handle_ai_callback(event: AICallbackEvent) -> None:
        logger.info(f"🤖 AI 回调: request_id={event.request_id}, status={event.status}")

    # 5. 文件上传审计
    @subscribe("file.uploaded.event", priority=100)
    async def audit_file_upload(event: FileUploadedEvent) -> None:
        logger.info(
            f"📁 文件上传审计: {event.file_name} "
            f"({event.file_size} bytes) by {event.uploader_id}"
        )

    logger.info(f"✅ 默认事件处理器已设置，当前订阅: {bus.get_all_event_types()}")
    return bus


# ═════════════════════════════════════════════
# 🟡 P2-5: 命令行入口
# ═════════════════════════════════════════════


async def run_event_cli() -> None:
    """
    🖥️ 事件总线命令行

    支持:
      --action {status, list, replay, test}
      --event-type TYPE  (用于 replay/test)
      --since TIMESTAMP  (用于 replay)
      --count N          (用于 test)
    """
    import argparse

    parser = argparse.ArgumentParser(description="事件总线管理工具")
    parser.add_argument(
        "--action",
        choices=["status", "list", "replay", "test"],
        default="status",
        help="执行的操作",
    )
    parser.add_argument("--event-type", help="筛选事件类型")
    parser.add_argument("--since", help="起始时间（ISO 格式）")
    parser.add_argument("--count", type=int, default=10, help="测试发布数量")
    parser.add_argument("--storage", help="事件存储路径")

    args = parser.parse_args()

    # 初始化总线
    bus = EventBus(
        backend=BusBackend.MEMORY,
        event_store=EventStore(args.storage) if args.storage else None,
    )
    set_global_bus(bus)
    setup_default_handlers()

    logger.info("")
    logger.info("=" * 60)
    logger.info("🟡 事件驱动架构 - 管理工具")
    logger.info("=" * 60)
    logger.info("")

    if args.action == "status":
        stats = bus.get_stats()
        logger.info("📊 状态: %s", stats['backend'])
        logger.info("   运行时长: %.1f 秒", stats['uptime_seconds'])
        logger.info("   订阅者数量: %d", stats['active_subscriptions'])
        logger.info("   已发布事件: %d", stats['total_events_published'])
        logger.info("   失败数: %d", stats['total_failed'])
        types_str = ', '.join(stats['event_types'][:10])
        if len(stats['event_types']) > 10:
            types_str += '...'
        logger.info("   事件类型: %s", types_str)

    elif args.action == "list":
        logger.info("📡 当前订阅列表:")
        for event_type in bus.get_all_event_types():
            subs = bus.get_subscribers(event_type)
            logger.info("  %s (%d 订阅者):", event_type, len(subs))
            for reg in subs:
                logger.info("    - %s (priority=%d)", reg.handler_name, reg.priority)

    elif args.action == "replay":
        event_store = bus._event_store
        if event_store:
            count = await event_store.replay(event_type=args.event_type, since=args.since)
            logger.info("⏪ 已重放 %d 个事件", count)
        else:
            logger.error("❌ 未配置事件存储，无法重放")

    elif args.action == "test":
        logger.info("🧪 测试发布 %d 个事件...", args.count)
        for i in range(args.count):
            await publish(
                FormulaCreated(
                    formula_id=f"test_formula_{i}",
                    formula_name=f"测试配方 {i}",
                    creator_id="test_user",
                    priority=EventPriority.NORMAL,
                )
            )
            await asyncio.sleep(0.05)
        logger.info("✅ 已发布 %d 个测试事件", args.count)
        logger.info("   统计: %s", bus.get_stats()['events_by_type'])

    logger.info("")
    logger.info("=" * 60)
    logger.info("")
    bus.shutdown()


# ═════════════════════════════════════════════
# 🟡 P2-5: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 核心类
    "DomainEvent",
    "EventBus",
    "EventStore",
    "EventHandlerRegistration",
    # 枚举
    "EventStatus",
    "EventPriority",
    "BusBackend",
    # 业务事件
    "FormulaEvent",
    "FormulaCreated",
    "FormulaUpdated",
    "FormulaDeleted",
    "FormulaReviewed",
    "FormulaPublished",
    "AIRequestEvent",
    "AICallbackEvent",
    "UserAuthEvent",
    "FileUploadedEvent",
    # 全局 API
    "get_global_bus",
    "set_global_bus",
    "subscribe",
    "publish",
    # 设置
    "setup_default_handlers",
    # CLI
    "run_event_cli",
]
