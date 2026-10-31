"""
配方智能校验与平台知识检索测试

覆盖：
1. 纯逻辑单测（不依赖数据库）：十八反/十九畏静态表、剂量状态判定、过敏原匹配、截断；
2. 服务层测试（mock FoodMaterial 匹配与检索）：识别/超量/过敏/配伍禁忌/知识检索；
3. API 路由测试：POST /ai/formula/validate 与 /ai/formula/knowledge 需登录。
"""
import secrets

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import create_app
from app.api.deps import get_db_session, get_current_active_user, get_current_user
from app.models import User
from app.models.food_material import FoodMaterial
from app.models.formula_feedback import FormulaFeedback

from app.services.ai.formula_intelligence import (
    ALLERGEN_SYNONYMS,
    _canonical_tcm_name,
    _classify_dosage,
    _find_allergen_hit,
    _find_tcm_incompatibilities,
    _match_allergens,
    _search_materials,
    _truncate,
    format_knowledge_entry,
    repair_formula_structure,
    retrieve_herb_knowledge,
    validate_formula,
)

from app.api.ai_modules.chat import _build_system_prompt


# ════════════════════════════════════════════
# 测试辅助
# ════════════════════════════════════════════

def make_material(**kwargs):
    """构造一个不落库的 FoodMaterial 实例（仅用于逻辑测试）。"""
    defaults = dict(
        id=1,
        external_id=None,
        gb_code=None,
        name_cn="",
        name_latin=None,
        name_en=None,
        aliases=[],
        category=None,
        sub_category=None,
        food_homology=False,
        toxicity_class=None,
        active_ingredients=[],
        compound_refs=[],
        effects=[],
        indications=None,
        ob_percent=None,
        dl_value=None,
        bioavailability_score=None,
        safe_dose_min=None,
        safe_dose_max=None,
        contraindications=[],
        interactions=[],
        regulatory_status=None,
        approved_regions=[],
        max_daily_intake=None,
        suppliers={},
        origin_countries=[],
        description=None,
        image_url=None,
        msds_url=None,
        coa_url=None,
        embedding=None,
        source_db="manual",
        data_quality=1.0,
        review_status="approved",
        reviewed_by=None,
        reviewed_at=None,
        created_at=None,
        updated_at=None,
        created_by=None,
    )
    defaults.update(kwargs)
    return FoodMaterial(**defaults)


class FakeResult:
    """模拟 SQLAlchemy Result：支持 .scalars().all() 与 .scalar_one_or_none()"""

    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class MockDBSession:
    """模拟 AsyncSession：记录 add/commit/refresh，execute 返回可配置结果。"""

    def __init__(self):
        self.added = []
        self.committed = False
        self.refreshed = []
        self.rollback_called = False
        self.execute_result = []

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def refresh(self, obj):
        self.refreshed.append(obj)
        if getattr(obj, "id", None) is None:
            obj.id = len(self.refreshed)

    async def execute(self, stmt, *args, **kwargs):
        return FakeResult(self.execute_result)

    async def rollback(self):
        self.rollback_called = True


# ════════════════════════════════════════════
# 纯逻辑单测
# ════════════════════════════════════════════

class TestDosageStatus:
    def test_within_range(self):
        assert _classify_dosage(5, 1, 10) == "范围内"

    def test_above_max(self):
        assert _classify_dosage(15, 1, 10) == "超上限"

    def test_below_min(self):
        assert _classify_dosage(0.5, 1, 10) == "低于"

    def test_unknown_no_range(self):
        assert _classify_dosage(5, None, None) == "未知"

    def test_unknown_only_min(self):
        # 只有下限无法确认上限，仍视为未知
        assert _classify_dosage(5, 1, None) == "未知"

    def test_unknown_none_dosage(self):
        assert _classify_dosage(None, 1, 10) == "未知"

    def test_unknown_negative(self):
        assert _classify_dosage(-1, 1, 10) == "未知"


class TestTcmCanonical:
    def test_wutou_family(self):
        assert _canonical_tcm_name("制附子") == "乌头"
        assert _canonical_tcm_name("川乌") == "乌头"

    def test_banxia_family(self):
        assert _canonical_tcm_name("法半夏") == "半夏"

    def test_gualou_family(self):
        assert _canonical_tcm_name("天花粉") == "瓜蒌"

    def test_gancao_family(self):
        assert _canonical_tcm_name("炙甘草") == "甘草"

    def test_unknown_keeps_original(self):
        assert _canonical_tcm_name("山药") == "山药"

    def test_empty(self):
        assert _canonical_tcm_name("") == ""


class TestIncompatibilityTables:
    def test_shibafan_gancao_haizao(self):
        issues = _find_tcm_incompatibilities(["甘草", "海藻"])
        assert len(issues) == 1
        assert issues[0]["source"] == "十八反"
        assert issues[0]["level"] == "error"
        assert issues[0]["affected_ingredients"] == ["甘草", "海藻"]

    def test_shibafan_wutou_banxia_with_processed_names(self):
        issues = _find_tcm_incompatibilities(["制附子", "法半夏"])
        assert issues and issues[0]["source"] == "十八反"
        assert issues[0]["level"] == "error"

    def test_shijiuwei_dingxiang_yujin(self):
        issues = _find_tcm_incompatibilities(["丁香", "郁金"])
        assert issues and issues[0]["source"] == "十九畏"
        assert issues[0]["level"] == "warning"

    def test_safe_pair_no_issue(self):
        issues = _find_tcm_incompatibilities(["山药", "茯苓"])
        assert issues == []

    def test_single_ingredient_no_issue(self):
        assert _find_tcm_incompatibilities(["人参"]) == []

    def test_empty_list(self):
        assert _find_tcm_incompatibilities([]) == []


