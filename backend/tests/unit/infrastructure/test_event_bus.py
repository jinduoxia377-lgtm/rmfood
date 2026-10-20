"""
InMemoryEventBus 单元测试

验证事件总线核心功能不依赖 Redis。
"""
import pytest
from datetime import datetime
from decimal import Decimal

pytestmark = pytest.mark.skip(reason="依赖已删除的 app.domain.entities 领域实体，待重写")

from app.infrastructure.event_bus import (
    InMemoryEventBus, serialize_event,
)


@pytest.fixture
def event_bus():
    bus = InMemoryEventBus()
    return bus


@pytest.fixture
def sample_event():
    return IngredientAddedEvent(
        formula_id=FormulaId(value="test-001"),
        ingredient_id="TCM-001",
        dosage_g=Decimal("10.0"),
    )


class TestEventSerialization:
    """事件序列化/反序列化测试"""

    def test_serialize_added_event(self, sample_event):
        result = serialize_event(sample_event)
        assert result["event_type"] == "IngredientAddedEvent"
        assert result["event_data"]["formula_id"]["value"] == "test-001"
        assert result["event_data"]["ingredient_id"] == "TCM-001"
        assert result["event_data"]["dosage_g"] == "10.0"
        assert "event_id" in result
        assert "timestamp" in result

    def test_serialize_submitted_event(self):
        event = FormulaSubmittedEvent(formula_id=FormulaId(value="f-002"))
        result = serialize_event(event)
        assert result["event_type"] == "FormulaSubmittedEvent"
        assert result["event_data"]["formula_id"]["value"] == "f-002"


class TestInMemoryEventBus:
    """内存事件总线功能测试"""

    @pytest.mark.asyncio
    async def test_publish_event(self, event_bus, sample_event):
        await event_bus.start()
        await event_bus.publish(sample_event)
        assert len(event_bus.published_events) == 1
        published = event_bus.published_events[0]
        assert published["event_type"] == "IngredientAddedEvent"

    @pytest.mark.asyncio
    async def test_subscribe_and_handle(self, event_bus, sample_event):
        handled = []

        async def handler(event_data):
            handled.append(event_data)

        event_bus.subscribe("IngredientAddedEvent", handler)
        await event_bus.start()
        await event_bus.publish(sample_event)

        assert len(handled) == 1
        assert handled[0]["event_type"] == "IngredientAddedEvent"
        assert handled[0]["event_data"]["ingredient_id"] == "TCM-001"

    @pytest.mark.asyncio
    async def test_wildcard_subscriber(self, event_bus):
        """ '*' 通配符订阅应接收所有事件 """
        handled = []

        async def wildcard_handler(event_data):
            handled.append(event_data["event_type"])

        event_bus.subscribe("*", wildcard_handler)
        await event_bus.start()

        await event_bus.publish(IngredientAddedEvent(
            formula_id=FormulaId(value="f-001"),
            ingredient_id="TCM-001",
            dosage_g=Decimal("5.0"),
        ))
        await event_bus.publish(FormulaSubmittedEvent(
            formula_id=FormulaId(value="f-002"),
        ))

        assert len(handled) == 2
        assert handled == ["IngredientAddedEvent", "FormulaSubmittedEvent"]

    @pytest.mark.asyncio
    async def test_unsubscribe(self, event_bus, sample_event):
        handled = []

        async def handler(event_data):
            handled.append(event_data)

        event_bus.subscribe("IngredientAddedEvent", handler)
        event_bus.unsubscribe("IngredientAddedEvent", handler)
        await event_bus.start()
        await event_bus.publish(sample_event)

        assert len(handled) == 0  # 取消订阅后不应再收到

    @pytest.mark.asyncio
    async def test_handler_error_does_not_block(self, event_bus, sample_event):
        """一个处理器的异常不应影响其他处理器"""
        results = []

        async def failing_handler(event_data):
            raise ValueError("模拟失败")

        async def normal_handler(event_data):
            results.append(event_data)

        event_bus.subscribe("IngredientAddedEvent", failing_handler)
        event_bus.subscribe("IngredientAddedEvent", normal_handler)
        await event_bus.start()
        await event_bus.publish(sample_event)

        assert len(results) == 1  # 正常处理器仍被调用

    @pytest.mark.asyncio
    async def test_multiple_events(self, event_bus):
        """批量发布多个事件"""
        await event_bus.start()
        events = [
            IngredientAddedEvent(
                formula_id=FormulaId(value=f"f-{i}"),
                ingredient_id=f"TCM-{i:03d}",
                dosage_g=Decimal(str(i * 1.5)),
            )
            for i in range(10)
        ]
        for event in events:
            await event_bus.publish(event)

        assert len(event_bus.published_events) == 10

    @pytest.mark.asyncio
    async def test_clear(self, event_bus, sample_event):
        """clear() 应清空已发布事件"""
        await event_bus.start()
        await event_bus.publish(sample_event)
        assert len(event_bus.published_events) == 1
        event_bus.clear()
        assert len(event_bus.published_events) == 0

    @pytest.mark.asyncio
    async def test_publish_from_domain_entity(self, event_bus):
        """验证领域实体产生的事件可通过总线发布"""
        formula = Formula(
            id=FormulaId(value="f-003"),
            name="测试配方",
            version="1.0.0",
            description="",
            ingredients=[],
            target_effects=[EffectCategory.ANTIOXIDANT],
            status=FormulaStatus.DRAFT,
            author_id="user-001",
            organization_id="org-001",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        # 通过领域方法触发事件
        ingredient = Ingredient(
            tcm_id="TCM-010",
            name_cn="当归",
            name_en="Angelica",
            dosage_g=Decimal("6.0"),
            dosage_min_g=Decimal("3.0"),
            dosage_max_g=Decimal("12.0"),
            category="根茎类",
        )
        formula.add_ingredient(ingredient)
        events = formula.collect_events()

        await event_bus.start()
        for event in events:
            await event_bus.publish(event)

        assert len(event_bus.published_events) == 1
        assert event_bus.published_events[0]["event_type"] == "IngredientAddedEvent"
