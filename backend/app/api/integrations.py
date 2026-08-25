"""
Webhook & API密钥 & 集成 API 路由

提供:
- Webhook CRUD + 测试
- API密钥管理
- 第三方集成配置
- 事件订阅管理
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


from .deps import get_db_session, get_current_user
from ..core.api_framework.integration_framework import (
    WebhookService,
    APIKeyService,
    ThirdPartyIntegrationService,
    WebhookEvent,
    WebhookStatus,
    IntegrationType,
    get_webhook_service,
    get_api_key_service,
    get_integration_service,
)


router = APIRouter(prefix="/integrations", tags=["integrations"])


# ============================================================
# Request/Response Models
# ============================================================

class CreateWebhookRequest(BaseModel):
    name: str
    url: str
    events: List[str]
    secret: Optional[str] = None
    headers: Optional[Dict[str, str]] = None


class UpdateWebhookRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    status: Optional[WebhookStatus] = None


class CreateAPIKeyRequest(BaseModel):
    name: str
    scopes: List[str]
    expires_in_days: Optional[int] = None


class CreateIntegrationRequest(BaseModel):
    type: IntegrationType
    name: str
    config: Dict[str, Any]
    events: Optional[List[str]] = None


class TestWebhookRequest(BaseModel):
    url: str
    secret: Optional[str] = None


# ============================================================
# Webhook Endpoints
# ============================================================

@router.post("/webhooks", summary="创建Webhook")
async def create_webhook(
    request: CreateWebhookRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    创建新的Webhook
    
    - 支持多种事件类型
    - 自动生成签名密钥
    - 可自定义请求头
    """
    service = get_webhook_service(db)
    
    try:
        events = [WebhookEvent(e) for e in request.events]
        
        webhook = await service.create_webhook(
            name=request.name,
            url=request.url,
            events=events,
            owner_id=current_user.id,
            secret=request.secret,
            headers=request.headers,
        )

        return {
            "success": True,
            "webhook": {
                "id": webhook.id,
                "name": webhook.name,
                "url": webhook.url,
                "events": [e.value for e in webhook.events],
                "status": webhook.status.value,
                "created_at": webhook.created_at.isoformat(),
            },
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的事件类型: {e}")


@router.get("/webhooks", summary="获取Webhook列表")
async def list_webhooks(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """获取当前用户的所有Webhook"""
    service = get_webhook_service(db)
    webhooks = await service.get_webhooks(current_user.id)

    return {
        "webhooks": [
            {
                "id": w.id,
                "name": w.name,
                "url": w.url,
                "events": [e.value for e in w.events],
                "status": w.status.value,
                "last_trigger_at": w.last_trigger_at.isoformat() if w.last_trigger_at else None,
                "success_count": w.success_count,
                "failure_count": w.failure_count,
                "created_at": w.created_at.isoformat(),
            }
            for w in webhooks
        ]
    }


@router.get("/webhooks/{webhook_id}", summary="获取Webhook详情")
async def get_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """获取单个Webhook详情（包含secret）"""
    service = get_webhook_service(db)
    webhook = await service.get_webhook(webhook_id, current_user.id)
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook不存在")

    return {
        "webhook": {
            "id": webhook.id,
            "name": webhook.name,
            "url": webhook.url,
            "secret": webhook.secret,
            "events": [e.value for e in webhook.events],
            "headers": webhook.headers,
            "status": webhook.status.value,
            "success_count": webhook.success_count,
            "failure_count": webhook.failure_count,
            "created_at": webhook.created_at.isoformat(),
        }
    }


@router.put("/webhooks/{webhook_id}", summary="更新Webhook")
async def update_webhook(
    webhook_id: str,
    request: UpdateWebhookRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """更新Webhook配置"""
    service = get_webhook_service(db)

    updates = {}
    if request.name is not None:
        updates["name"] = request.name
    if request.url is not None:
        updates["url"] = request.url
    if request.status is not None:
        updates["status"] = request.status

    webhook = await service.update_webhook(webhook_id, current_user.id, **updates)

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook不存在")

    return {"success": True, "webhook": webhook.__dict__}


@router.delete("/webhooks/{webhook_id}", summary="删除Webhook")
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """删除Webhook"""
    service = get_webhook_service(db)
    success = await service.delete_webhook(webhook_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Webhook不存在")

    return {"success": True}


@router.post("/webhooks/test", summary="测试Webhook")
async def test_webhook(
    request: TestWebhookRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    发送测试请求到指定URL

    - 验证连通性
    - 返回响应状态和耗时
    - SSRF 防护: 协议白名单 + DNS 预解析锁定 + 内网 IP 阻断
    """
    import ipaddress
    import json
    import datetime
    from urllib.parse import urlparse

    # ── SSRF 防护 Layer 1: 协议白名单 ──
    parsed = urlparse(request.url)
    if parsed.scheme not in ("http", "https"):
        return {
            "success": False,
            "error": "仅允许 http 和 https 协议",
        }

    hostname = parsed.hostname
    if not hostname:
        return {"success": False, "error": "无效的 URL，缺少主机名"}

    # ── SSRF 防护 Layer 2: 内网/保留 IP 阻断 ──
    try:
        host_ip = ipaddress.ip_address(hostname)
        if host_ip.is_private or host_ip.is_loopback or host_ip.is_reserved or host_ip.is_unspecified:
            return {"success": False, "error": "不允许访问内网或保留地址"}
    except ValueError:
        pass  # 域名，进入 DNS 预解析锁定

    # ── SSRF 防护 Layer 3: DNS 预解析锁定（防 DNS 重绑定） ──
    import socket

    resolved_addrs = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    if not resolved_addrs:
        return {"success": False, "error": "DNS 解析失败，主机名无法解析"}

    for addr_info in resolved_addrs:
        try:
            ip_str = addr_info[4][0]
            resolved_ip = ipaddress.ip_address(ip_str)
            if resolved_ip.is_private or resolved_ip.is_loopback or resolved_ip.is_reserved or resolved_ip.is_unspecified:
                logger.warning(
                    "SSRF 拦截: 域名 %s 解析到内网 IP %s",
                    hostname, ip_str,
                )
                return {"success": False, "error": "目标地址不允许访问（内网 IP）"}
        except (ValueError, IndexError):
            continue

    # ── 构造测试请求体 ──
    test_payload = {
        "test": True,
        "event": "test.event",
        "timestamp": datetime.datetime.now().isoformat(),
        "message": "来自RMFOOD平台的测试消息",
    }

    try:
        body = json.dumps(test_payload).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "RMFOOD-Webhook-Test/1.0",
        }

        if request.secret:
            from ..core.api_framework.integration_framework import WebhookService
            sig = WebhookService._generate_signature(body, request.secret)
            headers["X-Webhook-Signature"] = f"sha256={sig}"

        start_time = datetime.datetime.now()

        async with aiohttp.ClientSession() as session:
            async with session.post(
                request.url,
                data=body,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
                allow_redirects=False,  # 禁止重定向（防重定向 SSRF）
            ) as resp:
                response_body = await resp.text()
                duration_ms = (datetime.datetime.now() - start_time).total_seconds() * 1000

        return {
            "success": 200 <= resp.status < 300,
            "status_code": resp.status,
            "duration_ms": int(duration_ms),
            "response_body": response_body[:500],
        }

    except aiohttp.ClientError as e:
        logger.warning("Webhook 测试请求失败: %s", e)
        return {"success": False, "error": "网络连接失败，请检查目标 URL 是否正确"}
    except Exception as e:
        logger.error("Webhook 测试异常: %s", e)
        return {"success": False, "error": "测试请求失败"}


@router.get("/webhooks/events", summary="列出支持的事件类型")
async def list_events():
    """列出所有支持的事件类型"""
    events = []
    
    for event in WebhookEvent:
        category, action = event.value.split(".", 1)
        events.append({
            "value": event.value,
            "category": category,
            "action": action.replace("_", " ").title(),
            "description": _get_event_description(event),
        })

    return {"events": events}


# ============================================================
# API Key Endpoints
# ============================================================

@router.post("/api-keys", summary="创建API密钥")
async def create_api_key(
    request: CreateAPIKeyRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    创建新的API密钥
    
    ⚠️ 注意: 密钥仅在此响应中显示一次，请妥善保存！
    
    - 支持设置权限范围 (scopes)
    - 可设置过期时间
    - 自动生成安全密钥
    """
    service = get_api_key_service(db)

    api_key, plain_key = await service.create_api_key(
        name=request.name,
        scopes=request.scopes,
        owner_id=current_user.id,
        expires_in_days=request.expires_in_days,
    )

    return {
        "success": True,
        "api_key": {
            "id": api_key.id,
            "name": api_key.name,
            "key_prefix": api_key.key_prefix,
            "key": plain_key,
            "scopes": api_key.scopes,
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
            "created_at": api_key.created_at.isoformat(),
        },
        "warning": "⚠️ 请立即保存此密钥，它将不会再次显示！",
    }


@router.get("/api-keys", summary="列出API密钥")
async def list_api_keys(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    列出用户的所有API密钥
    
    ⚠️ 不返回实际密钥值，仅显示前缀
    """
    service = get_api_key_service(db)
    keys = await service.list_keys(current_user.id)

    return {"keys": keys}


@router.delete("/api-keys/{key_id}", summary="撤销API密钥")
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """撤销（禁用）指定的API密钥"""
    service = get_api_key_service(db)
    success = await service.revoke_key(key_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="密钥不存在")

    return {"success": True}


@router.get("/api-keys/scopes", summary="列出可用的权限范围")
async def list_scopes():
    """列出所有可用的API权限范围"""
    scopes = [
        {"value": "read", "label": "读取权限", "description": "读取配方、实验等数据"},
        {"value": "write", "label": "写入权限", "description": "创建、修改数据"},
        {"value": "delete", "label": "删除权限", "description": "删除数据"},
        {"value": "admin", "label": "管理员权限", "description": "完整的管理员访问权限"},
        {"value": "ai:generate", "label": "AI生成", "description": "调用AI配方生成"},
        {"value": "analytics:read", "label": "数据分析", "description": "访问分析报表"},
        {"value": "webhooks:manage", "label": "Webhook管理", "description": "管理Webhook"},
        {"value": "integrations:manage", "label": "集成管理", "description": "管理第三方集成"},
    ]

    return {"scopes": scopes}


# ============================================================
# Third-party Integration Endpoints
# ============================================================

@router.post("/third-party", summary="创建第三方集成")
async def create_integration(
    request: CreateIntegrationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    创建第三方服务集成
    
    支持的平台:
    - Slack (Incoming Webhook URL)
    - 钉钉 (机器人Webhook URL + Secret)
    - 飞书 (机器人Webhook URL)
    - 企业微信 (群机器人URL)
    """
    service = get_integration_service(db)

    events = [WebhookEvent(e) for e in request.events] if request.events else []

    integration = await service.create_integration(
        type=request.type,
        name=request.name,
        config=request.config,
        owner_id=current_user.id,
        events=events,
    )

    return {
        "success": True,
        "integration": {
            "id": integration.id,
            "type": integration.type.value,
            "name": integration.name,
            "is_active": integration.is_active,
            "created_at": integration.created_at.isoformat(),
        }
    }


@router.get("/third-party", summary="列出集成")
async def list_integrations(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """列出用户的所有第三方集成"""
    result = await db.execute(
        """SELECT id, type, name, is_active, created_at 
           FROM integrations 
           WHERE owner_id = :owner_id
           ORDER BY created_at DESC""",
        {"owner_id": current_user.id},
    )

    integrations = []
    for row in result.fetchall():
        integrations.append({
            "id": row.id,
            "type": row.type,
            "name": row.name,
            "is_active": row.is_active,
            "created_at": row.created_at.isoformat(),
        })

    return {"integrations": integrations}


@router.delete("/third-party/{integration_id}", summary="删除集成")
async def delete_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """删除第三方集成"""
    await db.execute(
        "DELETE FROM integrations WHERE id = :id AND owner_id = :owner_id",
        {"id": integration_id, "owner_id": current_user.id},
    )
    await db.commit()

    return {"success": True}


@router.get("/third-party/platforms", summary="列出支持的集成平台")
async def list_platforms():
    """列出所有支持的第三方平台及其配置说明"""
    platforms = [
        {
            "type": "slack",
            "name": "Slack",
            "icon": "💬",
            "config_fields": [
                {"name": "webhook_url", "label": "Webhook URL", "type": "url", "required": True, "help": "在Slack App设置中创建Incoming Webhook"},
            ],
            "features": ["消息通知", "卡片消息", "线程回复"],
        },
        {
            "type": "dingtalk",
            "name": "钉钉",
            "icon": "💰",
            "config_fields": [
                {"name": "webhook_url", "label": "Webhook URL", "type": "url", "required": True, "help": "钉钉群机器人Webhook地址"},
                {"name": "secret", "label": "加签密钥", "type": "password", "required": False, "help": "可选，用于签名验证"},
            ],
            "features": ["Markdown消息", "@提及", "链接预览"],
        },
        {
            "type": "feishu",
            "name": "飞书",
            "icon": "🐦",
            "config_fields": [
                {"name": "webhook_url", "label": "Webhook URL", "type": "url", "required": True, "help": "飞书群机器人Webhook地址"},
            ],
            "features": ["文本消息", "富文本", "图片消息"],
        },
        {
            "type": "wechat_work",
            "name": "企业微信",
            "icon": "💼",
            "config_fields": [
                {"name": "webhook_url", "label": "Webhook URL", "type": "url", "required": True, "help": "企业微信群机器人URL"},
            ],
            "features": ["文本消息", "Markdown", "图片"],
        },
    ]

    return {"platforms": platforms}


# ============================================================
# Helper Functions
# ============================================================

def _get_event_description(event: WebhookEvent) -> str:
    descriptions = {
        WebhookEvent.FORMULA_CREATED: "当新配方被创建时触发",
        WebhookEvent.FORMULA_UPDATED: "当配方被修改时触发",
        WebhookEvent.FORMULA_DELETED: "当配方被删除时触发",
        WebhookEvent.FORMULA_PUBLISHED: "当配方发布时触发",
        WebhookEvent.EXPERIMENT_CREATED: "当新实验被创建时触发",
        WebhookEvent.EXPERIMENT_UPDATED: "当实验被更新时触发",
        WebhookEvent.EXPERIMENT_COMPLETED: "当实验完成时触发",
        WebhookEvent.COMMENT_ADDED: "当添加评论时触发",
        WebhookEvent.MEMBER_INVITED: "当成员被邀请时触发",
        WebhookEvent.MEMBER_REMOVED: "当成员被移除时触发",
        WebhookEvent.AI_GENERATION_STARTED: "当AI生成开始时触发",
        WebhookEvent.AI_GENERATION_COMPLETED: "当AI生成完成时触发",
        WebhookEvent.AI_GENERATION_FAILED: "当AI生成失败时触发",
        WebhookEvent.WORKFLOW_APPROVAL_REQUESTED: "当需要审批时触发",
        WebhookEvent.WORKFLOW_APPROVED: "当审批通过时触发",
        WebhookEvent.WORKFLOW_REJECTED: "当审批被拒绝时触发",
        WebhookEvent.QUOTA_WARNING: "当配额使用达到警告阈值时触发",
        WebhookEvent.QUOTA_EXCEEDED: "当配额超限时触发",
    }
    return descriptions.get(event, "")


logger.info("🔌 集成框架API路由加载完成")