class TestAllergenMatch:
    def test_allergen_hit(self):
        items = _match_allergens("我对花生过敏", [
            {"name": "花生", "matched_name": "花生", "aliases": ["落花生"]},
        ])
        assert len(items) == 1
        assert items[0]["category"] == "allergen"
        assert items[0]["level"] == "error"

    def test_allergen_no_hit(self):
        items = _match_allergens("对海鲜过敏", [
            {"name": "山药", "matched_name": "山药", "aliases": []},
        ])
        assert items == []

    def test_allergen_empty_profile(self):
        items = _match_allergens("", [
            {"name": "花生", "matched_name": "花生", "aliases": []},
        ])
        assert items == []


class TestTruncateAndFormat:
    def test_truncate_short(self):
        assert _truncate("短文本", 300) == "短文本"

    def test_truncate_long(self):
        text = "长" * 500
        assert len(_truncate(text, 300)) == 301  # 300 + 省略号
        assert _truncate(text, 300).endswith("…")

    def test_format_knowledge_entry(self):
        entry = {
            "name_cn": "枸杞子",
            "effects": ["滋补肝肾", "益精明目"],
            "active_ingredients": ["枸杞多糖", "甜菜碱"],
            "safe_dose_range": {"min_g": 6, "max_g": 12},
            "contraindications": ["外邪实热者忌服"],
        }
        line = format_knowledge_entry(entry)
        assert "枸杞子" in line
        assert "滋补肝肾" in line
        assert "6-12g/天" in line
        assert "外邪实热者忌服" in line


# ════════════════════════════════════════════
# 服务层测试（mock 原料匹配/检索）
# ════════════════════════════════════════════

class TestValidateFormula:
    @pytest.mark.asyncio
    async def test_recognized_within_range(self):
        material = make_material(
            name_cn="山药", food_homology=True,
            safe_dose_min=15.0, safe_dose_max=30.0,
            effects=["补脾养胃"], active_ingredients=["山药多糖"],
            contraindications=["湿盛中满者慎用"],
        )
        db = AsyncMock()
        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(return_value=material),
        ):
            result = await validate_formula(
                [{"name": "山药", "dosage_g": 20.0, "role": "君"}],
                target_effects=["健脾"],
                db=db,
            )

        assert result["valid"] is True
        assert result["blocked_by_critical"] is False
        ing = result["ingredients"][0]
        assert ing["recognized"] is True
        assert ing["matched_name"] == "山药"
        assert ing["food_homology"] is True
        assert ing["dosage_status"] == "范围内"
        assert ing["safe_dose_range"] == {"min_g": 15.0, "max_g": 30.0}
        assert ing["contraindications"] == ["湿盛中满者慎用"]

    @pytest.mark.asyncio
    async def test_overdose_blocks(self):
        material = make_material(
            name_cn="维生素C", food_homology=True, toxicity_class="无毒",
            safe_dose_min=0.1, safe_dose_max=2.0,
        )
        db = AsyncMock()
        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(return_value=material),
        ):
            result = await validate_formula(
                [{"name": "维生素C", "dosage_g": 3.0}], db=db,
            )

        ing = result["ingredients"][0]
        assert ing["recognized"] is True
        assert ing["dosage_status"] == "超上限"
        assert result["blocked_by_critical"] is True
        assert result["valid"] is False
        # SafetyAlertSystem：维生素C 3000mg 超过 UL 2000mg → CRITICAL
        assert any(a["level"] == "critical" for a in result["alerts"])

    @pytest.mark.asyncio
    async def test_allergen_blocks(self):
        material = make_material(name_cn="花生", food_homology=True, aliases=["落花生"])
        db = AsyncMock()
        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(return_value=material),
        ):
            result = await validate_formula(
                [{"name": "花生", "dosage_g": 10.0}],
                user_profile="我对花生过敏，不能吃花生制品",
                db=db,
            )

        assert result["valid"] is False
        assert any(
            i["category"] == "allergen" and i["level"] == "error"
            for i in result["compatibility_issues"]
        )
        assert any(a["ingredient"] == "花生" for a in result["alerts"])

    @pytest.mark.asyncio
    async def test_shibafan_incompatibility_blocks(self):
        gan_cao = make_material(name_cn="甘草", food_homology=True)
        hai_zao = make_material(name_cn="海藻", food_homology=True)
        db = AsyncMock()

        async def fake_match(name, *args, **kwargs):
            if "甘草" in name:
                return gan_cao
            if "海藻" in name:
                return hai_zao
            return None

        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(side_effect=fake_match),
        ):
            result = await validate_formula(
                [{"name": "甘草", "dosage_g": 3.0}, {"name": "海藻", "dosage_g": 3.0}],
                db=db,
            )

        assert result["valid"] is False
        assert result["blocked_by_critical"] is True
        assert any(
            i["source"] == "十八反" and i["level"] == "error"
            for i in result["compatibility_issues"]
        )

    @pytest.mark.asyncio
    async def test_shijiuwei_incompatibility_warning(self):
        ding_xiang = make_material(name_cn="丁香", food_homology=True)
        yu_jin = make_material(name_cn="郁金", food_homology=True)
        db = AsyncMock()

        async def fake_match(name, *args, **kwargs):
            if "丁香" in name:
                return ding_xiang
            if "郁金" in name:
                return yu_jin
            return None

        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(side_effect=fake_match),
        ):
            result = await validate_formula(
                [{"name": "丁香", "dosage_g": 2.0}, {"name": "郁金", "dosage_g": 2.0}],
                db=db,
            )

        assert any(
            i["source"] == "十九畏" and i["level"] == "warning"
            for i in result["compatibility_issues"]
        )

    @pytest.mark.asyncio
    async def test_unrecognized_ingredient(self):
        db = AsyncMock()
        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(return_value=None),
        ):
            result = await validate_formula(
                [{"name": "未知原料XYZ", "dosage_g": 1.0}], db=db,
            )

        ing = result["ingredients"][0]
        assert ing["recognized"] is False
        assert ing["matched_name"] is None
        assert ing["dosage_status"] == "未知"
        assert ing["safe_dose_range"] is None

    @pytest.mark.asyncio
    async def test_empty_ingredients(self):
        result = await validate_formula([], db=AsyncMock())
        assert result["valid"] is True
        assert result["ingredients"] == []


