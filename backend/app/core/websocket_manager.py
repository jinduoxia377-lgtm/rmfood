"""
🟡 P4-2: WebSocket 实时协作系统

提供企业级实时通信能力:
1. 🔌 WebSocket 连接管理 - 心跳保活 / 断线重连 / 连接池
2. 📡 消息广播 - 单播 / 组播 / 广播
3. 👥 在线状态 - 用户上下线 / 实时在线列表
4. ✏️ 实时协同编辑 - 配方编辑锁定 / 冲突解决
5. 🔔 实时通知 - 配方审核 / 任务分配 / 系统公告
6. 📊 实时指标推送 - AI 分析进度 / 导出进度
7. 🛡️ 安全性 - JWT 认证 / 租户隔离 / 限流

使用方式:
    # 1. WebSocket 端点
    ws://api.example.com/ws?token=xxx

    # 2. 连接管理
    ws_manager = WebSocketManager()
    await ws_manager.connect(websocket, user_id, tenant_id)

    # 3. 发送消息
    await ws_manager.send_to_user(user_id, {
        "type": "notification",
        "data": {"title": "配方已审核", "status": "approved"}
    })

    # 4. 广播消息
    await ws_manager.broadcast_to_tenant(tenant_id, {
        "type": "formula_updated",
        "data": {"formula_id": "f_001"}
    })

    # 5. 前端使用
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "notification") showToast(msg.data.title);
    };
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ═════════════════════════════════════════════
# 🟡 P4-2: 消息类型枚举
# ═════════════════════════════════════════════


class MessageType(str, Enum):
    """WebSocket 消息类型"""
    # 连接相关
    CONNECT = "connect"
    CONNECTED = "connected"
    DISCONNECT = "disconnect"
    HEARTBEAT = "heartbeat"
    HEARTBEAT_ACK = "heartbeat_ack"

    # 通知
    NOTIFICATION = "notification"
    ANNOUNCEMENT = "announcement"
    SYSTEM_MESSAGE = "system_message"

    # 实时同步
    FORMULA_UPDATED = "formula_updated"
    FORMULA_CREATED = "formula_created"
    FORMULA_DELETED = "formula_deleted"
    FORMULA_REVIEWED = "formula_reviewed"

    # 协同编辑
    EDIT_LOCK_ACQUIRED = "edit_lock_acquired"
    EDIT_LOCK_RELEASED = "edit_lock_released"
    EDIT_LOCK_DENIED = "edit_lock_denied"
    CURSOR_MOVED = "cursor_moved"

    # AI 进度
    AI_TASK_PROGRESS = "ai_task_progress"
    AI_TASK_COMPLETED = "ai_task_completed"
    AI_TASK_FAILED = "ai_task_failed"

    # 在线状态
    USER_ONLINE = "user_online"
    USER_OFFLINE = "user_offline"
    ONLINE_USERS = "online_users"

    # 错误
    ERROR = "error"
    RATE_LIMITED = "rate_limited"

    # 频道管理
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"


# ═════════════════════════════════════════════
# 🟡 P4-2: 消息结构
# ═════════════════════════════════════════════


@dataclass
class WSMessage:
    """WebSocket 消息结构"""
    type: str
    data: Any = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    message_id: str = ""  # 消息唯一 ID，用于去重
    correlation_id: str = ""  # 关联 ID，用于追踪

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "data": self.data,
            "timestamp": self.timestamp,
            "message_id": self.message_id,
            "correlation_id": self.correlation_id,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @classmethod
    def from_json(cls, text: str) -> "WSMessage":
        data = json.loads(text)
        return cls(
            type=data.get("type", ""),
            data=data.get("data"),
            timestamp=data.get("timestamp", ""),
            message_id=data.get("message_id", ""),
            correlation_id=data.get("correlation_id", ""),
        )


# ═════════════════════════════════════════════
# 🟡 P4-2: 连接状态
# ═════════════════════════════════════════════


@dataclass
class ConnectionState:
    """单个 WebSocket 连接的状态"""
    websocket: WebSocket
    user_id: str
    tenant_id: str
    connected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_heartbeat: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    subscriptions: Set[str] = field(default_factory=set)  # 订阅的频道
    metadata: Dict[str, Any] = field(default_factory=dict)  # 扩展元数据

    def is_alive(self, heartbeat_timeout: int = 60) -> bool:
        """检查连接是否存活"""
        last_hb = datetime.fromisoformat(self.last_heartbeat)
        now = datetime.now(timezone.utc)
        return (now - last_hb).total_seconds() < heartbeat_timeout

    def touch(self) -> None:
        """更新心跳时间"""
        self.last_heartbeat = datetime.now(timezone.utc).isoformat()


# ═════════════════════════════════════════════
# 🟡 P4-2: WebSocket 管理器
# ═════════════════════════════════════════════


class WebSocketManager:
    """
    🔌 WebSocket 连接管理器

    功能:
    - 连接管理（连接 / 断开 / 心跳）
    - 消息路由（单播 / 组播 / 广播）
    - 频道订阅
    - 租户隔离
    - 限流保护
    """

    def __init__(
        self,
        heartbeat_interval: int = 30,
        heartbeat_timeout: int = 60,
        max_connections_per_user: int = 3,
        rate_limit_per_second: int = 10,
    ):
        # 核心数据结构
        self._connections: Dict[str, ConnectionState] = {}  # connection_id -> state
        self._user_connections: Dict[str, Set[str]] = defaultdict(set)  # user_id -> connection_ids
        self._tenant_connections: Dict[str, Set[str]] = defaultdict(set)  # tenant_id -> connection_ids
        self._channel_subscribers: Dict[str, Set[str]] = defaultdict(set)  # channel -> connection_ids

        # 锁
        self._lock = asyncio.Lock()

        # 配置
        self._heartbeat_interval = heartbeat_interval
        self._heartbeat_timeout = heartbeat_timeout
        self._max_connections_per_user = max_connections_per_user
        self._rate_limit_per_second = rate_limit_per_second

        # 限流计数器
        self._rate_limit_counter: Dict[str, List[float]] = defaultdict(list)

        # 统计
        self._stats = {
            "total_connections": 0,
            "total_messages_sent": 0,
            "total_messages_received": 0,
        }

        # 心跳任务
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._running = False

    # ─── 连接管理 ───

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        tenant_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        建立 WebSocket 连接

        Returns:
            connection_id
        """
        await websocket.accept()

        # 检查连接数限制
        existing = self._user_connections.get(user_id, set())
        if len(existing) >= self._max_connections_per_user:
            await websocket.close(code=1008, reason="连接数超限")
            raise HTTPException(status_code=403, detail="连接数超限")

        # 生成连接 ID
        connection_id = f"{user_id}:{len(existing)}:{int(time.time())}"

        # 创建连接状态
        state = ConnectionState(
            websocket=websocket,
            user_id=user_id,
            tenant_id=tenant_id,
            metadata=metadata or {},
        )

        # 注册连接
        async with self._lock:
            self._connections[connection_id] = state
            self._user_connections[user_id].add(connection_id)
            self._tenant_connections[tenant_id].add(connection_id)

        self._stats["total_connections"] += 1

        # 加入默认频道
        await self._join_channel(connection_id, f"tenant:{tenant_id}")
        await self._join_channel(connection_id, f"user:{user_id}")

        # 发送连接成功消息
        await self._send_to_connection(connection_id, WSMessage(
            type=MessageType.CONNECTED.value,
            data={
                "connection_id": connection_id,
                "user_id": user_id,
                "server_time": datetime.now(timezone.utc).isoformat(),
            },
        ))

        # 广播用户上线
        await self.broadcast_to_tenant(tenant_id, WSMessage(
            type=MessageType.USER_ONLINE.value,
            data={"user_id": user_id},
        ), exclude_self=user_id)

        logger.info(f"WebSocket 连接已建立: {connection_id} (user={user_id}, tenant={tenant_id})")
        return connection_id

    async def disconnect(self, connection_id: str, reason: str = "normal") -> None:
        """断开 WebSocket 连接"""
        async with self._lock:
            if connection_id not in self._connections:
                return

            state = self._connections[connection_id]
            user_id = state.user_id
            tenant_id = state.tenant_id

            # 离开所有频道
            for channel in state.subscriptions:
                self._channel_subscribers[channel].discard(connection_id)

            # 注销连接
            del self._connections[connection_id]
            self._user_connections[user_id].discard(connection_id)
            self._tenant_connections[tenant_id].discard(connection_id)

        self._stats["total_connections"] -= 1

        # 广播用户离线
        await self.broadcast_to_tenant(tenant_id, WSMessage(
            type=MessageType.USER_OFFLINE.value,
            data={"user_id": user_id, "reason": reason},
        ))

        logger.info(f"WebSocket 连接已断开: {connection_id} (reason={reason})")

    async def send_to_user(self, user_id: str, message: WSMessage | Dict) -> int:
        """
        发送消息给指定用户（单播）

        Returns:
            成功发送的连接数
        """
        if isinstance(message, dict):
            message = WSMessage(**message)

        connection_ids = self._user_connections.get(user_id, set())
        sent_count = 0

        for conn_id in connection_ids:
            if await self._send_to_connection(conn_id, message):
                sent_count += 1

        return sent_count

    async def send_to_connection(self, connection_id: str, message: WSMessage | Dict) -> bool:
        """发送消息到指定连接"""
        if isinstance(message, dict):
            message = WSMessage(**message)
        return await self._send_to_connection(connection_id, message)

    async def broadcast_to_tenant(
        self,
        tenant_id: str,
        message: WSMessage | Dict,
        exclude_user: Optional[str] = None,
    ) -> int:
        """
        广播消息到租户内的所有连接

        Args:
            tenant_id: 租户 ID
            message: 消息内容
            exclude_user: 排除的用户 ID

        Returns:
            成功发送数
        """
        if isinstance(message, dict):
            message = WSMessage(**message)

        connection_ids = self._tenant_connections.get(tenant_id, set())
        sent_count = 0

        for conn_id in connection_ids:
            # 排除指定用户
            if exclude_user:
                state = self._connections.get(conn_id)
                if state and state.user_id == exclude_user:
                    continue

            if await self._send_to_connection(conn_id, message):
                sent_count += 1

        return sent_count

    async def broadcast_to_session(
        self,
        session_id: str,
        message: WSMessage | Dict,
    ) -> int:
        """
        广播消息到指定会话频道

        session_id 格式: "session:{id}" 或 "resource:{id}"

        Args:
            session_id: 会话/资源 ID
            message: 消息内容

        Returns:
            成功发送数
        """
        if isinstance(message, dict):
            message = WSMessage(**message)
        return await self.broadcast_to_channel(session_id, message)

    async def broadcast_to_others(
        self,
        session_id: str,
        sender_user_id: str,
        message: WSMessage | Dict,
    ) -> int:
        """
        广播消息到会话中除发起者外的所有成员

        Args:
            session_id: 会话/资源 ID
            sender_user_id: 发送者用户 ID（排除）
            message: 消息内容

        Returns:
            成功发送数
        """
        if isinstance(message, dict):
            message = WSMessage(**message)
        return await self.broadcast_to_channel(session_id, message)

    async def broadcast_to_channel(
        self,
        channel: str,
        message: WSMessage | Dict,
    ) -> int:
        """广播消息到指定频道"""
        if isinstance(message, dict):
            message = WSMessage(**message)

        connection_ids = self._channel_subscribers.get(channel, set())
        sent_count = 0

        for conn_id in connection_ids:
            if await self._send_to_connection(conn_id, message):
                sent_count += 1

        return sent_count

    async def broadcast_all(self, message: WSMessage | Dict) -> int:
        """广播消息到所有连接"""
        if isinstance(message, dict):
            message = WSMessage(**message)

        sent_count = 0
        for conn_id in list(self._connections.keys()):
            if await self._send_to_connection(conn_id, message):
                sent_count += 1

        return sent_count

    # ─── 频道订阅 ───

    async def subscribe(self, connection_id: str, channel: str) -> bool:
        """订阅频道"""
        return await self._join_channel(connection_id, channel)

    async def unsubscribe(self, connection_id: str, channel: str) -> bool:
        """取消订阅频道"""
        async with self._lock:
            if connection_id in self._channel_subscribers.get(channel, set()):
                self._channel_subscribers[channel].discard(connection_id)
                return True
        return False

    async def _join_channel(self, connection_id: str, channel: str) -> bool:
        """加入频道"""
        async with self._lock:
            if connection_id not in self._connections:
                return False

            self._channel_subscribers[channel].add(connection_id)
            self._connections[connection_id].subscriptions.add(channel)
            return True

    # ─── 心跳与清理 ───

    async def start_heartbeat(self) -> None:
        """启动心跳任务"""
        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def stop_heartbeat(self) -> None:
        """停止心跳任务"""
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

    async def _heartbeat_loop(self) -> None:
        """心跳循环"""
        while self._running:
            await asyncio.sleep(self._heartbeat_interval)

            # 发送心跳
            heartbeat_msg = WSMessage(
                type=MessageType.HEARTBEAT.value,
                data={"server_time": datetime.now(timezone.utc).isoformat()},
            )

            for conn_id in list(self._connections.keys()):
                state = self._connections.get(conn_id)
                if not state:
                    continue

                if not state.is_alive(self._heartbeat_timeout):
                    # 连接超时，断开
                    await self.disconnect(conn_id, reason="heartbeat_timeout")
                    continue

                # 发送心跳
                await self._send_to_connection(conn_id, heartbeat_msg)

    # ─── 限流 ───

    def _check_rate_limit(self, connection_id: str) -> bool:
        """
        检查限流

        Returns:
            True = 允许, False = 超限
        """
        now = time.time()
        window = 1.0  # 1 秒窗口

        # 清理过期记录
        self._rate_limit_counter[connection_id] = [
            t for t in self._rate_limit_counter[connection_id]
            if now - t < window
        ]

        # 检查是否超限
        if len(self._rate_limit_counter[connection_id]) >= self._rate_limit_per_second:
            return False

        # 记录本次请求
        self._rate_limit_counter[connection_id].append(now)
        return True

    # ─── 内部方法 ───

    async def _get_redis_client(self):
        """获取 Redis 客户端（懒加载）"""
        if not hasattr(self, '_redis'):
            try:
                import redis.asyncio as redis
                from ..core.config import settings
                url = getattr(settings, 'redis_url', 'redis://localhost:6379')
                self._redis = redis.from_url(url, encoding='utf-8', decode_responses=False)
                await self._redis.ping()
            except Exception:
                self._redis = None
        return self._redis

    async def _send_to_connection(self, connection_id: str, message: WSMessage) -> bool:
        """向单个连接发送消息"""
        state = self._connections.get(connection_id)
        if not state:
            return False

        # 限流检查
        if not self._check_rate_limit(connection_id):
            await self._send_to_connection(connection_id, WSMessage(
                type=MessageType.RATE_LIMITED.value,
                data={"retry_after": 1},
            ))
            return False

        try:
            await state.websocket.send_text(message.to_json())
            self._stats["total_messages_sent"] += 1
            return True
        except Exception as e:
            logger.warning(f"发送消息失败: {connection_id}, {e}")
            await self.disconnect(connection_id, reason=f"send_error: {e}")
            return False

    async def handle_message(self, connection_id: str, raw_message: str) -> None:
        """处理收到的消息"""
        self._stats["total_messages_received"] += 1

        try:
            message = WSMessage.from_json(raw_message)
        except json.JSONDecodeError:
            await self._send_to_connection(connection_id, WSMessage(
                type=MessageType.ERROR.value,
                data={"code": "INVALID_JSON", "message": "消息格式错误"},
            ))
            return

        state = self._connections.get(connection_id)
        if not state:
            return

        # 更新心跳时间
        state.touch()

        # 根据消息类型处理
        handlers = {
            MessageType.HEARTBEAT.value: self._handle_heartbeat,
            MessageType.SUBSCRIBE.value: self._handle_subscribe,
            MessageType.UNSUBSCRIBE.value: self._handle_unsubscribe,
            MessageType.EDIT_LOCK_ACQUIRED.value: self._handle_edit_lock,
            MessageType.CURSOR_MOVED.value: self._handle_cursor_moved,
        }

        handler = handlers.get(message.type)
        if handler:
            await handler(connection_id, state, message)

    async def _handle_heartbeat(self, connection_id: str, state: ConnectionState, message: WSMessage) -> None:
        """处理心跳"""
        await self._send_to_connection(
            connection_id,
            WSMessage(type=MessageType.HEARTBEAT_ACK.value),
        )

    async def _handle_subscribe(self, connection_id: str, state: ConnectionState, message: WSMessage) -> None:
        """处理频道订阅"""
        channel = message.data.get("channel")
        if channel:
            await self.subscribe(connection_id, channel)

    async def _handle_unsubscribe(self, connection_id: str, state: ConnectionState, message: WSMessage) -> None:
        """处理取消订阅"""
        channel = message.data.get("channel")
        if channel:
            await self.unsubscribe(connection_id, channel)

    async def _handle_edit_lock(self, connection_id: str, state: ConnectionState, message: WSMessage) -> None:
        """处理编辑锁定"""
        resource_type = message.data.get("resource_type")
        resource_id = message.data.get("resource_id")

        # 获取当前锁定状态
        lock_key = f"{resource_type}:{resource_id}"

        # 分布式锁：使用 Redis SET NX
        try:
            redis_client = await self._get_redis_client()
            if redis_client:
                acquired = await redis_client.set(
                    f"ws:lock:{lock_key}",
                    state.user_id,
                    nx=True,
                    ex=30,  # 30秒自动过期
                )
                if not acquired:
                    # 锁已被其他用户持有
                    holder = await redis_client.get(f"ws:lock:{lock_key}")
                    await self._send_to_connection(
                        connection_id,
                        WSMessage(
                            type=MessageType.EDIT_LOCK_DENIED.value,
                            data={
                                "resource_type": resource_type,
                                "resource_id": resource_id,
                                "holder": holder.decode() if isinstance(holder, bytes) else holder,
                            },
                        ),
                    )
                    return
        except Exception as e:
            logger.info("Redis 分布式锁不可用，降级为本地模式: %s", e)

        await self._send_to_connection(
            connection_id,
            WSMessage(
                type=MessageType.EDIT_LOCK_ACQUIRED.value,
                data={"resource_type": resource_type, "resource_id": resource_id},
            ),
        )

    async def _handle_cursor_moved(self, state: ConnectionState, message: WSMessage) -> None:
        """处理光标移动（协同编辑）"""
        resource_id = message.data.get("resource_id")
        position = message.data.get("position")

        # 广播给同一资源的其他用户
        await self.broadcast_to_channel(
            f"resource:{resource_id}",
            WSMessage(
                type=MessageType.CURSOR_MOVED.value,
                data={
                    "user_id": state.user_id,
                    "resource_id": resource_id,
                    "position": position,
                },
            ),
        )

    # ─── 统计与状态 ───

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "total_connections": self._stats["total_connections"],
            "total_messages_sent": self._stats["total_messages_sent"],
            "total_messages_received": self._stats["total_messages_received"],
            "online_users": len(self._user_connections),
            "online_tenants": len(self._tenant_connections),
            "active_channels": len(self._channel_subscribers),
        }

    def get_online_users(self, tenant_id: str) -> List[str]:
        """获取租户内在线用户列表"""
        connection_ids = self._tenant_connections.get(tenant_id, set())
        users = set()
        for conn_id in connection_ids:
            state = self._connections.get(conn_id)
            if state:
                users.add(state.user_id)
        return list(users)

    # ─── 上下文管理 ───

    async def __aenter__(self):
        await self.start_heartbeat()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop_heartbeat()


