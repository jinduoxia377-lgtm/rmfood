"""
实验管理路由
实验 CRUD、数据管理、状态流转
"""
import logging
import secrets
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..api.deps import ExperimentFilterParams, PaginationParams, get_db_session
from ..core.multi_tenant.org_resolver import resolve_effective_org_id
from ..core.multi_tenant.tenant_security import TenantContext, require_tenant
from ..core.plans import require_plan
from ..models.experiment import Experiment, ExperimentData
from ..models.models import ExperimentStatus, User, UserRole
from ..schemas.experiment import (
    CompleteExperimentRequest,
    ExperimentCreate,
    ExperimentDataResponse,
    ExperimentListResponse,
    ExperimentResponse,
    ExperimentUpdate,
)
from ..services.auth import require_role
from ..services.experiment_service import ExperimentService

logger = logging.getLogger(__name__)


async def _require_experiment_access(current_user: Optional[User], db: AsyncSession) -> None:
    """实验访问权限开关：用户所属组织的 experiment_access 关闭时，仅 OWNER 可访问。"""
    if current_user is None:
        return
    from ..core.multi_tenant.multi_tenant_service import get_org_service
    org_id = await resolve_effective_org_id(None, current_user, db)
    if not org_id:
        return
    svc = get_org_service(db)
    # 自定义角色授权（additive）：拥有 experiment:read 的成员可访问
    if await svc.member_has_custom_permission(org_id, current_user.id, "experiment", "read"):
        return
    if not await svc.check_org_permission(org_id, current_user.id, "experiment_access"):
        raise HTTPException(status_code=403, detail="该组织已关闭「实验访问」权限，仅所有者可操作")

router = APIRouter(prefix="/experiments", tags=["实验管理"])


class ExperimentDataUpdate(BaseModel):
    """数据点更新请求体 — 所有字段可选，仅覆盖传入项。"""
    parameter: Optional[str] = Field(None, min_length=1, max_length=200)
    value: Optional[Union[float, str]] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    measurement_time: Optional[str] = None


