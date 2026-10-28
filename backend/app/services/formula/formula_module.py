"""
配方服务
配方 CRUD、版本管理、审核流程、AI 推荐、协同效应分析
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    User, Formula, FormulaVersion, Ingredient, Peptide,
    UserRole, FormulaStatus, AuditLog, NotificationType,
    formula_ingredients, formula_peptides,
    Category, Tag,
)
from app.schemas.formula import FormulaCreate, FormulaUpdate, FormulaReviewRequest

logger = logging.getLogger(__name__)


class FormulaService:
    """配方业务逻辑"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 配方编号生成器 ──

    async def _generate_formula_code(self) -> str:
        """生成配方编号: RMF-YYYYMMDD-XXXX

        使用 PostgreSQL advisory lock 保证并发安全。
        如果 advisory lock 不可用（如 SQLite），静默降级回退到 COUNT 方案。
        """
        from sqlalchemy import text

        today = datetime.now().strftime("%Y%m%d")
        prefix = f"RMF-{today}-"

        # 尝试使用 PostgreSQL advisory lock
        try:
            lock_key = hash(f"formula_code_gen_{today}") % 2147483647
            await self.db.execute(text(f"SELECT pg_advisory_xact_lock({lock_key})"))
        except Exception as e:
            # 非 PostgreSQL 或 advisory lock 不可用，静默降级
            logger.debug("Advisory lock 不可用（降级）: %s", e)
            pass

        # 查询今日已有的配方数量
        result = await self.db.execute(
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
        organization_id: Optional[int] = None,
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
            organization_id=organization_id,
            safety_check=data.safety_check,
            synergy_analysis=data.synergy_analysis,
        )
        self.db.add(formula)

        try:
            await self.db.flush()

            # 关联成分
            if data.ingredient_ids:
                await self._bind_ingredients(formula, data.ingredient_ids)

            # 关联肽段
            if data.peptide_ids:
                await self._bind_peptides(formula, data.peptide_ids)

            # 创建初始版本快照
            await self._create_version_snapshot(formula, "初始版本", creator_id)

            # 自动计算营养成分
            await self._calculate_nutrition_summary(formula)

            await self._audit_log(
                action="formula.create",
                entity_type="formula",
                entity_id=formula.id,
                user_id=creator_id,
            )

            logger.info(f"创建配方: {code} - {formula.name}")

            # 重新加载关联关系（成分/肽段/创建者/审核者），避免响应序列化
            # FormulaResponse 时访问懒加载关系（ingredients/peptides/creator）
            # 在 async greenlet 上下文外触发 MissingGreenlet。
            result = await self.db.execute(
                select(Formula)
                .options(
                    selectinload(Formula.ingredients),
                    selectinload(Formula.peptides),
                    selectinload(Formula.creator),
                    selectinload(Formula.reviewer),
                )
                .where(Formula.id == formula.id)
            )
            return result.scalar_one()
        except Exception as e:
            await self.db.rollback()
            logger.warning("创建配方失败: %s", e)
            raise

    async def get_formula(self, formula_id: int) -> Formula:
        """获取配方详情（含成分和肽段）"""
        result = await self.db.execute(
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
        tags: Optional[list[int]] = None,
        category: Optional[list[int]] = None,
        created_start: Optional[str] = None,
        created_end: Optional[str] = None,
        updated_start: Optional[str] = None,
        updated_end: Optional[str] = None,
        sort_field: str = "updated_at",
        sort_order: str = "desc",
        sort_field2: Optional[str] = None,
        sort_order2: str = "asc",
        organization_id: Optional[int] = None,
        include_deleted: bool = False,
    ) -> tuple[list[Formula], int]:
        """配方列表（分页 + 过滤 + 搜索 + 排序）"""
        # 排序字段映射
        sort_map: dict[str, object] = {
            "name": Formula.name,
            "status": Formula.status,
            "created_at": Formula.created_at,
            "updated_at": Formula.updated_at,
            "version": Formula.version,
        }

        query = select(Formula).options(
            selectinload(Formula.creator),
            selectinload(Formula.ingredients),
            selectinload(Formula.peptides),
            selectinload(Formula.tags),
            selectinload(Formula.categories),
        )

        # 软删除过滤：delete_formula 用 status=ARCHIVED 表示软删除（formulas 表无 deleted_at 列，
        # 原 `hasattr(Formula, 'deleted_at')` 恒为 False，导致已归档配方仍出现在默认列表）。
        # 默认（未指定状态过滤且不 include_deleted）排除已归档；指定状态过滤时按状态显示（可查看归档）。
        if not include_deleted and status is None:
            query = query.where(Formula.status != FormulaStatus.ARCHIVED)

        # ── 多租户隔离 ──
        if organization_id is not None:
            query = query.where(Formula.organization_id == organization_id)

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

        # 标签过滤（多值 OR）
        if tags and len(tags) > 0:
            query = query.join(Formula.tags).where(Tag.id.in_(tags))

        # 分类过滤（多值 OR）
        if category and len(category) > 0:
            query = query.join(Formula.categories).where(Category.id.in_(category))

        # 创建日期范围（naive datetime，匹配 TIMESTAMP WITHOUT TIME ZONE）
        if created_start:
            start_dt = datetime.fromisoformat(created_start.replace("Z", "+00:00"))
            start_dt = start_dt.replace(tzinfo=None)  # 去除时区，转为 naive
            query = query.where(Formula.created_at >= start_dt)
        if created_end:
            end_dt = datetime.fromisoformat(created_end.replace("Z", "+00:00")) + timedelta(days=1)
            end_dt = end_dt.replace(tzinfo=None)  # 去除时区，转为 naive
            query = query.where(Formula.created_at < end_dt)

        # 更新日期范围（naive datetime）
        if updated_start:
            start_dt = datetime.fromisoformat(updated_start.replace("Z", "+00:00"))
            start_dt = start_dt.replace(tzinfo=None)
            query = query.where(Formula.updated_at >= start_dt)
        if updated_end:
            end_dt = datetime.fromisoformat(updated_end.replace("Z", "+00:00")) + timedelta(days=1)
            end_dt = end_dt.replace(tzinfo=None)
            query = query.where(Formula.updated_at < end_dt)

        # 总数
        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        # 排序
        primary_col = sort_map.get(sort_field, Formula.updated_at)
        primary_order = primary_col.desc() if sort_order == "desc" else primary_col.asc()

        if sort_field2 and sort_field2 in sort_map:
            secondary_col = sort_map[sort_field2]
            secondary_order = secondary_col.desc() if sort_order2 == "desc" else secondary_col.asc()
            query = query.order_by(primary_order, secondary_order)
        else:
            query = query.order_by(primary_order)

        # 分页
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
        """恢复到指定版本（恢复标量字段 + 成分/肽段关联）"""
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
        # 从快照恢复标量字段
        data = snapshot.snapshot
        for field in ["name", "description", "target_effects", "composition",
                       "processing_method", "dosage", "storage_conditions", "shelf_life"]:
            if field in data:
                setattr(formula, field, data[field])

        try:
            # 恢复成分关联
            ingredient_ids = data.get("ingredient_ids")
            if ingredient_ids is not None:
                await self._bind_ingredients(formula, ingredient_ids)

            # 恢复肽段关联
            peptide_ids = data.get("peptide_ids")
            if peptide_ids is not None:
                await self._bind_peptides(formula, peptide_ids)

            formula.version += 1
            await self.db.flush()

            await self._create_version_snapshot(formula, f"从版本 v{version} 恢复", user_id)

            return formula
        except Exception as e:
            await self.db.rollback()
            logger.warning("恢复配方版本失败: %s", e)
            raise

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
            from app.services.notification import NotificationService
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
            from app.services.notification import NotificationService
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

    async def publish_formula(
        self,
        formula_id: int,
        publisher_id: int,
    ) -> Formula:
        """发布配方（仅 APPROVED 状态可发布）"""
        formula = await self.get_formula(formula_id)

        if formula.status != FormulaStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅审核通过的配方可以发布",
            )

        formula.status = FormulaStatus.PUBLISHED
        await self.db.flush()

        await self._audit_log(
            action="formula.publish",
            entity_type="formula",
            entity_id=formula_id,
            user_id=publisher_id,
        )

        # 通知团队成员
        try:
            from app.services.notification import NotificationService
            notif_svc = NotificationService(self.db)
            await notif_svc.create_notification(
                user_id=formula.creator_id,
                type_=NotificationType.FORMULA_REVIEW,
                title=f"配方已发布: {formula.name}",
                content=f"配方 {formula.code} 已由管理员发布，团队成员可查看。",
                link=f"/formulas/{formula_id}",
                metadata={"formula_id": formula_id},
            )
        except Exception as e:
            logger.warning(f"发送发布通知失败: {e}")

        logger.info(f"配方已发布: {formula.code}")
        return formula

    async def archive_formula(
        self,
        formula_id: int,
        user_id: int,
    ) -> Formula:
        """归档配方（已发布或草稿状态可归档）"""
        formula = await self.get_formula(formula_id)

        if formula.status not in (FormulaStatus.PUBLISHED, FormulaStatus.DRAFT):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅已发布或草稿状态的配方可以归档",
            )

        formula.status = FormulaStatus.ARCHIVED
        await self.db.flush()

        await self._audit_log(
            action="formula.archive",
            entity_type="formula",
            entity_id=formula_id,
            user_id=user_id,
        )

        logger.info(f"配方已归档: {formula.code}")
        return formula

    async def batch_update_status(
        self,
        ids: list[int],
        status: str,
        user_id: int,
    ) -> int:
        """批量更新配方状态"""
        from sqlalchemy import update
        try:
            result = await self.db.execute(
                update(Formula)
                .where(Formula.id.in_(ids))
                .values(status=status, updated_at=datetime.utcnow())
            )
            await self.db.commit()
            updated_count = result.rowcount
            logger.info(f"批量更新配方状态: {updated_count} 个 -> {status}")
            return updated_count
        except Exception as e:
            await self.db.rollback()
            logger.warning("更新配方状态失败: %s", e)
            raise

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
        """绑定配方成分（批量插入）"""
        # 先清除旧关联
        await self.db.execute(
            formula_ingredients.delete().where(
                formula_ingredients.c.formula_id == formula.id
            )
        )
        # 批量插入新关联
        if ingredient_ids:
            await self.db.execute(
                formula_ingredients.insert(),
                [
                    {"formula_id": formula.id, "ingredient_id": ing_id}
                    for ing_id in ingredient_ids
                ],
            )

    async def _calculate_nutrition_summary(self, formula: Formula) -> None:
        """自动计算配方营养成分摘要"""
        try:
            from ..formula.nutrition_service import FormulaNutritionService

            # 显式查询配方成分（避免访问懒加载关系 formula.ingredients 在
            # async greenlet 上下文外触发 MissingGreenlet，导致营养摘要静默失败）
            result = await self.db.execute(
                select(Ingredient)
                .join(formula_ingredients, formula_ingredients.c.ingredient_id == Ingredient.id)
                .where(formula_ingredients.c.formula_id == formula.id)
            )
            ingredients = result.scalars().all()

            ingredients_data = []
            for ing in ingredients:
                weight_g = ing.properties.get("weight_g", 0) if ing.properties else 0
                ingredients_data.append({
                    "ingredient_id": ing.id,
                    "name": ing.name,
                    "weight_g": weight_g,
                    "category": ing.category,
                })

            total_weight = sum(d["weight_g"] for d in ingredients_data)
            if total_weight <= 0:
                return

            service = FormulaNutritionService()
            nutrition = service.calculate(ingredients_data, total_weight)

            # 存储营养摘要到配方的 metadata_json（原实现使用不存在的
            # formula.properties 属性，导致营养计算一直静默失败）
            if not formula.metadata_json:
                formula.metadata_json = {}
            formula.metadata_json["nutrition_summary"] = {
                "total_weight_g": round(total_weight, 2),
                "per_100g": nutrition.get("per_100g", {}),
                "allergens": nutrition.get("allergens", []),
                "compliance": nutrition.get("compliance", {}),
                "warnings": nutrition.get("warnings", []),
            }
            logger.info(f"配方 {formula.code} 营养计算完成")
        except Exception as e:
            logger.warning(f"配方 {getattr(formula, 'code', '?')} 营养计算失败: {e}")

    async def _bind_peptides(self, formula: Formula, peptide_ids: list[int]):
        """绑定配方肽段（批量插入）"""
        await self.db.execute(
            formula_peptides.delete().where(
                formula_peptides.c.formula_id == formula.id
            )
        )
        if peptide_ids:
            await self.db.execute(
                formula_peptides.insert(),
                [
                    {"formula_id": formula.id, "peptide_id": pep_id}
                    for pep_id in peptide_ids
                ],
            )

    async def _create_version_snapshot(
        self, formula: Formula, change_summary: str, created_by: int
    ) -> FormulaVersion:
        """创建版本快照（包含标量字段 + 成分/肽段关联 ID 列表）"""
        # 查询当前关联的成分和肽段 ID
        ingredient_ids = [
            row[0] for row in (await self.db.execute(
                select(formula_ingredients.c.ingredient_id)
                .where(formula_ingredients.c.formula_id == formula.id)
            )).all()
        ]
        peptide_ids = [
            row[0] for row in (await self.db.execute(
                select(formula_peptides.c.peptide_id)
                .where(formula_peptides.c.formula_id == formula.id)
            )).all()
        ]

        snapshot_data = {
            "name": formula.name,
            "description": formula.description,
            "target_effects": formula.target_effects,
            "composition": formula.composition,
            "processing_method": formula.processing_method,
            "dosage": formula.dosage,
            "storage_conditions": formula.storage_conditions,
            "shelf_life": formula.shelf_life,
            "ingredient_ids": ingredient_ids,
            "peptide_ids": peptide_ids,
        }

        snapshot = FormulaVersion(
            formula_id=formula.id,
            version=formula.version,
            snapshot=snapshot_data,
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
            resource_type=entity_type,
            resource_id=entity_id,
            details=details,
        )
        self.db.add(log)