class TestRetrieveHerbKnowledge:
    @pytest.mark.asyncio
    async def test_returns_knowledge_entries(self):
        m1 = make_material(
            name_cn="枸杞子", food_homology=True, data_quality=0.9,
            effects=["滋补肝肾"], active_ingredients=["枸杞多糖"],
            safe_dose_min=6, safe_dose_max=12,
            contraindications=["外邪实热者忌服"],
        )
        m2 = make_material(
            name_cn="菊花", food_homology=True, data_quality=0.8,
            effects=["散风清热"], active_ingredients=["菊花黄酮"],
        )
        db = AsyncMock()
        with patch(
            "app.services.ai.formula_intelligence._search_materials",
            new=AsyncMock(return_value=[m1, m2]),
        ):
            items = await retrieve_herb_knowledge("枸杞", top_k=5, db=db)

        assert len(items) == 2
        first = items[0]
        assert first["name_cn"] == "枸杞子"
        assert first["effects"] == ["滋补肝肾"]
        assert first["active_ingredients"] == ["枸杞多糖"]
        assert first["safe_dose_range"] == {"min_g": 6, "max_g": 12}
        assert first["contraindications"] == ["外邪实热者忌服"]
        assert first["source"] == "平台原料库"

    @pytest.mark.asyncio
    async def test_empty_query_returns_empty(self):
        items = await retrieve_herb_knowledge("", db=AsyncMock())
        assert items == []

    @pytest.mark.asyncio
    async def test_search_materials_fallback_on_non_pg(self):
        """非 PG 环境（array_to_string 不可用）应回退到名称字段检索。"""
        m = make_material(name_cn="枸杞子", effects=["滋补肝肾"])
        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[Exception("function array_to_string does not exist"), FakeResult([m])]
        )
        rows = await _search_materials(db, "%枸杞%", 5)
        assert rows == [m]

    @pytest.mark.asyncio
    async def test_search_materials_returns_empty_on_db_error(self):
        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[Exception("boom"), Exception("boom again")]
        )
        rows = await _search_materials(db, "%枸杞%", 5)
        assert rows == []


# ════════════════════════════════════════════
# 智能对话 system prompt 知识注入测试
# ════════════════════════════════════════════

class TestChatKnowledgeInjection:
    @pytest.mark.asyncio
    async def test_formula_design_appends_knowledge(self):
        entry = {
            "name_cn": "枸杞子",
            "effects": ["滋补肝肾"],
            "active_ingredients": ["枸杞多糖"],
            "safe_dose_range": {"min_g": 6, "max_g": 12},
            "contraindications": [],
        }
        with patch(
            "app.services.ai.formula_intelligence.retrieve_herb_knowledge",
            new=AsyncMock(return_value=[entry]),
        ):
            prompt = await _build_system_prompt(
                "formula_design", None, question="枸杞怎么用", db=AsyncMock()
            )
        assert "【平台知识库参考】（来源：平台原料库）" in prompt
        assert "枸杞子" in prompt

    @pytest.mark.asyncio
    async def test_formula_design_knowledge_failure_silent(self):
        with patch(
            "app.services.ai.formula_intelligence.retrieve_herb_knowledge",
            new=AsyncMock(side_effect=Exception("db down")),
        ):
            prompt = await _build_system_prompt(
                "formula_design", None, question="枸杞", db=AsyncMock()
            )
        assert "【平台知识库参考】" not in prompt
        assert "枸杞子" not in prompt

    @pytest.mark.asyncio
    async def test_non_formula_scenario_no_knowledge(self):
        prompt = await _build_system_prompt(
            "academician", None, question="枸杞", db=AsyncMock()
        )
        assert "【平台知识库参考】" not in prompt

    @pytest.mark.asyncio
    async def test_profile_constraints_still_injected(self):
        with patch(
            "app.services.ai.formula_intelligence.retrieve_herb_knowledge",
            new=AsyncMock(return_value=[]),
        ):
            prompt = await _build_system_prompt(
                "formula_design",
                "对花生过敏；孕妇",
                question="设计一个调理配方",
                db=AsyncMock(),
            )
        assert "【用户约束 — 必须严格遵守】" in prompt
        assert "对花生过敏" in prompt


# ════════════════════════════════════════════
# API 路由测试
# ════════════════════════════════════════════

