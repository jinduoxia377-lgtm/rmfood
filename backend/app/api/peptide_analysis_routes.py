"""
肽序列分析 API 路由

提供完整的 CRUD 接口：
- POST / - 创建分析记录
- GET / - 列表查询（分页+筛选）
- GET /{id} - 获取详情（含7维数据）
- PUT /{id} - 更新元数据
- DELETE /{id} - 软删除
- POST /batch - 批量创建
- GET /export - 导出CSV/Excel
"""
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_active_user, PaginationParams
from ..models.user_model import User
from ..schemas.peptide_analysis import (
    PeptideAnalysisCreate, PeptideAnalysisUpdate,
    PeptideAnalysisResponse, PeptideAnalysisListResponse, BatchResult
)
from ..schemas import SuccessResponse, ApiResponse
from ..services.peptide_analysis_service import PeptideAnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/peptide-analyses", tags=["肽序列分析"])


@router.post(
    "",
    response_model=ApiResponse,
    status_code=201,
    summary="创建分析记录",
    description="保存新的肽序列分析结果到数据库"
)
async def create_analysis(
    data: PeptideAnalysisCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """创建新的肽序列分析记录"""
    try:
        service = PeptideAnalysisService(db, current_user)
        analysis = await service.create_analysis(data)

        return ApiResponse(
            success=True,
            data={
                "id": analysis.id,
                "sequence": analysis.sequence,
                "analysis_mode": analysis.analysis_mode,
                "created_at": analysis.created_at.isoformat(),
                "message": "分析记录创建成功"
            }
        )

    except (RuntimeError, ValueError, TypeError) as e:
        logger.error("创建分析失败: %s", e, exc_info=True)
        raise HTTPException(status_code=422, detail="分析创建失败，请检查请求参数")


@router.get(
    "",
    response_model=PeptideAnalysisListResponse,
    summary="获取分析列表",
    description="分页查询分析记录，支持关键词搜索、日期范围筛选、排序"
)
async def list_analyses(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None, description="序列关键词"),
    activity_type: Optional[str] = Query(None, description="活性类型"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """分页获取分析列表"""
    try:
        service = PeptideAnalysisService(db, current_user)
        items, total = await service.list_analyses(
            page=pagination.page,
            page_size=pagination.page_size,
            search=search,
            activity_type=activity_type,
            start_date=start_date,
            end_date=end_date,
            user_id=current_user.id,  # 默认只查当前用户的
            sort_by=sort_by,
            sort_order=sort_order
        )

        return PeptideAnalysisListResponse(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size
        )

    except (RuntimeError, ValueError, TypeError) as e:
        logger.error("查询分析列表失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="查询失败，请稍后重试")


@router.get(
    "/{analysis_id}",
    response_model=PeptideAnalysisResponse,
    summary="获取分析详情",
    description="获取单个分析的完整信息，包含7维分析详情数据"
)
async def get_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """获取分析详情（含嵌套的details）"""
    try:
        service = PeptideAnalysisService(db, current_user)
        analysis = await service.get_analysis(analysis_id)

        # 序列化为响应格式
        response_data = PeptideAnalysisResponse(
            id=analysis.id,
            sequence=analysis.sequence,
            user_id=analysis.user_id,
            analysis_mode=analysis.analysis_mode.value if hasattr(analysis.analysis_mode, 'value') else str(analysis.analysis_mode),
            tags=analysis.tags or [],
            notes=analysis.notes,
            peptide_id=analysis.peptide_id,
            created_at=analysis.created_at,
            updated_at=analysis.updated_at,
            details=[
                {
                    "id": d.id,
                    "dimension_type": d.dimension_type.value if hasattr(d.dimension_type, 'value') else str(d.dimension_type),
                    "data": d.data or {},
                    "created_at": d.created_at
                }
                for d in (analysis.details or [])
            ]
        )

        return response_data

    except HTTPException:
        raise
    except (RuntimeError, ValueError, TypeError) as e:
        logger.error("获取分析详情失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="获取分析详情失败，请稍后重试")


@router.put(
    "/{analysis_id}",
    response_model=PeptideAnalysisResponse,
    summary="更新分析元数据",
    description="仅允许更新备注和标签等元数据字段"
)
async def update_analysis(
    analysis_id: int,
    data: PeptideAnalysisUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """更新分析记录的元数据"""
    try:
        service = PeptideAnalysisService(db, current_user)
        analysis = await service.update_analysis(analysis_id, data)

        return PeptideAnalysisResponse(
            id=analysis.id,
            sequence=analysis.sequence,
            user_id=analysis.user_id,
            analysis_mode=analysis.analysis_mode.value if hasattr(analysis.analysis_mode, 'value') else str(analysis.analysis_mode),
            tags=analysis.tags or [],
            notes=analysis.notes,
            created_at=analysis.created_at,
            updated_at=analysis.updated_at,
            details=[]
        )

    except HTTPException:
        raise
    except (RuntimeError, ValueError, TypeError) as e:
        logger.error("更新分析失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="更新分析失败，请稍后重试")


@router.delete(
    "/{analysis_id}",
    response_model=SuccessResponse,
    summary="软删除分析",
    description="将分析记录移至回收站（不物理删除），可恢复"
)
async def delete_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """软删除分析记录"""
    try:
        service = PeptideAnalysisService(db, current_user)
        await service.soft_delete_analysis(analysis_id)

        return SuccessResponse(message="已移至回收站")

    except HTTPException:
        raise
    except (RuntimeError, ValueError, TypeError) as e:
        logger.error("删除分析失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="删除分析失败，请稍后重试")


@router.post(
    "/batch",
    response_model=BatchResult,
    status_code=207,
    summary="批量创建分析",
    description="批量导入多条分析记录（最多100条），返回成功/失败统计"
)
async def batch_create_analyses(
    items: list[PeptideAnalysisCreate],
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """批量创建分析记录"""
    if len(items) > 100:
        raise HTTPException(status_code=413, detail="单次最多100条")

    try:
        service = PeptideAnalysisService(db, current_user)
        result = await service.batch_create_analyses(items)

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail="参数无效")
    except (RuntimeError, ValueError, TypeError) as e:
        logger.error("批量创建失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="批量创建失败，请稍后重试")


@router.get(
    "/export",
    summary="导出分析数据",
    description="将分析列表导出为CSV或Excel文件下载"
)
async def export_analyses(
    format: str = Query("csv", description="导出格式: csv | excel"),
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """导出分析数据为文件"""
    try:
        service = PeptideAnalysisService(db, current_user)
        items, total = await service.list_analyses(
            page=1,
            page_size=1000,  # 导出限制
            search=search,
            start_date=start_date,
            end_date=end_date,
            user_id=current_user.id
        )

        if format == "csv":
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # 表头
            writer.writerow([
                "ID", "序列", "分析模式", "标签",
                "备注", "创建时间", "更新时间"
            ])

            # 数据行
            for item in items:
                writer.writerow([
                    item.id,
                    item.sequence,
                    item.analysis_mode.value if hasattr(item.analysis_mode, 'value') else item.analysis_mode,
                    ",".join(item.tags or []),
                    item.notes or "",
                    item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else "",
                    item.updated_at.strftime("%Y-%m-%d %H:%M:%S") if item.updated_at else ""
                ])

            from fastapi.responses import Response
            return Response(
                content=output.getvalue(),
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f"attachment; filename=peptide_analyses_{datetime.now().strftime('%Y%m%d')}.csv"
                }
            )

        elif format == "excel":
            # Excel 导出使用 openpyxl
            from io import BytesIO
            from openpyxl import Workbook
            from openpyxl.styles import Font, Alignment, PatternFill

            wb = Workbook()
            ws = wb.active
            ws.title = "肽段分析"

            # 表头
            headers = ["ID", "序列", "分子量", "等电点", "疏水性", "活性评分", "创建时间"]
            header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            header_font = Font(bold=True, color="FFFFFF", size=11)

            for col_idx, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col_idx, value=header)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center")

            # 数据行
            for idx, row in enumerate(items, 2):
                ws.cell(row=idx, column=1, value=row.get("id", ""))
                ws.cell(row=idx, column=2, value=row.get("sequence", ""))
                ws.cell(row=idx, column=3, value=row.get("molecular_weight", ""))
                ws.cell(row=idx, column=4, value=row.get("isoelectric_point", ""))
                ws.cell(row=idx, column=5, value=row.get("hydrophobicity", ""))
                ws.cell(row=idx, column=6, value=row.get("activity_score", ""))
                ws.cell(row=idx, column=7, value=row.get("created_at", ""))

            output = BytesIO()
            wb.save(output)
            output.seek(0)

            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename=peptide_analyses_{datetime.now().strftime('%Y%m%d')}.xlsx"
                }
            )

        else:
            raise HTTPException(status_code=400, detail=f"不支持的格式: {format}")

    except HTTPException:
        raise
    except (RuntimeError, ValueError, TypeError) as e:
        logger.error("导出失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="导出失败，请稍后重试")