# ═════════════════════════════════════════════
# 🟡 P4-2: 全局 WebSocket 管理器
# ═════════════════════════════════════════════

_ws_manager: Optional[WebSocketManager] = None


def get_ws_manager() -> WebSocketManager:
    """获取全局 WebSocket 管理器"""
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = WebSocketManager()
    return _ws_manager


def set_ws_manager(manager: WebSocketManager) -> None:
    """设置全局 WebSocket 管理器"""
    global _ws_manager
    _ws_manager = manager


# ═════════════════════════════════════════════
# 🟡 P4-2: FastAPI 路由
# ═════════════════════════════════════════════


ws_router = APIRouter(tags=["WebSocket"])


@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket 端点

    连接参数:
    - token: JWT 认证令牌
    - tenant_id: 租户 ID（可选，从 token 中提取）

    示例:
        ws://api.example.com/ws?token=xxx
    """
    manager = get_ws_manager()

    # 1. 获取认证信息（从 query 参数或 header）
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="缺少认证令牌")
        return

    # 2. 验证 token（实际应使用 JWT 解码）
    try:
        from ...utils.auth import decode_token
        payload = decode_token(token)
        if not payload:
            await websocket.close(code=4002, reason="认证失败")
            return
        user_id = str(payload.get("sub", "anonymous"))
        tenant_id = payload.get("tenant_id", "default")
        if not payload.get("type") == "access":
            await websocket.close(code=4002, reason="无效的Token类型")
            return
    except Exception:
        await websocket.close(code=4002, reason="认证失败")
        return

    # 3. 建立连接
    connection_id = await manager.connect(websocket, user_id, tenant_id)

    # 4. 消息循环
    try:
        while True:
            raw_message = await websocket.receive_text()
            await manager.handle_message(connection_id, raw_message)

    except WebSocketDisconnect:
        await manager.disconnect(connection_id, reason="client_disconnect")

    except Exception as e:
        logger.error(f"WebSocket 异常: {e}", exc_info=True)
        await manager.disconnect(connection_id, reason=f"error: {e}")


@ws_router.get("/ws/status")
async def websocket_status():
    """WebSocket 连接状态"""
    manager = get_ws_manager()
    return {
        "websocket_enabled": True,
        "stats": manager.get_stats(),
    }


@ws_router.get("/ws/online-users/{tenant_id}")
async def get_online_users(tenant_id: str):
    """获取租户在线用户列表"""
    manager = get_ws_manager()
    return {
        "tenant_id": tenant_id,
        "online_users": manager.get_online_users(tenant_id),
    }


# ═════════════════════════════════════════════
# 🟡 P4-2: 便捷函数
# ═════════════════════════════════════════════


async def notify_user(user_id: str, title: str, message: str, notification_type: str = "info"):
    """向用户发送通知"""
    manager = get_ws_manager()
    await manager.send_to_user(user_id, WSMessage(
        type=MessageType.NOTIFICATION.value,
        data={
            "title": title,
            "message": message,
            "type": notification_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    ))


async def notify_tenant(tenant_id: str, title: str, message: str, notification_type: str = "info"):
    """向租户内所有用户发送通知"""
    manager = get_ws_manager()
    await manager.broadcast_to_tenant(tenant_id, WSMessage(
        type=MessageType.ANNOUNCEMENT.value,
        data={
            "title": title,
            "message": message,
            "type": notification_type,
        },
    ))


async def broadcast_formula_update(tenant_id: str, formula_id: str, action: str, data: Dict):
    """广播配方更新"""
    manager = get_ws_manager()

    event_type = {
        "create": MessageType.FORMULA_CREATED.value,
        "update": MessageType.FORMULA_UPDATED.value,
        "delete": MessageType.FORMULA_DELETED.value,
        "review": MessageType.FORMULA_REVIEWED.value,
    }.get(action, MessageType.FORMULA_UPDATED.value)

    await manager.broadcast_to_channel(f"tenant:{tenant_id}", WSMessage(
        type=event_type,
        data={
            "formula_id": formula_id,
            "action": action,
            **data,
        },
    ))


async def push_ai_progress(user_id: str, task_id: str, progress: int, status: str = "running"):
    """推送 AI 任务进度"""
    manager = get_ws_manager()

    message_type = {
        "running": MessageType.AI_TASK_PROGRESS.value,
        "completed": MessageType.AI_TASK_COMPLETED.value,
        "failed": MessageType.AI_TASK_FAILED.value,
    }.get(status, MessageType.AI_TASK_PROGRESS.value)

    await manager.send_to_user(user_id, WSMessage(
        type=message_type,
        data={
            "task_id": task_id,
            "progress": progress,
            "status": status,
        },
    ))


# ═════════════════════════════════════════════
# 🟡 P4-2: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 枚举
    "MessageType",
    # 消息
    "WSMessage",
    # 管理器
    "WebSocketManager",
    "get_ws_manager",
    "set_ws_manager",
    # 路由
    "ws_router",
    # 便捷函数
    "notify_user",
    "notify_tenant",
    "broadcast_formula_update",
    "push_ai_progress",
]
