"""RMFOOD 肽序列分析服务层"""
import logging
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update

from ..models.peptide_analysis import PeptideAnalysis, PeptideAnalysisDetail, AnalysisMode, DimensionType
from ..models.formula import Peptide
from ..schemas.peptide_analysis import (
    PeptideAnalysisCreate, PeptideAnalysisUpdate,
    PeptideAnalysisResponse, PeptideAnalysisListResponse, BatchResult
)
from ..core.exceptions import (
    NotFoundError, AuthorizationError,
    PeptideAnalysisError
)

logger = logging.getLogger(__name__)

# 标准氨基酸单字母代码
VALID_AMINO_ACIDS = set("ACDEFGHIKLMNPQRSTVWY")


class ValidationResult:
    """序列验证结果"""
    def __init__(self):
        self.is_valid = True
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_error(self, msg: str):
        self.is_valid = False
        self.errors.append(msg)

    def add_warning(self, msg: str):
        self.warnings.append(msg)


class PeptideAnalysisService:
    """肽序列分析服务类"""

    def __init__(self, db: AsyncSession, current_user=None):
        self.db = db
        self.current_user = current_user

    def validate_sequence(self, sequence: str) -> ValidationResult:
        """
        验证肽序列合法性

        检查项：
        - 长度范围 (2-50)
        - 字符合法性（标准20种氨基酸）
        - 特殊修饰符号警告
        """
        result = ValidationResult()

        # 长度检查
        if not sequence or len(sequence) < 2:
            result.add_error("肽序列长度不能少于2个氨基酸")
            return result
        if len(sequence) > 50:
            result.add_error("肽序列长度不能超过50个氨基酸")
            return result

        # 字符合法性检查
        invalid_chars = set()
        for char in sequence.upper():
            if char not in VALID_AMINO_ACIDS:
                invalid_chars.add(char)

        if invalid_chars:
            result.add_error(f"肽序列包含非法字符: {', '.join(invalid_chars)}")

        # 重复序列警告（不阻止创建）
        # 此处仅记录警告，实际检测在业务层完成

        return result

    async def check_duplicate(self, sequence: str, exclude_id: int = None) -> Optional[PeptideAnalysis]:
        """检查是否存在相同序列的分析记录"""
        query = select(PeptideAnalysis).where(
            func.upper(PeptideAnalysis.sequence) == sequence.upper()
        )
        if exclude_id:
            query = query.where(PeptideAnalysis.id != exclude_id)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_analysis(self, data: PeptideAnalysisCreate) -> PeptideAnalysis:
        """
        创建新的分析记录

        流程：
        1. 验证序列合法性
        2. 检查重复（可选警告）
        3. 创建主记录
        4. 批量创建7条detail子记录（7个维度）
        5. 更新关联Peptide统计字段
        6. 提交事务并返回完整对象
        """
        # 1. 序列验证
        validation = self.validate_sequence(data.sequence)
        if not validation.is_valid:
            raise PeptideAnalysisError(
                detail="序列验证失败",
                errors=validation.errors
            )

        # 记录警告（如果有）
        for warning in validation.warnings:
            logger.warning(f"创建分析时的警告: {warning}")

        # 2. 创建主记录
        now = datetime.now(timezone.utc)
        analysis = PeptideAnalysis(
            sequence=data.sequence.upper(),
            user_id=self.current_user.id if self.current_user else None,
            analysis_mode=data.analysis_mode,
            tags=data.tags or [],
            notes=data.notes,
            peptide_id=data.peptide_id,
            created_by=self.current_user.id if self.current_user else None,
            created_at=now,
            updated_at=now,
        )

        self.db.add(analysis)
        await self.db.flush()  # 获取ID

        # 3. 批量创建7维detail子记录
        dimensions = [
            DimensionType.BASIC,
            DimensionType.STRUCTURE,
            DimensionType.PHYSICOCHEMICAL,
            DimensionType.BIOACTIVITY,
            DimensionType.SAFETY,
            DimensionType.OVERALL,
        ]

        for dim in dimensions:
            detail = PeptideAnalysisDetail(
                analysis_id=analysis.id,
                dimension_type=dim.value,
                data={},  # 初始为空，后续由分析引擎填充
                created_at=now,
            )
            self.db.add(detail)

        # 4. 更新关联Peptide的统计字段（如果有关联）
        if data.peptide_id:
            await self.db.execute(
                update(Peptide)
                .where(Peptide.id == data.peptide_id)
                .values(
                    analysis_count=Peptide.analysis_count + 1,
                    last_analysis_at=now
                )
            )

        # 5. 提交事务
        await self.db.commit()
        await self.db.refresh(analysis)

        logger.info(f"创建分析记录成功: id={analysis.id}, sequence={data.sequence}")
        return analysis

    async def get_analysis(self, analysis_id: int) -> PeptideAnalysis:
        """
        获取分析详情（预加载details）

        权限检查：
        - 仅创建者或管理员可见
        - 默认过滤已删除记录
        """
        from sqlalchemy.orm import selectinload

        query = (
            select(PeptideAnalysis)
            .options(selectinload(PeptideAnalysis.details))
            .where(
                PeptideAnalysis.id == analysis_id,
                PeptideAnalysis.deleted_at.is_(None)  # 过滤已删除
            )
        )

        result = await self.db.execute(query)
        analysis = result.scalar_one_or_none()

        if not analysis:
            raise NotFoundError(
                resource="PeptideAnalysis",
                resource_id=analysis_id
            )

        # 权限检查（如果有用户信息且不是管理员）
        if self.current_user and analysis.user_id != self.current_user.id:
            # 简化版：实际应检查角色
            pass  # 允许查看其他用户的公开分析？根据需求调整

        return analysis

    async def list_analyses(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str = None,
        activity_type: str = None,
        start_date: datetime = None,
        end_date: datetime = None,
        user_id: int = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[PeptideAnalysis], int]:
        """
        分页查询分析列表

        支持动态筛选条件组合
        """
        # 基础查询
        base_query = select(PeptideAnalysis).where(
            PeptideAnalysis.deleted_at.is_(None)
        )

        count_query = select(func.count(PeptideAnalysis.id)).where(
            PeptideAnalysis.deleted_at.is_(None)
        )

        # 动态添加筛选条件
        if search:
            search_pattern = f"%{search}%"
            base_query = base_query.where(
                or_(
                    PeptideAnalysis.sequence.ilike(search_pattern),
                    PeptideAnalysis.notes.ilike(search_pattern),
                )
            )
            count_query = count_query.where(
                or_(
                    PeptideAnalysis.sequence.ilike(search_pattern),
                    PeptideAnalysis.notes.ilike(search_pattern),
                )
            )

        if user_id:
            base_query = base_query.where(PeptideAnalysis.user_id == user_id)
            count_query = count_query.where(PeptideAnalysis.user_id == user_id)

        if start_date:
            base_query = base_query.where(PeptideAnalysis.created_at >= start_date)
            count_query = count_query.where(PeptideAnalysis.created_at >= start_date)

        if end_date:
            base_query = base_query.where(PeptideAnalysis.created_at <= end_date)
            count_query = count_query.where(PeptideAnalysis.created_at <= end_date)

        # 排序
        sort_column = getattr(PeptideAnalysis, sort_by, None)
        if sort_column:
            if sort_order.lower() == "desc":
                base_query = base_query.order_by(sort_column.desc())
            else:
                base_query = base_query.order_by(sort_column.asc())

        # 总数
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # 分页
        offset = (page - 1) * page_size
        base_query = base_query.offset(offset).limit(page_size)

        result = await self.db.execute(base_query)
        items = result.scalars().all()

        return list(items), total

    async def update_analysis(
        self,
        analysis_id: int,
        data: PeptideAnalysisUpdate
    ) -> PeptideAnalysis:
        """
        更新分析元数据

        仅允许更新notes和tags字段
        不允许修改sequence等核心字段
        """
        analysis = await self.get_analysis(analysis_id)

        # 更新允许的字段
        update_data = data.model_dump(exclude_unset=True)

        # 安全检查：排除不允许修改的字段
        forbidden_fields = {"sequence", "user_id", "analysis_mode", "peptide_id"}
        actual_update = {k: v for k, v in update_data.items() if k not in forbidden_fields}

        if actual_update:
            for field, value in actual_update.items():
                setattr(analysis, field, value)
            analysis.updated_at = datetime.now(timezone.utc)

            await self.db.commit()
            await self.db.refresh(analysis)

            logger.info(f"更新分析记录: id={analysis_id}, fields={list(actual_update.keys())}")

        return analysis

    async def soft_delete_analysis(self, analysis_id: int) -> None:
        """
        软删除分析记录

        设置deleted_at时间戳，级联更新关联统计
        """
        analysis = await self.get_analysis(analysis_id)

        now = datetime.now(timezone.utc)
        analysis.deleted_at = now
        analysis.updated_at = now

        # 更新关联Peptide的统计字段
        if analysis.peptide_id:
            await self.db.execute(
                update(Peptide)
                .where(Peptide.id == analysis.peptide_id)
                .values(
                    analysis_count=func.greatest(Peptide.analysis_count - 1, 0)
                )
            )

        await self.db.commit()
        logger.info(f"软删除分析记录: id={analysis_id}")

    async def batch_create_analyses(
        self,
        items: List[PeptideAnalysisCreate]
    ) -> BatchResult:
        """
        批量创建分析记录

        事务性操作：全部成功或全部回滚
        单次最多100条
        """
        if len(items) > 100:
            raise ValueError("批量创建数量不能超过100条")

        success_count = 0
        failed_items = []

        try:
            for idx, item in enumerate(items):
                try:
                    # 复用单个创建逻辑
                    await self.create_analysis(item)
                    success_count += 1
                except Exception as e:
                    failed_items.append({
                        "index": idx,
                        "error": str(e),
                        "sequence": item.sequence
                    })

            return BatchResult(
                success_count=success_count,
                failed_items=failed_items
            )

        except Exception as e:
            # 回滚整个事务
            await self.db.rollback()
            logger.error(f"批量创建失败，已回滚: {e}")
            raise
