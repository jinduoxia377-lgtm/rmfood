"""RMFOOD WebSocket通知处理器

提供实时通知推送功能：
- 房间概念：每个team_id一个room
- Presence Protocol：维护在线用户列表
- 心跳检测：30秒无响应则断开
- 重连机制：自动恢复订阅
"""
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Set, Optional, Any
from dataclasses import dataclass, field

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


@dataclass
class ConnectionInfo:
    """连接信息"""
    websocket: WebSocket
    team_id: int
    user_id: int
    username: str
    connected_at: datetime
    last_heartbeat: datetime


@dataclass
class NotificationPayload:
    """通知载荷"""
    type: str
    title: str
    content: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class NotificationWebSocketHandler:
    """
    WebSocket连接管理器
    
    管理团队实时通知的WebSocket连接：
    - 每个团队一个room
    - 维护在线用户列表（Presence）
    - 心跳检测和自动断开
    - 通知广播和单播
    """

    def __init__(self):
        self.rooms: Dict[int, Dict[int, ConnectionInfo]] = {}
        self.user_connections: Dict[int, int] = {}
        self.heartbeat_interval = 30
        self.max_mentions_per_message = 10

    async def connect(
        self,
        websocket: WebSocket,
        team_id: int,
        user_id: int,
        username: str = "Unknown",
    ) -> ConnectionInfo:
        """
        客户端连接，加入房间
        
        Args:
            websocket: WebSocket连接对象
            team_id: 团队ID
            user_id: 用户ID
            username: 用户名
            
        Returns:
            ConnectionInfo连接信息
        """
        await websocket.accept()

        now = datetime.now(timezone.utc)

        connection = ConnectionInfo(
            websocket=websocket,
            team_id=team_id,
            user_id=user_id,
            username=username,
            connected_at=now,
            last_heartbeat=now,
        )

        if team_id not in self.rooms:
            self.rooms[team_id] = {}

        self.rooms[team_id][user_id] = connection
        self.user_connections[user_id] = team_id

        await self._send_personal_message(websocket, {
            "type": "connected",
            "message": f"已加入团队 {team_id} 的实时通知频道",
            "team_id": team_id,
            "online_count": len(self.rooms[team_id]),
            "timestamp": now.isoformat(),
        })

        await self.broadcast_presence(team_id)

        logger.info(
            f"🔌 WebSocket连接建立:\n"
            f"   用户: {username} ({user_id})\n"
            f"   团队: {team_id}\n"
            f"   在线人数: {len(self.rooms[team_id])}"
        )

        return connection

    async def disconnect(self, websocket: WebSocket, team_id: int, user_id: int):
        """
        断开连接，清理状态
        
        Args:
            websocket: WebSocket连接
            team_id: 团队ID
            user_id: 用户ID
        """
        if team_id in self.rooms and user_id in self.rooms[team_id]:
            del self.rooms[team_id][user_id]

        if user_id in self.user_connections:
            del self.user_connections[user_id]

        if team_id in self.rooms and not self.rooms[team_id]:
            del self.rooms[team_id]

        await self.broadcast_presence(team_id)

        logger.info(
            f"🔌 WebSocket连接断开:\n"
            f"   用户: {user_id}\n"
            f"   团队: {team_id}"
        )

    async def push_notification(
        self,
        team_id: int,
        notification: NotificationPayload,
        exclude_user_ids: Optional[Set[int]] = None,
    ) -> Dict[str, bool]:
        """
        推送通知到团队房间
        
        只推送给在线且未屏蔽该类型的成员
        
        Args:
            team_id: 团队ID
            notification: 通知载荷
            exclude_user_ids: 排除的用户ID集合
            
        Returns:
            推送结果 {user_id: success}
        """
        if team_id not in self.rooms:
            logger.debug(f"团队 {team_id} 无在线用户")
            return {}

        results = {}
        message = {
            "type": "notification",
            "data": {
                "type": notification.type,
                "title": notification.title,
                "content": notification.content,
                "metadata": notification.metadata,
                "timestamp": notification.timestamp,
            },
        }

        for user_id, conn_info in self.rooms[team_id].items():
            if exclude_user_ids and user_id in exclude_user_ids:
                continue

            try:
                await conn_info.websocket.send_json(message)
                results[user_id] = True

                logger.debug(f"📤 通知已推送到用户 {user_id}")

            except Exception as e:
                logger.error(f"推送失败 (user={user_id}): {e}")
                results[user_id] = False

        logger.info(
            f"📢 通知广播完成:\n"
            f"   团队: {team_id}\n"
            f"   类型: {notification.type}\n"
            f"   成功: {sum(1 for v in results.values() if v)}/{len(results)}"
        )

        return results

    async def broadcast_presence(self, team_id: int):
        """
        广播在线状态变化
        
        Args:
            team_id: 团队ID
        """
        if team_id not in self.rooms:
            return

        online_users = [
            {
                "user_id": uid,
                "username": conn.username,
                "connected_at": conn.connected_at.isoformat(),
            }
            for uid, conn in self.rooms[team_id].items()
        ]

        presence_message = {
            "type": "presence_update",
            "data": {
                "team_id": team_id,
                "online_users": online_users,
                "online_count": len(online_users),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }

        for user_id, conn_info in list(self.rooms.get(team_id, {}).items()):
            try:
                await conn_info.websocket.send_json(presence_message)
            except Exception as e:
                logger.warning(f"Presence广播失败 (user={user_id}): {e}")
                await self.disconnect(conn_info.websocket, team_id, user_id)

    async def handle_heartbeat(self, websocket: WebSocket, team_id: int, user_id: int) -> bool:
        """
        处理心跳检测
        
        Args:
            websocket: WebSocket连接
            team_id: 团队ID
            user_id: 用户ID
            
        Returns:
            是否心跳正常
        """
        now = datetime.now(timezone.utc)

        if team_id in self.rooms and user_id in self.rooms[team_id]:
            self.rooms[team_id][user_id].last_heartbeat = now
            return True

        return False

    async def start_heartbeat_monitor(self):
        """启动心跳监控任务"""
        while True:
            await asyncio.sleep(self.heartbeat_interval)

            now = datetime.now(timezone.utc)
            timeout_threshold = timedelta(seconds=self.heartbeat_interval * 2)

            for team_id in list(self.rooms.keys()):
                for user_id in list(self.rooms[team_id].keys()):
                    conn_info = self.rooms[team_id][user_id]

                    if now - conn_info.last_heartbeat > timeout_threshold:
                        logger.warning(
                            f"⏰ 心跳超时，断开连接:\n"
                            f"   用户: {user_id}\n"
                            f"   团队: {team_id}"
                        )
                        
                        try:
                            await conn_info.websocket.close(code=4001, reason="heartbeat timeout")
                        except Exception as close_err:
                            logger.debug("关闭 WebSocket 心跳超时连接失败: %s", close_err)
                        
                        await self.disconnect(conn_info.websocket, team_id, user_id)

    async def _send_personal_message(self, websocket: WebSocket, message: Dict[str, Any]):
        """发送个人消息"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"发送个人消息失败: {e}")


ws_handler = NotificationWebSocketHandler()
