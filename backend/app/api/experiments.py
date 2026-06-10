"""
实验管理路由
实验 CRUD、数据管理、状态流转
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas.experiment import (
    ExperimentCreate, ExperimentUpdate, ExperimentResponse,
    ExperimentDataResponse,
)
from ..services.experiment import ExperimentService
from ..services.auth import get_current_user, require_role
from ..models.models import User, UserRole, ExperimentStatus
from ..api.deps import get_db_session, PaginationParams, ExperimentFilterParams

router = APIRouter(prefix="/experiments", tags=["实验管理"])


@router.get("", response_model=dict, summary="获取实验列表")
async def list_experiments(
    pagination: PaginationParams = Depends(),
    filters: ExperimentFilterParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """分页获取实验列表"""
    service = ExperimentService(db)
    experiments, total = await service.list_experiments(
        page=pagination.page,
        page_size=pagination.page_size,
        status=ExperimentStatus(filters.status) if filters.status else None,
        researcher_id=filters.researcher_id,
        formula_id=filters.formula_id,
        search=filters.search,
    )
    return {
        "items": experiments,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
    }


@router.get("/statistics", response_model=dict, summary="实验统计")
async def get_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取实验统计概览"""
    service = ExperimentService(db)
    return await service.get_experiment_statistics()


@router.get("/{experiment_id}", response_model=ExperimentResponse, summary="获取实验详情")
async def get_experiment(
    experiment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取实验详情（含数据点）"""
    service = ExperimentService(db)
    return await service.get_experiment(experiment_id)


@router.post("", response_model=ExperimentResponse, status_code=201, summary="创建实验")
async def create_experiment(
    data: ExperimentCreate,
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新实验"""
    service = ExperimentService(db)
    return await service.create_experiment(data, researcher_id=current_user.id)


@router.put("/{experiment_id}", response_model=ExperimentResponse, summary="更新实验")
async def update_experiment(
    experiment_id: int,
    data: ExperimentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新实验信息"""
    service = ExperimentService(db)
    return await service.update_experiment(experiment_id, data, current_user.id)


@router.delete("/{experiment_id}", summary="删除实验")
async def delete_experiment(
    experiment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """删除实验（取消状态）"""
    service = ExperimentService(db)
    await service.delete_experiment(experiment_id, current_user.id)
    return {"message": "实验已取消"}


@router.post("/batch-delete", summary="批量删除实验")
async def batch_delete_experiments(
    data: dict,
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """批量删除实验"""
    ids = data.get("ids", [])
    if not ids:
        return {"message": "未提供实验ID", "deleted": 0}
    service = ExperimentService(db)
    deleted = 0
    for eid in ids:
        try:
            await service.delete_experiment(int(eid), current_user.id)
            deleted += 1
        except Exception:
            pass
    return {"message": f"已删除 {deleted} 个实验", "deleted": deleted}


# ── 实验状态流转 ──

@router.post("/{experiment_id}/start", response_model=ExperimentResponse, summary="开始实验")
async def start_experiment(
    experiment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """将计划中的实验切换为进行中"""
    service = ExperimentService(db)
    return await service.start_experiment(experiment_id, current_user.id)


@router.post("/{experiment_id}/complete", response_model=ExperimentResponse, summary="完成实验")
async def complete_experiment(
    experiment_id: int,
    results: dict | None = None,
    conclusions: str | None = None,
    recommendations: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """完成实验并记录结果"""
    service = ExperimentService(db)
    return await service.complete_experiment(
        experiment_id, results, conclusions, recommendations, current_user.id
    )


# ── 实验数据管理 ──

@router.get("/{experiment_id}/data", response_model=list[ExperimentDataResponse], summary="获取实验数据")
async def get_data_points(
    experiment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取实验全部数据点"""
    service = ExperimentService(db)
    return await service.get_data_points(experiment_id)


@router.post("/{experiment_id}/data", response_model=ExperimentDataResponse, status_code=201, summary="添加数据点")
async def add_data_point(
    experiment_id: int,
    parameter: str,
    value: float | str | None = None,
    unit: str | None = None,
    notes: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """向实验添加单个数据点"""
    service = ExperimentService(db)
    return await service.add_data_point(
        experiment_id, parameter, value, unit, notes
    )


@router.delete("/data/{data_point_id}", summary="删除数据点")
async def delete_data_point(
    data_point_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """删除指定数据点"""
    service = ExperimentService(db)
    await service.delete_data_point(data_point_id)
    return {"message": "数据点已删除"}
