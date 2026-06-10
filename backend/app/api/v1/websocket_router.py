"""RMFOOD WebSocket通知路由

提供实时通知推送的WebSocket端点。
"""
import json
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends

from ...websockets.notification_handler import ws_handler, NotificationPayload
from ...api.deps import get_current_active_user
from ...models.user_model import User
from ...core.websocket import connection_manager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket Notifications"])


@router.websocket("/ws")
async def websocket_generic_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT Token"),
    connection_id: Optional[str] = Query(None, description="Connection ID"),
):
    """
    通用 WebSocket 连接端点（匹配前端 WebSocketService 的连接路径）

    前端连接格式: ws://host/api/v1/ws?token=xxx&connection_id=xxx&client_info=xxx

    功能：
    - JWT Token 认证
    - 心跳检测 (ping/pong)
    - 连接状态管理
    - 广播消息支持
    """
    await websocket.accept()

    try:
        from app.utils.auth import decode_token

        if not token:
            await websocket.close(code=4001, reason="Missing authentication token")
            return

        payload = decode_token(token)

        if not payload or payload.get("type") != "access":
            await websocket.close(code=4003, reason="Invalid or expired token")
            return

        user_id = str(payload["sub"])

        # 解析客户端信息
        client_info = {}
        if connection_id:
            try:
                import urllib.parse
                raw_client_info = urllib.parse.unquote(connection_id)
                client_info = json.loads(raw_client_info) if raw_client_info.startswith("{") else {}
            except Exception:
                pass

        effective_connection_id = connection_id or f"conn_{user_id}_{id(websocket)}"

        # 注册到连接管理器
        await connection_manager.connect(
            websocket=websocket,
            user_id=user_id,
            connection_id=effective_connection_id,
            client_info=client_info,
        )

        logger.info(f"通用 WebSocket 客户端已连接: user={user_id} conn={effective_connection_id}")

        # 消息循环
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "ping":
                    connection_manager.update_ping(effective_connection_id)
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
                    })

                elif msg_type == "heartbeat":
                    connection_manager.update_ping(effective_connection_id)
                    await websocket.send_json({
                        "type": "heartbeat_ack",
                        "timestamp": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
                    })

                else:
                    logger.debug(f"收到未知消息类型: {msg_type}")

            except json.JSONDecodeError:
                logger.warning(f"无效的JSON消息: {data[:100]}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format",
                })

    except WebSocketDisconnect:
        logger.info(f"通用 WebSocket 断开: user={user_id} conn={effective_connection_id}")
        await connection_manager.disconnect(user_id, effective_connection_id)

    except Exception as e:
        logger.error(f"通用 WebSocket 错误: {e}")
        try:
            await connection_manager.disconnect(user_id, effective_connection_id)
            await websocket.close(code=1011, reason=str(e))
        except Exception:
            pass


@router.websocket("/ws/notifications/{team_id}")
async def websocket_notification_endpoint(
    websocket: WebSocket,
    team_id: int,
    token: Optional[str] = Query(None, description="JWT Token"),
):
    """
    WebSocket通知连接端点
    
    用于接收团队的实时通知推送。
    
    连接流程：
    1. 验证Token获取用户信息
    2. 加入团队房间
    3. 接收心跳消息保持连接
    4. 接收实时通知推送
    
    Args:
        websocket: WebSocket连接
        team_id: 团队ID
        token: JWT认证令牌
    """
    await websocket.accept()

    try:
        from app.utils.auth import decode_token
        
        if not token:
            await websocket.close(code=4001, reason="Missing authentication token")
            return

        payload = decode_token(token)

        if not payload or payload.get("type") != "access":
            await websocket.close(code=4003, reason="Invalid or expired token")
            return

        user_id = int(payload["sub"])

        async with ws_handler.db_context() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()

            if not user or not user.is_active:
                await websocket.close(code=4003, reason="User not found or inactive")
                return

            username = user.username or f"User_{user_id}"

            connection = await ws_handler.connect(
                websocket=websocket,
                team_id=team_id,
                user_id=user_id,
                username=username,
            )

        logger.info(f"🔌 WebSocket客户端已连接: {username} ({user_id}) → team {team_id}")

        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                msg_type = message.get("type")

                if msg_type == "heartbeat":
                    await ws_handler.handle_heartbeat(websocket, team_id, user_id)
                    await websocket.send_json({
                        "type": "heartbeat_ack",
                        "timestamp": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
                    })

                elif msg_type == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
                    })

                else:
                    logger.debug(f"收到未知消息类型: {msg_type}")

            except json.JSONDecodeError:
                logger.warning(f"无效的JSON消息: {data[:100]}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format",
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket断开: user {user_id} from team {team_id}")
        await ws_handler.disconnect(websocket, team_id, user_id)

    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        try:
            await websocket.close(code=1011, reason=str(e))
        except Exception:
            pass


@router.websocket("/ws/presence/{team_id}")
async def websocket_presence_endpoint(
    websocket: WebSocket,
    team_id: int,
    token: Optional[str] = Query(None),
):
    """
    WebSocket在线状态端点
    
    专门用于查询和管理团队成员在线状态。
    """
    await websocket.accept()

    try:
        if not token:
            await websocket.close(code=4001, reason="Missing token")
            return

        from app.utils.auth import decode_token
        payload = decode_token(token)

        if not payload:
            await websocket.close(code=4003, reason="Invalid token")
            return

        user_id = int(payload["sub"])

        online_users = []
        
        if team_id in ws_handler.rooms:
            online_users = [
                {
                    "user_id": uid,
                    "username": conn.username,
                    "connected_at": conn.connected_at.isoformat(),
                }
                for uid, conn in ws_handler.rooms[team_id].items()
            ]

        await websocket.send_json({
            "type": "presence_list",
            "data": {
                "team_id": team_id,
                "online_users": online_users,
                "online_count": len(online_users),
            },
        })

        while True:
            await asyncio.sleep(30)
            
            if team_id in ws_handler.rooms:
                current_online = [
                    {
                        "user_id": uid,
                        "username": conn.username,
                    }
                    for uid, conn in ws_handler.rooms[team_id].items()
                ]
                
                await websocket.send_json({
                    "type": "presence_update",
                    "data": {
                        "online_count": len(current_online),
                    },
                })
            else:
                break

    except WebSocketDisconnect:
        pass

    except Exception as e:
        logger.error(f"Presence WebSocket错误: {e}")
