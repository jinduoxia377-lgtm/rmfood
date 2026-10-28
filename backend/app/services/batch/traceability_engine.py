"""
双向追溯引擎
- 正向：原料批号 → 使用该批号的所有批次 → 所有成品
- 反向：成品批次 → 使用的所有原料批号
"""
import logging
from typing import Any, Dict, List

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Batch, IngredientLot, Sample, TestReport

logger = logging.getLogger(__name__)


class TraceabilityEngine:
    """
    双向追溯引擎

    正向追溯: 给定一个原料批号，找出所有使用了该批号的批次和成品
    反向追溯: 给定一个批次，找出所有使用的原料批号

    对标 FormLab: "Lot & raw-material traceability for small teams"
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def forward_trace(self, ingredient_lot_id: int) -> Dict[str, Any]:
        """
        正向追溯：这个原料批号用到了哪些产品

        流程：IngredientLot → Batch(通过 batch_ingredient_lots) → Sample → TestReport
        """
        # 1. 获取原料批号信息
        lot_stmt = select(IngredientLot).where(IngredientLot.id == ingredient_lot_id)
        lot_result = await self.db.execute(lot_stmt)
        lot = lot_result.scalar_one_or_none()
        if not lot:
            raise ValueError(f"原料批号不存在: {ingredient_lot_id}")

        # 2. 找到所有使用该批号的批次
        batches_stmt = text("""
            SELECT b.* FROM batches b
            JOIN batch_ingredient_lots bil ON b.id = bil.batch_id
            WHERE bil.ingredient_lot_id = :lot_id
            ORDER BY b.created_at DESC
        """)
        batch_result = await self.db.execute(batches_stmt, {"lot_id": ingredient_lot_id})
        batch_rows = batch_result.fetchall()

        batches = []
        for row in batch_rows:
            batch_info = {
                "id": row[0],
                "batch_code": row[1] if len(row) > 1 else None,
                "formula_id": row[2] if len(row) > 2 else None,
                "target_weight_kg": row[3] if len(row) > 3 else None,
                "status": row[4] if len(row) > 4 else None,
                "created_at": row[5] if len(row) > 5 else None,
            }
            # 获取批次对应的配方代码
            formula_stmt = select(text("code, name")).where(text("id = :fid")).bindparams(fid=batch_info["formula_id"])
            formula_result = await self.db.execute(formula_stmt)
            formula_row = formula_result.fetchone()
            if formula_row:
                batch_info["formula_code"] = formula_row[0]
                batch_info["formula_name"] = formula_row[1]
            batches.append(batch_info)

        # 3. 获取这些批次的所有样品和测试
        all_samples = []
        for batch in batches:
            samples_stmt = select(Sample).where(Sample.batch_id == batch["id"])
            samples_result = await self.db.execute(samples_stmt)
            samples = samples_result.scalars().all()
            for s in samples:
                sample_info = s.to_dict()
                # 获取该样品的测试报告
                tests_stmt = select(TestReport).where(TestReport.sample_id == s.id)
                tests_result = await self.db.execute(tests_stmt)
                sample_info["test_reports"] = [t.to_dict() for t in tests_result.scalars().all()]
                all_samples.append(sample_info)

        return {
            "ingredient_lot_id": ingredient_lot_id,
            "supplier_lot_number": lot.supplier_lot_number,
            "internal_lot_code": lot.internal_lot_code,
            "ingredient_name": lot.ingredient_name,
            "received_qty_kg": lot.received_qty_kg,
            "remaining_qty_kg": lot.remaining_qty_kg,
            "status": lot.status.value if hasattr(lot.status, 'value') else str(lot.status),
            "batches": batches,
            "samples": all_samples,
            "batch_count": len(batches),
            "sample_count": len(all_samples),
        }

    async def backward_trace(self, batch_id: int) -> Dict[str, Any]:
        """
        反向追溯：这个批次用了哪些原料

        流程：Batch → IngredientLot (通过 batch_ingredient_lots)
        """
        # 1. 获取批次信息
        batch_stmt = select(Batch).where(Batch.id == batch_id)
        batch_result = await self.db.execute(batch_stmt)
        batch = batch_result.scalar_one_or_none()
        if not batch:
            raise ValueError(f"批次不存在: {batch_id}")

        # 2. 获取所有关联的原料批号
        lots_stmt = text("""
            SELECT il.*, ing.name as ingredient_name
            FROM ingredient_lots il
            JOIN batch_ingredient_lots bil ON il.id = bil.ingredient_lot_id
            JOIN ingredients ing ON il.ingredient_id = ing.id
            WHERE bil.batch_id = :batch_id
        """)
        lots_result = await self.db.execute(lots_stmt, {"batch_id": batch_id})
        lots_rows = lots_result.fetchall()

        ingredient_lots = []
        for row in lots_rows:
            lot_info = {
                "id": row[0],
                "supplier_lot_number": row[2] if len(row) > 2 else None,
                "internal_lot_code": row[3] if len(row) > 3 else None,
                "ingredient_name": row[-1] if row else None,
                "received_qty_kg": row[4] if len(row) > 4 else None,
                "used_qty_kg": row[5] if len(row) > 5 else None,
                "remaining_qty_kg": row[6] if len(row) > 6 else None,
                "status": row[7] if len(row) > 7 else None,
                "coa_url": row[8] if len(row) > 8 else None,
            }
            ingredient_lots.append(lot_info)

        # 3. 获取批次的样品和测试
        samples_stmt = select(Sample).where(Sample.batch_id == batch_id)
        samples_result = await self.db.execute(samples_stmt)
        samples = samples_result.scalars().all()

        sample_data = []
        for s in samples:
            sample_info = s.to_dict()
            tests_stmt = select(TestReport).where(TestReport.sample_id == s.id)
            tests_result = await self.db.execute(tests_stmt)
            sample_info["test_reports"] = [t.to_dict() for t in tests_result.scalars().all()]
            sample_data.append(sample_info)

        return {
            "batch_id": batch_id,
            "batch_code": batch.batch_code,
            "formula_id": batch.formula_id,
            "target_weight_kg": batch.target_weight_kg,
            "status": batch.status.value if hasattr(batch.status, 'value') else str(batch.status),
            "ingredient_lots": ingredient_lots,
            "samples": sample_data,
            "ingredient_lot_count": len(ingredient_lots),
            "sample_count": len(sample_data),
        }

    async def find_formulas_using_ingredient(self, ingredient_id: int) -> List[Dict[str, Any]]:
        """查找使用了某原料的所有配方（用于价格变动影响分析）"""
        stmt = text("""
            SELECT f.id, f.code, f.name, fi.dosage_mg, fi.unit
            FROM formulas f
            JOIN formula_ingredients fi ON f.id = fi.formula_id
            WHERE fi.ingredient_id = :ingredient_id AND f.deleted_at IS NULL
        """)
        result = await self.db.execute(stmt, {"ingredient_id": ingredient_id})
        rows = result.fetchall()
        return [
            {
                "formula_id": row[0],
                "formula_code": row[1],
                "formula_name": row[2],
                "dosage_mg": row[3],
                "unit": row[4],
            }
            for row in rows
        ]

    async def find_batches_using_lot(self, ingredient_lot_id: int) -> List[int]:
        """查找使用了某原料批号的所有批次ID"""
        stmt = text("""
            SELECT batch_id FROM batch_ingredient_lots
            WHERE ingredient_lot_id = :lot_id
        """)
        result = await self.db.execute(stmt, {"lot_id": ingredient_lot_id})
        return [row[0] for row in result.fetchall()]


def create_traceability_engine(db: AsyncSession) -> TraceabilityEngine:
    return TraceabilityEngine(db)
