"""
领域实体：纯 Python，零外部依赖

配方配方领域的核心实体定义。
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum, auto
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


# ──────────── 值对象 (Value Objects) ────────────


class FormulaStatus(Enum):
    """配方生命周期状态"""
    DRAFT = auto()         # 草稿
    UNDER_REVIEW = auto()  # 审核中
    REJECTED = auto()      # 已驳回
    APPROVED = auto()      # 已批准
    ARCHIVED = auto()      # 已归档


class EffectCategory(Enum):
    """功效分类"""
    ANTIOXIDANT = auto()       # 抗氧化
    ANTI_INFLAMMATORY = auto() # 抗炎
    BLOOD_SUGAR = auto()       # 血糖调节
    BLOOD_PRESSURE = auto()    # 血压调节
    IMMUNE = auto()            # 免疫调节
    GUT_HEALTH = auto()        # 肠道健康
    SLEEP = auto()             # 助眠
    ENERGY = auto()            # 提神
    SKIN = auto()              # 美容养颜
    LIVER = auto()             # 护肝


@dataclass(frozen=True)
class Ingredient:
    """原料值对象（不可变）"""
    tcm_id: str                    # TCMSP 数据库 ID
    name_cn: str                   # 中文名
    name_en: str                   # 英文名
    dosage_g: Decimal              # 用量（克）
    dosage_min_g: Decimal          # 最小用量
    dosage_max_g: Decimal          # 最大用量
    category: str                  # 原料类别
    active_compounds: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class FormulaId:
    """配方 ID 值对象"""
    value: str

    def __str__(self) -> str:
        return f"F-{self.value}"


@dataclass(frozen=True)
class NutrientProfile:
    """营养成分值对象"""
    protein_g: Optional[Decimal] = None
    fat_g: Optional[Decimal] = None
    carbohydrate_g: Optional[Decimal] = None
    fiber_g: Optional[Decimal] = None
    sodium_mg: Optional[Decimal] = None
    energy_kcal: Optional[Decimal] = None


# ──────────── 领域实体 (Domain Entities) ────────────


@dataclass
class Formula:
    """配方聚合根"""
    id: FormulaId
    name: str
    version: str
    description: str
    ingredients: List[Ingredient]
    target_effects: List[EffectCategory]
    status: FormulaStatus
    author_id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None
    nutrient_profile: Optional[NutrientProfile] = None
    tags: List[str] = field(default_factory=list)

    _domain_events: List[DomainEvent] = field(default_factory=list, repr=False)

    # ─── 领域行为 ───

    def add_ingredient(self, ingredient: Ingredient) -> None:
        """添加原料（执行领域规则校验）"""
        self._validate_ingredient_compatibility(ingredient)
        self._validate_dosage(ingredient)

        self.ingredients.append(ingredient)
        self.updated_at = datetime.utcnow()
        self._add_event(IngredientAddedEvent(
            formula_id=self.id,
            ingredient_id=ingredient.tcm_id,
            dosage_g=ingredient.dosage_g,
        ))

    def remove_ingredient(self, ingredient_id: str) -> None:
        """移除原料"""
        self.ingredients = [i for i in self.ingredients if i.tcm_id != ingredient_id]
        self.updated_at = datetime.utcnow()
        self._add_event(IngredientRemovedEvent(
            formula_id=self.id,
            ingredient_id=ingredient_id,
        ))

    def submit_for_review(self) -> None:
        """提交审核"""
        if self.status != FormulaStatus.DRAFT:
            raise FormulaDomainError("Only draft formulas can be submitted for review")
        if len(self.ingredients) < 1:
            raise FormulaDomainError("Formula must have at least one ingredient")

        self.status = FormulaStatus.UNDER_REVIEW
        self.updated_at = datetime.utcnow()
        self._add_event(FormulaSubmittedEvent(formula_id=self.id))

    def approve(self, reviewer_id: str) -> None:
        """批准配方"""
        if self.status != FormulaStatus.UNDER_REVIEW:
            raise FormulaDomainError("Only formulas under review can be approved")

        self.status = FormulaStatus.APPROVED
        self.approved_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self._add_event(FormulaApprovedEvent(
            formula_id=self.id,
            reviewer_id=reviewer_id,
        ))

    def reject(self, reviewer_id: str, reason: str) -> None:
        """驳回配方"""
        if self.status != FormulaStatus.UNDER_REVIEW:
            raise FormulaDomainError("Only formulas under review can be rejected")

        self.status = FormulaStatus.REJECTED
        self.updated_at = datetime.utcnow()
        self._add_event(FormulaRejectedEvent(
            formula_id=self.id,
            reviewer_id=reviewer_id,
            reason=reason,
        ))

    def archive(self) -> None:
        """归档配方"""
        self.status = FormulaStatus.ARCHIVED
        self.updated_at = datetime.utcnow()
        self._add_event(FormulaArchivedEvent(formula_id=self.id))

    # ─── 领域规则 ───

    def _validate_ingredient_compatibility(self, ingredient: Ingredient) -> None:
        """校验原料配伍禁忌"""
        # 十八条十九畏基础检查
        for existing in self.ingredients:
            if _INCOMPATIBLE_PAIRS.get(existing.tcm_id) == ingredient.tcm_id:
                raise FormulaDomainError(
                    f"原料 {existing.name_cn} 与 {ingredient.name_cn} 存在配伍禁忌"
                )

    def _validate_dosage(self, ingredient: Ingredient) -> None:
        """校验用量安全范围"""
        if ingredient.dosage_g > ingredient.dosage_max_g:
            raise FormulaDomainError(
                f"{ingredient.name_cn} 用量 {ingredient.dosage_g}g 超出安全上限 {ingredient.dosage_max_g}g"
            )
        if ingredient.dosage_g < ingredient.dosage_min_g:
            raise FormulaDomainError(
                f"{ingredient.name_cn} 用量 {ingredient.dosage_g}g 低于有效下限 {ingredient.dosage_min_g}g"
            )

    # ─── 事件收集 ───

    def _add_event(self, event: DomainEvent) -> None:
        self._domain_events.append(event)

    def collect_events(self) -> List[DomainEvent]:
        """收集并清空领域事件"""
        events = list(self._domain_events)
        self._domain_events.clear()
        return events


# ──────────── 领域事件 (Domain Events) ────────────


@dataclass
class DomainEvent:
    """领域事件基类"""
    formula_id: FormulaId = None  # placeholder — 子类应覆盖此字段

    def __post_init__(self) -> None:
        if not hasattr(self, 'timestamp'):
            self.timestamp = datetime.utcnow()


@dataclass
class IngredientAddedEvent:
    formula_id: FormulaId
    ingredient_id: str
    dosage_g: Decimal
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class IngredientRemovedEvent:
    formula_id: FormulaId
    ingredient_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FormulaSubmittedEvent:
    formula_id: FormulaId
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FormulaApprovedEvent:
    formula_id: FormulaId
    reviewer_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FormulaRejectedEvent:
    formula_id: FormulaId
    reviewer_id: str
    reason: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FormulaArchivedEvent:
    formula_id: FormulaId
    timestamp: datetime = field(default_factory=datetime.utcnow)


# ──────────── 领域异常 ────────────


class FormulaDomainError(Exception):
    """配方领域规则违反异常"""
    pass


# ──────────── 配伍禁忌表 ────────────

# 简化的"十八反"对照表（示例，实际需从知识图谱加载）
_INCOMPATIBLE_PAIRS: dict[str, str] = {
    # "ginseng": "veratrum",  # 人参反藜芦 (示例)
    # 正式实现应从 Neo4j 知识图谱加载
}
