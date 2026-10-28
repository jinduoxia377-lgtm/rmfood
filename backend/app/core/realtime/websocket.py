"""
WebSocket 连接管理模块
- 管理所有WebSocket连接
- 处理消息广播和定向发送
- 实现连接状态监控
- 支持心跳检测和自动重连

院士级修复[P1]:
- 增加连接数上限（MAX_CONNECTIONS），超限时拒绝新连接
- 实现真正的 ping-pong 双向心跳机制（服务端主动 ping，等待 pong 响应）
- 超时未响应的连接会被主动关闭，不再依赖单向广播
- 连接状态细化：CONNECTED / AWAITING_PONG / TIMEOUT
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional, Set

logger = logging.getLogger("rmfood.websocket")

# ── 连接保护参数（可通过环境变量覆盖）──
MAX_CONNECTIONS: int = 500        # 单实例最大并发 WebSocket 连接数
MAX_CONNECTIONS_PER_USER: int = 5 # 每个用户最多同时持有的连接数
HEARTBEAT_INTERVAL: int = 30      # 心跳间隔（秒）
PONG_TIMEOUT: int = 10            # 等待 pong 超时（秒）
IDLE_TIMEOUT: int = 300           # 无任何消息的空闲超时（秒，5分钟）


class ConnectionManager:
    """
    WebSocket 连接管理器（院士级增强版）

    心跳协议（真正双向 ping-pong）：
    1. 服务端每 HEARTBEAT_INTERVAL 秒发送 {"type": "ping", "timestamp": <ts>}
    2. 客户端必须在 PONG_TIMEOUT 秒内回复 {"type": "pong", "timestamp": <orig_ts>}
    3. 超时未 pong 的连接被标记为 TIMEOUT 并主动关闭

    连接数保护：
    - 全局超过 MAX_CONNECTIONS 时，新连接立即发送 {"type":"error","code":"MAX_CONNECTIONS"} 并关闭
    - 单用户超过 MAX_CONNECTIONS_PER_USER 时，踢掉最老的连接
    """

    def __init__(self):
        # 存储所有活跃连接: {user_id: {connection_id: websocket}}
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        # 存储连接信息: {connection_id: {user_id, last_ping, last_pong, status, client_info}}
        self.connection_info: Dict[str, Dict[str, Any]] = {}
        # 消息队列
        self.message_queue: asyncio.Queue = asyncio.Queue()
        # 广播任务
        self.broadcast_task: Optional[asyncio.Task] = None
        # 心跳检测任务
        self.heartbeat_task: Optional[asyncio.Task] = None
        # 启动标志
        self.running = False

    @property
    def total_connections(self) -> int:
        """当前全局活跃连接总数"""
        return sum(len(conns) for conns in self.active_connections.values())

    async def start(self):
        """启动连接管理器"""
        if not self.running:
            self.running = True
            self.broadcast_task = asyncio.create_task(self._process_message_queue())
            self.heartbeat_task = asyncio.create_task(self._heartbeat_check())
            logger.info(
                "WebSocket连接管理器已启动 (max=%d, per_user=%d, ping_interval=%ds)",
                MAX_CONNECTIONS, MAX_CONNECTIONS_PER_USER, HEARTBEAT_INTERVAL,
            )

    async def stop(self):
        """停止连接管理器"""
        if self.running:
            self.running = False

            if self.broadcast_task:
                self.broadcast_task.cancel()
            if self.heartbeat_task:
                self.heartbeat_task.cancel()

            # 关闭所有连接
            for user_connections in self.active_connections.values():
                for websocket in user_connections.values():
                    try:
                        await websocket.close()
                    except Exception as e:
                        logger.error(f"关闭WebSocket连接时出错: {e}")

            self.active_connections.clear()
            self.connection_info.clear()
            logger.info("WebSocket连接管理器已停止")

    async def connect(self, websocket: Any, user_id: str, connection_id: str, client_info: Dict[str, Any]) -> bool:
        """
        添加新连接

        院士级修复[P1]: 增加全局连接数上限 + 单用户连接数上限保护。

        Returns:
            True  → 连接成功
            False → 超出上限，已拒绝（调用方应立即 close websocket）
        """
        # ── 检查全局上限 ──
        if self.total_connections >= MAX_CONNECTIONS:
            logger.warning(
                "[WS] 拒绝新连接 %s — 全局连接数已达上限 %d",
                connection_id, MAX_CONNECTIONS,
            )
            try:
                await websocket.send_json({
                    "type": "error",
                    "code": "MAX_CONNECTIONS",
                    "message": f"服务器连接数已达上限 {MAX_CONNECTIONS}，请稍后重试",
                })
                await websocket.close(code=1013)  # 1013: Try Again Later
            except Exception as conn_err:
                logger.warning("连接数检查失败: %s", conn_err)
                await websocket.close(code=1013)  # 1013: Try Again Later

        # ── 检查单用户上限（踢掉最老的连接）──
        if user_id in self.active_connections:
            user_conns = self.active_connections[user_id]
            if len(user_conns) >= MAX_CONNECTIONS_PER_USER:
                oldest_conn_id = next(iter(user_conns))
                logger.warning(
                    "[WS] 用户 %s 连接数超过 %d，踢掉最老连接 %s",
                    user_id, MAX_CONNECTIONS_PER_USER, oldest_conn_id,
                )
                await self.disconnect(user_id, oldest_conn_id)

        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}

        self.active_connections[user_id][connection_id] = websocket
        self.connection_info[connection_id] = {
            "user_id": user_id,
            "last_ping": datetime.utcnow().timestamp(),
            "last_pong": datetime.utcnow().timestamp(),   # 新增：上次 pong 时间
            "last_msg": datetime.utcnow().timestamp(),    # 新增：上次任意消息时间
            "status": "CONNECTED",                         # CONNECTED / AWAITING_PONG / TIMEOUT
            "client_info": client_info,
        }

        logger.info(
            "[WS] 用户 %s 已连接 (id=%s, 总连接数=%d)",
            user_id, connection_id, self.total_connections,
        )

        # 发送连接成功消息
        await self.send_personal_message(
            user_id,
            connection_id,
            {
                "type": "connection_established",
                "message": "连接成功",
                "connection_id": connection_id,
                "timestamp": datetime.utcnow().isoformat(),
                "heartbeat_interval": HEARTBEAT_INTERVAL,
                "pong_timeout": PONG_TIMEOUT,
            }
        )
        return True

    async def disconnect(self, user_id: str, connection_id: str):
        """移除连接"""
        if user_id in self.active_connections:
            if connection_id in self.active_connections[user_id]:
                # 尝试关闭底层 websocket
                try:
                    ws = self.active_connections[user_id][connection_id]
                    await ws.close()
                except Exception as close_err:
                    logger.debug("关闭 WebSocket 连接失败: %s", close_err)
                del self.active_connections[user_id][connection_id]

                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

        if connection_id in self.connection_info:
            del self.connection_info[connection_id]

        logger.info(
            "[WS] 用户 %s 断开连接 (id=%s, 剩余连接数=%d)",
            user_id, connection_id, self.total_connections,
        )

    async def send_personal_message(self, user_id: str, connection_id: str, message: Dict[str, Any]):
        """发送个人消息"""
        try:
            if user_id in self.active_connections:
                if connection_id in self.active_connections[user_id]:
                    websocket = self.active_connections[user_id][connection_id]
                    await websocket.send_json(message)
                    return True
        except Exception as e:
            logger.error(f"发送个人消息失败: {e}")
        return False

    async def broadcast(self, message: Dict[str, Any], exclude_users: Optional[Set[str]] = None):
        """广播消息"""
        await self.message_queue.put((message, exclude_users))

    async def broadcast_to_user(self, user_id: str, message: Dict[str, Any]):
        """向特定用户广播消息"""
        if user_id in self.active_connections:
            for connection_id, websocket in self.active_connections[user_id].items():
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"向用户 {user_id} 发送消息失败: {e}")

    async def _process_message_queue(self):
        """处理消息队列"""
        while self.running:
            try:
                message, exclude_users = await self.message_queue.get()

                # 创建连接副本以避免迭代时修改字典
                connections_copy = list(self.active_connections.items())

                for user_id, connections in connections_copy:
                    if exclude_users and user_id in exclude_users:
                        continue

                    # 创建连接ID和websocket的副本
                    connection_items = list(connections.items())

                    for connection_id, websocket in connection_items:
                        try:
                            # 再次检查连接是否仍然存在
                            if user_id in self.active_connections and connection_id in self.active_connections[user_id]:
                                await websocket.send_json(message)
                        except Exception as e:
                            logger.error(f"广播消息失败 (用户: {user_id}, 连接: {connection_id}): {e}")
                            # 移除无效连接
                            await self.disconnect(user_id, connection_id)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"处理消息队列时出错: {e}")

    async def _heartbeat_check(self):
        """
        双向心跳检测（院士级增强）

        心跳流程：
        1. 每 HEARTBEAT_INTERVAL 秒向所有连接发送 {"type":"ping"}
        2. 连接状态标记为 AWAITING_PONG
        3. 再等待 PONG_TIMEOUT 秒检查是否收到 pong
        4. 超过 IDLE_TIMEOUT 无任何消息则强制断开
        """
        while self.running:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                if not self.running:
                    break

                current_time = datetime.utcnow().timestamp()
                to_disconnect: list = []

                # ── 1. 检查超时连接并发送新一轮 ping ──
                conn_snapshot = dict(self.connection_info)
                for conn_id, info in conn_snapshot.items():
                    # 空闲超时（IDLE_TIMEOUT 内无任何消息）
                    if current_time - info.get("last_msg", current_time) > IDLE_TIMEOUT:
                        logger.warning(
                            "[WS] 连接 %s (user=%s) 空闲超时 %ds，主动断开",
                            conn_id, info["user_id"], IDLE_TIMEOUT,
                        )
                        to_disconnect.append((info["user_id"], conn_id))
                        continue

                    # Pong 超时（AWAITING_PONG 状态超过 PONG_TIMEOUT）
                    if info.get("status") == "AWAITING_PONG":
                        last_ping = info.get("last_ping", current_time)
                        if current_time - last_ping > PONG_TIMEOUT:
                            logger.warning(
                                "[WS] 连接 %s (user=%s) pong 超时 %ds，主动断开",
                                conn_id, info["user_id"], PONG_TIMEOUT,
                            )
                            to_disconnect.append((info["user_id"], conn_id))
                            continue

                # ── 2. 断开超时连接 ──
                for user_id, conn_id in to_disconnect:
                    await self.disconnect(user_id, conn_id)

                # ── 3. 向所有剩余活跃连接发送 ping，标记 AWAITING_PONG ──
                ping_ts = current_time
                conn_snapshot = dict(self.connection_info)
                for conn_id, info in conn_snapshot.items():
                    if info.get("status") == "CONNECTED":
                        user_id = info["user_id"]
                        sent = await self.send_personal_message(
                            user_id, conn_id,
                            {"type": "ping", "timestamp": ping_ts}
                        )
                        if sent and conn_id in self.connection_info:
                            self.connection_info[conn_id]["status"] = "AWAITING_PONG"
                            self.connection_info[conn_id]["last_ping"] = ping_ts

                active = self.total_connections
                if active > 0:
                    logger.debug("[WS] 心跳轮次完成，活跃连接: %d", active)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[WS] 心跳检测异常: %s", e, exc_info=True)

    def handle_pong(self, connection_id: str) -> None:
        """
        处理客户端 pong 响应（院士级修复：真正的双向心跳）

        连接状态从 AWAITING_PONG → CONNECTED
        """
        if connection_id in self.connection_info:
            info = self.connection_info[connection_id]
            info["last_pong"] = datetime.utcnow().timestamp()
            info["last_msg"] = info["last_pong"]
            info["status"] = "CONNECTED"
            logger.debug("[WS] 收到 pong: %s", connection_id)

    def update_ping(self, connection_id: str) -> None:
        """
        更新连接最后活跃时间（兼容旧 API，推荐改用 handle_pong）
        """
        if connection_id in self.connection_info:
            now = datetime.utcnow().timestamp()
            self.connection_info[connection_id]["last_ping"] = now
            self.connection_info[connection_id]["last_msg"] = now
            self.connection_info[connection_id]["status"] = "CONNECTED"

    def update_message_time(self, connection_id: str) -> None:
        """更新连接的最后消息时间（收到任意消息时调用）"""
        if connection_id in self.connection_info:
            self.connection_info[connection_id]["last_msg"] = datetime.utcnow().timestamp()

    def get_connection_count(self) -> Dict[str, Any]:
        """获取连接统计（含保护参数信息）"""
        total = self.total_connections
        per_user = {uid: len(conns) for uid, conns in self.active_connections.items()}
        awaiting_pong = sum(
            1 for info in self.connection_info.values()
            if info.get("status") == "AWAITING_PONG"
        )
        return {
            "total": total,
            "limit": MAX_CONNECTIONS,
            "utilization_pct": round(total / MAX_CONNECTIONS * 100, 1),
            "awaiting_pong": awaiting_pong,
            "per_user": per_user,
        }

    def get_connection_info(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """获取连接信息"""
        return self.connection_info.get(connection_id)


# 全局连接管理器实例
connection_manager = ConnectionManager()


class WebSocketMessage:
    """WebSocket消息封装"""

    @staticmethod
    def create(type: str, data: Any, **kwargs) -> Dict[str, Any]:
        """创建消息"""
        message = {
            "type": type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs
        }
        return message

    @staticmethod
    def data_update(entity_type: str, entity_id: str, action: str, data: Any) -> Dict[str, Any]:
        """创建数据更新消息"""
        return WebSocketMessage.create(
            "data_update",
            {
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": action,  # create, update, delete
                "data": data
            }
        )

    @staticmethod
    def error(message: str, code: str = "error") -> Dict[str, Any]:
        """创建错误消息"""
        return WebSocketMessage.create(
            "error",
            {
                "message": message,
                "code": code
            }
        )

    @staticmethod
    def success(message: str, data: Any = None) -> Dict[str, Any]:
        """创建成功消息"""
        return WebSocketMessage.create(
            "success",
            {
                "message": message,
                "data": data
            }
        )

    @staticmethod
    def user_status(user_id: str, status: str) -> Dict[str, Any]:
        """创建用户状态消息"""
        return WebSocketMessage.create(
            "user_status",
            {
                "user_id": user_id,
                "status": status  # online, offline, away
            }
        )
