"""CDC 监听器单元测试

覆盖:
- CDC 事件捕获
- 软删除机制
- 数据源健康监控
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.core.compliance.cdc_listener import CDCListener, EXCLUDED_TABLES
from app.models.change_event import ChangeEvent, ChangeAction
from app.models.data_source_health import DataSourceHealth, DataSourceType, DataSourceStatus
from app.models.base import SoftDeleteMixin


# ════════════════════════════════════════════
# CDC 监听器测试
# ════════════════════════════════════════════

class TestCDCListener:
    """CDC 监听器功能测试"""

    def test_excluded_tables(self):
        """验证排除表列表正确"""
        assert "change_events" in EXCLUDED_TABLES
        assert "alembic_version" in EXCLUDED_TABLES
        assert "formula_ingredients" in EXCLUDED_TABLES
        assert "formula_peptides" in EXCLUDED_TABLES

    def test_listener_initialization(self):
        """测试监听器初始化"""
        listener = CDCListener()
        assert listener._enabled is False
        assert listener._current_user_id is None
        assert listener._current_ip is None
        assert len(listener._pending_events) == 0

    def test_set_context(self):
        """测试设置操作上下文"""
        listener = CDCListener()
        listener.set_context(user_id=42, ip_address="192.168.1.1")

        assert listener._current_user_id == 42
        assert listener._current_ip == "192.168.1.1"

    def test_serialize_value(self):
        """测试值序列化"""
        listener = CDCListener()

        # 基本类型
        assert listener._serialize_value(42) == 42
        assert listener._serialize_value("hello") == "hello"
        assert listener._serialize_value(3.14) == 3.14
        assert listener._serialize_value(True) is True
        assert listener._serialize_value(None) is None

        # datetime
        dt = datetime(2026, 6, 3, 12, 0, 0, tzinfo=timezone.utc)
        assert listener._serialize_value(dt) == dt.isoformat()

        # 列表和字典
        assert listener._serialize_value([1, 2, 3]) == [1, 2, 3]
        assert listener._serialize_value({"a": 1}) == {"a": 1}

    def test_get_entity_id(self):
        """测试获取实体 ID"""
        listener = CDCListener()

        # 模拟实体
        obj = MagicMock()
        obj.id = 123
        assert listener._get_entity_id(obj) == 123

        # 无 ID 的实体
        obj_no_id = MagicMock(spec=[])
        assert listener._get_entity_id(obj_no_id) is None


# ════════════════════════════════════════════
# 软删除测试
# ════════════════════════════════════════════

class TestSoftDelete:
    """软删除机制测试"""

    def test_soft_delete_mixin(self):
        """测试 SoftDeleteMixin 功能"""

        # 创建一个使用 SoftDeleteMixin 的测试类
        class TestModel(SoftDeleteMixin):
            def __init__(self):
                self.deleted_at = None

        obj = TestModel()

        # 初始状态：未删除
        assert obj.is_deleted is False
        assert obj.deleted_at is None

        # 软删除
        obj.soft_delete()
        assert obj.is_deleted is True
        assert obj.deleted_at is not None

        # 恢复
        obj.restore()
        assert obj.is_deleted is False
        assert obj.deleted_at is None

    def test_soft_delete_timestamp(self):
        """测试软删除时间戳"""
        from app.models.utils import now_utc_mapped as _now

        class TestModel(SoftDeleteMixin):
            def __init__(self):
                self.deleted_at = None

        obj = TestModel()
        before = _now()
        obj.soft_delete()
        after = _now()

        assert before <= obj.deleted_at <= after


# ════════════════════════════════════════════
# 数据源健康监控测试
# ════════════════════════════════════════════

class TestDataSourceHealth:
    """数据源健康监控测试"""

    def test_data_source_status_enum(self):
        """测试数据源状态枚举"""
        assert DataSourceStatus.HEALTHY.value == "healthy"
        assert DataSourceStatus.DEGRADED.value == "degraded"
        assert DataSourceStatus.UNHEALTHY.value == "unhealthy"
        assert DataSourceStatus.UNKNOWN.value == "unknown"

    def test_data_source_type_enum(self):
        """测试数据源类型枚举"""
        assert DataSourceType.TCMSP.value == "tcmsp"
        assert DataSourceType.DFBP.value == "dfbp"
        assert DataSourceType.NEO4J.value == "neo4j"
        assert DataSourceType.REDIS.value == "redis"
        assert DataSourceType.LLM.value == "llm"

    def test_health_record_properties(self):
        """测试健康记录属性"""
        record = DataSourceHealth(
            source_type=DataSourceType.TCMSP,
            source_name="TCMSP 数据库",
            status=DataSourceStatus.HEALTHY,
            latency_ms=150.0,
            sync_success_count=100,
            sync_failure_count=5,
        )

        assert record.is_available is True
        assert record.sync_success_rate == pytest.approx(95.24, abs=0.01)

    def test_health_record_unavailable(self):
        """测试不可用状态"""
        record = DataSourceHealth(
            source_type=DataSourceType.DFBP,
            source_name="DFBP 数据库",
            status=DataSourceStatus.UNHEALTHY,
        )

        assert record.is_available is False

    def test_health_record_to_dict(self):
        """测试转换为字典"""
        record = DataSourceHealth(
            source_type=DataSourceType.TCMSP,
            source_name="TCMSP 数据库",
            status=DataSourceStatus.HEALTHY,
            latency_ms=150.0,
        )

        d = record.to_dict()
        assert d["source_type"] == "tcmsp"
        assert d["source_name"] == "TCMSP 数据库"
        assert d["status"] == "healthy"
        assert d["latency_ms"] == 150.0
        assert "created_at" in d
        assert "updated_at" in d


# ════════════════════════════════════════════
# 变更事件模型测试
# ════════════════════════════════════════════

class TestChangeEvent:
    """变更事件模型测试"""

    def test_change_action_enum(self):
        """测试变更操作枚举"""
        assert ChangeAction.INSERT.value == "INSERT"
        assert ChangeAction.UPDATE.value == "UPDATE"
        assert ChangeAction.DELETE.value == "DELETE"

    def test_change_event_creation(self):
        """测试变更事件创建"""
        event = ChangeEvent(
            entity_type="formulas",
            entity_id=123,
            action=ChangeAction.UPDATE,
            changed_fields=["name", "status"],
            old_values={"name": "旧名称"},
            new_values={"name": "新名称"},
            user_id=42,
        )

        assert event.entity_type == "formulas"
        assert event.entity_id == 123
        assert event.action == ChangeAction.UPDATE
        assert event.changed_fields == ["name", "status"]
        assert event.user_id == 42

    def test_change_event_to_dict(self):
        """测试变更事件转换为字典"""
        event = ChangeEvent(
            entity_type="formulas",
            entity_id=123,
            action=ChangeAction.INSERT,
            new_values={"name": "测试配方"},
        )

        d = event.to_dict()
        assert d["entity_type"] == "formulas"
        assert d["entity_id"] == 123
        assert d["action"] == "INSERT"
        assert d["new_values"] == {"name": "测试配方"}
