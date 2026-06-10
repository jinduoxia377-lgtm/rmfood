"""
配方应用服务 — 用例编排

使用六边形架构：应用服务依赖端口（接口），不依赖具体技术实现
"""
from __future__ import annotations
from typing import Optional, List
from decimal import Decimal

from ..domain.entities import (
    Formula, FormulaId, Ingredient, NutrientProfile,
    FormulaStatus, EffectCategory,
    FormulaDomainError, DomainEvent,
)
from ..domain.ports import FormulaRepository, EventPublisher, IngredientRepository


class FormulaApplicationService:
    """
    配方应用服务

    依赖反转：构造函数注入端口接口，而非具体实现
    """

    def __init__(
        self,
        formula_repo: FormulaRepository,
        ingredient_repo: IngredientRepository,
        event_publisher: EventPublisher,
    ):
        self._formula_repo = formula_repo
        self._ingredient_repo = ingredient_repo
        self._event_publisher = event_publisher

    # ─── 创建配方（Create） ───

    async def create_formula(
        self,
        name: str,
        description: str,
        target_effects: List[EffectCategory],
        author_id: str,
        organization_id: str,
    ) -> Formula:
        """创建新配方"""
        # 检查同名配方
        existing = await self._formula_repo.get_by_name(name)
        if existing:
            raise FormulaDomainError(f"配方名称 '{name}' 已存在")

        formula = Formula(
            id=FormulaId(value=uuid4_str()),
            name=name,
            version="1.0.0",
            description=description,
            ingredients=[],
            target_effects=target_effects,
            status=FormulaStatus.DRAFT,
            author_id=author_id,
            organization_id=organization_id,
        )

        await self._formula_repo.save(formula)
        await self._publish_events(formula)

        return formula

    # ─── 添加原料 ───

    async def add_ingredient_to_formula(
        self,
        formula_id: str,
        tcm_id: str,
        name_cn: str,
        name_en: str,
        dosage_g: Decimal,
        category: str,
    ) -> Formula:
        """向配方添加原料"""
        formula = await self._get_formula_or_raise(FormulaId(value=formula_id))

        # 获取安全用量范围
        dosage_range = await self._ingredient_repo.get_dosage_range(tcm_id)

        ingredient = Ingredient(
            tcm_id=tcm_id,
            name_cn=name_cn,
            name_en=name_en,
            dosage_g=dosage_g,
            dosage_min_g=Decimal(str(dosage_range[0])),
            dosage_max_g=Decimal(str(dosage_range[1])),
            category=category,
        )

        # 领域规则验证（在实体内部执行）
        formula.add_ingredient(ingredient)

        await self._formula_repo.save(formula)
        await self._publish_events(formula)

        return formula

    # ─── 提交审核（状态变更） ───

    async def submit_formula_for_review(self, formula_id: str) -> Formula:
        """提交配方进入审核流程"""
        formula = await self._get_formula_or_raise(FormulaId(value=formula_id))
        formula.submit_for_review()

        await self._formula_repo.save(formula)
        await self._publish_events(formula)

        return formula

    async def approve_formula(self, formula_id: str, reviewer_id: str) -> Formula:
        """批准配方"""
        formula = await self._get_formula_or_raise(FormulaId(value=formula_id))
        formula.approve(reviewer_id)

        await self._formula_repo.save(formula)
        await self._publish_events(formula)

        return formula

    async def reject_formula(self, formula_id: str, reviewer_id: str, reason: str) -> Formula:
        """驳回配方"""
        formula = await self._get_formula_or_raise(FormulaId(value=formula_id))
        formula.reject(reviewer_id, reason)

        await self._formula_repo.save(formula)
        await self._publish_events(formula)

        return formula

    # ─── 查询 ───

    async def get_formula(self, formula_id: str) -> Optional[Formula]:
        return await self._formula_repo.get_by_id(FormulaId(value=formula_id))

    async def list_draft_formulas(self, limit: int = 20) -> List[Formula]:
        return await self._formula_repo.find_by_status("DRAFT", limit)

    async def list_pending_review(self, limit: int = 20) -> List[Formula]:
        return await self._formula_repo.find_by_status("UNDER_REVIEW", limit)

    # ─── 内部辅助 ───

    async def _get_formula_or_raise(self, id: FormulaId) -> Formula:
        formula = await self._formula_repo.get_by_id(id)
        if not formula:
            raise FormulaDomainError(f"配方不存在: {id}")
        return formula

    async def _publish_events(self, aggregate: Formula) -> None:
        """发布聚合根产生的所有领域事件"""
        for event in aggregate.collect_events():
            await self._event_publisher.publish(event)


def uuid4_str() -> str:
    """生成 UUID4 字符串（避免 domain 层导入 uuid 造成混淆）"""
    import uuid
    return str(uuid.uuid4())
