"""
食源性多肽COA API路由

提供完整的CRUD接口：
- POST / - 创建COA
- GET / - 列表查询（分页+筛选）
- GET /{id} - 获取详情
- PUT /{id} - 更新COA
- PUT /{id}/test-items - 更新检验单项
- DELETE /{id} - 软删除
- POST /batch/import - 批量导入
- GET /by-peptide/{peptide_id} - 按多肽查询
- GET /by-batch/{batch_no} - 按批号查询
"""
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_user, PaginationParams
from ..models.user_model import User
from ..schemas.coa import (
    COACreate, COAUpdate, COAResponse, COAListResponse,
    COATestItemCreate, COATestItemUpdate,
    COAFilterParams,
)
from ..schemas import ApiResponse
from ..services.coa_service import COAService
from ..services.coa_generator import generate_coa_word, generate_coa_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coa", tags=["食源性多肽COA"])


# ─── 辅助函数 ────────────────────────────────────────────────

def _pagination_params(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


# ─── COA CRUD 接口 ──────────────────────────────────────────

@router.post(
    "",
    response_model=ApiResponse,
    status_code=201,
    summary="创建COA",
    description="创建新的出厂检验报告，可包含检验单项"
)
async def create_coa(
    data: COACreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """创建COA记录"""
    try:
        service = COAService(db)
        coa = await service.create_coa(data)
        return ApiResponse(
            success=True,
            data=coa.to_dict(),
            message="COA创建成功"
        )
    except Exception as e:
        logger.error("创建COA失败: %s", e, exc_info=True)
        raise HTTPException(status_code=422, detail=f"COA创建失败: {str(e)}")


@router.get(
    "",
    response_model=ApiResponse,
    summary="获取COA列表",
    description="分页查询COA列表，支持多维度筛选"
)
async def list_coas(
    pagination: PaginationParams = Depends(_pagination_params),
    peptide_id: Optional[int] = Query(None, description="多肽ID筛选"),
    batch_no: Optional[str] = Query(None, description="批号关键词"),
    product_name_cn: Optional[str] = Query(None, description="产品名称关键词"),
    gb_standard: Optional[str] = Query(None, description="执行标准"),
    test_conclusion: Optional[str] = Query(None, description="检验结论: 合格/不合格/待检"),
    qualified: Optional[bool] = Query(None, description="是否合格"),
    supplier_name: Optional[str] = Query(None, description="供应商名称"),
    start_date: Optional[datetime] = Query(None, description="生产日期起始"),
    end_date: Optional[datetime] = Query(None, description="生产日期截止"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """分页获取COA列表"""
    try:
        service = COAService(db)
        items, total = await service.list_coas(
            page=pagination.page,
            page_size=pagination.page_size,
            peptide_id=peptide_id,
            batch_no=batch_no,
            product_name_cn=product_name_cn,
            gb_standard=gb_standard,
            test_conclusion=test_conclusion,
            qualified=qualified,
            supplier_name=supplier_name,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return ApiResponse(
            success=True,
            data={
                "items": [item.to_dict() for item in items],
                "total": total,
                "page": pagination.page,
                "page_size": pagination.page_size,
            }
        )
    except Exception as e:
        logger.error("查询COA列表失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{coa_id}",
    response_model=ApiResponse,
    summary="获取COA详情",
    description="获取COA完整信息（含检验单项明细）"
)
async def get_coa(
    coa_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取COA详情"""
    service = COAService(db)
    coa = await service.get_coa(coa_id)
    if not coa:
        raise HTTPException(status_code=404, detail=f"COA {coa_id} 不存在")
    return ApiResponse(success=True, data=coa.to_dict())


@router.put(
    "/{coa_id}",
    response_model=ApiResponse,
    summary="更新COA",
    description="更新COA元数据（不含检验单项）"
)
async def update_coa(
    coa_id: int,
    data: COAUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """更新COA"""
    service = COAService(db)
    coa = await service.update_coa(coa_id, data)
    if not coa:
        raise HTTPException(status_code=404, detail=f"COA {coa_id} 不存在")
    return ApiResponse(success=True, data=coa.to_dict(), message="COA更新成功")


@router.put(
    "/{coa_id}/test-items",
    response_model=ApiResponse,
    summary="更新检验单项",
    description="批量替换COA的所有检验单项"
)
async def update_test_items(
    coa_id: int,
    items: list[COATestItemUpdate],
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """批量更新检验单项"""
    service = COAService(db)
    updated_items = await service.update_test_items(coa_id, items)
    coa = await service.get_coa(coa_id)
    return ApiResponse(
        success=True,
        data={
            "coa": coa.to_dict() if coa else None,
            "test_items": [item.to_dict() for item in updated_items],
        },
        message=f"已更新 {len(updated_items)} 个检验单项"
    )


@router.post(
    "/{coa_id}/test-items",
    response_model=ApiResponse,
    status_code=201,
    summary="添加检验单项",
    description="为COA添加单个检验单项"
)
async def create_test_item(
    coa_id: int,
    data: COATestItemCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """创建检验单项"""
    service = COAService(db)
    item = await service.create_test_item(coa_id, data)
    return ApiResponse(success=True, data=item.to_dict(), message="检验单项添加成功")


@router.delete(
    "/{coa_id}",
    response_model=ApiResponse,
    summary="删除COA",
    description="软删除COA记录"
)
async def delete_coa(
    coa_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """软删除COA"""
    service = COAService(db)
    deleted = await service.delete_coa(coa_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"COA {coa_id} 不存在")
    return ApiResponse(success=True, data={"coa_id": coa_id}, message="COA已删除")


# ─── 按条件查询接口 ─────────────────────────────────────────

@router.get(
    "/by-peptide/{peptide_id}",
    response_model=ApiResponse,
    summary="按多肽ID查询COA",
    description="获取某多肽的所有批次COA"
)
async def get_coas_by_peptide(
    peptide_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """按多肽ID获取COA列表"""
    service = COAService(db)
    coas = await service.get_coas_by_peptide(peptide_id)
    return ApiResponse(
        success=True,
        data=[coa.to_dict() for coa in coas],
        message=f"共 {len(coas)} 条COA记录"
    )


@router.get(
    "/by-batch/{batch_no}",
    response_model=ApiResponse,
    summary="按批号查询COA",
    description="通过生产批号获取COA"
)
async def get_coa_by_batch_no(
    batch_no: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """按批号查询COA"""
    service = COAService(db)
    coa = await service.get_coa_by_batch_no(batch_no)
    if not coa:
        raise HTTPException(status_code=404, detail=f"批号 {batch_no} 的COA不存在")
    return ApiResponse(success=True, data=coa.to_dict())


# ─── 批量操作接口 ──────────────────────────────────────────

@router.post(
    "/batch/import",
    response_model=ApiResponse,
    status_code=201,
    summary="批量导入COA",
    description="批量创建COA记录"
)
async def batch_import_coas(
    data: list[COACreate],
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """批量导入COA"""
    if len(data) > 100:
        raise HTTPException(status_code=422, detail="单次最多导入100条COA")
    try:
        service = COAService(db)
        results = await service.batch_import(data)
        return ApiResponse(
            success=True,
            data={"imported_count": len(results), "coa_ids": [r.id for r in results]},
            message=f"成功导入 {len(results)} 条COA"
        )
    except Exception as e:
        logger.error("批量导入COA失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量导入失败: {str(e)}")


# ─── 统计接口 ──────────────────────────────────────────────

@router.get(
    "/stats/summary",
    response_model=ApiResponse,
    summary="COA统计摘要",
    description="获取COA数据的统计摘要"
)
async def get_coa_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取COA统计数据"""
    from sqlalchemy import func as sqla_func
    from ..models.peptide_batch_coa import PeptideBatchCOA

    result = await db.execute(
        select(
            sqla_func.count(PeptideBatchCOA.id).label("total"),
            sqla_func.count(PeptideBatchCOA.id).filter(PeptideBatchCOA.qualified == True).label("qualified"),
            sqla_func.count(PeptideBatchCOA.id).filter(PeptideBatchCOA.qualified == False).label("unqualified"),
            sqla_func.count(PeptideBatchCOA.id).filter(PeptideBatchCOA.test_conclusion == "待检").label("pending"),
            sqla_func.count(sqla_func.distinct(PeptideBatchCOA.peptide_id)).label("peptide_types"),
            sqla_func.count(sqla_func.distinct(PeptideBatchCOA.batch_no)).label("total_batches"),
        ).where(PeptideBatchCOA.deleted_at.is_(None))
    )
    stats = result.fetchone()

    return ApiResponse(
        success=True,
        data={
            "total": stats.total or 0,
            "qualified": stats.qualified or 0,
            "unqualified": stats.unqualified or 0,
            "pending": stats.pending or 0,
            "peptide_types": stats.peptide_types or 0,
            "total_batches": stats.total_batches or 0,
            "qualified_rate": round((stats.qualified or 0) / max(stats.total or 1, 1) * 100, 2),
        }
    )


# --- COA Document Downloads ---

@router.get("/{coa_id}/download/word")
async def download_coa_word(
    coa_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """下载 COA Word 文档"""
    service = COAService(db)
    coa = await service.get_coa(coa_id)
    if not coa:
        raise HTTPException(status_code=404, detail="COA 报告不存在")
    coa_data = {
        "company_name_cn": "莱辛（厦门）分子生物科技有限公司",
        "company_name_en": "RHEIN (XIAMEN) MOLEKUL BIOTECH INC",
        "product_name_cn": coa.product_name_cn,
        "product_name_en": coa.product_name_en or "",
        "product_type": coa.product_type,
        "product_code": coa.product_code or "",
        "spec": coa.spec or "",
        "batch_no": coa.batch_no,
        "mfg_date": coa.mfg_date.strftime("%Y-%m-%d") if coa.mfg_date else "",
        "gb_standard": coa.gb_standard or "",
        "inspection_basis": coa.inspection_basis or coa.gb_standard or "企业标准",
        "test_conclusion": coa.test_conclusion,
        "tested_by": coa.tested_by or "",
        "checked_by": coa.checked_by or "",
        "approved_by": coa.approved_by or "",
        "test_items": [
            {
                "category": i.category, "item_name": i.item_name,
                "item_name_en": i.item_name_en or "",
                "standard": i.standard, "result": i.result or "",
                "unit": i.unit or "", "judgment": i.judgment or "",
                "remark": i.remark or "",
            }
            for i in (coa.test_items or [])
        ],
    }
    from fastapi.responses import Response
    try:
        content = generate_coa_word(coa_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    filename = f"COA_{coa.batch_no}.docx"
    return Response(content=content, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})


@router.get("/{coa_id}/download/pdf")
async def download_coa_pdf(
    coa_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """下载 COA PDF 文档"""
    service = COAService(db)
    coa = await service.get_coa(coa_id)
    if not coa:
        raise HTTPException(status_code=404, detail="COA 报告不存在")
    coa_data = {
        "company_name_cn": "莱辛（厦门）分子生物科技有限公司",
        "company_name_en": "RHEIN (XIAMEN) MOLEKUL BIOTECH INC",
        "product_name_cn": coa.product_name_cn,
        "product_name_en": coa.product_name_en or "",
        "product_type": coa.product_type,
        "product_code": coa.product_code or "",
        "spec": coa.spec or "",
        "batch_no": coa.batch_no,
        "mfg_date": coa.mfg_date.strftime("%Y-%m-%d") if coa.mfg_date else "",
        "gb_standard": coa.gb_standard or "",
        "inspection_basis": coa.inspection_basis or coa.gb_standard or "企业标准",
        "test_conclusion": coa.test_conclusion,
        "tested_by": coa.tested_by or "",
        "checked_by": coa.checked_by or "",
        "approved_by": coa.approved_by or "",
        "test_items": [
            {
                "category": i.category, "item_name": i.item_name,
                "item_name_en": i.item_name_en or "",
                "standard": i.standard, "result": i.result or "",
                "unit": i.unit or "", "judgment": i.judgment or "",
                "remark": i.remark or "",
            }
            for i in (coa.test_items or [])
        ],
    }
    from fastapi.responses import Response
    try:
        content = generate_coa_pdf(coa_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    filename = f"COA_{coa.batch_no}.pdf"
    return Response(content=content, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})
