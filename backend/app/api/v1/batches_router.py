"""
批记录 API 路由
对标 FormLab: bench formula to batch record, lot traceability
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database.session import get_db
from app.services.batch import (
    create_batch_service,
    create_price_change_service,
    create_traceability_engine,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batches", tags=["批记录管理"])


# ── 请求/响应模型 ──────────────────────────────────────────────

class CreateBatchRequest(BaseModel):
    formula_id: int = Field(..., description="配方 ID")
    target_weight_kg: float = Field(..., description="目标产量(kg)", gt=0)
    preparer_id: Optional[int] = Field(None, description="配制人员 ID")
    notes: Optional[str] = Field(None, description="备注")
    ingredient_lot_assignments: Optional[dict] = Field(
        None, description="原料批号分配 {ingredient_id: ingredient_lot_id}"
    )


class UpdateBatchStatusRequest(BaseModel):
    status: str = Field(..., description="新状态: planned/in_progress/completed/closed")
    actual_weight_kg: Optional[float] = Field(None, description="实际产量(kg)")


class ListBatchesRequest(BaseModel):
    formula_id: Optional[int] = None
    status: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ── API 端点 ───────────────────────────────────────────────────

@router.post("", summary="创建批记录", response_model=dict)
async def create_batch(
    req: CreateBatchRequest,
    db = Depends(get_db),
):
    """
    从配方创建批记录
    自动生成批号，按比例放大各成分用量
    """
    service = create_batch_service(db)
    try:
        result = await service.create_batch(
            formula_id=req.formula_id,
            target_weight_kg=req.target_weight_kg,
            preparer_id=req.preparer_id,
            notes=req.notes,
            ingredient_lot_assignments=req.ingredient_lot_assignments,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", summary="批记录列表", response_model=dict)
async def list_batches(
    formula_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db = Depends(get_db),
):
    """列出批记录，支持按配方和状态筛选"""
    service = create_batch_service(db)
    return await service.list_batches(
        formula_id=formula_id,
        status=status,
        page=page,
        page_size=page_size,
    )


@router.get("/{batch_id}", summary="批记录详情", response_model=dict)
async def get_batch(
    batch_id: int,
    db = Depends(get_db),
):
    """获取批记录详情，包含关联样品和原料批号"""
    service = create_batch_service(db)
    batch = await service.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批记录不存在")
    return batch.to_dict()


@router.patch("/{batch_id}/status", summary="更新批记录状态", response_model=dict)
async def update_batch_status(
    batch_id: int,
    req: UpdateBatchStatusRequest,
    db = Depends(get_db),
):
    """更新批记录状态（计划→进行中→已完成→关闭）"""
    service = create_batch_service(db)
    try:
        return await service.update_batch_status(
            batch_id=batch_id,
            status=req.status,
            actual_weight_kg=req.actual_weight_kg,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{batch_id}/trace/backward", summary="反向追溯（批次→原料）", response_model=dict)
async def backward_trace(
    batch_id: int,
    db = Depends(get_db),
):
    """
    反向追溯：给定批次，找出所有使用的原料批号

    对标 FormLab: "Trace a result back to its source: lot, batch & formula version"
    """
    engine = create_traceability_engine(db)
    try:
        return await engine.backward_trace(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/lots/{lot_id}/trace/forward", summary="正向追溯（原料批号→批次）", response_model=dict)
async def forward_trace(
    lot_id: int,
    db = Depends(get_db),
):
    """
    正向追溯：给定原料批号，找出所有使用该批号的批次和成品

    对标 FormLab: "Lot & raw-material traceability for small teams"
    """
    engine = create_traceability_engine(db)
    try:
        return await engine.forward_trace(lot_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/prices/impact/{ingredient_id}", summary="原料调价影响分析", response_model=dict)
async def analyze_price_impact(
    ingredient_id: int,
    new_price_per_kg: float = Query(..., description="新单价（元/kg）"),
    db = Depends(get_db),
):
    """
    分析某原料调价对所有配方和批次的成本影响

    对标 FormLab: "How to manage raw-material costs across 100+ formulas"
    """
    service = create_price_change_service(db)
    try:
        # 获取当前价格
        from sqlalchemy import select

        from app.models import Ingredient
        stmt = select(Ingredient).where(Ingredient.id == ingredient_id)
        result = await db.execute(stmt)
        ingredient = result.scalar_one_or_none()
        if not ingredient:
            raise HTTPException(status_code=404, detail="原料不存在")

        old_price = (ingredient.properties or {}).get("price_per_kg", 0)
        return await service.analyze_impact(ingredient_id, old_price, new_price_per_kg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/prices/{ingredient_id}/update", summary="更新原料价格并分析影响", response_model=dict)
async def update_price(
    ingredient_id: int,
    new_price_per_kg: float = Query(..., description="新单价（元/kg）"),
    currency: str = Query("CNY"),
    note: Optional[str] = None,
    db = Depends(get_db),
):
    """
    更新原料价格（自动记录历史），并返回影响分析

    对标 FormLab: "Bulk-update ingredient prices"
    """
    service = create_price_change_service(db)
    try:
        from sqlalchemy import select

        from app.models import Ingredient
        stmt = select(Ingredient).where(Ingredient.id == ingredient_id)
        result = await db.execute(stmt)
        ingredient = result.scalar_one_or_none()
        if not ingredient:
            raise HTTPException(status_code=404, detail="原料不存在")

        old_price = (ingredient.properties or {}).get("price_per_kg", 0)
        return await service.bulk_update_price(ingredient_id, new_price_per_kg, currency, note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