def _make_api_app(override_db=True):
    """创建测试 app：可选覆盖 DB 会话与登录依赖。"""
    app = create_app()

    if override_db:
        async def mock_db_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = mock_db_session

    async def mock_current_user():
        user = MagicMock(spec=User)
        user.id = 1
        user.username = "test_researcher"
        user.email = "test@example.com"
        user.role = "researcher"
        user.is_active = True
        return user

    app.dependency_overrides[get_current_active_user] = mock_current_user
    return app


def _csrf(client):
    """设置 CSRF 双提交 cookie + header。"""
    token = secrets.token_hex(32)
    client.cookies.clear()
    client.cookies.set("csrf_token", token)
    client.headers["X-CSRF-Token"] = token


class TestFormulaIntelligenceAPI:
    def test_validate_endpoint(self):
        app = _make_api_app()
        material = make_material(
            name_cn="山药", food_homology=True,
            safe_dose_min=15.0, safe_dose_max=30.0,
        )
        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(return_value=material),
        ):
            client = TestClient(app)
            _csrf(client)
            resp = client.post("/api/v1/ai/formula/validate", json={
                "formula_name": "健脾养胃方",
                "ingredients": [{"name": "山药", "dosage_g": 20.0, "role": "君"}],
                "target_effects": ["健脾"],
                "user_profile_context": "",
            })

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["valid"] is True
        assert data["formula_name"] == "健脾养胃方"
        assert data["ingredients"][0]["dosage_status"] == "范围内"
        assert data["ingredients"][0]["recognized"] is True
        assert "recommendations" in data

    def test_validate_endpoint_formula_name_optional(self):
        """formula_name 为可选字段：不传时响应回显 None。"""
        app = _make_api_app()
        material = make_material(
            name_cn="山药", food_homology=True,
            safe_dose_min=15.0, safe_dose_max=30.0,
        )
        with patch(
            "app.services.ai.formula_intelligence._match_food_material",
            new=AsyncMock(return_value=material),
        ):
            client = TestClient(app)
            _csrf(client)
            resp = client.post("/api/v1/ai/formula/validate", json={
                "ingredients": [{"name": "山药", "dosage_g": 20.0}],
            })

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["formula_name"] is None

    def test_knowledge_endpoint(self):
        app = _make_api_app()
        m = make_material(
            name_cn="枸杞子", food_homology=True,
            effects=["滋补肝肾"], active_ingredients=["枸杞多糖"],
        )
        with patch(
            "app.services.ai.formula_intelligence._search_materials",
            new=AsyncMock(return_value=[m]),
        ):
            client = TestClient(app)
            _csrf(client)
            resp = client.post("/api/v1/ai/formula/knowledge", json={
                "query": "枸杞",
                "top_k": 5,
            })

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["name_cn"] == "枸杞子"
        assert data["items"][0]["source"] == "平台原料库"

    def test_validate_requires_login(self):
        # 不覆盖登录依赖 → 无 token 应返回 401/403
        app = _make_api_app(override_db=False)
        app.dependency_overrides.pop(get_current_active_user, None)
        client = TestClient(app)
        _csrf(client)
        resp = client.post("/api/v1/ai/formula/validate", json={
            "ingredients": [{"name": "山药", "dosage_g": 1.0}],
        })
        assert resp.status_code in (401, 403), resp.text

    def test_validate_rejects_invalid_dosage(self):
        app = _make_api_app()
        client = TestClient(app)
        _csrf(client)
        resp = client.post("/api/v1/ai/formula/validate", json={
            "ingredients": [{"name": "山药", "dosage_g": -1}],
        })
        # dosage_g <= 0 违反 pydantic gt=0 → 422
        assert resp.status_code == 422, resp.text

    def test_knowledge_requires_login(self):
        app = _make_api_app(override_db=False)
        app.dependency_overrides.pop(get_current_active_user, None)
        client = TestClient(app)
        _csrf(client)
        resp = client.post("/api/v1/ai/formula/knowledge", json={"query": "枸杞"})
        assert resp.status_code in (401, 403), resp.text


# ════════════════════════════════════════════
# 过敏原别名增强测试
# ════════════════════════════════════════════

