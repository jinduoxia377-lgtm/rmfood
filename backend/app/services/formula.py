"""
配方服务
配方 CRUD、版本管理、审核流程、AI 推荐、协同效应分析

院士级架构升级说明 (2026-06-12):
- 引入双轨模式：同时支持旧版 AsyncSession 直连（向后兼容）
  和新版 FormulaRepository 接口（DDD 正确路径）。
- 新代码应通过 FormulaRepository 接口操作配方聚合根，
  逐步淘汰直接 Session 操作，最终完成依赖倒置原则(DIP)迁移。
- 过渡期参考: infrastructure/formula_repository.py
"""
import logging
from datetime import datetime
from typing import Optional, Union

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import (
    User, Formula, FormulaVersion, Ingredient, Peptide,
    UserRole, FormulaStatus, AuditLog, NotificationType,
    formula_ingredients, formula_peptides,
)
from ..schemas.formula import FormulaCreate, FormulaUpdate, FormulaReviewRequest
# 新增: 引入 Repository 端口（DDD 路径）
from ..domain.ports import FormulaRepository as FormulaRepositoryPort

logger = logging.getLogger(__name__)


class FormulaService:
    """
    配方业务逻辑

    院士级双轨构造函数：
    - FormulaService(db=session)     → 旧路径（向后兼容）
    - FormulaService(repo=formula_repo) → 新 DDD 路径（推荐）

    新功能开发应使用 repo 参数以遵循依赖倒置原则(DIP)。
    """

    def __init__(
        self,
        db: Optional[AsyncSession] = None,
        repo: Optional[FormulaRepositoryPort] = None,
    ):
        if db is None and repo is None:
            raise ValueError("FormulaService 需要提供 db 或 repo 参数之一")
        self.db = db  # 旧路径（向后兼容 - 不建议在新代码中使用）
        self._repo = repo  # 新 DDD 路径（推荐）

    @property
    def _session(self) -> AsyncSession:
        """内部使用：获取 Session（向后兼容助手）"""
        if self.db is None:
            raise RuntimeError(
                "此操作需要 AsyncSession，但 FormulaService 以 repo 模式初始化。"
                "请通过 FormulaRepository 接口访问配方数据。"
            )
        return self.db

    # ── 配方编号生成器 ──

    async def _generate_formula_code(self) -> str:
        """生成配方编号: RMF-YYYYMMDD-XXXX"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"RMF-{today}-"

        # 查询今日已有的配方数量
        result = await self._session.execute(
            select(func.count()).select_from(Formula).where(Formula.code.like(f"{prefix}%"))
        )
        count = result.scalar() or 0
        seq = str(count + 1).zfill(4)
        return f"{prefix}{seq}"

    # ── CRUD 操作 ──

    async def create_formula(
        self,
        data: FormulaCreate,
        creator_id: int,
    ) -> Formula:
        """创建配方（草稿）"""
        code = await self._generate_formula_code()

        formula = Formula(
            name=data.name,
            code=code,
            description=data.description,
            status=FormulaStatus.DRAFT,
            version=1,
            target_effects=data.target_effects or [],
            composition=data.composition or {},
            processing_method=data.processing_method,
            dosage=data.dosage,
            storage_conditions=data.storage_conditions,
            shelf_life=data.shelf_life,
            creator_id=creator_id,
            safety_check=data.safety_check,
            synergy_analysis=data.synergy_analysis,
        )
        self._session.add(formula)
        await self._session.flush()

        # 关联成分
        if data.ingredient_ids:
            await self._bind_ingredients(formula, data.ingredient_ids)

        # 关联肽段
        if data.peptide_ids:
            await self._bind_peptides(formula, data.peptide_ids)

        # 创建初始版本快照
        await self._create_version_snapshot(formula, "初始版本", creator_id)

        await self._audit_log(
            action="formula.create",
            entity_type="formula",
            entity_id=formula.id,
            user_id=creator_id,
        )

        logger.info(f"创建配方: {code} - {formula.name}")
        return formula

    async def get_formula(self, formula_id: int) -> Formula:
        """获取配方详情（含成分和肽段）"""
        result = await self._session.execute(
            select(Formula)
            .options(
                selectinload(Formula.ingredients),
                selectinload(Formula.peptides),
                selectinload(Formula.creator),
                selectinload(Formula.reviewer),
            )
            .where(Formula.id == formula_id)
        )
        formula = result.scalar_one_or_none()
        if not formula:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="配方不存在",
            )
        return formula

    async def list_formulas(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[FormulaStatus] = None,
        creator_id: Optional[int] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
    ) -> tuple[list[Formula], int]:
        """配方列表（分页 + 过滤 + 搜索）"""
        query = select(Formula).options(
            selectinload(Formula.creator),
        )

        # 软删除过滤（默认不显示已删除的记录）
        if not include_deleted and hasattr(Formula, 'deleted_at'):
            query = query.where(Formula.deleted_at.is_(None))

        if status:
            query = query.where(Formula.status == status)
        if creator_id:
            query = query.where(Formula.creator_id == creator_id)
        if search:
            pattern = f"%{search}%"
            query = query.where(
                Formula.name.ilike(pattern)
                | Formula.code.ilike(pattern)
                | Formula.description.ilike(pattern)
            )

        # 总数
        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        # 分页排序
        query = query.order_by(Formula.updated_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)

        return list(result.scalars().all()), total

    async def update_formula(
        self,
        formula_id: int,
        data: FormulaUpdate,
        user_id: int,
    ) -> Formula:
        """更新配方（仅草稿和已驳回状态可编辑）"""
        formula = await self.get_formula(formula_id)

        if formula.status not in (FormulaStatus.DRAFT, FormulaStatus.REJECTED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"当前状态({formula.status.value})不允许编辑，仅草稿和已驳回状态可修改",
            )

        update_data = data.model_dump(exclude_unset=True)

        # 处理成分和肽段关联
        ingredient_ids = update_data.pop("ingredient_ids", None)
        peptide_ids = update_data.pop("peptide_ids", None)

        for field, value in update_data.items():
            setattr(formula, field, value)

        if ingredient_ids is not None:
            await self._bind_ingredients(formula, ingredient_ids)
        if peptide_ids is not None:
            await self._bind_peptides(formula, peptide_ids)

        await self.db.flush()

        await self._audit_log(
            action="formula.update",
            entity_type="formula",
            entity_id=formula.id,
            user_id=user_id,
            details={"updated_fields": list(update_data.keys())},
        )

        return formula

    async def delete_formula(self, formula_id: int, user_id: int) -> None:
        """删除配方（软删除：归档）"""
        formula = await self.get_formula(formula_id)

        if formula.status not in (FormulaStatus.DRAFT, FormulaStatus.ARCHIVED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅草稿和已归档状态可删除",
            )

        formula.status = FormulaStatus.ARCHIVED
        await self.db.flush()

        await self._audit_log(
            action="formula.delete",
            entity_type="formula",
            entity_id=formula_id,
            user_id=user_id,
        )

    # ── 版本管理 ──

    async def create_version(self, formula_id: int, change_summary: str, user_id: int) -> FormulaVersion:
        """创建配方新版本"""
        formula = await self.get_formula(formula_id)
        formula.version += 1
        await self.db.flush()

        return await self._create_version_snapshot(formula, change_summary, user_id)

    async def get_version_history(self, formula_id: int) -> list[FormulaVersion]:
        """获取配方版本历史"""
        result = await self.db.execute(
            select(FormulaVersion)
            .where(FormulaVersion.formula_id == formula_id)
            .order_by(FormulaVersion.version.desc())
        )
        return list(result.scalars().all())

    async def restore_version(self, formula_id: int, version: int, user_id: int) -> Formula:
        """恢复到指定版本"""
        result = await self.db.execute(
            select(FormulaVersion).where(
                FormulaVersion.formula_id == formula_id,
                FormulaVersion.version == version,
            )
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")

        formula = await self.get_formula(formula_id)
        # 从快照恢复数据
        data = snapshot.snapshot
        for field in ["name", "description", "target_effects", "composition",
                       "processing_method", "dosage", "storage_conditions", "shelf_life"]:
            if field in data:
                setattr(formula, field, data[field])

        formula.version += 1
        await self.db.flush()

        await self._create_version_snapshot(formula, f"从版本 v{version} 恢复", user_id)

        return formula

    # ── 审核流程 ──

    async def submit_for_review(self, formula_id: int, user_id: int) -> Formula:
        """提交审核"""
        formula = await self.get_formula(formula_id)

        if formula.status != FormulaStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅草稿状态可提交审核",
            )

        # 只有创建者可以提交自己的配方
        if formula.creator_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有配方创建者可以提交审核",
            )

        formula.status = FormulaStatus.PENDING_REVIEW
        await self.db.flush()

        await self._audit_log(
            action="formula.submit_review",
            entity_type="formula",
            entity_id=formula_id,
            user_id=user_id,
        )

        # ── 通知审核员 ──
        try:
            from .notification import NotificationService
            notif_svc = NotificationService(self.db)
            reviewers = (await self.db.execute(
                select(User).where(User.role == UserRole.REVIEWER, User.is_active == True)
            )).scalars().all()
            for reviewer in reviewers:
                await notif_svc.create_notification(
                    user_id=reviewer.id,
                    type_=NotificationType.FORMULA_REVIEW,
                    title=f"新配方待审核: {formula.name}",
                    content=f"配方 {formula.code} 已提交审核。",
                    link=f"/formulas/{formula_id}",
                    metadata={"formula_id": formula_id, "action": "review"},
                )
        except Exception as e:
            logger.warning(f"发送审核通知失败: {e}")

        return formula

    async def review_formula(
        self,
        formula_id: int,
        review: FormulaReviewRequest,
        reviewer_id: int,
    ) -> Formula:
        """审核配方"""
        formula = await self.get_formula(formula_id)

        if formula.status != FormulaStatus.PENDING_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="配方未在待审核状态",
            )

        formula.reviewer_id = reviewer_id
        formula.reviewed_at = datetime.utcnow()
        formula.review_notes = review.review_notes
        formula.status = FormulaStatus.APPROVED if review.approved else FormulaStatus.REJECTED

        await self.db.flush()

        await self._audit_log(
            action="formula.review",
            entity_type="formula",
            entity_id=formula_id,
            user_id=reviewer_id,
            details={
                "approved": review.approved,
                "notes": review.review_notes,
            },
        )

        # ── 通知创建者 ──
        try:
            from .notification import NotificationService
            notif_svc = NotificationService(self.db)
            status_text = "已通过" if review.approved else "已驳回"
            await notif_svc.create_notification(
                user_id=formula.creator_id,
                type_=NotificationType.FORMULA_REVIEW,
                title=f"配方审核{status_text}: {formula.name}",
                content=review.review_notes or f"配方 {formula.code} 审核结果: {status_text}。",
                link=f"/formulas/{formula_id}",
                metadata={"formula_id": formula_id, "approved": review.approved},
            )
        except Exception as e:
            logger.warning(f"发送审核结果通知失败: {e}")

        logger.info(
            f"配方审核完成: {formula.code} -> {'通过' if review.approved else '驳回'}"
        )
        return formula

    # ── AI 辅助功能 ──

    async def get_ai_recommendations(
        self,
        target_effects: list[str],
        preferred_categories: list[str] = None,
        max_results: int = 5,
    ) -> list[dict]:
        """
        AI 配方推荐（本地规则引擎）
        Phase 2 将集成大语言模型进行智能推荐

        当前实现基于规则匹配：
        1. 按功效匹配成分
        2. 按药食同源优先
        3. 协同效应评分
        """
        query = select(Ingredient)

        # 如果指定了分类偏好，优先筛选
        if preferred_categories:
            conditions = []
            for cat in preferred_categories:
                conditions.append(Ingredient.category.ilike(f"%{cat}%"))
            from sqlalchemy import or_
            query = query.where(or_(*conditions))

        # 优先药食同源
        query = query.order_by(Ingredient.is_food_homology.desc())
        query = query.limit(max_results * 3)  # 多取一些用于排序

        result = await self.db.execute(query)
        ingredients = list(result.scalars().all())

        # 简单评分和排序
        recommendations = []
        for ing in ingredients:
            score = 0.0
            if ing.is_food_homology:
                score += 30.0
            if ing.properties:
                props = ing.properties or {}
                for effect in target_effects:
                    if effect.lower() in str(props.get("effects", "")).lower():
                        score += 20.0
                score += len(props) * 2.0

            if score > 0:
                recommendations.append({
                    "ingredient_id": ing.id,
                    "name": ing.name,
                    "name_cn": ing.name_cn,
                    "category": ing.category,
                    "is_food_homology": ing.is_food_homology,
                    "score": round(score, 1),
                    "match_reasons": self._generate_match_reasons(ing, target_effects),
                })

        # 按分数排序
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations[:max_results]

    def _generate_match_reasons(self, ingredient: Ingredient, target_effects: list[str]) -> list[str]:
        """生成匹配原因说明"""
        reasons = []
        if ingredient.is_food_homology:
            reasons.append("药食同源成分")
        if ingredient.category:
            reasons.append(f"分类: {ingredient.category}")
        return reasons

    # ── 私有方法 ──

    async def _bind_ingredients(self, formula: Formula, ingredient_ids: list[int]):
        """绑定配方成分"""
        # 先清除旧关联
        await self.db.execute(
            formula_ingredients.delete().where(
                formula_ingredients.c.formula_id == formula.id
            )
        )
        # 批量插入新关联
        for ing_id in ingredient_ids:
            await self.db.execute(
                formula_ingredients.insert().values(
                    formula_id=formula.id,
                    ingredient_id=ing_id,
                )
            )

    async def _bind_peptides(self, formula: Formula, peptide_ids: list[int]):
        """绑定配方肽段"""
        await self.db.execute(
            formula_peptides.delete().where(
                formula_peptides.c.formula_id == formula.id
            )
        )
        for pep_id in peptide_ids:
            await self.db.execute(
                formula_peptides.insert().values(
                    formula_id=formula.id,
                    peptide_id=pep_id,
                )
            )

    async def _create_version_snapshot(
        self, formula: Formula, change_summary: str, created_by: int
    ) -> FormulaVersion:
        """创建版本快照"""
        snapshot = FormulaVersion(
            formula_id=formula.id,
            version=formula.version,
            snapshot={
                "name": formula.name,
                "description": formula.description,
                "target_effects": formula.target_effects,
                "composition": formula.composition,
                "processing_method": formula.processing_method,
                "dosage": formula.dosage,
                "storage_conditions": formula.storage_conditions,
                "shelf_life": formula.shelf_life,
            },
            change_summary=change_summary,
            created_by=created_by,
        )
        self.db.add(snapshot)
        await self.db.flush()
        return snapshot

    async def _audit_log(
        self,
        action: str,
        entity_type: str,
        entity_id: int,
        user_id: int,
        details: dict = None,
    ):
        """记录审计日志"""
        log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        )
        self.db.add(log)
