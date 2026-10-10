"""
实验服务
实验 CRUD、数据管理、进度跟踪
"""
import logging
import secrets
from datetime import datetime, timezone
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
        """生成实验编号: EXP-YYYYMMDD-XXXX

        并发防护：基于当日计数 + 已存在校验 + 随机后缀兜底，
        降低唯一约束冲突概率。
        """
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"EXP-{today}-"

        result = await self.db.execute(
            select(func.count()).select_from(Experiment).where(
                Experiment.code.like(f"{prefix}%")
            )
        )
        count = result.scalar() or 0
        seq = str(count + 1).zfill(4)
        code = f"{prefix}{seq}"

        # 校验是否已存在（极端并发下 count 可能撞号），存在则加随机后缀
        exists = await self.db.execute(
            select(Experiment.id).where(Experiment.code == code).limit(1)
        )
        if exists.scalar_one_or_none() is not None:
            code = f"{prefix}{seq}-{secrets.token_hex(2).upper()}"

        return code

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
        sort_field: str = "updated_at",
        sort_order: str = "desc",
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

        # 排序字段白名单，防止任意 SQL 列注入
        sort_columns = {
            "title": Experiment.title,
            "code": Experiment.code,
            "status": Experiment.status,
            "updated_at": Experiment.updated_at,
            "created_at": Experiment.created_at,
            "id": Experiment.id,
        }
        order_col = sort_columns.get(sort_field, Experiment.updated_at)
        query = query.order_by(
            order_col.asc() if sort_order == "asc" else order_col.desc()
        )
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
        # 统一使用 naive UTC 墙钟，与 created_at/updated_at（now_utc_naive）及
        # 趋势查询的 naive-UTC cutoff 保持一致；原 datetime.now() 为本地时间，会引入 8h 偏差。
        experiment.actual_start = datetime.now(timezone.utc).replace(tzinfo=None)
        # 显式 commit：get_db() 的条件 commit 检查（session.dirty/new）在 flush 之后
        # 已被清空，若不在此处显式提交，本请求的状态变更不会真正落盘，
        # 后续请求（如添加数据点、完成实验）读到的仍是 planned 旧状态。
        await self.db.commit()

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
        # 与 actual_start 保持一致，使用 naive UTC 墙钟
        experiment.actual_end = datetime.now(timezone.utc).replace(tzinfo=None)
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

        # 显式 commit：审计日志 + 状态流转需原子落盘。
        await self.db.commit()

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
            data_type=parameter,
            data_value=float(value) if value is not None else None,
            unit=unit,
            notes=notes,
        )
        self.db.add(data_point)
        await self.db.flush()
        # 显式 commit：flush 后 session.new 已清空，get_db() 的条件 commit
        # （if session.dirty or session.new）不会触发，不显式提交则本数据点
        # 在 session.close() 时被回滚（实测 id 分配了但 DB 中查不到）。
        await self.db.commit()

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
                data_type=dp.get("parameter", ""),
                data_value=float(dp.get("value")) if dp.get("value") is not None else None,
                unit=dp.get("unit"),
                notes=dp.get("notes"),
            )
            self.db.add(point)
            created.append(point)

        await self.db.flush()
        # 显式 commit：保证本请求批量数据点原子落盘（同 add_data_point）。
        await self.db.commit()
        return created

    async def get_data_points(self, experiment_id: int) -> list[ExperimentData]:
        """获取实验全部数据点"""
        result = await self.db.execute(
            select(ExperimentData)
            .where(ExperimentData.experiment_id == experiment_id)
            .order_by(ExperimentData.created_at)
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
        # 显式 commit：同上，避免 delete 被回滚。
        await self.db.commit()

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
        """记录审计日志

        audit_logs 真实表列（已用 information_schema 校验）：
          id / action / resource_type / resource_id / user_id / details(json)
          / ip_address / user_agent / request_id / created_at
        模型属性通过 mapped_column 列名映射对齐；细节信息（含 entity_type 语义）
        统一并入 details JSON，不再写独立列。
        """
        merged_details = details or {}
        merged_details["entity_type"] = entity_type
        merged_details["resource_id"] = entity_id
        log = AuditLog(
            action=action,
            resource_type=entity_type,
            resource_id=entity_id,
            user_id=user_id,
            details=merged_details,
        )
        self.db.add(log)
