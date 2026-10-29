"""RMFOOD WebSocket通知路由

提供实时通知推送的WebSocket端点。
统一使用 WebSocketManager (core/websocket_manager) 作为唯一管理器。
"""
import asyncio
import json
import logging
import urllib.parse
from typing import Any, Dict, Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ...core.realtime.websocket_manager import get_ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket Notifications"])


@router.websocket("/ws")
async def websocket_generic_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT Token"),
    connection_id: Optional[str] = Query(None, description="Connection ID"),
):
    """
    通用 WebSocket 连接端点（统一使用 WebSocketManager）
    """
    # 从 query 参数或 Cookie 获取 JWT token
    ws_token = token
    if not ws_token:
        ws_token = websocket.cookies.get("rmfood_access_token")

    if not ws_token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        from ...utils.auth import decode_token
        payload = decode_token(ws_token)
        if not payload or payload.get("type") != "access":
            await websocket.close(code=4003, reason="Invalid or expired token")
            return
        user_id = str(payload["sub"])
    except Exception as auth_err:
        logger.warning("WebSocket 认证失败: %s", auth_err)
        await websocket.close(code=4003, reason="Authentication failed")
        return

    # 解析客户端信息
    client_info: Dict[str, Any] = {}
    if connection_id:
        try:
            raw = urllib.parse.unquote(connection_id)
            client_info = json.loads(raw) if raw.startswith("{") else {}
        except Exception as parse_err:
            logger.debug("WebSocket 客户端信息解析失败: %s", parse_err)

    manager = get_ws_manager()
    effective_connection_id = await manager.connect(websocket, user_id, tenant_id=payload.get("tenant_id", "default"), metadata=client_info)

    logger.info(f"通用 WebSocket 客户端已连接: user={user_id} conn={effective_connection_id}")

    # 消息循环 - 使用统一的 handle_message
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                if msg_type in ("ping", "heartbeat"):
                    await manager.handle_message(effective_connection_id, data)
                elif msg_type == "subscribe":
                    channel = message.get("channel")
                    if channel:
                        await manager.subscribe(effective_connection_id, channel)
                elif msg_type == "unsubscribe":
                    channel = message.get("channel")
                    if channel:
                        await manager.unsubscribe(effective_connection_id, channel)
                else:
                    await manager.handle_message(effective_connection_id, data)
            except json.JSONDecodeError:
                await manager.send_to_connection(effective_connection_id, {
                    "type": "error",
                    "data": {"code": "INVALID_JSON", "message": "Invalid JSON format"},
                })
    except WebSocketDisconnect:
        logger.info(f"通用 WebSocket 断开: user={user_id} conn={effective_connection_id}")
    except Exception as e:
        logger.error(f"通用 WebSocket 错误: {e}", exc_info=True)
    finally:
        await manager.disconnect(effective_connection_id, reason="client_disconnect")


@router.websocket("/ws/notifications/{team_id}")
async def websocket_notification_endpoint(
    websocket: WebSocket,
    team_id: int,
    token: Optional[str] = Query(None, description="JWT Token"),
):
    """WebSocket通知端点（统一使用 WebSocketManager）"""
    ws_token = token or websocket.cookies.get("rmfood_access_token")
    if not ws_token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        from ...utils.auth import decode_token
        payload = decode_token(ws_token)
        if not payload or payload.get("type") != "access":
            await websocket.close(code=4003, reason="Invalid or expired token")
            return
        user_id = str(payload["sub"])
    except Exception as auth_err:
        logger.warning("WebSocket 认证失败: %s", auth_err)
        await websocket.close(code=4003, reason="Authentication failed")
        return

    manager = get_ws_manager()
    connection_id = await manager.connect(websocket, user_id, tenant_id=str(team_id), metadata={"team_id": team_id})

    logger.info(f"WebSocket已连接: user={user_id} team={team_id}")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                if msg_type in ("ping", "heartbeat"):
                    await manager.handle_message(connection_id, data)
                elif msg_type == "subscribe":
                    channel = message.get("channel")
                    if channel:
                        await manager.subscribe(connection_id, channel)
                elif msg_type == "unsubscribe":
                    channel = message.get("channel")
                    if channel:
                        await manager.unsubscribe(connection_id, channel)
                else:
                    await manager.handle_message(connection_id, data)
            except json.JSONDecodeError:
                await manager.send_to_connection(connection_id, {
                    "type": "error", "data": {"code": "INVALID_JSON"}
                })
    except WebSocketDisconnect:
        logger.debug("通用 WebSocket 客户端正常断开连接")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}", exc_info=True)
    finally:
        await manager.disconnect(connection_id, reason="client_disconnect")


@router.websocket("/ws/presence/{team_id}")
async def websocket_presence_endpoint(
    websocket: WebSocket,
    team_id: int,
    token: Optional[str] = Query(None),
):
    """WebSocket在线状态端点（统一使用 WebSocketManager）"""
    ws_token = token or websocket.cookies.get("rmfood_access_token")
    if not ws_token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        from ...utils.auth import decode_token
        payload = decode_token(ws_token)
        if not payload or payload.get("type") != "access":
            await websocket.close(code=4003, reason="Invalid token")
            return
        str(payload["sub"])
    except Exception as auth_err:
        logger.warning("WebSocket 认证失败: %s", auth_err)
        await websocket.close(code=4003, reason="Authentication failed")
        return

    manager = get_ws_manager()

    # 发送初始在线列表
    online_users = manager.get_online_users(str(team_id))
    await websocket.send_json({
        "type": "presence_list",
        "data": {
            "team_id": team_id,
            "online_users": [{"user_id": uid} for uid in online_users],
            "online_count": len(online_users),
        },
    })

    try:
        while True:
            await asyncio.sleep(30)
            current_users = manager.get_online_users(str(team_id))
            await websocket.send_json({
                "type": "presence_update",
                "data": {
                    "team_id": team_id,
                    "online_count": len(current_users),
                    "online_users": [{"user_id": uid} for uid in current_users],
                },
            })
    except WebSocketDisconnect:
        logger.debug("Presence WebSocket 客户端正常断开连接")
    except Exception as e:
        logger.error(f"Presence WebSocket错误: {e}")
