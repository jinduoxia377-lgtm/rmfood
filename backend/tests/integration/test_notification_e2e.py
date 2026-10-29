"""通知模块端到端（E2E）集成测试

覆盖真实业务链路（真实 PostgreSQL 会话 + NotificationService + v1 通知路由）：

1. 创建通知：``NotificationService(db).create_notification`` 后通过
   ``get_user_notifications`` 能查到记录，字段完整（type/title/content/is_read/metadata/link）。
2. 偏好持久化：向 ``notification_preferences`` 写入偏好（直接操作模型），再读取一致。
3. 偏好过滤：事件开关 False / enabled=False / 分类关闭时，
   ``create_notification`` 返回 None 且不产生任何记录。
4. 标记已读/未读数：创建通知后 unread_count 增加，``mark_as_read`` 后未读数减少。
5. v1 API：通过 httpx AsyncClient 调用 GET/PUT/DELETE ``/api/v1/notifications*`` 接口，
   验证 CSRF 双提交（GET 获取 csrf_token cookie，PUT/DELETE 带 X-CSRF-Token 头）。

运行方式（本机缺少 faker/pytest_timeout 等插件，务必使用）：
    cd D:\\RMFOODFP\\backend
    $env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
    .\\venv\\Scripts\\python.exe -m pytest tests/integration/test_notification_e2e.py -o addopts= -p pytest_asyncio --no-header -q
"""
import pytest
from sqlalchemy import delete, select, func

from app.models import Notification, NotificationPreference, NotificationType, User
from app.models.enums import UserRole
from app.core.realtime.notification_center import (
    NotificationService,
    NotificationCategory,
    NotificationPriority,
)


async def _cleanup_user(db, user_id: int) -> None:
    """删除指定用户的测试数据（通知/偏好/用户），保证测试可重复执行。"""
    await db.execute(delete(Notification).where(Notification.user_id == user_id))
    await db.execute(
        delete(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()


async def _count_notifications(db, user_id: int) -> int:
    """统计指定用户的通知记录数。"""
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id)
    )
    return result.scalar() or 0


# ══════════════════════════════════════════════
# 1. 创建通知
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_create_notification_fields(db_session, create_user):
    """创建通知后 get_user_notifications 能查到完整字段。"""
    user = await create_user(username="notif_e2e_create", role=UserRole.RESEARCHER)
    try:
        svc = NotificationService(db_session)
        notif = await svc.create_notification(
            user_id=user.id,
            type_=NotificationType.FORMULA_REVIEW,
            title="配方审核通知",
            content="您的配方已提交审核",
            link="/formulas/42",
            metadata={"formula_id": 42, "reviewer": "admin"},
            category=NotificationCategory.WORKFLOW,
            priority=NotificationPriority.HIGH,
        )

        assert notif is not None
        assert notif.user_id == user.id
        assert notif.is_read is False

        result = await svc.get_user_notifications(user_id=user.id)
        assert result["pagination"]["total"] == 1
        assert result["unread_count"] == 1

        item = result["items"][0]
        assert item["id"] == notif.id
        assert item["type"] == NotificationType.FORMULA_REVIEW.value
        assert item["title"] == "配方审核通知"
        assert item["content"] == "您的配方已提交审核"
        assert item["is_read"] is False
        assert item["link"] == "/formulas/42"
        assert item["metadata"]["formula_id"] == 42
        assert item["metadata"]["category"] == NotificationCategory.WORKFLOW.value
        assert item["metadata"]["priority"] == NotificationPriority.HIGH.value
    finally:
        await _cleanup_user(db_session, user.id)