@router.get("", response_model=ExperimentListResponse, summary="获取实验列表")
async def list_experiments(
    pagination: PaginationParams = Depends(),
    filters: ExperimentFilterParams = Depends(),
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
    tenant: TenantContext = Depends(require_tenant),
):
    """分页获取实验列表

    修复: 原实现以 `response_model=dict` 直接返回 ORM `Experiment` 对象，
    FastAPI 的 Pydantic 无法把 ORM 实例序列化为 JSON（PydanticSerializationError）
    → 500。改用专用响应模式 `ExperimentListResponse`，其 `from_attributes`
    会把 ORM 对象逐字段映射，稳定输出 JSON。

    P0 租户隔离：强制认证（require_plan→get_current_active_user）+
    按当前租户 org_id 过滤（organization_id==tenant.org_id），
    tenant.org_id 为 None 时禁止全平台列出实验。
    """
    # P0：解析有效组织（Cookie 认证兼容：tenant.org_id 为 None 时回退
    # 用户默认组织/首个活跃成员关系），无有效组织 → 禁止全平台列表。
    org_id = await resolve_effective_org_id(tenant.org_id, current_user, db)
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="缺少组织租户上下文，禁止全平台列出实验",
        )

    await _require_experiment_access(current_user, db)
    service = ExperimentService(db)
    experiments, total = await service.list_experiments(
        page=pagination.page,
        page_size=pagination.page_size,
        status=ExperimentStatus(filters.status) if filters.status else None,
        researcher_id=filters.researcher_id,
        formula_id=filters.formula_id,
        search=filters.search,
        sort_field=filters.sort_field,
        sort_order=filters.sort_order,
    )
    # P0：API 层追加 org 过滤（experiment_service 不可改）。
    # 保留全局实验（organization_id 为 None）与当前租户实验；其余剔除。
    experiments = [
        e for e in experiments
        if e.organization_id is None or e.organization_id == org_id
    ]
    total = len(experiments)
    return ExperimentListResponse(
        items=experiments,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/statistics", response_model=dict, summary="实验统计")
async def get_statistics(
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """获取实验统计概览"""
    service = ExperimentService(db)
    return await service.get_experiment_statistics()


@router.get("/{experiment_id}", response_model=ExperimentResponse, summary="获取实验详情")
async def get_experiment(
    experiment_id: int,
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """获取实验详情（含数据点）"""
    service = ExperimentService(db)
    return await service.get_experiment(experiment_id)


@router.post("", response_model=ExperimentResponse, status_code=201, summary="创建实验")
async def create_experiment(
    data: ExperimentCreate,
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR)),
    _plan_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新实验"""
    await _require_experiment_access(current_user, db)
    service = ExperimentService(db)
    return await service.create_experiment(data, researcher_id=current_user.id)


@router.put("/{experiment_id}", response_model=ExperimentResponse, summary="更新实验")
async def update_experiment(
    experiment_id: int,
    data: ExperimentUpdate,
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """更新实验信息"""
    service = ExperimentService(db)
    return await service.update_experiment(experiment_id, data, current_user.id)


@router.delete("/{experiment_id}", summary="取消实验")
async def delete_experiment(
    experiment_id: int,
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR, UserRole.ADMIN)),
    _plan_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """取消实验（软删除：状态置为 cancelled）"""
    service = ExperimentService(db)
    await service.delete_experiment(experiment_id, current_user.id)
    return {"message": "实验已取消"}


@router.post("/batch-delete", summary="批量取消实验")
async def batch_delete_experiments(
    data: dict,
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR, UserRole.ADMIN)),
    _plan_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """批量取消实验"""
    ids = data.get("ids", [])
    if not ids:
        return {"message": "未提供实验ID", "deleted": 0}
    if not isinstance(ids, list) or not all(isinstance(i, (int, str)) and str(i).isdigit() for i in ids):
        raise HTTPException(status_code=400, detail="实验ID列表格式不正确")
    service = ExperimentService(db)
    deleted = 0
    failed_ids: list[str] = []
    for eid in ids:
        try:
            await service.delete_experiment(int(eid), current_user.id)
            deleted += 1
        except HTTPException as e:
            failed_ids.append(f"#{eid}: {e.detail}")
        except Exception as e:
            logger.warning("实验删除失败 id=%s: %s", eid, e)
            failed_ids.append(f"#{eid}")
    message = f"已取消 {deleted} 个实验"
    if failed_ids:
        message += f"，{len(failed_ids)} 个失败（{', '.join(failed_ids)}）"
    return {"message": message, "deleted": deleted}


# ── 实验状态流转 ──

@router.post("/{experiment_id}/start", response_model=ExperimentResponse, summary="开始实验")
async def start_experiment(
    experiment_id: int,
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """将计划中的实验切换为进行中"""
    service = ExperimentService(db)
    return await service.start_experiment(experiment_id, current_user.id)


@router.post("/{experiment_id}/complete", response_model=ExperimentResponse, summary="完成实验")
async def complete_experiment(
    experiment_id: int,
    payload: CompleteExperimentRequest = CompleteExperimentRequest(),
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """完成实验并记录结果

    修复: 三个字段从 query 参数改为 JSON body（CompleteExperimentRequest），
    避免客户端发 JSON 时文案错位进 results.conclusions、conclusions 列落库为 NULL。
    向后兼容: body 可省略（全部字段 Optional），无 body 等价于空请求。
    """
    service = ExperimentService(db)
    return await service.complete_experiment(
        experiment_id,
        payload.results,
        payload.conclusions,
        payload.recommendations,
        current_user.id,
    )


# ── 实验数据管理 ──

@router.get("/{experiment_id}/data", response_model=list[ExperimentDataResponse], summary="获取实验数据")
async def get_data_points(
    experiment_id: int,
    current_user: User = Depends(require_plan("advanced_analytics")),
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
    current_user: User = Depends(require_plan("advanced_analytics")),
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
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """删除指定数据点"""
    service = ExperimentService(db)
    await service.delete_data_point(data_point_id)


@router.put("/data/{data_point_id}", response_model=ExperimentDataResponse, summary="更新数据点")
async def update_data_point(
    data_point_id: int,
    payload: ExperimentDataUpdate,
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """更新指定数据点的可编辑字段（parameter / value / unit / notes / measurement_time）。

    未传入的字段保持原值不变。
    必须注册在 DELETE /data/{data_point_id} 之后：FastAPI 按注册顺序匹配，
    同路径形状的独立 router 若晚挂载会被 DELETE 路由遮蔽（405）。

    权限：仅该实验的研究者或管理员可编辑。
    """
    result = await db.execute(
        select(ExperimentData).where(ExperimentData.id == data_point_id).limit(1)
    )
    point = result.scalars().first()
    if not point:
        raise HTTPException(status_code=404, detail="数据点不存在")

    # ── 归属校验：仅实验研究者或管理员可编辑 ──
    exp = await db.get(Experiment, point.experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="关联实验不存在")
    if current_user.role != UserRole.ADMIN and exp.researcher_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权编辑该实验的数据点")

    if payload.parameter is not None:
        point.data_type = payload.parameter
    if payload.value is not None:
        if isinstance(payload.value, (int, float)):
            point.data_value = float(payload.value)
        elif isinstance(payload.value, str):
            try:
                point.data_value = float(payload.value)
            except ValueError:
                point.data_text = payload.value
                point.data_value = None
        else:
            point.data_value = None
    if payload.unit is not None:
        point.unit = payload.unit
    if payload.notes is not None:
        point.notes = payload.notes
    if payload.measurement_time is not None:
        from datetime import datetime
        try:
            point.measurement_time = datetime.fromisoformat(payload.measurement_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="measurement_time 格式无效（需 ISO 8601）")

    await db.commit()
    await db.refresh(point)
    return ExperimentDataResponse.model_validate(point)


# ═══════════════════════════════════════════
# 实验结果回写配方
# ═══════════════════════════════════════════

@router.post("/{experiment_id}/writeback", summary="实验结果回写配方")
async def writeback_experiment_result(
    experiment_id: int,
    payload: dict,
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """
    将实验结果回写到关联的配方。

    更新配方的：
    - safety_check: 安全性评分
    - compliance_status: 合规性状态
    - synergy_analysis: 协同效应评分
    """
    from ..models.formula import Formula

    service = ExperimentService(db)
    experiment = await service.get_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="实验不存在")

    # ── 归属校验：仅实验研究者或管理员可回写 ──
    if current_user.role != UserRole.ADMIN and experiment.researcher_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权回写该实验的结果到配方")

    if not experiment.formula_id:
        raise HTTPException(status_code=400, detail="实验未关联配方")

    # 获取关联配方
    formula = await db.get(Formula, experiment.formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="关联配方不存在")

    # 回写安全性评分
    safety_score = payload.get("safety_score")
    if safety_score is not None:
        if not formula.safety_check:
            formula.safety_check = {}
        formula.safety_check["experiment_score"] = safety_score
        formula.safety_check["last_updated"] = experiment.updated_at.isoformat() if experiment.updated_at else None

    # 回写协同效应评分
    synergy_score = payload.get("synergy_score")
    if synergy_score is not None:
        if not formula.synergy_analysis:
            formula.synergy_analysis = {}
        formula.synergy_analysis["experiment_score"] = synergy_score

    await db.flush()

    return {
        "success": True,
        "formula_id": formula.id,
        "code": formula.code,
        "updated_fields": [k for k, v in [("safety_score", safety_score), ("synergy_score", synergy_score)] if v is not None],
    }


# ═══════════════════════════════════════════
# 实验公开分享（免登录只读）
# ═══════════════════════════════════════════

@router.post("/{experiment_id}/share", summary="创建实验分享链接")
async def create_experiment_share(
    experiment_id: int,
    current_user: User = Depends(require_plan("advanced_analytics")),
    db: AsyncSession = Depends(get_db_session),
):
    """生成（或复用已存在的）实验公开分享码。

    已存在 share_code 时幂等返回，避免每次点击都生成新码。
    """
    experiment = await db.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="实验不存在")

    # 归属校验：仅创建者可分享
    if experiment.researcher_id is not None and experiment.researcher_id != current_user.id:
        raise HTTPException(status_code=403, detail="仅实验创建者可分享")

    if not experiment.share_code:
        experiment.share_code = secrets.token_urlsafe(16)
        experiment.view_count = 0
    await db.commit()

    return {
        "share_code": experiment.share_code,
        "url": f"/experiments/share/{experiment.share_code}",
        "experiment_id": experiment.id,
        "title": experiment.title,
    }


@router.get("/share/{share_code}", summary="公开获取分享内容")
async def get_shared_experiment(
    share_code: str,
    db: AsyncSession = Depends(get_db_session),
):
    """公开只读访问：按 share_code 返回实验内容 + 数据点。

    每次访问 view_count +1（best-effort）。
    响应为 dict（ExperimentResponse 字段 + data_points / view_count）。
    """
    result = await db.execute(
        select(Experiment)
        .where(Experiment.share_code == share_code)
        .options(selectinload(Experiment.formula), selectinload(Experiment.researcher))
        .limit(1)
    )
    experiment = result.scalars().first()
    if not experiment:
        raise HTTPException(status_code=404, detail="分享链接不存在或已失效")

    # 访问计数
    experiment.view_count = (experiment.view_count or 0) + 1

    # 拉取数据点
    data_result = await db.execute(
        select(ExperimentData).where(ExperimentData.experiment_id == experiment.id)
    )
    data_points = [ExperimentDataResponse.from_orm(d) for d in data_result.scalars().all()]

    # 序列化 schema（从已预加载的属性取值，避免懒加载触发 MissingGreenlet）
    resp_extra = ExperimentResponse.model_validate(experiment).model_dump()
    resp_extra["data_points"] = [p.model_dump() for p in data_points]
    resp_extra["view_count"] = experiment.view_count
    await db.commit()
    return resp_extra
