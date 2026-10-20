"""app/core/multi_tenant/multi_tenant_service.py 单元测试

覆盖组织角色/套餐/资源枚举、套餐限制常量与 slug 生成。
"""
import pytest

from app.core.multi_tenant.multi_tenant_service import (
    OrganizationRole,
    OrganizationPlan,
    ResourceType,
    PlanLimits,
    PLAN_LIMITS,
    PRICING,
    OrganizationService,
)


class TestEnums:
    def test_organization_role_values(self):
        assert OrganizationRole.OWNER.value == "owner"
        assert OrganizationRole.ADMIN.value == "admin"
        assert OrganizationRole.MEMBER.value == "member"
        assert OrganizationRole.VIEWER.value == "viewer"

    def test_organization_plan_values(self):
        assert OrganizationPlan.FREE.value == "free"
        assert OrganizationPlan.PRO.value == "pro"
        assert OrganizationPlan.ENTERPRISE.value == "enterprise"

    def test_resource_type_values(self):
        assert ResourceType.MEMBERS.value == "members"
        assert ResourceType.FORMULAS.value == "formulas"
        assert ResourceType.AI_GENERATIONS.value == "ai_generations"


class TestPlanLimits:
    def test_plan_limits_dataclass(self):
        limits = PlanLimits(
            plan=OrganizationPlan.FREE,
            max_members=5,
            max_teams=2,
            max_formulas=100,
            storage_mb=1024,
            api_calls_per_day=1000,
            ai_generations_per_day=10,
            features=["Basic"],
        )
        assert limits.plan == OrganizationPlan.FREE
        assert limits.max_members == 5

    def test_plan_limits_contains_all_plans(self):
        assert set(PLAN_LIMITS.keys()) == {
            OrganizationPlan.FREE,
            OrganizationPlan.PRO,
            OrganizationPlan.ENTERPRISE,
        }

    def test_free_plan_limits(self):
        free = PLAN_LIMITS[OrganizationPlan.FREE]
        assert free.max_members == 5
        assert free.max_formulas == 100

    def test_enterprise_unlimited(self):
        ent = PLAN_LIMITS[OrganizationPlan.ENTERPRISE]
        assert ent.max_members == -1
        assert ent.storage_mb == -1

    def test_pricing_structure(self):
        assert PRICING[OrganizationPlan.FREE]["monthly_cents"] == 0
        assert PRICING[OrganizationPlan.PRO]["monthly_cents"] == 19900


class TestSlug:
    def test_slug_basic(self):
        svc = OrganizationService(db=None)
        assert svc._generate_slug("My Organization") == "my-organization"

    def test_slug_multiple_spaces(self):
        svc = OrganizationService(db=None)
        assert svc._generate_slug("  Hello   World  ") == "hello-world"

    def test_slug_removes_special_chars(self):
        svc = OrganizationService(db=None)
        assert svc._generate_slug("foo/bar:baz") == "foobarbaz"

    def test_slug_keeps_unicode(self):
        svc = OrganizationService(db=None)
        assert svc._generate_slug("ABC公司") == "abc公司"


class TestServiceMethods:
    @pytest.mark.asyncio
    async def test_get_members_mock(self):
        from unittest.mock import AsyncMock, Mock

        db = AsyncMock()
        db.execute.return_value = Mock()
        db.execute.return_value.fetchall.return_value = []
        svc = OrganizationService(db)
        members = await svc.get_members(1)
        assert members == []

    @pytest.mark.asyncio
    async def test_get_organization_not_found_mock(self):
        from unittest.mock import AsyncMock, Mock

        db = AsyncMock()
        db.execute.return_value = Mock()
        db.execute.return_value.fetchone.return_value = None
        svc = OrganizationService(db)
        org = await svc.get_organization(999)
        assert org is None

    @pytest.mark.asyncio
    async def test_slug_exists_mock(self):
        from unittest.mock import AsyncMock, Mock

        db = AsyncMock()
        db.execute.return_value = Mock()
        db.execute.return_value.fetchone.return_value = None
        svc = OrganizationService(db)
        assert await svc._slug_exists("some-slug") is False

    @pytest.mark.asyncio
    async def test_get_teams_mock(self):
        from unittest.mock import AsyncMock, Mock

        db = AsyncMock()
        db.execute.return_value = Mock()
        db.execute.return_value.fetchall.return_value = []
        svc = OrganizationService(db)
        teams = await svc.get_teams(1)
        assert teams == []

    @pytest.mark.asyncio
    async def test_check_org_permission_no_membership(self):
        from unittest.mock import AsyncMock

        db = AsyncMock()
        svc = OrganizationService(db)
        svc._get_membership = AsyncMock(return_value=None)
        assert await svc.check_org_permission(1, 1, "formula_access") is False

    @pytest.mark.asyncio
    async def test_add_member_mock(self):
        from unittest.mock import AsyncMock, Mock

        db = AsyncMock()
        db.execute.return_value = Mock()
        db.execute.return_value.fetchone.return_value = Mock(id=7)
        svc = OrganizationService(db)
        svc._check_quota = AsyncMock()
        member = await svc.add_member(1, 2, OrganizationRole.MEMBER)
        assert member["id"] == 7
        assert member["role"] == "member"
        assert member["user_id"] == 2

    @pytest.mark.asyncio
    async def test_create_organization_mock(self):
        from unittest.mock import AsyncMock, Mock
        from datetime import datetime, timezone

        db = AsyncMock()
        db.execute.return_value = Mock()
        db.execute.return_value.fetchone.return_value = Mock(
            id=1,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            settings="{}",
        )
        svc = OrganizationService(db)
        svc._slug_exists = AsyncMock(return_value=False)
        svc.add_member = AsyncMock(return_value={})
        org = await svc.create_organization(owner_id=1, name="测试组织")
        assert org["id"] == 1
        assert org["name"] == "测试组织"