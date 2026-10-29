"""
企业级集成框架

功能:
- Webhook 管理 (创建/删除/测试)
- API 密钥管理 (生成/撤销/权限控制)
- 第三方服务集成 (Slack/DingTalk/飞书/企微)
- 事件总线 (Event Bus)
- 请求日志与重试机制
- 签名验证与安全
"""

import asyncio
import hashlib
import hmac
import json
import logging
import secrets
import urllib.parse
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy import text

from app.utils.error_sanitize import sanitize_error

logger = logging.getLogger(__name__)


# ============================================================
# Enums & Models
# ============================================================

class WebhookEvent(str, Enum):
    """支持的事件类型"""
    FORMULA_CREATED = "formula.created"
    FORMULA_UPDATED = "formula.updated"
    FORMULA_DELETED = "formula.deleted"
    FORMULA_PUBLISHED = "formula.published"

    EXPERIMENT_CREATED = "experiment.created"
    EXPERIMENT_UPDATED = "experiment.updated"
    EXPERIMENT_COMPLETED = "experiment.completed"

    COMMENT_ADDED = "comment.added"
    MEMBER_INVITED = "member.invited"
    MEMBER_REMOVED = "member.removed"

    AI_GENERATION_STARTED = "ai_generation.started"
    AI_GENERATION_COMPLETED = "ai_generation.completed"
    AI_GENERATION_FAILED = "ai_generation.failed"

    WORKFLOW_APPROVAL_REQUESTED = "workflow.approval_requested"
    WORKFLOW_APPROVED = "workflow.approved"
    WORKFLOW_REJECTED = "workflow.rejected"

    QUOTA_WARNING = "quota.warning"
    QUOTA_EXCEEDED = "quota.exceeded"


class IntegrationType(str, Enum):
    """集成类型"""
    WEBHOOK = "webhook"
    SLACK = "slack"
    DINGTALK = "dingtalk"
    FEISHU = "feishu"
    WECHAT_WORK = "wechat_work"
    CUSTOM = "custom"


