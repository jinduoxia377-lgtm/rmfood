"""配方服务单元测试

覆盖:
- 配方创建
- 配方查询（单个/列表）
- 配方更新
- 配方删除
- 配方状态变更
"""
import pytest
import importlib.util
import os

# 直接从文件导入 FormulaService（避免 formula 包/文件命名冲突）
_spec = importlib.util.spec_from_file_location(
    "app.services.formula_module",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "app", "services", "formula", "formula_module.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
FormulaService = _mod.FormulaService

from app.models.formula import Formula
from app.models.enums import FormulaStatus, UserRole


@pytest.mark.asyncio
class TestFormulaService:
    """配方业务逻辑"""

    async def test_create_formula(self, db_session, create_user):
        """创建配方成功"""
        user = await create_user(username="formulator", role=UserRole.FORMULATOR)
        service = FormulaService(db_session)

        formula = await service.create_formula(
            data=type("FormulaCreate", (), {
                "name": "养气配方",
                "description": "补气养血",
                "target_effects": ["补气", "养血"],
                "composition": {"ingredients": [{"name": "人参", "percentage": 100}]},
                "processing_method": "煎煮",
                "dosage": "10g/次",
                "storage_conditions": "避光",
                "shelf_life": 365,
                "ingredient_ids": [],
                "peptide_ids": [],
                "safety_check": True,
                "synergy_analysis": False,
            })(),
            creator_id=user.id,
        )

        assert formula.id is not None
        assert formula.name == "养气配方"
        assert formula.status == FormulaStatus.DRAFT
        assert formula.version == 1
        assert formula.creator_id == user.id
        assert formula.code.startswith("RMF-")

    async def test_get_formula(self, db_session, create_user, create_formula):
        """获取配方详情"""
        user = await create_user(username="owner")
        formula = await create_formula(name="详情配方", creator_id=user.id)

        service = FormulaService(db_session)
        result = await service.get_formula(formula.id)

        assert result.id == formula.id
        assert result.name == "详情配方"

    async def test_get_formula_not_found(self, db_session):
        """获取不存在的配方"""
        service = FormulaService(db_session)
        with pytest.raises(Exception) as exc_info:
            await service.get_formula(99999)
        assert exc_info.value.status_code == 404

    async def test_list_formulas(self, db_session, create_user, create_formula):
        """配方列表查询"""
        user = await create_user(username="listuser")
        await create_formula(name="配方A", creator_id=user.id)
        await create_formula(name="配方B", creator_id=user.id)

        service = FormulaService(db_session)
        formulas, total = await service.list_formulas(page=1, page_size=10)

        assert total >= 2
        assert len(formulas) >= 2

    async def test_list_formulas_with_status_filter(self, db_session, create_user, create_formula):
        """按状态过滤配方列表"""
        user = await create_user(username="filteruser")
        await create_formula(name="草稿配方", creator_id=user.id, status=FormulaStatus.DRAFT)
        await create_formula(
            name="已审批配方", creator_id=user.id, status=FormulaStatus.APPROVED,
        )

        service = FormulaService(db_session)
        drafts, _ = await service.list_formulas(status=FormulaStatus.DRAFT)

        draft_names = [f.name for f in drafts]
        assert "草稿配方" in draft_names

    async def test_list_formulas_with_search(self, db_session, create_user, create_formula):
        """搜索配方"""
        user = await create_user(username="searchuser")
        await create_formula(name="人参养气汤", creator_id=user.id)
        await create_formula(name="枸杞补血方", creator_id=user.id)

        service = FormulaService(db_session)
        results, _ = await service.list_formulas(search="人参")

        names = [f.name for f in results]
        assert "人参养气汤" in names

    async def test_update_formula(self, db_session, create_user, create_formula):
        """更新配方"""
        from app.schemas.formula import FormulaUpdate

        user = await create_user(username="upduser")
        formula = await create_formula(name="原始名称", creator_id=user.id)

        service = FormulaService(db_session)
        updated = await service.update_formula(
            formula.id,
            data=FormulaUpdate(
                name="更新后名称",
                description="更新后描述",
            ),
            user_id=user.id,
        )

        assert updated.name == "更新后名称"
        assert updated.description == "更新后描述"