class TestAllergenSynonyms:
    def test_synonym_table_has_at_least_60_groups(self):
        assert len(ALLERGEN_SYNONYMS) >= 60

    def test_allergen_hit_via_synonym(self):
        """用户写「落花生」，原料名为「花生」→ 通过同义词扩展命中。"""
        items = _match_allergens("我对落花生过敏", [
            {"name": "花生", "matched_name": "花生", "aliases": []},
        ])
        assert len(items) == 1
        assert items[0]["category"] == "allergen"
        assert items[0]["level"] == "error"

    def test_allergen_hit_via_english_synonym(self):
        """用户写「whey」，原料名为「牛奶」→ 命中乳制品组。"""
        items = _match_allergens("allergic to whey", [
            {"name": "牛奶", "matched_name": "牛奶", "aliases": []},
        ])
        assert len(items) == 1
        assert items[0]["category"] == "allergen"

    def test_allergen_hit_via_ingredient_alias(self):
        """原料别名「对虾」，用户写「虾」→ 命中虾组。"""
        items = _match_allergens("对虾过敏", [
            {"name": "虾", "matched_name": "虾", "aliases": ["对虾"]},
        ])
        assert len(items) == 1

    def test_allergen_hit_via_processed_form(self):
        """用户写「面筋」，原料名为「麸质」→ 命中麸质组。"""
        items = _match_allergens("不能吃面筋", [
            {"name": "麸质", "matched_name": "麸质", "aliases": []},
        ])
        assert len(items) == 1

    def test_allergen_hit_nut_expansion(self):
        """用户写「pistachio」，原料名为「开心果」→ 命中开心果组。"""
        items = _match_allergens("allergic to pistachio", [
            {"name": "开心果", "matched_name": "开心果", "aliases": []},
        ])
        assert len(items) == 1
        assert items[0]["category"] == "allergen"

    def test_allergen_hit_scallop_expansion(self):
        """用户写「scallop」，原料名为「扇贝」→ 命中扇贝组。"""
        items = _match_allergens("不能吃 scallop", [
            {"name": "扇贝", "matched_name": "扇贝", "aliases": []},
        ])
        assert len(items) == 1

    def test_allergen_hit_cuttlefish_expansion(self):
        """用户写「乌贼」，原料名为「墨鱼」→ 命中墨鱼组。"""
        items = _match_allergens("对乌贼过敏", [
            {"name": "墨鱼", "matched_name": "墨鱼", "aliases": []},
        ])
        assert len(items) == 1

    def test_allergen_hit_buckwheat_expansion(self):
        """用户写「buckwheat」，原料名为「荞麦」→ 命中荞麦组。"""
        items = _match_allergens("allergic to buckwheat", [
            {"name": "荞麦", "matched_name": "荞麦", "aliases": []},
        ])
        assert len(items) == 1

    def test_allergen_hit_bee_pollen_expansion(self):
        """用户写「蜂花粉」，原料名为「花粉」→ 命中蜂花粉组。"""
        items = _match_allergens("对蜂花粉过敏", [
            {"name": "花粉", "matched_name": "花粉", "aliases": []},
        ])
        assert len(items) == 1

    def test_allergen_hit_peanut_oil_expansion(self):
        """用户写「花生油」，原料名为「花生」→ 命中花生组。"""
        items = _match_allergens("不能吃花生油", [
            {"name": "花生", "matched_name": "花生", "aliases": []},
        ])
        assert len(items) == 1

    def test_single_char_no_false_positive(self):
        """「花」不应因「花生」而误报。"""
        items = _match_allergens("我对花生过敏", [
            {"name": "花", "matched_name": "花", "aliases": []},
        ])
        assert items == []

    def test_find_allergen_hit_single_char(self):
        assert _find_allergen_hit(["花"], "我对花生过敏") is None

    def test_find_allergen_hit_direct(self):
        assert _find_allergen_hit(["花生"], "我对花生过敏") == "花生"

    def test_find_allergen_hit_synonym_expansion(self):
        # 画像包含英文同义词 peanut，原文「花生」不含 peanut → 通过同义词组扩展命中
        assert _find_allergen_hit(["花生"], "我对 peanut 过敏") == "peanut"


# ════════════════════════════════════════════
# 结构化修复服务测试
# ════════════════════════════════════════════

class TestRepairFormulaStructure:
    @pytest.mark.asyncio
    async def test_repair_success(self):
        structured = {"blocks": [{"type": "header", "data": {"title": "测试配方"}}]}
        fake_llm = MagicMock()
        fake_llm.is_available = True
        fake_llm.chat_with_json = AsyncMock(return_value=structured)
        with patch("app.services.llm_service.llm_service", fake_llm):
            result = await repair_formula_structure(
                "人参 10g，枸杞 5g，适合熬夜人群", formula_name="熬夜调理方"
            )
        assert result["success"] is True
        assert result["structured"] == structured
        assert result["message"] is None

    @pytest.mark.asyncio
    async def test_repair_llm_unavailable(self):
        fake_llm = MagicMock()
        fake_llm.is_available = False
        with patch("app.services.llm_service.llm_service", fake_llm):
            result = await repair_formula_structure("人参 10g")
        assert result["success"] is False
        assert result["structured"] is None
        assert "未配置" in result["message"]

    @pytest.mark.asyncio
    async def test_repair_parse_failure(self):
        fake_llm = MagicMock()
        fake_llm.is_available = True
        fake_llm.chat_with_json = AsyncMock(side_effect=Exception("json decode error"))
        fake_llm.chat = AsyncMock(side_effect=Exception("LLM API 调用失败"))
        with patch("app.services.llm_service.llm_service", fake_llm):
            result = await repair_formula_structure("人参 10g")
        assert result["success"] is False
        assert result["structured"] is None
        assert result["message"]

    @pytest.mark.asyncio
    async def test_repair_empty_content(self):
        result = await repair_formula_structure("")
        assert result["success"] is False
        assert "不能为空" in result["message"]

    @pytest.mark.asyncio
    async def test_repair_missing_blocks(self):
        """LLM 返回 JSON 但缺少 blocks 键 → 判定失败。"""
        fake_llm = MagicMock()
        fake_llm.is_available = True
        fake_llm.chat_with_json = AsyncMock(return_value={"foo": "bar"})
        with patch("app.services.llm_service.llm_service", fake_llm):
            result = await repair_formula_structure("人参 10g")
        assert result["success"] is False
        assert "blocks" in result["message"]


# ════════════════════════════════════════════
# 结构化修复 API 测试
# ════════════════════════════════════════════