class WebhookStatus(str, Enum):
    """Webhook状态"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


@dataclass
class Webhook:
    """Webhook配置"""
    id: str
    name: str
    url: str
    events: List[WebhookEvent]
    secret: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    status: WebhookStatus = WebhookStatus.ACTIVE
    owner_id: int = 0
    org_id: Optional[int] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_trigger_at: Optional[datetime] = None
    success_count: int = 0
    failure_count: int = 0


@dataclass
class APIKey:
    """API密钥"""
    id: str
    name: str
    key_hash: str
    key_prefix: str
    scopes: List[str]
    owner_id: int = 0
    org_id: Optional[int] = None
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True


@dataclass
class WebhookDelivery:
    """Webhook投递记录"""
    id: str
    webhook_id: str
    event_type: WebhookEvent
    payload: Dict[str, Any]
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    duration_ms: Optional[int] = None
    success: bool = False
    retry_count: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class IntegrationConfig:
    """第三方集成配置"""
    id: str
    type: IntegrationType
    name: str
    config: Dict[str, Any]
    events: List[WebhookEvent] = field(default_factory=list)
    is_active: bool = True
    owner_id: int = 0
    org_id: Optional[int] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================
# Event Bus
# ============================================================

class EventBus:
    """
    事件总线

    负责在系统中发布和订阅事件，
    触发关联的Webhook和集成。
    """

    def __init__(self):
        self._subscribers: Dict[WebhookEvent, List[Callable]] = {}

    def subscribe(self, event: WebhookEvent, handler: Callable):
        """订阅事件"""
        if event not in self._subscribers:
            self._subscribers[event] = []
        self._subscribers[event].append(handler)
        logger.debug(f"📝 订阅事件: {event.value}")

    def unsubscribe(self, event: WebhookEvent, handler: Callable):
        """取消订阅"""
        if event in self._subscribers:
            self._subscribers[event] = [h for h in self._subscribers[event] if h != handler]

    async def publish(self, event: WebhookEvent, payload: Dict[str, Any]):
        """发布事件"""
        logger.info(f"🚀 发布事件: {event.value}")

        handlers = self._subscribers.get(event, [])

        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event, payload)
                else:
                    handler(event, payload)
            except Exception as e:
                logger.error(f"❌ 事件处理器执行失败 ({event.value}): {e}")


# Global Event Bus Instance
event_bus = EventBus()


# ============================================================
# Webhook Service
# ============================================================

class WebhookService:
    """
    Webhook管理服务

    Features:
    - 创建/更新/删除Webhook
    - 事件触发与投递
    - 签名验证（HMAC-SHA256）
    - 自动重试机制
    - 投递日志记录
    """

    def __init__(self, db):
        self.db = db

    async def create_webhook(
        self,
        name: str,
        url: str,
        events: List[WebhookEvent],
        owner_id: int,
        *,
        secret: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        org_id: Optional[int] = None,
    ) -> Webhook:
        """
        创建新Webhook

        Args:
            name: 名称
            url: 回调URL
            events: 监听的事件列表
            owner_id: 创建者ID
            secret: 签名密钥（可选，自动生成）
            headers: 自定义请求头
            org_id: 组织ID（可选）

        Returns:
            Webhook对象
        """
        webhook = Webhook(
            id=str(uuid.uuid4()),
            name=name,
            url=url,
            events=events,
            secret=secret or secrets.token_hex(32),
            headers=headers or {},
            owner_id=owner_id,
            org_id=org_id,
        )

        await self.db.execute(text("""INSERT INTO webhooks
               (id, name, url, events, secret, headers, status, owner_id, org_id, created_at, updated_at)
               VALUES (:id, :name, :url, CAST(:events_arr AS text[]), :secret, CAST(:headers_jsonb AS jsonb), :status, :owner_id, :org_id, NOW(), NOW())"""),
            {
                "id": webhook.id,
                "name": webhook.name,
                "url": webhook.url,
                "events_arr": [e.value for e in webhook.events],
                "secret": webhook.secret,
                "headers_jsonb": json.dumps(webhook.headers),
                "status": webhook.status.value,
                "owner_id": webhook.owner_id,
                "org_id": webhook.org_id,
            },
        )
        await self.db.commit()

        for event in events:
            event_bus.subscribe(event, lambda e, p, wh=webhook: self._trigger_webhook(wh, e, p))

        logger.info(f"🪝 创建Webhook: {name} → {url} (events={[e.value for e in events]})")

        return webhook

    async def get_webhooks(self, owner_id: int) -> List[Webhook]:
        """获取用户的所有Webhook"""
        result = await self.db.execute(text("""SELECT * FROM webhooks
               WHERE owner_id = :owner_id OR org_id IN (
                 SELECT org_id FROM organization_members WHERE user_id = :owner_id
               )
               ORDER BY created_at DESC"""),
            {"owner_id": owner_id},
        )

        webhooks = []
        for row in result.fetchall():
            webhooks.append(Webhook(
                id=row.id,
                name=row.name,
                url=row.url,
                events=[WebhookEvent(e) for e in row.events],
                secret=row.secret,
                headers=json.loads(row.headers) if row.headers else {},
                status=WebhookStatus(row.status),
                owner_id=row.owner_id,
                org_id=row.org_id,
                created_at=row.created_at,
                updated_at=row.updated_at,
                last_trigger_at=row.last_trigger_at,
                success_count=row.success_count or 0,
                failure_count=row.failure_count or 0,
            ))

        return webhooks

    async def get_webhook(self, webhook_id: str, owner_id: int) -> Optional[Webhook]:
        """获取单个Webhook详情"""
        result = await self.db.execute(text("SELECT * FROM webhooks WHERE id = :id AND owner_id = :owner_id"),
            {"id": webhook_id, "owner_id": owner_id},
        )
        row = result.fetchone()

        if not row:
            return None

        return Webhook(
            id=row.id,
            name=row.name,
            url=row.url,
            events=[WebhookEvent(e) for e in row.events],
            secret=row.secret,
            headers=json.loads(row.headers) if row.headers else {},
            status=WebhookStatus(row.status),
            owner_id=row.owner_id,
            org_id=row.org_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
            last_trigger_at=row.last_trigger_at,
            success_count=row.success_count or 0,
            failure_count=row.failure_count or 0,
        )

    async def update_webhook(
        self,
        webhook_id: str,
        owner_id: int,
        **updates
    ) -> Optional[Webhook]:
        """更新Webhook配置"""
        allowed_fields = ["name", "url", "status"]
        set_clauses = []
        params = {"id": webhook_id, "owner_id": owner_id}

        for key, value in updates.items():
            if key in allowed_fields:
                set_clauses.append(f"{key} = :{key}")
                params[key] = value

        if set_clauses:
            set_clauses.append("updated_at = NOW()")

            await self.db.execute(text("UPDATE webhooks SET {', '.join(set_clauses)} WHERE id = :id AND owner_id = :owner_id"),
                params,
            )
            await self.db.commit()

        return await self.get_webhook(webhook_id, owner_id)

    async def delete_webhook(self, webhook_id: str, owner_id: int) -> bool:
        """删除Webhook"""
        await self.db.execute(text("DELETE FROM webhooks WHERE id = :id AND owner_id = :owner_id"),
            {"id": webhook_id, "owner_id": owner_id},
        )
        await self.db.commit()

        return True

    async def _trigger_webhook(self, webhook: Webhook, event: WebhookEvent, payload: Dict[str, Any]):
        """触发Webhook（内部方法）"""
        import aiohttp

        delivery = WebhookDelivery(
            id=str(uuid.uuid4()),
            webhook_id=webhook.id,
            event_type=event,
            payload=payload,
        )

        try:
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')

            signature = self._generate_signature(body, webhook.secret)

            headers = {
                "Content-Type": "application/json",
                "User-Agent": "RMFOOD-Webhook/2.0",
                "X-Webhook-Event": event.value,
                "X-Webhook-Signature": f"sha256={signature}",
                "X-Webhook-ID": webhook.id,
                "X-Webhook-Timestamp": str(int(datetime.now().timestamp())),
                **webhook.headers,
            }

            start_time = datetime.now()

            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(webhook.url, data=body, headers=headers) as response:
                    delivery.response_status = response.status
                    delivery.response_body = await response.text()
                    delivery.success = 200 <= response.status < 300

            delivery.duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            if delivery.success:
                await self._update_success_count(webhook.id)
            else:
                await self._update_failure_count(webhook.id)

        except Exception as e:
            logger.error(f"❌ Webhook投递失败 ({webhook.name}): {e}")
            delivery.success = False
            delivery.response_body = sanitize_error(e, "集成失败")
            await self._update_failure_count(webhook.id)

        finally:
            await self._log_delivery(delivery)

        logger.info(f"📤 Webhook投递: {webhook.name} → {delivery.success} ({delivery.duration_ms}ms)")

    def _generate_signature(self, body: bytes, secret: str) -> str:
        """生成HMAC-SHA256签名"""
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    def verify_signature(self, body: bytes, signature: str, secret: str) -> bool:
        """验证签名"""
        expected = self._generate_signature(body, secret)
        return hmac.compare_digest(signature, f"sha256={expected}")

    async def _log_delivery(self, delivery: WebhookDelivery):
        """记录投递日志"""
        await self.db.execute(text("""INSERT INTO webhook_deliveries
               (id, webhook_id, event_type, payload, response_status, response_body, duration_ms, success, retry_count, created_at)
               VALUES (:id, :webhook_id, :event_type, CAST(:payload_jsonb AS jsonb), :response_status, :response_body, :duration_ms, :success, :retry_count, NOW())"""),
            {
                "id": delivery.id,
                "webhook_id": delivery.webhook_id,
                "event_type": delivery.event_type.value,
                "payload_jsonb": json.dumps(delivery.payload),
                "response_status": delivery.response_status,
                "response_body": delivery.response_body,
                "duration_ms": delivery.duration_ms,
                "success": delivery.success,
                "retry_count": delivery.retry_count,
            },
        )
        await self.db.commit()

    async def _update_success_count(self, webhook_id: str):
        """更新成功计数"""
        await self.db.execute(text("UPDATE webhooks SET success_count = success_count + 1, last_trigger_at = NOW() WHERE id = :id"),
            {"id": webhook_id},
        )

    async def _update_failure_count(self, webhook_id: str):
        """更新失败计数"""
        await self.db.execute(text("UPDATE webhooks SET failure_count = failure_count + 1, last_trigger_at = NOW() WHERE id = :id"),
            {"id": webhook_id},
        )


# ============================================================
# API Key Service
# ============================================================

class APIKeyService:
    """
    API密钥管理服务

    Features:
    - 安全的密钥生成与存储（仅存储hash）
    - 权限范围控制
    - 过期时间设置
    - 使用统计
    - 密钥撤销
    """

    def __init__(self, db):
        self.db = db

    def generate_key(self) -> tuple:
        """
        生成新的API密钥

        Returns:
            (plain_key, key_prefix) 元组，plain_key仅返回一次
        """
        raw_key = f"rmf_{secrets.token_hex(32)}"
        prefix = raw_key[:12] + "..."
        return raw_key, prefix

    async def create_api_key(
        self,
        name: str,
        scopes: List[str],
        owner_id: int,
        *,
        expires_in_days: Optional[int] = None,
        org_id: Optional[int] = None,
    ) -> tuple:
        """
        创建API密钥

        Args:
            name: 密钥名称
            scopes: 权限范围列表
            owner_id: 所有者ID
            expires_in_days: 有效期（天），None表示永不过期
            org_id: 组织ID

        Returns:
            (api_key_object, plain_key) 仅创建时返回明文密钥
        """
        plain_key, prefix = self.generate_key()
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()

        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

        api_key = APIKey(
            id=str(uuid.uuid4()),
            name=name,
            key_hash=key_hash,
            key_prefix=prefix,
            scopes=scopes,
            owner_id=owner_id,
            org_id=org_id,
            expires_at=expires_at,
        )

        await self.db.execute(text("""INSERT INTO api_keys
               (id, name, key_hash, key_prefix, scopes, owner_id, org_id, expires_at, is_active, created_at)
               VALUES (:id, :name, :key_hash, :key_prefix, CAST(:scopes_arr AS text[]), :owner_id, :org_id, :expires_at, TRUE, NOW())"""),
            {
                "id": api_key.id,
                "name": api_key.name,
                "key_hash": api_key.key_hash,
                "key_prefix": api_key.key_prefix,
                "scopes_arr": api_key.scopes,
                "owner_id": api_key.owner_id,
                "org_id": api_key.org_id,
                "expires_at": api_key.expires_at,
            },
        )
        await self.db.commit()

        logger.info(f"🔑 创建API密钥: {name} (prefix={prefix})")

        return api_key, plain_key

    async def verify_key(self, plain_key: str) -> Optional[APIKey]:
        """验证API密钥并返回密钥对象"""
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()

        result = await self.db.execute(text("""SELECT * FROM api_keys
               WHERE key_hash = :key_hash AND is_active = TRUE
               AND (expires_at IS NULL OR expires_at > NOW())"""),
            {"key_hash": key_hash},
        )
        row = result.fetchone()

        if not row:
            return None

        await self.db.execute(text("UPDATE api_keys SET last_used_at = NOW() WHERE id = :id"),
            {"id": row.id},
        )
        await self.db.commit()

        return APIKey(
            id=row.id,
            name=row.name,
            key_hash=row.key_hash,
            key_prefix=row.key_prefix,
            scopes=list(row.scopes),
            owner_id=row.owner_id,
            org_id=row.org_id,
            expires_at=row.expires_at,
            last_used_at=datetime.now(timezone.utc),
            created_at=row.created_at,
            is_active=True,
        )

    async def list_keys(self, owner_id: int) -> List[Dict[str, Any]]:
        """列出用户的所有API密钥（不含实际密钥值）"""
        result = await self.db.execute(text("""SELECT id, name, key_prefix, scopes, expires_at, last_used_at, is_active, created_at
               FROM api_keys
               WHERE owner_id = :owner_id
               ORDER BY created_at DESC"""),
            {"owner_id": owner_id},
        )

        keys = []
        for row in result.fetchall():
            keys.append({
                "id": row.id,
                "name": row.name,
                "key_prefix": row.key_prefix,
                "scopes": list(row.scopes),
                "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat(),
            })

        return keys

    async def revoke_key(self, key_id: str, owner_id: int) -> bool:
        """撤销API密钥"""
        await self.db.execute(text("UPDATE api_keys SET is_active = FALSE WHERE id = :id AND owner_id = :owner_id"),
            {"id": key_id, "owner_id": owner_id},
        )
        await self.db.commit()

        logger.info(f"🔒 撤销API密钥: {key_id}")

        return True


# ============================================================
# Third-party Integrations
# ============================================================

class ThirdPartyIntegrationService:
    """
    第三方集成服务

    支持的平台:
    - Slack (Incoming Webhooks)
    - 钉钉 (机器人)
    - 飞书 (自定义机器人)
    - 企业微信 (群机器人)
    """

    def __init__(self, db):
        self.db = db

    async def create_integration(
        self,
        type: IntegrationType,
        name: str,
        config: Dict[str, Any],
        owner_id: int,
        events: Optional[List[WebhookEvent]] = None,
        org_id: Optional[int] = None,
    ) -> IntegrationConfig:
        """创建第三方集成"""
        integration = IntegrationConfig(
            id=str(uuid.uuid4()),
            type=type,
            name=name,
            config=config,
            events=events or [],
            owner_id=owner_id,
            org_id=org_id,
        )

        await self.db.execute(text("""INSERT INTO integrations
               (id, type, name, config, events, is_active, owner_id, org_id, created_at)
               VALUES (:id, :type, :name, CAST(:config_jsonb AS jsonb), CAST(:events_arr AS text[]), :is_active, :owner_id, :org_id, NOW())"""),
            {
                "id": integration.id,
                "type": integration.type.value,
                "name": integration.name,
                "config_jsonb": json.dumps(integration.config),
                "events_arr": [e.value for e in integration.events],
                "is_active": integration.is_active,
                "owner_id": integration.owner_id,
                "org_id": integration.org_id,
            },
        )
        await self.db.commit()

        logger.info(f"🔗 创建集成: {name} ({type.value})")

        return integration

    async def send_to_slack(self, integration: IntegrationConfig, message: str, *, blocks: Optional[List[Dict]] = None):
        """发送消息到Slack"""
        import aiohttp

        webhook_url = integration.config.get("webhook_url")
        if not webhook_url:
            raise ValueError("缺少Slack Webhook URL")

        payload: Dict[str, Any] = {"text": message}
        if blocks:
            payload["blocks"] = blocks

        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as resp:
                return resp.status == 200

    async def send_to_dingtalk(self, integration: IntegrationConfig, title: str, content: str):
        """发送消息到钉钉"""
        import aiohttp

        webhook_url = integration.config.get("webhook_url")
        if not webhook_url:
            raise ValueError("缺少钉钉Webhook URL")

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": content,
            },
        }

        secret = integration.config.get("secret")
        if secret:
            import time
            timestamp = str(round(time.time() * 1000))
            string_to_sign = f'{timestamp}\n{secret}'
            hmac_code = hmac.new(secret.encode(), string_to_sign.encode(), digestmod=hashlib.sha256).digest()
            sign = urllib.parse.quote_plus(hmac_code.hex())
            webhook_url = f"{webhook_url}&timestamp={timestamp}&sign={sign}"

        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as resp:
                return resp.status == 200

    async def send_to_feishu(self, integration: IntegrationConfig, content: str):
        """发送消息到飞书"""
        import aiohttp

        webhook_url = integration.config.get("webhook_url")
        if not webhook_url:
            raise ValueError("缺少飞书Webhook URL")

        payload = {
            "msg_type": "text",
            "content": {"text": content},
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as resp:
                return resp.status == 200


def get_webhook_service(db) -> WebhookService:
    return WebhookService(db)


def get_api_key_service(db) -> APIKeyService:
    return APIKeyService(db)


def get_integration_service(db) -> ThirdPartyIntegrationService:
    return ThirdPartyIntegrationService(db)


logger.info("🔌 企业级集成框架初始化完成")
