"""
WebSocket 连接管理模块
- 管理所有WebSocket连接
- 处理消息广播和定向发送
- 实现连接状态监控
- 支持心跳检测和自动重连
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any

logger = logging.getLogger("rmfood.websocket")


class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 存储所有活跃连接: {user_id: {connection_id: websocket}}
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        # 存储连接信息: {connection_id: {user_id, last_ping, client_info}}
        self.connection_info: Dict[str, Dict[str, Any]] = {}
        # 消息队列
        self.message_queue: asyncio.Queue = asyncio.Queue()
        # 广播任务
        self.broadcast_task: Optional[asyncio.Task] = None
        # 心跳检测任务
        self.heartbeat_task: Optional[asyncio.Task] = None
        # 启动标志
        self.running = False
    
    async def start(self):
        """启动连接管理器"""
        if not self.running:
            self.running = True
            self.broadcast_task = asyncio.create_task(self._process_message_queue())
            self.heartbeat_task = asyncio.create_task(self._heartbeat_check())
            logger.info("WebSocket连接管理器已启动")
    
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
    
    async def connect(self, websocket: Any, user_id: str, connection_id: str, client_info: Dict[str, Any]):
        """添加新连接"""
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
        
        self.active_connections[user_id][connection_id] = websocket
        self.connection_info[connection_id] = {
            "user_id": user_id,
            "last_ping": datetime.utcnow().timestamp(),
            "client_info": client_info
        }
        
        logger.info(f"用户 {user_id} 已连接 (连接ID: {connection_id})")
        
        # 发送连接成功消息
        await self.send_personal_message(
            user_id,
            connection_id,
            {
                "type": "connection_established",
                "message": "连接成功",
                "connection_id": connection_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    async def disconnect(self, user_id: str, connection_id: str):
        """移除连接"""
        if user_id in self.active_connections:
            if connection_id in self.active_connections[user_id]:
                del self.active_connections[user_id][connection_id]
                
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        
        if connection_id in self.connection_info:
            del self.connection_info[connection_id]
        
        logger.info(f"用户 {user_id} 已断开连接 (连接ID: {connection_id})")
    
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
        """心跳检测"""
        while self.running:
            try:
                current_time = datetime.utcnow().timestamp()
                timeout = 30  # 30秒超时
                
                # 检查所有连接
                to_remove = []
                for connection_id, info in self.connection_info.items():
                    if current_time - info["last_ping"] > timeout:
                        to_remove.append((info["user_id"], connection_id))
                
                # 移除超时连接
                for user_id, connection_id in to_remove:
                    await self.disconnect(user_id, connection_id)
                
                # 发送心跳
                await self.broadcast({
                    "type": "heartbeat",
                    "timestamp": current_time
                })
                
                await asyncio.sleep(10)  # 每10秒检查一次
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"心跳检测时出错: {e}")
                await asyncio.sleep(10)
    
    def update_ping(self, connection_id: str):
        """更新连接的ping时间"""
        if connection_id in self.connection_info:
            self.connection_info[connection_id]["last_ping"] = datetime.utcnow().timestamp()
    
    def get_connection_count(self) -> Dict[str, int]:
        """获取连接统计"""
        total = sum(len(connections) for connections in self.active_connections.values())
        per_user = {user_id: len(connections) for user_id, connections in self.active_connections.items()}
        return {
            "total": total,
            "per_user": per_user
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
