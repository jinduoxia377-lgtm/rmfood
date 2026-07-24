"""
🔴 P0-1: Repository 查询优化层（QueryOptimizer

解决 N+1 查询问题
统一的查询优化，统一的查询优化模式

核心思想:
1. 定义所有配方的关联关系（categories/tags/ingredients/peptides
2. 使用 selectinload/joinedload 统一查询优化器
3. 提供带 eager 预加载策略，消除 N+1 并自动检测的查询优化
4. 提供统一的查询优化辅助函数，供各 API 层直接调用

性能提升预估: 5-10 倍（N+1 场景
使用方式:

from app.core.database.query_optimizer import (
    FormulaQueryOptimizer, optimized_list,
    get_optimized_formulas, get_optimized_formula,
    get_optimized_users,
)

# 方式1: 配方列表
optimized_service = FormulaQueryOptimizer(db)
formulas = await optimized_service.list_optimized(
    page=1, page_size=20, status="DRAFT"
)

# 方式2: 单个配方详情
formula = await optimized_service.get_optimized(formula_id=123)
"""
from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, TypeVar, Generic

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import (
    selectinload, joinedload, subqueryload,
)

# 导入领域模型
from ..models.formula import Formula, Category, Tag
from ..models.ingredient import Ingredient
from ..models.peptide import Peptide
from ..models.user_model import User
from ..models.experiment import Experiment
from ..models.enums import FormulaStatus

logger = logging.getLogger(__name__)

T = TypeVar('T')

# ═══════════════════════════════════════
# 🔴 P0-1: 查询优化配置
# ═══════════════════════════════════════

@dataclass
class EagerLoadStrategy:
    """预加载策略配置"""
    
    # 配方预加载
    formula_full: list = field(default_factory=lambda: [
        # 关联实体（集合关系，使用 selectinload 更高效）
        'categories',        # 配方类别（多对多）
        'tags',              # 标签（多对多）
        'ingredients',       # 成分（多对多）
        'peptides',          # 肽段（多对多）
        # 单值关联（一对一/多对一）
        'creator',           # 创建者
        'reviewer',          # 审核者
        # 版本历史（一对多）
        'versions',          # 版本历史
        # 关联集合（一对多）
        'experiments',       # 关联实验
    ])
    
    # 配方精简版（列表页使用）
    formula_list: list = field(default_factory=lambda: [
        'categories',
        'tags',
        'creator',  # 只在列表页显示创建者信息
    ])
    
    # 用户预加载
    user_detail: list = field(default_factory=lambda: [
        'teams',
        'devices',
    ])

# 全局策略实例
strategy = EagerLoadStrategy()

# ═══════════════════════════════════════
# 🔴 P0-1: 查询优化辅助函数
# ═══════════════════════════════════════

