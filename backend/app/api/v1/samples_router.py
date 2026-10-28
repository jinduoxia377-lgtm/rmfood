"""
样品与测试 API 路由
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database.session import get_db
from app.services.batch import (
    create_sample_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/samples", tags=["样品与测试"])


# ── 请求/响应模型 ──────────────────────────────────────────────

class CreateSampleRequest(BaseModel):
    batch_id: int = Field(..., description="批次 ID")
    sample_type: str = Field("qc", description="样品类型: qc/stability/pilot/retention")
    quantity_g: Optional[float] = Field(None, description="取样量(g)")
    storage_condition: Optional[str] = Field(None, description="存储条件")


class AddTestResultRequest(BaseModel):
    sample_id: int = Field(..., description="样品 ID")
    parameter: str = Field(..., description="测试参数名")
    value: float = Field(..., description="实测值")
    unit: Optional[str] = Field(None, description="单位")
    spec_min: Optional[float] = Field(None, description="规格下限")
    spec_max: Optional[float] = Field(None, description="规格上限")
    tester_id: Optional[int] = Field(None, description="测试人员 ID")
    notes: Optional[str] = Field(None, description="备注")


class ListSamplesRequest(BaseModel):
    batch_id: Optional[int] = None
    sample_type: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ── API 端点 ───────────────────────────────────────────────────

@router.post("", summary="创建样品", response_model=dict)
async def create_sample(
    req: CreateSampleRequest,
    db = Depends(get_db),
):
    """创建样品，关联到批次"""
    service = create_sample_service(db)
    try:
        return await service.create_sample(
            batch_id=req.batch_id,
            sample_type=req.sample_type,
            quantity_g=req.quantity_g,
            storage_condition=req.storage_condition,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", summary="样品列表", response_model=dict)
async def list_samples(
    batch_id: Optional[int] = Query(None),
    sample_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db = Depends(get_db),
):
    """列出样品，支持按批次和类型筛选"""
    service = create_sample_service(db)
    return await service.list_samples(
        batch_id=batch_id,
        sample_type=sample_type,
        page=page,
        page_size=page_size,
    )


@router.post("/tests", summary="添加测试结果", response_model=dict)
async def add_test_result(
    req: AddTestResultRequest,
    db = Depends(get_db),
):
    """添加测试结果，自动判定 pass/fail/warn"""
    service = create_sample_service(db)
    try:
        return await service.add_test_result(
            sample_id=req.sample_id,
            parameter=req.parameter,
            value=req.value,
            unit=req.unit,
            spec_min=req.spec_min,
            spec_max=req.spec_max,
            tester_id=req.tester_id,
            notes=req.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{sample_id}/tests", summary="样品测试报告", response_model=list)
async def get_sample_tests(
    sample_id: int,
    db = Depends(get_db),
):
    """获取样品的所有测试报告"""
    service = create_sample_service(db)
    return await service.get_sample_tests(sample_id)


@router.get("/comparison", summary="测试结果对比", response_model=dict)
async def compare_test_results(
    sample_ids: str = Query(..., description="样品 ID 列表，逗号分隔"),
    parameters: Optional[str] = Query(None, description="指定参数，逗号分隔；None 则返回全部"),
    db = Depends(get_db),
):
    """
    对比多个样品的测试结果

    对标 FormLab: "Comparing test results across batches and formulations"
    """
    from sqlalchemy import select

    from app.models import TestReport

    ids = [int(x.strip()) for x in sample_ids.split(",") if x.strip()]
    params = parameters.split(",") if parameters else None

    stmt = select(TestReport).where(TestReport.sample_id.in_(ids))
    if params:
        stmt = stmt.where(TestReport.parameter.in_(params))
    stmt = stmt.order_by(TestReport.sample_id, TestReport.parameter)

    result = await db.execute(stmt)
    rows = result.fetchall()

    # 按样品分组
    by_sample = {}
    for row in rows:
        sid = row[1]  # sample_id
        if sid not in by_sample:
            by_sample[sid] = []
        by_sample[sid].append(row)

    return {
        "sample_count": len(by_sample),
        "total_tests": len(rows),
        "by_sample": {
            str(sid): [
                {
                    "parameter": r[2],
                    "value": r[3],
                    "unit": r[4],
                    "spec_min": r[5],
                    "spec_max": r[6],
                    "result": r[7],
                }
                for r in tests
            ]
            for sid, tests in by_sample.items()
        },
    }