# ══════════════════════════════════════════════
# 2. 偏好持久化
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_preference_persistence_orm(db_session, create_user):
    """向 notification_preferences 写入偏好后，再读取结果一致。"""
    user = await create_user(username="notif_e2e_pref_orm", role=UserRole.RESEARCHER)
    try:
        # 直接操作模型写入偏好（与 v1 PUT /preferences 落库的 settings 结构一致）
        db_session.add(
            NotificationPreference(
                user_id=user.id,
                email_enabled=False,
                in_app_enabled=True,
                webhook_enabled=True,
                settings={
                    "formula_review": False,
                    "experiment_complete": True,
                    "system_alert": True,
                    "ai_task_complete": False,
                    "categories": {"workflow": True, "system": False},
                    "quiet_hours": {"start": "22:00", "end": "08:00"},
                    "digest_mode": True,
                    "digest_frequency": "daily",
                },
            )
        )
        await db_session.flush()

        # 通过 service 读取
        svc = NotificationService(db_session)
        loaded = await svc._get_user_preference(user.id)
        assert loaded.enabled is True
        assert loaded.channel_preferences["email"] is False
        assert loaded.channel_preferences["in_app"] is True
        assert loaded.channel_preferences["websocket"] is True
        assert loaded.settings["formula_review"] is False
        assert loaded.settings["experiment_complete"] is True
        assert loaded.settings["system_alert"] is True
        assert loaded.settings["ai_task_complete"] is False
        assert loaded.category_enabled == {"workflow": True, "system": False}
        assert loaded.quiet_hours_start == "22:00"
        assert loaded.quiet_hours_end == "08:00"

        # 直接查库核对落库字段
        row_result = await db_session.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id
            )
        )
        row = row_result.scalar_one()
        assert row.email_enabled is False
        assert row.in_app_enabled is True
        assert row.webhook_enabled is True
        assert row.settings["formula_review"] is False
        assert row.settings["experiment_complete"] is True
        assert row.settings["system_alert"] is True
        assert row.settings["ai_task_complete"] is False
        assert row.settings["categories"] == {"workflow": True, "system": False}
        assert row.settings["quiet_hours"] == {"start": "22:00", "end": "08:00"}
    finally:
        await _cleanup_user(db_session, user.id)


# ══════════════════════════════════════════════
# 3. 偏好过滤
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_preference_filter_event_toggle_off(db_session, create_user):
    """事件开关 formula_review=False 时，create_notification 返回 None 且不落库。"""
    user = await create_user(username="notif_e2e_filter_toggle", role=UserRole.RESEARCHER)
    try:
        db_session.add(
            NotificationPreference(
                user_id=user.id,
                email_enabled=True,
                in_app_enabled=True,
                webhook_enabled=True,
                settings={"formula_review": False, "categories": {}},
            )
        )
        await db_session.flush()

        svc = NotificationService(db_session)
        notif = await svc.create_notification(
            user_id=user.id,
            type_=NotificationType.FORMULA_REVIEW,
            title="配方审核通知",
            content="不应创建",
        )
        assert notif is None
        assert await _count_notifications(db_session, user.id) == 0

        result = await svc.get_user_notifications(user_id=user.id)
        assert result["pagination"]["total"] == 0
        assert result["unread_count"] == 0
    finally:
        await _cleanup_user(db_session, user.id)


@pytest.mark.asyncio
async def test_preference_filter_enabled_false(db_session, create_user):
    """enabled=False（in_app_enabled=False）时，create_notification 返回 None 且不落库。"""
    user = await create_user(username="notif_e2e_filter_disabled", role=UserRole.RESEARCHER)
    try:
        db_session.add(
            NotificationPreference(
                user_id=user.id,
                email_enabled=True,
                in_app_enabled=False,  # 整体关闭站内信 → UserNotificationPreference.enabled=False
                webhook_enabled=False,
                settings={},
            )
        )
        await db_session.flush()

        svc = NotificationService(db_session)
        notif = await svc.create_notification(
            user_id=user.id,
            type_=NotificationType.SYSTEM,
            title="系统通知",
            content="不应创建",
        )
        assert notif is None
        assert await _count_notifications(db_session, user.id) == 0

        result = await svc.get_user_notifications(user_id=user.id)
        assert result["pagination"]["total"] == 0
        assert result["unread_count"] == 0
    finally:
        await _cleanup_user(db_session, user.id)


@pytest.mark.asyncio
async def test_preference_filter_category_off(db_session, create_user):
    """分类关闭（categories.workflow=False）时，create_notification 返回 None 且不落库。"""
    user = await create_user(username="notif_e2e_filter_category", role=UserRole.RESEARCHER)
    try:
        db_session.add(
            NotificationPreference(
                user_id=user.id,
                email_enabled=True,
                in_app_enabled=True,
                webhook_enabled=True,
                settings={"categories": {"workflow": False}},
            )
        )
        await db_session.flush()

        svc = NotificationService(db_session)
        notif = await svc.create_notification(
            user_id=user.id,
            type_=NotificationType.FORMULA_REVIEW,
            title="配方审核通知",
            content="不应创建",
            category=NotificationCategory.WORKFLOW,
        )
        assert notif is None
        assert await _count_notifications(db_session, user.id) == 0
    finally:
        await _cleanup_user(db_session, user.id)


