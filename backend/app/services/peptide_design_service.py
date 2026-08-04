"""RMFOOD 肽设计优化服务层"""
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_

from ..models.peptide_design import (
    PeptideDesign, PeptideDesignCandidate,
    PeptideDesignStatus
)
from ..schemas.peptide_design import (
    PeptideDesignCreate, PeptideDesignUpdate,
    PeptideDesignCandidateCreate, VersionInfo, ComparisonResult
)
from app.core.middleware.exceptions import NotFoundError, ConflictError

logger = logging.getLogger(__name__)

# 有效的目标活性类型列表（可从配置文件或数据库加载）
VALID_TARGET_EFFECTS = {
    "ACE_inhibitory", "antioxidant", "DPP_IV_inhibitory",
    "antimicrobial", "immunomodulatory", "bone_stimulating",
    "permeability", "stability", "solubility"
}

# 合法的状态转换规则
VALID_STATUS_TRANSITIONS = {
    PeptideDesignStatus.DRAFT: [
        PeptideDesignStatus.IN_PROGRESS,
        PeptideDesignStatus.ARCHIVED,
    ],
    PeptideDesignStatus.IN_PROGRESS: [
        PeptideDesignStatus.COMPLETED,
        PeptideDesignStatus.ARCHIVED,
        PeptideDesignStatus.DRAFT,  # 允许回退到草稿
    ],
    PeptideDesignStatus.COMPLETED: [
        PeptideDesignStatus.ARCHIVED,
        PeptideDesignStatus.IN_PROGRESS,  # 允许重新编辑
    ],
    PeptideDesignStatus.ARCHIVED: [],  # 归档后不可变更状态
}


