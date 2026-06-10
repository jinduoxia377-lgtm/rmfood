"""
肽设计优化 API 路由

提供完整的项目管理接口：
- POST / - 创建设计项目
- GET / - 项目列表（支持状态筛选）
- GET /{id} - 项目详情（含候选方案）
- PUT /{id} - 更新项目配置
- PATCH /{id}/status - 更新状态
- DELETE /{id} - 归档项目
- POST /{id}/candidates - 添加候选方案
- GET /{id}/versions - 版本历史
- GET /{id}/compare - 版本对比
"""
import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_user, PaginationParams
from ..models.user_model import User
from ..schemas.peptide_design import (
    PeptideDesignCreate, PeptideDesignUpdate,
    PeptideDesignCandidateCreate, PeptideDesignResponse,
    PeptideDesignListResponse, VersionInfo, ComparisonResult
)
from ..schemas import SuccessResponse, ApiResponse
from ..services.peptide_design_service import PeptideDesignService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/peptide-designs", tags=["肽设计优化"])


@router.post(
    "",
    response_model=ApiResponse,
    status_code=201,
    summary="创建设计项目",
    description="创建新的肽设计优化项目"
)
async def create_project(
    data: PeptideDesignCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """创建新的肽设计项目"""
    try:
        service = PeptideDesignService(db, current_user)
        project = await service.create_project(data)

        return ApiResponse(
            success=True,
            data={
                "id": project.id,
                "project_name": project.project_name,
                "target_effects": project.target_effects,
                "status": project.status.value if hasattr(project.status, 'value') else str(project.status),
                "version": project.version,
                "created_at": project.created_at.isoformat(),
                "message": "项目创建成功，请添加候选方案"
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"创建项目失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "",
    response_model=PeptideDesignListResponse,
    summary="获取项目列表",
    description="分页查询设计项目，支持状态、目标活性类型筛选"
)
async def list_projects(
    pagination: PaginationParams = Depends(),
    status: Optional[str] = Query(None, description="状态: draft/in_progress/completed/archived"),
    search: Optional[str] = Query(None, description="项目名称搜索"),
    sort_by: Optional[str] = Query("updated_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取设计项目列表"""
    try:
        service = PeptideDesignService(db, current_user)
        items, total = await service.list_projects(
            page=pagination.page,
            page_size=pagination.page_size,
            status=status,
            user_id=current_user.id,
            sort_by=sort_by,
            sort_order=sort_order
        )

        # 序列化响应（简化版，不含candidates以节省带宽）
        response_items = []
        for item in items:
            response_items.append(PeptideDesignResponse(
                id=item.id,
                project_name=item.project_name,
                user_id=item.user_id,
                target_effects=item.target_effects or [],
                objective_weights=item.objective_weights or {},
                constraints=item.constraints,
                seed_sequence=item.seed_sequence,
                status=item.status.value if hasattr(item.status, 'value') else str(item.status),
                version=item.version,
                parent_version_id=item.parent_version_id,
                total_candidates=item.total_candidates,
                pareto_size=item.pareto_size,
                candidates=[],  # 列表不加载candidates
                created_at=item.created_at,
                updated_at=item.updated_at,
                archived_at=item.archived_at
            ))

        return PeptideDesignListResponse(
            items=response_items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size
        )

    except Exception as e:
        logger.error(f"查询项目列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{design_id}",
    response_model=ApiResponse,
    summary="获取项目详情",
    description="获取项目的完整信息，包含所有候选方案"
)
async def get_project(
    design_id: int,
    include_candidates: bool = Query(True, description="是否包含候选方案"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取项目详情"""
    try:
        service = PeptideDesignService(db, current_user)
        project = await service.get_project(design_id, include_candidates=include_candidates)

        # 构建候选方案数据
        candidates_data = []
        if include_candidates and hasattr(project, 'candidates'):
            for c in (project.candidates or []):
                candidates_data.append({
                    "id": c.id,
                    "sequence": c.sequence,
                    "objectives_scores": c.objectives_scores or {},
                    "rank": c.rank or 0,
                    "is_pareto_frontier": c.is_pareto_frontier or False,
                    "dominated_by_count": c.dominated_by_count or 0,
                    "created_at": c.created_at.isoformat() if c.created_at else None
                })

        return ApiResponse(
            success=True,
            data={
                "id": project.id,
                "project_name": project.project_name,
                "user_id": project.user_id,
                "target_effects": project.target_effects or [],
                "objective_weights": project.objective_weights or {},
                "constraints": project.constraints,
                "seed_sequence": project.seed_sequence,
                "status": project.status.value if hasattr(project.status, 'value') else str(project.status),
                "version": project.version,
                "total_candidates": project.total_candidates,
                "pareto_size": project.pareto_size,
                "candidates": candidates_data,
                "created_at": project.created_at.isoformat(),
                "updated_at": project.updated_at.isoformat()
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取项目详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{design_id}",
    response_model=ApiResponse,
    summary="更新项目配置",
    description="更新项目名称、备注等元数据（核心参数锁定）"
)
async def update_project(
    design_id: int,
    data: PeptideDesignUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """更新项目元数据"""
    try:
        service = PeptideDesignService(db, current_user)
        project = await service.get_project(design_id, include_candidates=False)

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(project, field) and field not in {"target_effects", "objective_weights"}:
                setattr(project, field, value)

        project.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(project)

        return ApiResponse(
            success=True,
            data={"id": project.id, "updated_at": project.updated_at.isoformat()}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新项目失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch(
    "/{design_id}/status",
    response_model=ApiResponse,
    summary="更新项目状态",
    description="变更项目状态（draft→in_progress→completed→archived），自动递增版本号"
)
async def update_project_status(
    design_id: int,
    new_status: str = Query(..., description="目标状态"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """更新项目状态"""
    try:
        service = PeptideDesignService(db, current_user)
        project = await service.update_project_status(design_id, new_status)

        return ApiResponse(
            success=True,
            data={
                "id": project.id,
                "new_status": project.status.value if hasattr(project.status, 'value') else str(project.status),
                "version": project.version,
                "message": f"状态已变更为 {new_status}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新状态失败: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{design_id}",
    response_model=SuccessResponse,
    summary="归档项目",
    description="将项目归档（非物理删除），归档后不可编辑"
)
async def archive_project(
    design_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """归档项目"""
    try:
        service = PeptideDesignService(db, current_user)
        await service.archive_project(design_id)

        return SuccessResponse(message="项目已归档")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"归档项目失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{design_id}/candidates",
    response_model=ApiResponse,
    status_code=201,
    summary="添加候选方案",
    description="向项目添加一个或多个候选肽序列，自动计算Pareto前沿"
)
async def add_candidates(
    design_id: int,
    candidates_data: List[PeptideDesignCandidateCreate],
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """添加候选方案到项目"""
    if len(candidates_data) > 50:
        raise HTTPException(status_code=413, detail="单次最多添加50个候选")

    try:
        service = PeptideDesignService(db, current_user)
        new_candidates = await service.add_candidates(design_id, candidates_data)

        return ApiResponse(
            success=True,
            data={
                "design_id": design_id,
                "added_count": len(new_candidates),
                "message": f"成功添加 {len(new_candidates)} 个候选方案"
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"添加候选失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{design_id}/versions",
    response_model=List[VersionInfo],
    summary="版本历史",
    description="获取项目的版本历史记录（最近10个版本）"
)
async def get_project_versions(
    design_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取版本历史"""
    try:
        service = PeptideDesignService(db, current_user)
        versions = await service.get_project_versions(design_id)

        return versions

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取版本历史失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{design_id}/compare",
    response_model=ComparisonResult,
    summary="版本对比",
    description="对比两个版本的差异（配置变更和候选集变化）"
)
async def compare_versions(
    design_id: int,
    v1: int = Query(..., description="版本1编号"),
    v2: int = Query(..., description="版本2编号"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """对比两个版本"""
    try:
        service = PeptideDesignService(db, current_user)
        comparison = await service.compare_versions(design_id, v1, v2)

        return comparison

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"版本对比失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
