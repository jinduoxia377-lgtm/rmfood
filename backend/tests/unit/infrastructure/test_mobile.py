"""
移动端后端服务测试（M2.6）
"""
import pytest
from app.infrastructure.mobile_service import MobileService
from app.application.mobile_facade import MobileFacade


@pytest.fixture
def service():
    return MobileService()


@pytest.fixture
def facade():
    # MobileFacade 现在通过构造函数注入 MobileServicePort 依赖
    return MobileFacade(MobileService())


class TestMobileDashboard:
    """仪表盘测试"""

    @pytest.mark.asyncio
    async def test_get_dashboard(self, service):
        dashboard = await service.get_dashboard("user-001")
        assert dashboard.total_formulas >= 0
        assert dashboard.pending_review >= 0
        assert len(dashboard.stats) > 0

    @pytest.mark.asyncio
    async def test_dashboard_has_alerts(self, service):
        dashboard = await service.get_dashboard("user-001")
        assert len(dashboard.alerts) >= 1
        for alert in dashboard.alerts:
            assert "message" in alert
            assert "type" in alert


class TestSync:
    """离线同步测试"""

    @pytest.mark.asyncio
    async def test_sync_push(self, service):
        items = [
            {
                "entity_type": "formula",
                "action": "update",
                "entity_id": "f-001",
                "data": {"name": "测试更新"},
                "timestamp": "2026-06-01T00:00:00",
            }
        ]
        results = await service.sync_push(items)
        assert len(results) == 1
        assert results[0]["status"] == "synced"
        assert results[0]["entity_id"] == "f-001"

    @pytest.mark.asyncio
    async def test_sync_push_empty(self, service):
        results = await service.sync_push([])
        assert results == []

    @pytest.mark.asyncio
    async def test_sync_pull(self, service):
        changes = await service.sync_pull()
        assert len(changes) >= 0


class TestNotifications:
    """通知测试"""

    @pytest.mark.asyncio
    async def test_get_notifications(self, service):
        notifs = await service.get_notifications("user-001", limit=10)
        assert len(notifs) <= 10
        if notifs:
            assert notifs[0].title
            assert notifs[0].notification_type

    @pytest.mark.asyncio
    async def test_mark_read(self, service):
        result = await service.mark_notification_read("n-001")
        assert result is True

    @pytest.mark.asyncio
    async def test_notification_types(self, service):
        notifs = await service.get_notifications("user-001", limit=20)
        types = {n.notification_type for n in notifs}
        assert "approval" in types
        assert "alert" in types


class TestTraceability:
    """溯源测试"""

    @pytest.mark.asyncio
    async def test_trace_valid_batch(self, service):
        record = await service.trace_product("B20260501")
        assert record is not None
        assert record.batch_id == "B20260501"
        assert len(record.ingredients) >= 1
        assert len(record.custody_chain) >= 2

    @pytest.mark.asyncio
    async def test_trace_empty_batch(self, service):
        record = await service.trace_product("")
        assert record is None

    @pytest.mark.asyncio
    async def test_trace_has_quality_records(self, service):
        record = await service.trace_product("B20260501")
        assert len(record.quality_records) >= 1
        assert record.quality_records[0]["result"] == "合格"


class TestMobileFacade:
    """Facade 集成测试"""

    @pytest.mark.asyncio
    async def test_facade_dashboard(self, facade):
        dashboard = await facade.get_dashboard("user-001")
        assert dashboard is not None

    @pytest.mark.asyncio
    async def test_facade_quick_approve(self, facade):
        result = await facade.quick_approve("F-001", "user-001")
        assert result["status"] == "approved"
        assert result["formula_id"] == "F-001"

    @pytest.mark.asyncio
    async def test_facade_pending_review(self, facade):
        formulas = await facade.get_pending_review(limit=5)
        assert len(formulas) <= 5
        for f in formulas:
            assert "name" in f
            assert "submitter" in f