class PeptideDesignService:
    """肽设计优化项目服务类"""

    def __init__(self, db: AsyncSession, current_user=None):
        self.db = db
        self.current_user = current_user

    def validate_target_effects(self, target_effects: List[str]) -> bool:
        """验证目标活性类型有效性"""
        return all(effect in VALID_TARGET_EFFECTS for effect in target_effects)

    def validate_objective_weights(self, weights: Dict[str, float]) -> bool:
        """
        验证目标权重

        检查：
        - 权重值范围 [0, 1]
        - 总和接近 1.0 (容差 ±0.01)
        """
        if not weights:
            return False

        # 检查每个权重值范围
        for key, value in weights.items():
            if not (0 <= value <= 1):
                logger.warning(f"权重值超出[0,1]范围: {key}={value}")
                return False

        # 检查总和
        total = sum(weights.values())
        if abs(total - 1.0) > 0.01:
            logger.warning(f"权重总和不等于1.0: total={total}")
            return False

        return True

    async def compute_pareto_frontier(
        self,
        candidates: List[PeptideDesignCandidate]
    ) -> None:
        """
        计算Pareto前沿标记

        算法：非支配排序 (Non-dominated Sorting)

        对于每个候选方案，检查是否被其他方案支配。
        如果不被任何其他方案支配，则属于Pareto前沿。

        支配定义：
        方案A支配方案B当且仅当：
        - A在所有目标上都不差于B
        - A在至少一个目标上严格优于B
        """
        n = len(candidates)
        if n == 0:
            return

        # 重置所有标记
        for c in candidates:
            c.is_pareto_frontier = False
            c.dominated_by_count = 0

        # 非支配排序算法
        for i in range(n):
            dominated_count = 0
            for j in range(n):
                if i == j:
                    continue

                ci = candidates[i]
                cj = candidates[j]

                scores_i = ci.objectives_scores or {}
                scores_j = cj.objectives_scores or {}

                # 检查cj是否支配ci
                dominates = True
                strictly_better = False

                for obj_key in scores_i.keys():
                    val_i = scores_i.get(obj_key, 0)
                    val_j = scores_j.get(obj_key, 0)

                    if val_i > val_j:  # 假设得分越高越好
                        dominates = False
                        break
                    elif val_j > val_i:
                        strictly_better = True

                if dominates and strictly_better:
                    dominated_count += 1

            candidates[i].dominated_by_count = dominated_count
            candidates[i].is_pareto_frontier = (dominated_count == 0)

        # 更新排名（按支配数升序）
        sorted_candidates = sorted(candidates, key=lambda x: x.dominated_by_count)
        for rank, candidate in enumerate(sorted_candidates, 1):
            candidate.rank = rank

    async def create_project(self, data: PeptideDesignCreate) -> PeptideDesign:
        """
        创建新的设计项目

        初始化：
        - version=1
        - status=draft
        - 统计字段=0
        """
        # 验证目标活性类型
        if not self.validate_target_effects(data.target_effects):
            raise ValueError(f"无效的目标活性类型: {data.target_effects}")

        # 验证权重（如果提供）
        if data.objective_weights and not self.validate_objective_weights(data.objective_weights):
            raise ValueError("目标权重无效：总值需为1.0，各值需在[0,1]范围内")

        now = datetime.now(timezone.utc)
        project = PeptideDesign(
            project_name=data.project_name,
            user_id=self.current_user.id if self.current_user else None,
            target_effects=data.target_effects,
            objective_weights=data.objective_weights or {},
            constraints=data.constraints,
            seed_sequence=data.seed_sequence,
            status=PeptideDesignStatus.DRAFT,
            version=1,
            parent_version_id=None,
            total_candidates=0,
            pareto_size=0,
            created_at=now,
            updated_at=now,
        )

        self.db.add(project)
        try:
            await self.db.commit()
            await self.db.refresh(project)
        except Exception as e:
            await self.db.rollback()
            logger.warning("创建设计项目失败: %s", e)
            raise
        return project

    async def add_candidates(
        self,
        design_id: int,
        candidates_data: List[PeptideDesignCandidateCreate]
    ) -> List[PeptideDesignCandidate]:
        """
        向项目添加候选方案

        处理流程：
        1. 批量插入候选记录（最多50个）
        2. 自动计算Pareto前沿标记
        3. 更新项目统计字段
        4. 如果是首次添加候选，自动将status改为in_progress
        """
        if len(candidates_data) > 50:
            raise ValueError("单次添加候选数量不能超过50个")

        project = await self.get_project(design_id)

        now = datetime.now(timezone.utc)
        new_candidates = []

        # 批量插入
        for cand_data in candidates_data:
            candidate = PeptideDesignCandidate(
                design_id=design_id,
                sequence=cand_data.sequence.upper(),
                objectives_scores=cand_data.objectives_scores,
                rank=cand_data.rank or 0,
                is_pareto_frontier=cand_data.is_pareto_frontier or False,
                dominated_by_count=cand_data.dominated_by_count or 0,
                additional_data=cand_data.additional_data,
                created_at=now,
            )
            self.db.add(candidate)
            new_candidates.append(candidate)

        await self.db.flush()

        try:
            # 重新查询所有候选（包括新增的）
            all_candidates_result = await self.db.execute(
                select(PeptideDesignCandidate)
                .where(PeptideDesignCandidate.design_id == design_id)
            )
            all_candidates = list(all_candidates_result.scalars().all())

            # 计算Pareto前沿
            await self.compute_pareto_frontier(all_candidates)

            # 更新统计字段
            pareto_count = sum(1 for c in all_candidates if c.is_pareto_frontier)
            project.total_candidates = len(all_candidates)
            project.pareto_size = pareto_count
            project.updated_at = now

            # 首次添加候选 → 自动改为in_progress
            if project.status == PeptideDesignStatus.DRAFT and len(all_candidates) > 0:
                project.status = PeptideDesignStatus.IN_PROGRESS
                project.version += 1  # 版本递增

            await self.db.commit()
            await self.db.refresh(project)

            logger.info(
                f"添加候选方案成功: design_id={design_id}, count={len(new_candidates)}, "
                f"pareto_size={pareto_count}"
            )

            return new_candidates
        except Exception as e:
            await self.db.rollback()
            logger.warning("批量创建候选肽段失败: %s", e)
            raise
        """
        获取项目详情

        可选择是否预加载candidates（按rank排序）
        """
        from sqlalchemy.orm import selectinload

        query = select(PeptideDesign).where(PeptideDesign.id == design_id)

        if include_candidates:
            query = query.options(
                selectinload(PeptideDesign.candidates)
            )

        result = await self.db.execute(query)
        project = result.scalar_one_or_none()

        if not project:
            raise NotFoundError(
                resource="PeptideDesign",
                resource_id=design_id
            )

        # 对candidates按rank排序（如果在内存中）
        if include_candidates and hasattr(project, 'candidates'):
            project.candidates = sorted(
                project.candidates,
                key=lambda x: x.rank or 999
            )

        return project

    async def list_projects(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str = None,
        user_id: int = None,
        sort_by: str = "updated_at",
        sort_order: str = "desc"
    ) -> Tuple[List[PeptideDesign], int]:
        """分页查询项目列表"""
        base_query = select(PeptideDesign)
        count_query = select(func.count(PeptideDesign.id))

        # 状态筛选（排除archived除非明确要求）
        if status:
            base_query = base_query.where(PeptideDesign.status == status)
            count_query = count_query.where(PeptideDesign.status == status)
        else:
            # 默认不显示已归档
            base_query = base_query.where(
                PeptideDesign.status != PeptideDesignStatus.ARCHIVED
            )
            count_query = count_query.where(
                PeptideDesign.status != PeptideDesignStatus.ARCHIVED
            )

        if user_id:
            base_query = base_query.where(PeptideDesign.user_id == user_id)
            count_query = count_query.where(PeptideDesign.user_id == user_id)

        # 排序
        sort_column = getattr(PeptideDesign, sort_by, None)
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
        items = list(result.scalars().all())

        return items, total

    async def update_project_status(
        self,
        design_id: int,
        new_status: str
    ) -> PeptideDesign:
        """
        更新项目状态

        校验状态转换合法性：
        - 不允许从archived转换到其他状态
        - 状态变更时自动递增version
        """
        project = await self.get_project(design_id, include_candidates=False)

        try:
            current_status = project.status
            target_status = PeptideDesignStatus(new_status)

            # 检查转换是否合法
            valid_transitions = VALID_STATUS_TRANSITIONS.get(current_status, [])
            if target_status not in valid_transitions:
                raise ConflictError(
                    detail=f"不允许从 '{current_status.value}' 变更为 '{target_status.value}'"
                )

            # 执行状态变更
            old_status = project.status
            project.status = target_status
            project.version += 1
            project.updated_at = datetime.now(timezone.utc)

            # 特殊状态处理
            if target_status == PeptideDesignStatus.ARCHIVED:
                project.archived_at = datetime.now(timezone.utc)

            await self.db.commit()
            await self.db.refresh(project)

            logger.info(
                f"更新项目状态: id={design_id}, "
                f"{old_status.value} -> {target_status.value}, version={project.version}"
            )

            return project

        except ValueError as e:
            raise ConflictError(
                detail=f"无效的状态值: {new_status}"
            ) from e

    async def archive_project(self, design_id: int) -> None:
        """
        归档项目（软归档）

        设置status=archived + archived_at
        不删除物理数据
        """
        await self.update_project_status(design_id, PeptideDesignStatus.ARCHIVED.value)
        logger.info(f"归档项目: design_id={design_id}")

    async def get_project_versions(self, design_id: int) -> List[VersionInfo]:
        """
        获取项目的版本历史

        返回最近10个版本的快照摘要
        注意：当前实现基于version字段的简化版本，
        完整版本控制需要额外的版本历史表
        """
        project = await self.get_project(design_id, include_candidates=False)

        # 当前版本信息
        current_version = VersionInfo(
            version=project.version,
            status=project.status.value,
            config_snapshot={
                "target_effects": project.target_effects,
                "objective_weights": project.objective_weights,
                "constraints": project.constraints,
                "seed_sequence": project.seed_sequence,
            },
            candidate_count=project.total_candidates,
            created_at=project.updated_at,  # 使用最后修改时间作为版本时间
            change_summary="当前版本"
        )

        # 返回当前版本（完整版本历史需要额外表支持）
        return [current_version]

    async def compare_versions(
        self,
        design_id: int,
        v1: int,
        v2: int
    ) -> ComparisonResult:
        """
        对比两个版本的差异

        完整实现需要版本历史表，此处返回基础对比框架
        """
        # 获取项目基本信息
        project = await self.get_project(design_id, include_candidates=False)

        # 构建差异报告（简化版）
        comparison = ComparisonResult(
            v1_version=v1,
            v2_version=v2,
            config_changes={
                "note": "完整版本对比功能需要版本历史表支持"
            },
            candidate_changes={
                "total_candidates": project.total_candidates,
                "pareto_size": project.pareto_size,
            },
            summary="版本对比功能待完善（需要版本历史数据存储）"
        )

        return comparison
