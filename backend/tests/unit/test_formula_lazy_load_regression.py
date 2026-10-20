"""回归测试：FormulaService.create_formula 返回的配方已 eager-load 关联关系。

历史 bug：POST /api/v1/formulas 创建配方后，FastAPI 序列化 FormulaResponse 时访问
formula.ingredients / formula.peptides 懒加载关系，在 async greenlet 上下文外触发
MissingGreenlet（greenlet_spawn has not been called），导致 503 ResponseValidationError。

修复：create_formula 在返回前用 selectinload 重新加载 ingredients/peptides/creator/
reviewer；同时修复 _calculate_nutrition_summary 的懒加载与不存在的 properties 属性
（营养摘要现存入 formulas 表已有的 metadata_json 列）。

相关生产文件：
- app/services/formula/formula_module.py
- app/models/formula.py
"""
import pytest

from app.services.formula.formula_module import FormulaService

from app.models.formula import Ingredient
from app.models.enums import UserRole


@pytest.mark.asyncio
class TestFormulaCreateEagerLoad:
    """create_formula 返回的 ORM 对象关系应已加载，避免 MissingGreenlet"""

    async def test_create_formula_ingredients_loaded(self, db_session, create_user):
        user = await create_user(username="eageruser", role=UserRole.FORMULATOR)

        ing = Ingredient(name="回归测试人参", name_cn="回归测试人参", properties={"weight_g": 3})
        db_session.add(ing)
        await db_session.flush()

        data = type("FormulaCreate", (), {
            "name": "懒加载回归配方",
            "description": None,
            "target_effects": ["补气"],
            "composition": {},
            "processing_method": None,
            "dosage": None,
            "storage_conditions": None,
            "shelf_life": None,
            "ingredient_ids": [ing.id],
            "peptide_ids": [],
            "safety_check": None,
            "synergy_analysis": None,
        })()

        service = FormulaService(db_session)
        formula = await service.create_formula(data, creator_id=user.id)

        # 关键回归断言：在协程返回后访问懒加载关系不应抛 MissingGreenlet
        assert [i.id for i in formula.ingredients] == [ing.id]
        assert list(formula.peptides) == []

        # 营养摘要应写入 metadata_json（而非不存在的 properties）
        ns = (formula.metadata_json or {}).get("nutrition_summary")
        assert ns is not None
        assert ns["total_weight_g"] == 3

    async def test_create_formula_empty_relations_loaded(self, db_session, create_user):
        user = await create_user(username="eageruser2", role=UserRole.FORMULATOR)

        data = type("FormulaCreate", (), {
            "name": "空关系回归配方",
            "description": None,
            "target_effects": [],
            "composition": {},
            "processing_method": None,
            "dosage": None,
            "storage_conditions": None,
            "shelf_life": None,
            "ingredient_ids": [],
            "peptide_ids": [],
            "safety_check": None,
            "synergy_analysis": None,
        })()

        service = FormulaService(db_session)
        formula = await service.create_formula(data, creator_id=user.id)

        # 空关系也应已加载（返回空列表而非触发懒加载）
        assert formula.ingredients == []
        assert formula.peptides == []