class FormulaQueryOptimizer:
    """
    🔴 P0-1: 配方查询优化器

    消除 N+1 查询，统一使用 selectinload/joinedload
    预加载关联关系，提升查询性能。

    使用方式:
        optimizer = FormulaQueryOptimizer(db_session)
        # 列表查询（自动预加载所有关联关系，避免 N+1）
        formulas, total = await optimizer.list_optimized(
            page=1, page_size=20,
            status=FormulaStatus.DRAFT,
        )
        # 详情查询
        formula = await optimizer.get_optimized(formula_id=123)
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    # ─────────────────────────────────────────
    # 配方列表（带预加载优化）
    # ─────────────────────────────────────────
    async def list_optimized(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[FormulaStatus] = None,
        creator_id: Optional[int] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
        eager_load: bool = True,
    ) -> Tuple[List[Formula], int]:
        """
        🔴 P0-1: 优化版配方列表查询

        Args:
            eager_load: 是否启用预加载（默认为 True，False 时仅查询主表）

        Returns:
            (formulas, total_count)
        """
        start = time.time()

        # 基础查询
        query = select(Formula)

        if eager_load:
            # 🔴 核心优化：使用 selectinload 预加载所有关联关系
            # 避免在 Pydantic 序列化时产生 N+1 查询
            query = query.options(
                # 配方关联关系（多对多）
                selectinload(Formula.categories),
                selectinload(Formula.tags),
                selectinload(Formula.ingredients),
                selectinload(Formula.peptides),
                # 创建者信息（多对一）
                selectinload(Formula.creator),
                # 审核者信息（多对一）
                selectinload(Formula.reviewer),
                # 版本历史（一对多）
                selectinload(Formula.versions),
                # 关联实验（一对多）
                selectinload(Formula.experiments),
            )

        # 软删除过滤
        if not include_deleted and hasattr(Formula, 'deleted_at'):
            query = query.where(Formula.deleted_at.is_(None))

        # 状态筛选
        if status:
            query = query.where(Formula.status == status)
        if creator_id:
            query = query.where(Formula.creator_id == creator_id)

        # 关键词搜索（配方名称/编号/描述）
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Formula.name.ilike(pattern),
                    Formula.code.ilike(pattern),
                    Formula.description.ilike(pattern),
                )
            )

        # 🔴 总数查询（避免重复查询开销）
        count_stmt = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_stmt)).scalar() or 0

        # 分页
        query = query.order_by(Formula.updated_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        # 执行主查询（只执行一次
        result = await self._session.execute(query)
        formulas = list(result.scalars().all())

        elapsed = time.time() - start
        logger.info(
            f"[QueryOptimizer] 配方列表查询: %dms total=%d "
            f"(eager_load=%s, eager_relations=%d)",
            int(elapsed * 1000), total, eager_load,
            len(strategy.formula_full),
        )

        return formulas, total

    # ─────────────────────────────────────────
    # 配方详情（带预加载优化）
    # ─────────────────────────────────────────
    async def get_optimized(
        self,
        formula_id: int,
        include_deleted: bool = False,
    ) -> Optional[Formula]:
        """优化版配方详情查询，预加载所有关联关系"""
        start = time.time()

        query = select(Formula).where(Formula.id == formula_id)

        # 🔴 核心优化：一次查询加载所有关联关系
        query = query.options(
            selectinload(Formula.categories),
            selectinload(Formula.tags),
            selectinload(Formula.ingredients),
            selectinload(Formula.peptides),
            selectinload(Formula.creator),
            selectinload(Formula.reviewer),
            selectinload(Formula.versions),
            selectinload(Formula.experiments),
        )

        if not include_deleted and hasattr(Formula, 'deleted_at'):
            query = query.where(Formula.deleted_at.is_(None))

        result = await self._session.execute(query)
        formula = result.scalar_one_or_none()

        elapsed = time.time() - start
        logger.info(
            f"[QueryOptimizer] 配方详情查询: %dms success=%s",
            int(elapsed * 1000), formula is not None,
        )

        return formula

    # ─────────────────────────────────────────
    # 统计查询（只读，用于仪表盘）
    # ─────────────────────────────────────────
    async def get_stats(self) -> Dict[str, Any]:
        """获取配方统计信息（一次性查询聚合）"""
        start = time.time()

        # 🔴 单次查询获取所有统计信息，避免多个独立查询
        stmt = select(
            func.count(Formula.id).label('total'),
            func.sum(
                (Formula.status == FormulaStatus.DRAFT).cast('int')
            ).label('draft_count'),
            func.sum(
                (Formula.status == FormulaStatus.APPROVED).cast('int')
            ).label('approved_count'),
            func.sum(
                (Formula.status == FormulaStatus.REJECTED).cast('int')
            ).label('rejected_count'),
            func.count(Formula.creator_id.distinct()).label('unique_creators'),
        )

        if hasattr(Formula, 'deleted_at'):
            stmt = stmt.where(Formula.deleted_at.is_(None))

        result = await self._session.execute(stmt)
        row = result.fetchone()

        elapsed = time.time() - start
        logger.info(
            f"[QueryOptimizer] 统计查询: %dms", int(elapsed * 1000),
        )

        if row is None:
            return {
                'total': 0,
                'draft_count': 0,
                'approved_count': 0,
                'rejected_count': 0,
                'unique_creators': 0,
            }

        return {
            'total': row.total or 0,
            'draft_count': row.draft_count or 0,
            'approved_count': row.approved_count or 0,
            'rejected_count': row.rejected_count or 0,
            'unique_creators': row.unique_creators or 0,
        }

    # ─────────────────────────────────────────
    # 按用户查询配方（优化版，一次查询）
    # ─────────────────────────────────────────
    async def list_by_user(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 50,
        status: Optional[FormulaStatus] = None,
    ) -> Tuple[List[Formula], int]:
        """按用户查询配方（优化版，预加载关联关系"""
        query = select(Formula).where(Formula.creator_id == user_id)

        # 预加载
        query = query.options(
            selectinload(Formula.categories),
            selectinload(Formula.tags),
            selectinload(Formula.creator),
            selectinload(Formula.versions),
        )

        if status:
            query = query.where(Formula.status == status)

        # 总数
        count_stmt = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_stmt)).scalar() or 0

        # 分页
        query = query.order_by(Formula.updated_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self._session.execute(query)
        formulas = list(result.scalars().all())

        return formulas, total


# ═══════════════════════════════════════
# 🔴 P0-1: 用户查询优化器
# ═══════════════════════════════════════

class UserQueryOptimizer:
    """用户查询优化器，预加载用户关联关系"""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_optimized(
        self,
        user_id: int,
    ) -> Optional[User]:
        """优化版用户详情查询"""
        query = select(User).where(User.id == user_id)

        # 预加载关联关系（避免 N+1 查询）
        query = query.options(
            selectinload(User.formulas_created),  # 关联配方
            selectinload(User.formulas_reviewed),  # 审核过的配方
            selectinload(User.team_memberships),  # 团队成员关系
            selectinload(User.experiments),  # 关联实验
            selectinload(User.notifications),  # 通知
        )

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def list_optimized(
        self,
        page: int = 1,
        page_size: int = 50,
        is_active: Optional[bool] = True,
    ) -> Tuple[List[User], int]:
        """优化版用户列表查询"""
        query = select(User)

        if is_active is not None:
            query = query.where(User.is_active == is_active)

        # 预加载
        query = query.options(
            selectinload(User.team_memberships),
        )

        count_stmt = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_stmt)).scalar() or 0

        query = query.order_by(User.updated_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self._session.execute(query)
        return list(result.scalars().all()), total


# ════════════════════════════════════════
# ════════════════════════════════════════
# 🔴 P0-1: 简化版全局便捷函数
# ════════════════════════════════════════

async def get_optimized_formulas(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: Optional[FormulaStatus] = None,
    creator_id: Optional[int] = None,
    search: Optional[str] = None,
) -> Tuple[List[Formula], int]:
    """便捷函数：获取优化版配方列表

    示例:
        formulas, total = await get_optimized_formulas(db, page=1, page_size=20)
    """
    optimizer = FormulaQueryOptimizer(session)
    return await optimizer.list_optimized(
        page=page, page_size=page_size,
        status=status, creator_id=creator_id, search=search,
    )


async def get_optimized_formula(
    session: AsyncSession,
    formula_id: int,
) -> Optional[Formula]:
    """便捷函数：获取优化版配方详情

    示例:
        formula = await get_optimized_formula(db, 123)
    """
    optimizer = FormulaQueryOptimizer(session)
    return await optimizer.get_optimized(formula_id=formula_id)


async def get_optimized_user(
    session: AsyncSession,
    user_id: int,
) -> Optional[User]:
    """便捷函数：获取优化版用户详情

    示例:
        user = await get_optimized_user(db, 456)
    """
    optimizer = UserQueryOptimizer(session)
    return await optimizer.get_optimized(user_id=user_id)


async def get_formula_stats(session: AsyncSession) -> Dict[str, Any]:
    """便捷函数：获取配方统计信息

    示例:
        stats = await get_formula_stats(db)
    """
    optimizer = FormulaQueryOptimizer(session)
    return await optimizer.get_stats()


# ════════════════════════════════════════
# 🔴 P0-1: 便捷函数（从用户配方列表
# ════════════════════════════════════════

async def get_user_formulas(
    session: AsyncSession,
    user_id: int,
    page: int = 1,
    page_size: int = 50,
    status: Optional[FormulaStatus] = None,
) -> Tuple[List[Formula], int]:
    """便捷函数：获取用户配方列表（预加载关联关系

    示例:
        formulas, total = await get_user_formulas(db, user_id=1, page=1, page_size=50)
    """
    optimizer = FormulaQueryOptimizer(session)
    return await optimizer.list_by_user(
        user_id=user_id, page=page, page_size=page_size, status=status,
    )


__all__ = [
    # 核心类
    'FormulaQueryOptimizer',
    'UserQueryOptimizer',
    'EagerLoadStrategy',
    'strategy',
    # 便捷函数
    'get_optimized_formulas',
    'get_optimized_formula',
    'get_optimized_user',
    'get_formula_stats',
    'get_user_formulas',
]