# ══════════════════════════════════════════════
# 4. 标记已读 / 未读数
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_mark_as_read_and_unread_count(db_session, create_user):
    """创建通知后 unread_count 增加，mark_as_read / mark_all_as_read 后未读数减少。"""
    user = await create_user(username="notif_e2e_read", role=UserRole.RESEARCHER)
    try:
        svc = NotificationService(db_session)
        n1 = await svc.create_notification(
            user_id=user.id,
            type_=NotificationType.SYSTEM,
            title="通知1",
            content="内容1",
        )
        n2 = await svc.create_notification(
            user_id=user.id,
            type_=NotificationType.EXPERIMENT_COMPLETE,
            title="通知2",
            content="内容2",
        )
        assert n1 is not None and n2 is not None

        result = await svc.get_user_notifications(user_id=user.id)
        assert result["unread_count"] == 2
        assert result["pagination"]["total"] == 2

        # 标记一条已读
        marked = await svc.mark_as_read(user_id=user.id, notification_ids=[str(n1.id)])
        assert marked == 1

        result = await svc.get_user_notifications(user_id=user.id)
        assert result["unread_count"] == 1
        items = {item["id"]: item for item in result["items"]}
        assert items[n1.id]["is_read"] is True
        assert items[n2.id]["is_read"] is False

        # 全部标记已读
        marked_all = await svc.mark_all_as_read(user_id=user.id)
        assert marked_all == 1

        result = await svc.get_user_notifications(user_id=user.id)
        assert result["unread_count"] == 0
        assert all(item["is_read"] for item in result["items"])
    finally:
        await _cleanup_user(db_session, user.id)


# ══════════════════════════════════════════════
# 5. v1 API（带 CSRF 双提交）
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_v1_notification_api_flow(db_session, create_user, async_client):
    """通过 v1 通知接口验证列表/未读数/标记已读/偏好读写，PUT 带 X-CSRF-Token。"""
    from app.services.auth import create_access_token

    user = await create_user(username="notif_e2e_api", role=UserRole.RESEARCHER)
    await db_session.commit()
    try:
        # 业务链路创建通知（服务层真实落库）
        svc = NotificationService(db_session)
        notif = await svc.create_notification(
            user_id=user.id,
            type_=NotificationType.FORMULA_REVIEW,
            title="配方审核通知",
            content="您的配方已提交审核",
            link="/formulas/100",
            metadata={"formula_id": 100},
        )
        await db_session.commit()
        assert notif is not None

        token = create_access_token(user_id=user.id, role=UserRole.RESEARCHER.value)
        headers = {"Authorization": f"Bearer {token}"}

        # GET 列表（同时获取 csrf_token cookie）
        resp = await async_client.get("/api/v1/notifications", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["unread_count"] == 1
        item = body["notifications"][0]
        assert item["id"] == notif.id
        assert item["type"] == NotificationType.FORMULA_REVIEW.value
        assert item["title"] == "配方审核通知"
        assert item["content"] == "您的配方已提交审核"
        assert item["link"] == "/formulas/100"
        assert item["is_read"] is False
        assert item["metadata"]["formula_id"] == 100

        # GET 未读数（响应会刷新 csrf cookie，以下一个 GET 返回的 token 为准）
        resp = await async_client.get("/api/v1/notifications/unread-count", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["unread_count"] == 1
        csrf_token = resp.cookies.get("csrf_token")
        assert csrf_token

        # PUT 标记已读（带 X-CSRF-Token）
        resp = await async_client.put(
            f"/api/v1/notifications/{notif.id}/read",
            headers={**headers, "X-CSRF-Token": csrf_token},
        )
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

        # 未读数减少
        resp = await async_client.get("/api/v1/notifications/unread-count", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["unread_count"] == 0
        csrf_token = resp.cookies.get("csrf_token")

        # PUT 通知偏好（带 X-CSRF-Token）
        resp = await async_client.put(
            "/api/v1/notifications/preferences",
            headers={**headers, "X-CSRF-Token": csrf_token},
            json={
                "formula_review": False,
                "experiment_complete": True,
                "in_app_enabled": True,
                "email_enabled": False,
            },
        )
        assert resp.status_code == 200

        # GET 偏好（读取一致）
        resp = await async_client.get("/api/v1/notifications/preferences", headers=headers)
        assert resp.status_code == 200
        prefs = resp.json()["preferences"]
        assert prefs["formula_review"] is False
        assert prefs["experiment_complete"] is True
        assert prefs["in_app_enabled"] is True
        assert prefs["email_enabled"] is False
    finally:
        await _cleanup_user(db_session, user.id)