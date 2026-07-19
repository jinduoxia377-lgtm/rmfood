"""
变更数据捕获 (CDC) 事件监听器

使用 SQLAlchemy 事件系统自动捕获所有表的 INSERT/UPDATE/DELETE 操作，
记录到 change_events 表并通过 EventBus 广播。

架构:
  SQLAlchemy Event → CDCListener → change_events 表
                                     ↓
                               EventBus → WebSocket 推送

使用方式:
    # 在 app lifespan 中启动
    from app.core.cdc_listener import cdc_listener
    cdc_listener.start()
    yield
    cdc_listener.stop()
"""
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session, Mapper

logger = logging.getLogger(__name__)

# 不追踪的表（系统表、关联表、CDC 自身）
EXCLUDED_TABLES: Set[str] = {
    "change_events",
    "alembic_version",
    "formula_ingredients",
    "formula_peptides",
    "formula_categories",
    "formula_tags",
    "comment_likes",
    "term_statistics",
    "term_validations",
}


class CDCListener:
    """
    变更数据捕获监听器

    监听 SQLAlchemy Session 的 flush 事件，
    自动检测并记录所有实体变更。

    Phase 3-B: 支持通过事件总线发布变更事件。
    """

    def __init__(self):
        self._enabled = False
        self._pending_events: list = []
        self._lock = threading.Lock()
        # 当前用户上下文（由中间件设置）
        self._current_user_id: Optional[int] = None
        self._current_ip: Optional[str] = None
        # Phase 3-B: 事件总线实例
        self._event_bus = None

    def set_context(self, user_id: Optional[int] = None, ip_address: Optional[str] = None):
        """设置当前操作上下文（由认证中间件调用）"""
        self._current_user_id = user_id
        self._current_ip = ip_address

    def set_event_bus(self, event_bus=None):
        """设置事件总线实例（Phase 3-B: 事件驱动架构）"""
        self._event_bus = event_bus
        if event_bus:
            logger.info("[CDC] 事件总线已设置，变更事件将通过 EventBus 发布")
        else:
            logger.info("[CDC] 事件总线未设置，变更事件仅持久化到数据库")

    def start(self):
        """启动 CDC 监听"""
        if self._enabled:
            return

        # 监听 Session 的 before_flush 事件（捕获变更）
        event.listen(Session, "before_flush", self._on_before_flush)
        # 监听 Session 的 after_commit 事件（持久化事件）
        event.listen(Session, "after_commit", self._on_after_commit)

        self._enabled = True
        logger.info("📡 CDC 变更捕获监听器已启动")

    def stop(self):
        """停止 CDC 监听"""
        if not self._enabled:
            return

        event.remove(Session, "before_flush", self._on_before_flush)
        event.remove(Session, "after_commit", self._on_after_commit)

        self._enabled = False
        logger.info("📡 CDC 变更捕获监听器已停止")

    def _on_before_flush(self, session: Session, flush_context, instances):
        """
        在 Session flush 前捕获变更

        此时 session.new, session.dirty, session.deleted 包含待变更的实体。
        """
        if not self._enabled:
            return

        try:
            # 捕获新增实体
            for obj in session.new:
                self._capture_insert(obj, session)

            # 捕获更新实体
            for obj in session.dirty:
                self._capture_update(obj, session)

            # 捕获删除实体
            for obj in session.deleted:
                self._capture_delete(obj, session)

        except Exception as e:
            # CDC 错误不应影响正常业务
            logger.error(f"CDC 捕获变更失败: {e}", exc_info=True)

    def _on_after_commit(self, session: Session):
        """在 Session commit 后持久化 CDC 事件"""
        if not self._enabled or not self._pending_events:
            return

        try:
            # 获取 pending events 并清空
            with self._lock:
                events_to_process = list(self._pending_events)
                self._pending_events.clear()

            # 将事件写入数据库（使用独立 session 避免递归）
            self._persist_events(events_to_process)

        except Exception as e:
            logger.error(f"CDC 持久化事件失败: {e}", exc_info=True)

    def _capture_insert(self, obj, session: Session):
        """捕获 INSERT 事件"""
        table_name = self._get_table_name(obj)
        if not table_name or table_name in EXCLUDED_TABLES:
            return

        entity_id = self._get_entity_id(obj)
        if entity_id is None:
            return

        # 获取所有字段的新值
        new_values = self._get_current_values(obj)

        event_data = {
            "entity_type": table_name,
            "entity_id": entity_id,
            "action": "INSERT",
            "changed_fields": list(new_values.keys()),
            "old_values": None,
            "new_values": new_values,
            "user_id": self._current_user_id,
            "ip_address": self._current_ip,
        }

        with self._lock:
            self._pending_events.append(event_data)

        logger.debug(f"CDC: INSERT {table_name}:{entity_id}")

    def _capture_update(self, obj, session: Session):
        """捕获 UPDATE 事件"""
        table_name = self._get_table_name(obj)
        if not table_name or table_name in EXCLUDED_TABLES:
            return

        entity_id = self._get_entity_id(obj)
        if entity_id is None:
            return

        # 获取变更的字段
        changed_fields = []
        old_values = {}
        new_values = {}

        insp = inspect(obj)
        for attr in insp.attrs:
            hist = attr.history
            if hist.has_changes():
                field_name = attr.key
                changed_fields.append(field_name)

                # 获取旧值
                if hist.deleted:
                    old_val = hist.deleted[0]
                    old_values[field_name] = self._serialize_value(old_val)

                # 获取新值
                if hist.added:
                    new_val = hist.added[0]
                    new_values[field_name] = self._serialize_value(new_val)

        if not changed_fields:
            return

        event_data = {
            "entity_type": table_name,
            "entity_id": entity_id,
            "action": "UPDATE",
            "changed_fields": changed_fields,
            "old_values": old_values if old_values else None,
            "new_values": new_values if new_values else None,
            "user_id": self._current_user_id,
            "ip_address": self._current_ip,
        }

        with self._lock:
            self._pending_events.append(event_data)

        logger.debug(f"CDC: UPDATE {table_name}:{entity_id} fields={changed_fields}")

    def _capture_delete(self, obj, session: Session):
        """捕获 DELETE 事件"""
        table_name = self._get_table_name(obj)
        if not table_name or table_name in EXCLUDED_TABLES:
            return

        entity_id = self._get_entity_id(obj)
        if entity_id is None:
            return

        # 删除前记录旧值
        old_values = self._get_current_values(obj)

        event_data = {
            "entity_type": table_name,
            "entity_id": entity_id,
            "action": "DELETE",
            "changed_fields": None,
            "old_values": old_values,
            "new_values": None,
            "user_id": self._current_user_id,
            "ip_address": self._current_ip,
        }

        with self._lock:
            self._pending_events.append(event_data)

        logger.debug(f"CDC: DELETE {table_name}:{entity_id}")

    def _persist_events(self, events: list):
        """将 CDC 事件持久化到数据库"""
        if not events:
            return

        try:
            from ..models.change_event import ChangeEvent, ChangeAction
            from ..core.session import async_session_factory
            import asyncio

            # 如果在异步上下文中，使用异步写入
            # 否则使用同步写入（作为后备）
            loop = asyncio.new_event_loop()
            if loop.is_running():
                # 在异步上下文中，创建任务异步写入
                asyncio.create_task(self._async_persist_events(events))
            else:
                # 同步写入
                asyncio.run(self._async_persist_events(events))

        except Exception as e:
            logger.error(f"CDC 持久化失败: {e}", exc_info=True)

    async def _async_persist_events(self, events: list):
        """异步持久化 CDC 事件并通过事件总线发布"""
        try:
            from ..models.change_event import ChangeEvent, ChangeAction
            from ..core.session import async_session_factory

            async with async_session_factory() as session:
                for event_data in events:
                    change_event = ChangeEvent(
                        entity_type=event_data["entity_type"],
                        entity_id=event_data["entity_id"],
                        action=ChangeAction(event_data["action"]),
                        changed_fields=event_data.get("changed_fields"),
                        old_values=event_data.get("old_values"),
                        new_values=event_data.get("new_values"),
                        user_id=event_data.get("user_id"),
                        ip_address=event_data.get("ip_address"),
                    )
                    session.add(change_event)

                await session.commit()
                logger.debug(f"CDC: 持久化 {len(events)} 个变更事件")

            # Phase 3-B: 通过事件总线发布变更事件
            if self._event_bus:
                await self._publish_to_event_bus(events)
            else:
                # 降级：通过 WebSocket 推送变更事件
                await self._broadcast_changes(events)

            # 失效相关缓存
            await self._invalidate_cache(events)

        except Exception as e:
            logger.error(f"CDC 异步持久化失败: {e}", exc_info=True)

    async def _broadcast_changes(self, events: list):
        """通过 WebSocket 广播变更事件"""
        try:
            from .websocket import connection_manager

            for event_data in events:
                # 构建 WebSocket 消息
                ws_message = {
                    "type": "data_change",
                    "data": {
                        "entity_type": event_data["entity_type"],
                        "entity_id": event_data["entity_id"],
                        "action": event_data["action"],
                        "changed_fields": event_data.get("changed_fields"),
                        "user_id": event_data.get("user_id"),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    "channel": f"entity:{event_data['entity_type']}",
                }

                # 广播到所有连接的用户
                await connection_manager.broadcast(ws_message)

                # 如果有特定用户ID，也发送个人消息
                if event_data.get("user_id"):
                    await connection_manager.broadcast_to_user(
                        str(event_data["user_id"]),
                        ws_message
                    )

            logger.debug(f"CDC: WebSocket 广播 {len(events)} 个变更事件")

        except Exception as e:
            logger.error(f"CDC WebSocket 广播失败: {e}", exc_info=True)

    async def _invalidate_cache(self, events: list):
        """根据变更事件失效相关缓存"""
        try:
            from .cache_system import get_cache

            cache = get_cache()

            # 实体类型到缓存 key 前缀的映射
            cache_key_map = {
                "formulas": ["formula:", "formulas:"],
                "experiments": ["experiment:", "experiments:"],
                "users": ["user:", "users:"],
                "teams": ["team:", "teams:"],
                "notifications": ["notification:", "notifications:"],
                "ingredients": ["ingredient:", "ingredients:"],
                "peptides": ["peptide:", "peptides:"],
                "workflows": ["workflow:", "workflows:"],
            }

            invalidated_keys = set()

            for event_data in events:
                entity_type = event_data["entity_type"]
                entity_id = event_data["entity_id"]

                # 获取需要失效的缓存 key 前缀
                prefixes = cache_key_map.get(entity_type, [])

                for prefix in prefixes:
                    # 失效特定实体的缓存
                    specific_key = f"{prefix}{entity_id}"
                    await cache.delete(specific_key)
                    invalidated_keys.add(specific_key)

                    # 失效列表缓存（通过标签）
                    await cache.invalidate_by_tag(entity_type)
                    invalidated_keys.add(f"tag:{entity_type}")

            if invalidated_keys:
                logger.debug(f"CDC: 失效缓存 {len(invalidated_keys)} 个 key")

        except Exception as e:
            logger.error(f"CDC 缓存失效失败: {e}", exc_info=True)

    async def _publish_to_event_bus(self, events: list):
        """通过事件总线发布 CDC 事件（Phase 3-B: 事件驱动架构）"""
        try:
            from ..core.domain_events import DomainEvent

            for event_data in events:
                # 创建 CDC 事件（使用通用 DomainEvent）
                data_changed_event = DomainEvent(
                    event_type="data.changed",
                    aggregate_type=event_data["entity_type"],
                    aggregate_id=str(event_data["entity_id"]),
                    metadata={
                        "action": event_data["action"],
                        "changed_fields": event_data.get("changed_fields"),
                        "old_values": event_data.get("old_values"),
                        "new_values": event_data.get("new_values"),
                        "user_id": event_data.get("user_id"),
                        "ip_address": event_data.get("ip_address"),
                    },
                )
                # formula_id 使用 field(init=False)，不包含在 __init__ 中
                # 如果需要设置 formula_id，可以在创建后手动赋值（但 CDC 事件通常不需要）

                # 通过事件总线发布
                await self._event_bus.publish(data_changed_event)
                logger.debug(f"CDC: 事件已发布到 EventBus [{event_data['entity_type']}:{event_data['action']}]")

            logger.info(f"CDC: 已发布 {len(events)} 个变更事件到 EventBus")

        except Exception as e:
            logger.error(f"CDC: 发布事件到 EventBus 失败: {e}", exc_info=True)
            # 降级：通过 WebSocket 推送
            await self._broadcast_changes(events)

    def _get_table_name(self, obj) -> Optional[str]:
        """获取实体的表名"""
        try:
            mapper = inspect(type(obj))
            return mapper.mapped_table.name
        except Exception:
            return None

    def _get_entity_id(self, obj) -> Optional[int]:
        """获取实体的主键 ID"""
        try:
            return getattr(obj, "id", None)
        except Exception:
            return None

    def _get_current_values(self, obj) -> dict:
        """获取实体当前的所有字段值"""
        values = {}
        try:
            mapper = inspect(type(obj))
            for col in mapper.mapped_table.columns:
                val = getattr(obj, col.name, None)
                values[col.name] = self._serialize_value(val)
        except Exception:
            pass
        return values

    def _serialize_value(self, val: Any) -> Any:
        """序列化值为 JSON 兼容格式"""
        if val is None:
            return None
        if isinstance(val, (int, float, str, bool)):
            return val
        if isinstance(val, datetime):
            return val.isoformat()
        if isinstance(val, (list, dict)):
            return val
        # 枚举类型
        if hasattr(val, "value"):
            return val.value
        return str(val)


# 全局 CDC 监听器实例
cdc_listener = CDCListener()
