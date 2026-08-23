"""
实验服务
实验 CRUD、数据管理、进度跟踪
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import (
    Experiment, ExperimentData, Formula,
    ExperimentStatus, AuditLog,
)
from ..schemas.experiment import ExperimentCreate, ExperimentUpdate

logger = logging.getLogger(__name__)


class ExperimentService:
    """实验业务逻辑"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_experiment_code(self) -> str:
        """生成实验编号: EXP-YYYYMMDD-XXXX"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"EXP-{today}-"

        result = await self.db.execute(
            select(func.count()).select_from(Experiment).where(
                Experiment.code.like(f"{prefix}%")
            )
        )
        count = result.scalar() or 0
        seq = str(count + 1).zfill(4)
        return f"{prefix}{seq}"

    async def create_experiment(
        self,
        data: ExperimentCreate,
        researcher_id: int,
    ) -> Experiment:
        """创建实验"""
        code = await self._generate_experiment_code()

        # 验证关联配方存在
        if data.formula_id:
            formula = await self.db.execute(
                select(Formula).where(Formula.id == data.formula_id)
            )
            if not formula.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="关联配方不存在",
                )

        experiment = Experiment(
            title=data.title,
            code=code,
            description=data.description,
            status=ExperimentStatus.PLANNED,
            formula_id=data.formula_id,
            researcher_id=researcher_id,
            objectives=data.objectives or [],
            methodology=data.methodology,
            parameters=data.parameters or {},
            materials=data.materials or [],
            equipment=data.equipment or [],
            start_date=data.start_date,
            end_date=data.end_date,
        )
        self.db.add(experiment)
        await self.db.flush()

        await self._audit_log(
            action="experiment.create",
            entity_type="experiment",
            entity_id=experiment.id,
            user_id=researcher_id,
        )

        logger.info(f"创建实验: {code} - {experiment.title}")
        return experiment

    async def get_experiment(self, experiment_id: int) -> Experiment:
        """获取实验详情（含数据点和关联）"""
        result = await self.db.execute(
            select(Experiment)
            .options(
                selectinload(Experiment.data_points),
                selectinload(Experiment.formula),
                selectinload(Experiment.researcher),
            )
            .where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()
        if not experiment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="实验不存在",
            )
        return experiment

    async def list_experiments(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[ExperimentStatus] = None,
        researcher_id: Optional[int] = None,
        formula_id: Optional[int] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
    ) -> tuple[list[Experiment], int]:
        """实验列表"""
        query = select(Experiment).options(
            selectinload(Experiment.researcher),
            selectinload(Experiment.formula),
        )

        # 软删除过滤
        if not include_deleted and hasattr(Experiment, 'deleted_at'):
            query = query.where(Experiment.deleted_at.is_(None))

        if status:
            query = query.where(Experiment.status == status)
        if researcher_id:
            query = query.where(Experiment.researcher_id == researcher_id)
        if formula_id:
            query = query.where(Experiment.formula_id == formula_id)
        if search:
            pattern = f"%{search}%"
            query = query.where(
                Experiment.title.ilike(pattern)
                | Experiment.code.ilike(pattern)
            )

        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        query = query.order_by(Experiment.updated_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)

        return list(result.scalars().all()), total

    async def update_experiment(
        self,
        experiment_id: int,
        data: ExperimentUpdate,
        user_id: int,
    ) -> Experiment:
        """更新实验"""
        experiment = await self.get_experiment(experiment_id)
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(experiment, field, value)

        await self.db.flush()

        await self._audit_log(
            action="experiment.update",
            entity_type="experiment",
            entity_id=experiment_id,
            user_id=user_id,
        )

        return experiment

    async def delete_experiment(self, experiment_id: int, user_id: int) -> None:
        """删除实验"""
        experiment = await self.get_experiment(experiment_id)

        if experiment.status in (ExperimentStatus.IN_PROGRESS,):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="进行中的实验不能删除",
            )

        experiment.status = ExperimentStatus.CANCELLED
        await self.db.flush()

        await self._audit_log(
            action="experiment.delete",
            entity_type="experiment",
            entity_id=experiment_id,
            user_id=user_id,
        )

    # ── 实验状态流转 ──

    async def start_experiment(self, experiment_id: int, user_id: int) -> Experiment:
        """开始实验"""
        experiment = await self.get_experiment(experiment_id)

        if experiment.status != ExperimentStatus.PLANNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅计划中状态可开始",
            )

        experiment.status = ExperimentStatus.IN_PROGRESS
        experiment.actual_start = datetime.utcnow()
        await self.db.flush()

        return experiment

    async def complete_experiment(
        self,
        experiment_id: int,
        results: Optional[dict] = None,
        conclusions: Optional[str] = None,
        recommendations: Optional[str] = None,
        user_id: int = 0,
    ) -> Experiment:
        """完成实验"""
        experiment = await self.get_experiment(experiment_id)

        if experiment.status != ExperimentStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅进行中状态可完成",
            )

        experiment.status = ExperimentStatus.COMPLETED
        experiment.actual_end = datetime.utcnow()
        if results is not None:
            experiment.results = results
        if conclusions is not None:
            experiment.conclusions = conclusions
        if recommendations is not None:
            experiment.recommendations = recommendations

        await self.db.flush()

        await self._audit_log(
            action="experiment.complete",
            entity_type="experiment",
            entity_id=experiment_id,
            user_id=user_id,
        )

        return experiment

    # ── 实验数据点管理 ──

    async def add_data_point(
        self,
        experiment_id: int,
        parameter: str,
        value,
        unit: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ExperimentData:
        """添加实验数据点"""
        experiment = await self.get_experiment(experiment_id)

        if experiment.status != ExperimentStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅进行中的实验可添加数据",
            )

        data_point = ExperimentData(
            experiment_id=experiment_id,
            parameter=parameter,
            value=value,
            unit=unit,
            notes=notes,
        )
        self.db.add(data_point)
        await self.db.flush()

        return data_point

    async def batch_add_data_points(
        self,
        experiment_id: int,
        data_points: list[dict],
    ) -> list[ExperimentData]:
        """批量添加实验数据"""
        experiment = await self.get_experiment(experiment_id)

        if experiment.status != ExperimentStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅进行中的实验可添加数据",
            )

        created = []
        for dp in data_points:
            point = ExperimentData(
                experiment_id=experiment_id,
                parameter=dp.get("parameter", ""),
                value=dp.get("value"),
                unit=dp.get("unit"),
                notes=dp.get("notes"),
            )
            self.db.add(point)
            created.append(point)

        await self.db.flush()
        return created

    async def get_data_points(self, experiment_id: int) -> list[ExperimentData]:
        """获取实验全部数据点"""
        result = await self.db.execute(
            select(ExperimentData)
            .where(ExperimentData.experiment_id == experiment_id)
            .order_by(ExperimentData.recorded_at)
        )
        return list(result.scalars().all())

    async def delete_data_point(self, data_point_id: int) -> None:
        """删除数据点"""
        result = await self.db.execute(
            select(ExperimentData).where(ExperimentData.id == data_point_id)
        )
        point = result.scalar_one_or_none()
        if not point:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="数据点不存在",
            )
        await self.db.delete(point)
        await self.db.flush()

    # ── 实验统计 ──

    async def get_experiment_statistics(self, researcher_id: Optional[int] = None) -> dict:
        """实验统计概览"""
        filters = []
        if researcher_id:
            filters.append(Experiment.researcher_id == researcher_id)

        base = select(Experiment)
        for f in filters:
            base = base.where(f)

        # 各状态计数
        stats = {}
        for s in ExperimentStatus:
            q = select(func.count()).select_from(base.where(Experiment.status == s).subquery())
            result = await self.db.execute(q)
            stats[s.value] = result.scalar() or 0

        total_q = select(func.count()).select_from(base.subquery())
        stats["total"] = (await self.db.execute(total_q)).scalar() or 0

        return stats

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
