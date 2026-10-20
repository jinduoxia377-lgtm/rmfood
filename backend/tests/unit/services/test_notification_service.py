"""
Unit tests for app.services.notification.notification_service.NotificationService.

Covers:
- create_notification: creates a notification with correct fields
- get_notifications: returns paginated notification list
- mark_as_read: marks a single notification as read
- delete_notification: removes a notification
- get_unread_count: returns correct unread count
- mark_all_as_read: bulk mark as read
- bulk_create: batch notification creation
- clear_all: removes all notifications for a user
- _normalize_type: normalizes notification type strings
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.models.enums import NotificationType

pytestmark = pytest.mark.skip(reason="app.services.notification.notification_service 已删除，通知服务已迁移，待重写")


# ════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════

def _make_notification_obj(
    id: int = 1,
    user_id: int = 10,
    type_: NotificationType = NotificationType.SYSTEM,
    title: str = "Test",
    content: str | None = None,
    is_read: bool = False,
    read_at: datetime | None = None,
    created_at: datetime | None = None,
    metadata_: dict | None = None,
) -> MagicMock:
    """Create a mock Notification ORM object."""
    notif = MagicMock()
    notif.id = id
    notif.user_id = user_id
    notif.type = type_
    notif.title = title
    notif.content = content
    notif.is_read = is_read
    notif.read_at = read_at
    notif.created_at = created_at or datetime.now(timezone.utc)
    notif.metadata_ = metadata_ or {}
    return notif


def _make_mock_db() -> AsyncMock:
    """Create a mock AsyncSession."""
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    db.execute = AsyncMock()
    return db


# ════════════════════════════════════════════
# create_notification
# ════════════════════════════════════════════

class TestCreateNotification:
    """NotificationService.create_notification writes to DB and returns the object."""

    @pytest.mark.asyncio
    async def test_creates_notification_with_correct_fields(self):
        db = _make_mock_db()
        service = NotificationService(db)

        mock_notif = _make_notification_obj(
            id=1, user_id=10, title="New alert", content="Details here"
        )

        # db.add captures the notification; db.refresh makes it look persisted
        def capture_add(obj):
            obj.id = mock_notif.id
            obj.created_at = mock_notif.created_at

        db.add.side_effect = capture_add
        db.refresh.side_effect = lambda obj: None

        result = await service.create_notification(
            recipient_id=10,
            type_="system",
            title="New alert",
            content="Details here",
        )

        db.add.assert_called_once()
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_creates_notification_with_metadata(self):
        db = _make_mock_db()
        service = NotificationService(db)
        db.refresh.side_effect = lambda obj: None

        metadata = {"formula_id": 42, "action": "updated"}
        result = await service.create_notification(
            recipient_id=5,
            type_="prompt_updated",
            title="Formula changed",
            metadata=metadata,
        )

        added_obj = db.add.call_args[0][0]
        assert added_obj.metadata_ == metadata

    @pytest.mark.asyncio
    async def test_creates_notification_with_default_empty_metadata(self):
        db = _make_mock_db()
        service = NotificationService(db)
        db.refresh.side_effect = lambda obj: None

        await service.create_notification(
            recipient_id=5,
            type_="system",
            title="No meta",
        )

        added_obj = db.add.call_args[0][0]
        assert added_obj.metadata_ == {}

    @pytest.mark.asyncio
    async def test_title_truncated_to_200_chars(self):
        db = _make_mock_db()
        service = NotificationService(db)
        db.refresh.side_effect = lambda obj: None

        long_title = "x" * 500
        await service.create_notification(
            recipient_id=1,
            type_="system",
            title=long_title,
        )

        added_obj = db.add.call_args[0][0]
        assert len(added_obj.title) == 200

    @pytest.mark.asyncio
    async def test_notification_starts_unread(self):
        db = _make_mock_db()
        service = NotificationService(db)
        db.refresh.side_effect = lambda obj: None

        await service.create_notification(
            recipient_id=1,
            type_="system",
            title="Unread test",
        )

        added_obj = db.add.call_args[0][0]
        assert added_obj.is_read is False

    @pytest.mark.asyncio
    async def test_sets_user_id_correctly(self):
        db = _make_mock_db()
        service = NotificationService(db)
        db.refresh.side_effect = lambda obj: None

        await service.create_notification(
            recipient_id=99,
            type_="system",
            title="User check",
        )

        added_obj = db.add.call_args[0][0]
        assert added_obj.user_id == 99


# ════════════════════════════════════════════
# get_notifications
# ════════════════════════════════════════════

class TestGetNotifications:
    """NotificationService.get_notifications returns paginated results."""

    @pytest.mark.asyncio
    async def test_returns_paginated_structure(self):
        db = _make_mock_db()
        service = NotificationService(db)

        notif = _make_notification_obj(id=1, user_id=10, title="Test")

        # Two execute calls: count query, then data query
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        data_result = MagicMock()
        data_result.scalars.return_value.all.return_value = [notif]

        unread_result = MagicMock()
        unread_result.scalar.return_value = 1

        db.execute.side_effect = [count_result, unread_result, data_result]

        result = await service.get_notifications(user_id=10, page=1, page_size=20)

        assert "notifications" in result
        assert "total" in result
        assert "unread_count" in result
        assert "page" in result
        assert "page_size" in result
        assert result["page"] == 1
        assert result["page_size"] == 20
        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_returns_notification_dicts(self):
        db = _make_mock_db()
        service = NotificationService(db)

        now = datetime.now(timezone.utc)
        notif = _make_notification_obj(
            id=42, user_id=10, title="Hello", content="World",
            created_at=now, is_read=False,
        )

        count_result = MagicMock()
        count_result.scalar.return_value = 1

        data_result = MagicMock()
        data_result.scalars.return_value.all.return_value = [notif]

        unread_result = MagicMock()
        unread_result.scalar.return_value = 0

        db.execute.side_effect = [count_result, unread_result, data_result]

        result = await service.get_notifications(user_id=10)
        items = result["notifications"]

        assert len(items) == 1
        assert items[0]["id"] == 42
        assert items[0]["title"] == "Hello"
        assert items[0]["content"] == "World"
        assert items[0]["is_read"] is False

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_notifications(self):
        db = _make_mock_db()
        service = NotificationService(db)

        count_result = MagicMock()
        count_result.scalar.return_value = 0

        data_result = MagicMock()
        data_result.scalars.return_value.all.return_value = []

        unread_result = MagicMock()
        unread_result.scalar.return_value = 0

        db.execute.side_effect = [count_result, unread_result, data_result]

        result = await service.get_notifications(user_id=999)
        assert result["notifications"] == []
        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_respects_type_filter(self):
        db = _make_mock_db()
        service = NotificationService(db)

        count_result = MagicMock()
        count_result.scalar.return_value = 0

        data_result = MagicMock()
        data_result.scalars.return_value.all.return_value = []

        unread_result = MagicMock()
        unread_result.scalar.return_value = 0

        db.execute.side_effect = [count_result, unread_result, data_result]

        result = await service.get_notifications(
            user_id=10, type_filter="prompt_updated"
        )
        assert result["notifications"] == []


# ════════════════════════════════════════════
# mark_as_read
# ════════════════════════════════════════════

class TestMarkAsRead:
    """NotificationService.mark_as_read sets is_read=True and read_at."""

    @pytest.mark.asyncio
    async def test_marks_notification_as_read(self):
        db = _make_mock_db()
        service = NotificationService(db)

        notif = _make_notification_obj(id=1, user_id=10, is_read=False)
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = notif
        db.execute.return_value = result_mock

        success = await service.mark_as_read(notification_id=1, user_id=10)

        assert success is True
        assert notif.is_read is True
        assert notif.read_at is not None
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_false_when_notification_not_found(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        success = await service.mark_as_read(notification_id=999, user_id=10)

        assert success is False
        db.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_returns_true_when_already_read(self):
        db = _make_mock_db()
        service = NotificationService(db)

        notif = _make_notification_obj(id=1, user_id=10, is_read=True)
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = notif
        db.execute.return_value = result_mock

        success = await service.mark_as_read(notification_id=1, user_id=10)

        assert success is True
        # Should not commit since already read
        db.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_returns_false_when_wrong_user(self):
        """Notification belongs to a different user."""
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        success = await service.mark_as_read(notification_id=1, user_id=999)

        assert success is False


# ════════════════════════════════════════════
# delete_notification
# ════════════════════════════════════════════

class TestDeleteNotification:
    """NotificationService.delete_notification removes a notification."""

    @pytest.mark.asyncio
    async def test_deletes_existing_notification(self):
        db = _make_mock_db()
        service = NotificationService(db)

        notif = _make_notification_obj(id=1, user_id=10)
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = notif
        db.execute.return_value = result_mock

        success = await service.delete_notification(notification_id=1, user_id=10)

        assert success is True
        db.delete.assert_awaited_once_with(notif)
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_false_when_notification_not_found(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        success = await service.delete_notification(notification_id=999, user_id=10)

        assert success is False
        db.delete.assert_not_awaited()
        db.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_returns_false_when_wrong_user(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        success = await service.delete_notification(notification_id=1, user_id=999)

        assert success is False


# ════════════════════════════════════════════
# get_unread_count
# ════════════════════════════════════════════

class TestGetUnreadCount:
    """NotificationService.get_unread_count returns the count of unread notifications."""

    @pytest.mark.asyncio
    async def test_returns_unread_count(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar.return_value = 5
        db.execute.return_value = result_mock

        count = await service.get_unread_count(user_id=10)

        assert count == 5

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_notifications(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        db.execute.return_value = result_mock

        count = await service.get_unread_count(user_id=999)

        assert count == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_all_read(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar.return_value = 0
        db.execute.return_value = result_mock

        count = await service.get_unread_count(user_id=10)

        assert count == 0


# ════════════════════════════════════════════
# mark_all_as_read
# ════════════════════════════════════════════

class TestMarkAllAsRead:
    """NotificationService.mark_all_as_read bulk-updates unread notifications."""

    @pytest.mark.asyncio
    async def test_marks_all_as_read(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.rowcount = 3
        db.execute.return_value = result_mock

        count = await service.mark_all_as_read(user_id=10)

        assert count == 3
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_unread(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.rowcount = 0
        db.execute.return_value = result_mock

        count = await service.mark_all_as_read(user_id=10)

        assert count == 0

    @pytest.mark.asyncio
    async def test_respects_type_filter(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.rowcount = 2
        db.execute.return_value = result_mock

        count = await service.mark_all_as_read(user_id=10, type_filter="prompt_updated")

        assert count == 2


# ════════════════════════════════════════════
# bulk_create
# ════════════════════════════════════════════

class TestBulkCreate:
    """NotificationService.bulk_create creates notifications for multiple recipients."""

    @pytest.mark.asyncio
    async def test_creates_notification_for_each_recipient(self):
        db = _make_mock_db()
        service = NotificationService(db)
        db.refresh.side_effect = lambda obj: None

        count = await service.bulk_create(
            recipients=[1, 2, 3],
            type_="system",
            title="Team announcement",
            content="Hello team!",
        )

        assert count == 3
        assert db.add.call_count == 3

    @pytest.mark.asyncio
    async def test_returns_zero_for_empty_recipients(self):
        db = _make_mock_db()
        service = NotificationService(db)

        count = await service.bulk_create(
            recipients=[],
            type_="system",
            title="Empty",
        )

        assert count == 0
        db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_continues_on_individual_failure(self):
        db = _make_mock_db()
        service = NotificationService(db)

        # First call raises, second succeeds
        call_count = 0
        original_commit = db.commit

        async def failing_commit():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("DB error")

        db.commit = failing_commit
        db.refresh.side_effect = lambda obj: None

        count = await service.bulk_create(
            recipients=[1, 2],
            type_="system",
            title="Partial fail",
        )

        # One succeeded, one failed
        assert count == 1


# ════════════════════════════════════════════
# clear_all
# ════════════════════════════════════════════

class TestClearAll:
    """NotificationService.clear_all deletes all notifications for a user."""

    @pytest.mark.asyncio
    async def test_clears_all_notifications(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.rowcount = 10
        db.execute.return_value = result_mock

        count = await service.clear_all(user_id=10)

        assert count == 10
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_clears_with_type_filter(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.rowcount = 3
        db.execute.return_value = result_mock

        count = await service.clear_all(user_id=10, type_filter="prompt_updated")

        assert count == 3

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_notifications(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.rowcount = 0
        db.execute.return_value = result_mock

        count = await service.clear_all(user_id=999)

        assert count == 0


# ════════════════════════════════════════════
# _normalize_type
# ════════════════════════════════════════════

class TestNormalizeType:
    """NotificationService._normalize_type converts string to NotificationType enum."""

    def test_normalizes_known_enum_value(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result = service._normalize_type("system")
        assert result == NotificationType.SYSTEM

    def test_normalizes_string_to_enum(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result = service._normalize_type("formula_review")
        assert result == NotificationType.FORMULA_REVIEW

    def test_defaults_to_system_for_unknown_type(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result = service._normalize_type("prompt_updated")
        assert result == NotificationType.SYSTEM

    def test_defaults_to_system_for_completely_unknown(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result = service._normalize_type("totally_unknown_type")
        assert result == NotificationType.SYSTEM


# ════════════════════════════════════════════
# NotificationPreferences dataclass
# ════════════════════════════════════════════

class TestNotificationPreferences:
    """NotificationPreferences dataclass defaults."""

    def test_defaults_all_enabled(self):
        prefs = NotificationPreferences()
        assert prefs.email_enabled is True
        assert prefs.push_enabled is True
        assert prefs.prompt_updated is True
        assert prefs.prompt_created is True
        assert prefs.mention is True

    def test_quiet_hours_default_none(self):
        prefs = NotificationPreferences()
        assert prefs.quiet_hours_start is None
        assert prefs.quiet_hours_end is None


# ════════════════════════════════════════════
# NotificationDict dataclass
# ════════════════════════════════════════════

class TestNotificationDict:
    """NotificationDict dataclass construction."""

    def test_creates_with_required_fields(self):
        nd = NotificationDict(type="system", title="Test")
        assert nd.type == "system"
        assert nd.title == "Test"
        assert nd.content is None
        assert nd.recipient_ids == []
        assert nd.actor_id is None

    def test_creates_with_all_fields(self):
        nd = NotificationDict(
            type="mention",
            title="You were mentioned",
            content="Check this out",
            metadata={"formula_id": 1},
            recipient_ids=[1, 2, 3],
            actor_id=5,
        )
        assert nd.metadata == {"formula_id": 1}
        assert len(nd.recipient_ids) == 3
        assert nd.actor_id == 5


# ════════════════════════════════════════════
# NOTIFICATION_TYPES constant
# ════════════════════════════════════════════

class TestNotificationTypesConstant:
    """NOTIFICATION_TYPES lists all supported notification type strings."""

    def test_is_list(self):
        assert isinstance(NOTIFICATION_TYPES, list)

    def test_contains_expected_types(self):
        expected = [
            "prompt_updated", "prompt_created", "prompt_deleted",
            "member_joined", "member_left", "role_changed",
            "comment_added", "mention", "version_created",
            "invitation_received",
        ]
        for t in expected:
            assert t in NOTIFICATION_TYPES, f"Missing type: {t}"

    def test_all_entries_are_strings(self):
        for t in NOTIFICATION_TYPES:
            assert isinstance(t, str)


# ════════════════════════════════════════════
# get_preferences
# ════════════════════════════════════════════

class TestGetPreferences:
    """NotificationService.get_preferences returns user notification preferences."""

    @pytest.mark.asyncio
    async def test_returns_default_when_user_not_found(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        prefs = await service.get_preferences(user_id=999)

        assert isinstance(prefs, NotificationPreferences)
        assert prefs.email_enabled is True
        assert prefs.push_enabled is True

    @pytest.mark.asyncio
    async def test_returns_default_when_user_has_no_preferences(self):
        db = _make_mock_db()
        service = NotificationService(db)

        user = MagicMock()
        user.preferences = None
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = user
        db.execute.return_value = result_mock

        prefs = await service.get_preferences(user_id=10)

        assert isinstance(prefs, NotificationPreferences)
        assert prefs.email_enabled is True


# ════════════════════════════════════════════
# update_preferences
# ════════════════════════════════════════════

class TestUpdatePreferences:
    """NotificationService.update_preferences updates user preferences."""

    @pytest.mark.asyncio
    async def test_raises_when_user_not_found(self):
        db = _make_mock_db()
        service = NotificationService(db)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock

        with pytest.raises(ValueError, match="用户不存在"):
            await service.update_preferences(user_id=999, preferences={"email_enabled": False})

    @pytest.mark.asyncio
    async def test_updates_preferences(self):
        db = _make_mock_db()
        service = NotificationService(db)

        user = MagicMock()
        user.preferences = {"notification": {"email_enabled": True}}
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = user

        # First execute: find user for update. Second: find user for get_preferences
        user_for_get = MagicMock()
        user_for_get.preferences = {"notification": {"email_enabled": False}}
        result_mock2 = MagicMock()
        result_mock2.scalar_one_or_none.return_value = user_for_get

        db.execute.side_effect = [result_mock, result_mock2]

        prefs = await service.update_preferences(
            user_id=10, preferences={"email_enabled": False}
        )

        db.commit.assert_awaited_once()
        assert isinstance(prefs, NotificationPreferences)
