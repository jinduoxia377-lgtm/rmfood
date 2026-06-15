"""
WebSocket API路由
- 处理WebSocket连接
- 实现实时数据同步
- 管理连接状态
"""
import asyncio
import json
import logging
from typing import Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..core.websocket import connection_manager, WebSocketMessage
from ..core.security import decode_access_token
from .deps import get_current_user
from ..models import User

logger = logging.getLogger("rmfood.websocket.api")

router = APIRouter()
security = HTTPBearer()


async def get_user_from_token(token: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """从token获取用户信息"""
    try:
        payload = decode_access_token(token.credentials)
        return payload
    except Exception as e:
        logger.error(f"解析token失败: {e}")
        raise


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    connection_id: str = Query(...),
    client_info: str = Query(None)
):
    """WebSocket连接端点"""
    await websocket.accept()
    
    user_data = None
    user_id = None
    
    try:
        # 验证token
        try:
            payload = decode_access_token(token)
            user_data = payload
            user_id = payload.sub
        except Exception as e:
            logger.warning(f"无效的token，使用匿名连接: {e}")
            user_data = None
            user_id = f"anonymous_{connection_id[:8]}"
        
        # 解析客户端信息
        client_info_dict = {}
        if client_info:
            try:
                client_info_dict = json.loads(client_info)
            except json.JSONDecodeError:
                pass
        
        # 连接到管理器（院士级修复: 检查返回值，若超限则已自动拒绝）
        connected = await connection_manager.connect(
            websocket=websocket,
            user_id=user_id,
            connection_id=connection_id,
            client_info=client_info_dict
        )
        if not connected:
            return  # 连接已被拒绝，管理器已发送错误消息并关闭
        
        # 发送用户在线状态
        await connection_manager.broadcast(
            WebSocketMessage.user_status(user_id, "online")
        )
        
        # 处理消息
        while True:
            # 接收消息
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                # 处理不同类型的消息
                if message_type == "ping":
                    # 更新活跃时间（客户端主动 ping）
                    connection_manager.update_ping(connection_id)
                    # 回复 pong
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": message.get("timestamp")
                    })

                elif message_type == "pong":
                    # 院士级修复[P1]: 处理服务端 ping 的 pong 响应
                    connection_manager.handle_pong(connection_id)
                    # 不回复，仅更新连接状态
                
                elif message_type == "subscribe":
                    # 处理订阅请求
                    await websocket.send_json(WebSocketMessage.success(
                        "订阅成功",
                        {"channels": message.get("channels", [])}
                    ))
                
                elif message_type == "unsubscribe":
                    # 处理取消订阅
                    await websocket.send_json(WebSocketMessage.success(
                        "取消订阅成功",
                        {"channels": message.get("channels", [])}
                    ))
                
                else:
                    # 其他消息类型
                    logger.info(f"收到消息: {message}")
                    await websocket.send_json(WebSocketMessage.success("消息已收到"))
                    
            except json.JSONDecodeError:
                await websocket.send_json(WebSocketMessage.error("无效的JSON格式"))
            except Exception as e:
                logger.error(f"处理消息时出错: {e}")
                await websocket.send_json(WebSocketMessage.error(f"处理消息时出错: {str(e)}"))
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket连接断开: {user_id}")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
    finally:
        # 断开连接
        if user_id and connection_id:
            await connection_manager.disconnect(user_id, connection_id)
            # 发送用户离线状态
            await connection_manager.broadcast(
                WebSocketMessage.user_status(user_id, "offline")
            )


@router.get("/ws/status")
async def get_websocket_status():
    """获取WebSocket连接状态"""
    return {
        "status": "running" if connection_manager.running else "stopped",
        "connections": connection_manager.get_connection_count()
    }


@router.post("/ws/broadcast")
async def broadcast_message(
    message: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """广播消息（管理员）"""
    if not current_user.is_admin:
        return {"error": "权限不足"}
    
    await connection_manager.broadcast(message)
    return {"success": True, "message": "消息已广播"}


@router.post("/ws/send/{user_id}")
async def send_to_user(
    user_id: str,
    message: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """向特定用户发送消息"""
    await connection_manager.broadcast_to_user(user_id, message)
    return {"success": True, "message": "消息已发送"}