class TestRepairStructuredAPI:
    def test_repair_structured_endpoint_success(self):
        app = _make_api_app()
        structured = {"blocks": [{"type": "header", "data": {"title": "修复配方"}}]}
        fake_llm = MagicMock()
        fake_llm.is_available = True
        fake_llm.chat_with_json = AsyncMock(return_value=structured)
        with patch("app.services.llm_service.llm_service", fake_llm):
            client = TestClient(app)
            _csrf(client)
            resp = client.post("/api/v1/ai/formula/repair-structured", json={
                "content": "人参 10g，枸杞 5g，适合熬夜人群",
                "formula_name": "熬夜调理方",
            })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is True
        assert data["structured"]["blocks"][0]["type"] == "header"
        assert data["message"] is None

    def test_repair_structured_endpoint_llm_unavailable(self):
        app = _make_api_app()
        fake_llm = MagicMock()
        fake_llm.is_available = False
        with patch("app.services.llm_service.llm_service", fake_llm):
            client = TestClient(app)
            _csrf(client)
            resp = client.post("/api/v1/ai/formula/repair-structured", json={
                "content": "人参 10g",
            })
        # LLM 不可用也必须返回 200 + success:false，而不是 500
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is False
        assert data["structured"] is None
        assert data["message"]

    def test_repair_structured_requires_login(self):
        app = _make_api_app(override_db=False)
        app.dependency_overrides.pop(get_current_active_user, None)
        client = TestClient(app)
        _csrf(client)
        resp = client.post("/api/v1/ai/formula/repair-structured", json={"content": "人参 10g"})
        assert resp.status_code in (401, 403), resp.text


# ════════════════════════════════════════════
# 配方反馈闭环 API 测试
# ════════════════════════════════════════════

class TestFeedbackAPI:
    def test_feedback_post(self):
        app = _make_api_app()
        session = MockDBSession()

        async def mock_db_session():
            yield session

        app.dependency_overrides[get_db_session] = mock_db_session
        client = TestClient(app)
        _csrf(client)
        resp = client.post("/api/v1/ai/formula/feedback", json={
            "formula_id": 123,
            "rating": 5,
            "symptom_change": "睡眠质量改善",
            "metric_updates": [{"metric": "入睡时间", "value": "由 60 分钟缩短至 30 分钟"}],
            "notes": "整体感觉不错",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is True
        assert data["feedback"]["formula_id"] == 123
        assert data["feedback"]["rating"] == 5
        assert data["feedback"]["symptom_change"] == "睡眠质量改善"
        assert session.committed is True
        assert len(session.added) == 1
        assert session.added[0].rating == 5

    def test_feedback_get_list(self):
        app = _make_api_app()
        feedback_obj = FormulaFeedback(
            id=7,
            user_id=1,
            organization_id=1,
            formula_id=123,
            rating=4,
            symptom_change="改善",
            metric_updates=[{"metric": "空腹血糖", "value": "下降 0.5"}],
            notes="继续观察",
        )
        session = MockDBSession()
        session.execute_result = [feedback_obj]

        async def mock_db_session():
            yield session

        app.dependency_overrides[get_db_session] = mock_db_session
        client = TestClient(app)
        _csrf(client)
        resp = client.get("/api/v1/ai/formula/123/feedback")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["formula_id"] == 123
        assert data["total"] == 1
        assert data["items"][0]["id"] == 7
        assert data["items"][0]["rating"] == 4
        assert data["items"][0]["notes"] == "继续观察"

    def test_feedback_post_invalid_rating(self):
        app = _make_api_app()
        client = TestClient(app)
        _csrf(client)
        resp = client.post("/api/v1/ai/formula/feedback", json={
            "formula_id": 123,
            "rating": 9,
        })
        # rating 超出 1-5 → 422
        assert resp.status_code == 422, resp.text

    def test_feedback_requires_login(self):
        app = _make_api_app(override_db=False)
        app.dependency_overrides.pop(get_current_active_user, None)
        client = TestClient(app)
        _csrf(client)
        resp = client.post("/api/v1/ai/formula/feedback", json={
            "formula_id": 123,
            "rating": 3,
        })
        assert resp.status_code in (401, 403), resp.text

    def test_feedback_get_requires_login(self):
        app = _make_api_app(override_db=False)
        app.dependency_overrides.pop(get_current_active_user, None)
        client = TestClient(app)
        _csrf(client)
        resp = client.get("/api/v1/ai/formula/123/feedback")
        assert resp.status_code in (401, 403), resp.text


# ════════════════════════════════════════════
# 五期：配方成分平台原料库富化
# ════════════════════════════════════════════

class TestEnrichIngredientsWithFoodMaterial:
    """验证保存配方时用 FoodMaterial 富化 composition.ingredients 的 platform_data。"""

    async def test_enrich_adds_platform_data(self):
        from app.api.formulas import _enrich_ingredients_with_food_material

        material = make_material(
            name_cn="黄芪",
            food_homology=True,
            safe_dose_min=9.0,
            safe_dose_max=30.0,
            effects=["补气升阳"],
            active_ingredients=["黄芪多糖"],
            contraindications=["表实邪盛者不宜"],
            toxicity_class="无毒",
        )
        db = MagicMock()
        db.execute = AsyncMock(return_value=FakeResult([material]))

        composition = {
            "ingredients": [
                {"name": "黄芪", "dosage": "15", "role": "君"},
                {"name": "未知成分", "dosage": "5"},
            ]
        }
        enriched = await _enrich_ingredients_with_food_material(db, composition)

        assert enriched["ingredients"][0]["platform_data"]["matched_name"] == "黄芪"
        assert enriched["ingredients"][0]["platform_data"]["food_homology"] is True
        assert enriched["ingredients"][0]["platform_data"]["safe_dose_range"] == {
            "min_g": 9.0,
            "max_g": 30.0,
        }
        assert "黄芪多糖" in enriched["ingredients"][0]["platform_data"]["active_ingredients"]
        assert enriched["ingredients"][1].get("platform_data") is None  # 未匹配保持原样

    async def test_enrich_empty_composition(self):
        from app.api.formulas import _enrich_ingredients_with_food_material

        db = MagicMock()
        assert await _enrich_ingredients_with_food_material(db, None) == {}
        assert await _enrich_ingredients_with_food_material(db, {}) == {}
        assert await _enrich_ingredients_with_food_material(db, {"ingredients": []}) == {"ingredients": []}

    async def test_enrich_db_error_keeps_original(self):
        from app.api.formulas import _enrich_ingredients_with_food_material

        db = MagicMock()
        db.execute = AsyncMock(side_effect=Exception("db down"))
        composition = {"ingredients": [{"name": "黄芪", "dosage": "15"}]}
        enriched = await _enrich_ingredients_with_food_material(db, composition)
        assert enriched["ingredients"][0].get("platform_data") is None


# ════════════════════════════════════════════
# 专业配方设计输出协议（四期）
# ════════════════════════════════════════════

class TestProfessionalFormulaProtocol:
    """验证修复提示词与主提示词已升级为「专业配方设计卡」协议。"""

    def test_repair_prompt_contains_professional_fields(self):
        from app.services.ai.formula_intelligence import _REPAIR_SYSTEM_PROMPT

        for keyword in [
            "active_compound",      # 功效成分列
            "nature_flavor",        # 性味归经列
            "mechanism",            # 作用机理列
            "synergy-chart",        # 君臣佐使配伍
            "timeline",             # 服用周期
            "制备工艺SOP",           # 工艺
            "监测与迭代建议",         # 监测
            "参考文献",               # 参考文献
        ]:
            assert keyword in _REPAIR_SYSTEM_PROMPT, f"修复提示词缺少专业字段: {keyword}"

    def test_academician_prompt_no_longer_report_only(self):
        """主提示词应移除「不少于1000字」报告式要求，并包含专业配方卡协议字段。"""
        import yaml
        from pathlib import Path

        config_path = Path(__file__).resolve().parents[2] / "conf" / "prompts" / "default.yaml"
        data = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        academician = data["system_prompts"]["academician"]

        # 报告式要求已移除
        assert "不少于1000字" not in academician
        # 专业配方卡协议字段存在
        for keyword in ["active_compound", "nature_flavor", "制备工艺SOP", "监测与迭代建议", "synergy-chart", "timeline"]:
            assert keyword in academician, f"主提示词缺少专业字段: {keyword}"

    def test_professional_formula_example_exists_and_valid(self):
        """示例配方 JSON 存在、可解析，且包含专业配方卡各块。"""
        import json
        from pathlib import Path

        example_path = Path(__file__).resolve().parents[2] / "conf" / "prompts" / "professional_formula_example.json"
        assert example_path.exists(), "professional_formula_example.json 不存在"
        data = json.loads(example_path.read_text(encoding="utf-8"))
        block_types = {b["type"] for b in data["blocks"]}
        assert "data-table" in block_types
        assert "timeline" in block_types
        assert "synergy-chart" in block_types
        assert "ingredient-detail" in block_types
        # data-table 含专业列
        table = next(b for b in data["blocks"] if b["type"] == "data-table")
        table_keys = {c["key"] for c in table["data"]["columns"]}
        assert {"role", "name", "dosage", "nature_flavor", "active_compound", "mechanism"} <= table_keys


# ════════════════════════════════════════════
# 科学合规修复测试（task-34）
# ════════════════════════════════════════════

class TestScientificComplianceFixes:
    """覆盖：剂量预校验、历史 Token 级截断、输出安全过滤、辨证传 db、提示词合规。"""

    # ── P0-3 剂量预校验 ──

    @pytest.mark.asyncio
    async def test_append_dosage_warnings_normal_dose_no_append(self):
        from app.api.ai_modules.chat import _append_dosage_warnings

        answer = "建议：黄芪 10g，每日一次，温水冲服。"
        result = await _append_dosage_warnings(answer, db=None)
        assert result == answer
        assert "剂量警示" not in result

    @pytest.mark.asyncio
    async def test_append_dosage_warnings_over_dose_appends(self):
        from app.api.ai_modules.chat import _append_dosage_warnings

        answer = "建议：黄芪 50g，每日一次。"
        result = await _append_dosage_warnings(answer, db=None)
        assert "剂量警示" in result
        assert "黄芪 50g 超出常规安全上限" in result
        assert "9-30g" in result

    @pytest.mark.asyncio
    async def test_append_dosage_warnings_range_and_unknown_herb(self):
        from app.api.ai_modules.chat import _append_dosage_warnings

        answer = "每日当归 10-20g。\n另加神秘草 100g。"
        result = await _append_dosage_warnings(answer, db=None)
        # 当归 10-20g 取上限 20 > 12 → 警示
        assert "当归 20g 超出常规安全上限" in result
        assert "剂量警示" in result
        # 神秘草不在内置表，db=None 时静默跳过（警示文本不含神秘草）
        assert "神秘草 100g 超出" not in result

    @pytest.mark.asyncio
    async def test_append_dosage_warnings_empty_answer(self):
        from app.api.ai_modules.chat import _append_dosage_warnings

        assert await _append_dosage_warnings("", db=None) == ""

    # ── P2-12 历史 Token 级截断 ──

    def test_truncate_history_keeps_recent_within_budget(self):
        from app.api.ai_modules.chat import _truncate_history_by_tokens

        history = [{"role": "user", "content": f"旧消息{i:03d}：" + "长" * 300} for i in range(5)]
        truncated = _truncate_history_by_tokens(history, budget_chars=1000)
        assert truncated, "应至少保留最近消息"
        total_chars = sum(len(h["content"]) for h in truncated)
        # 预算 1000 + 最后一条截断余量 200
        assert total_chars <= 1200
        # 最近一条消息必须保留
        assert truncated[-1]["content"] == history[-1]["content"]

    def test_truncate_history_empty(self):
        from app.api.ai_modules.chat import _truncate_history_by_tokens

        assert _truncate_history_by_tokens(None) == []
        assert _truncate_history_by_tokens([]) == []

    def test_truncate_history_respects_max_messages(self):
        from app.api.ai_modules.chat import _truncate_history_by_tokens

        history = [{"role": "user", "content": "短消息"} for _ in range(50)]
        truncated = _truncate_history_by_tokens(history, max_messages=5)
        assert len(truncated) == 5

    # ── P2-11 辨证分析传 db ──

    @pytest.mark.asyncio
    async def test_analyze_dialectics_accepts_db(self):
        from app.services.ai.dialectics_service import analyze_dialectics

        # 规则引擎路径不依赖 db，传入 db 参数应正常工作
        result = await analyze_dialectics("长期失眠，多梦易醒", db=AsyncMock())
        assert isinstance(result, dict)
        assert "regulation_goals" in result

    # ── P0-2 非流式路径接入 check_output ──

    def test_chat_non_stream_applies_check_output(self):
        from app.services.ai.safety.output_filter import OutputCheckResult, OutputRiskLevel

        app = _make_api_app()

        async def mock_current_user():
            user = MagicMock(spec=User)
            user.id = 1
            user.username = "test_researcher"
            user.email = "test@example.com"
            user.role = "researcher"
            user.is_active = True
            return user

        # /chat 使用可选认证 get_current_user；本测试需要登录态
        app.dependency_overrides[get_current_user] = mock_current_user
        client = TestClient(app)
        _csrf(client)

        fake_llm = MagicMock()
        fake_llm.is_available = True
        fake_llm.config.model = "test-model"
        fake_llm.config.key_from_db = False
        fake_llm.config.api_key = "sk-test"

        async def fake_stream(*args, **kwargs):
            yield "这是一段回复"

        fake_llm.chat_stream = fake_stream

        unsafe_result = OutputCheckResult(
            risk_level=OutputRiskLevel.HIGH,
            original_length=6,
            safe_length=6,
            findings=[],
            is_safe=False,
            sanitized_text="[REDACTED] 回复",
            action="sanitize",
        )
        with (
            patch("app.api.ai_modules.chat._get_user_llm", new=AsyncMock(return_value=None)),
            patch("app.services.llm_service.llm_service", fake_llm),
            patch("app.core.multi_tenant.multi_tenant_service.ensure_ai_quota", new=AsyncMock(return_value=None)),
            patch("app.api.ai_modules.chat._persist_chat_record", new=AsyncMock(return_value=None)),
            patch("app.services.ai.safety.check_output", return_value=unsafe_result),
        ):
            resp = client.post("/api/v1/ai/chat", json={
                "question": "帮我设计一个配方" + secrets.token_hex(4),
                "stream": False,
            })

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["content"] == "[REDACTED] 回复"

    # ── P0-1 / P1-4 / P1-5 / P1-7 提示词合规 ──

    def test_prompts_no_absolute_safety_and_no_hard_word_count(self):
        import yaml
        from pathlib import Path

        config_path = Path(__file__).resolve().parents[2] / "conf" / "prompts" / "default.yaml"
        data = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        academician = data["system_prompts"]["academician"]

        # P0-1: 删除「绝对安全」
        assert "绝对安全" not in academician
        assert "安全优先" in academician
        # P1-5: 删除硬性字数要求
        assert "不少于1000字" not in academician
        # P1-7: 软化「严禁」
        assert "严禁写「适量」" not in academician
        assert "避免写「适量」" in academician
        # P2-9: 强制免责声明
        assert "不能替代专业医师诊断与治疗" in academician
        # P1-6: 需遵医嘱兜底
        assert "需遵医嘱" in academician

    def test_chat_engine_no_absolute_safety_and_114_items(self):
        from app.services.ai.orchestration.chat_engine import ACADEMICIAN_SYSTEM_PROMPT

        assert "绝对安全" not in ACADEMICIAN_SYSTEM_PROMPT
        assert "安全优先" in ACADEMICIAN_SYSTEM_PROMPT
        assert "114种" in ACADEMICIAN_SYSTEM_PROMPT
        assert "110种" not in ACADEMICIAN_SYSTEM_PROMPT
        assert "不少于1000字" not in ACADEMICIAN_SYSTEM_PROMPT

    def test_llm_service_114_items(self):
        from app.services.llm_service import RMFOOD_SYSTEM_PROMPT, SCENARIO_SYSTEM_PROMPTS

        combined = RMFOOD_SYSTEM_PROMPT + str(SCENARIO_SYSTEM_PROMPTS)
        assert "110种" not in combined
        # llm_service 中 110 种出现在离线回答模板（chat_with_rmfood），单独检查源码
        import inspect
        import app.services.llm_service as llm_svc

        source = inspect.getsource(llm_svc)
        assert "110种" not in source
        assert "114种" in source