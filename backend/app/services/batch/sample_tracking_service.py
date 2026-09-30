"""
样品追踪服务
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Sample, Batch, TestReport, SampleType, TestResult
from app.models.enums import SampleType as SampleTypeEnum

logger = logging.getLogger(__name__)


class SampleTrackingService:
    """样品管理与追踪服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_sample(
        self,
        batch_id: int,
        sample_type: str = "qc",
        quantity_g: float | None = None,
        storage_condition: str | None = None,
    ) -> Dict[str, Any]:
        """创建样品"""
        batch = await self.db.get(Batch, batch_id)
        if not batch:
            raise ValueError(f"批记录不存在: {batch_id}")

        sample_code = await self._generate_sample_code(batch.batch_code)

        sample = Sample(
            organization_id=batch.organization_id,
            sample_code=sample_code,
            batch_id=batch_id,
            sample_type=SampleTypeEnum(sample_type),
            quantity_g=quantity_g,
            storage_condition=storage_condition,
        )
        self.db.add(sample)
        await self.db.commit()
        await self.db.refresh(sample)

        logger.info(f"创建样品: {sample_code} (批次: {batch.batch_code})")
        return sample.to_dict()

    async def list_samples(
        self,
        batch_id: int | None = None,
        sample_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """列出样品"""
        stmt = select(Sample)

        if batch_id:
            stmt = stmt.where(Sample.batch_id == batch_id)
        if sample_type:
            stmt = stmt.where(Sample.sample_type == sample_type)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = stmt.order_by(Sample.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(stmt)
        samples = result.scalars().all()

        return {
            "items": [s.to_dict() for s in samples],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def add_test_result(
        self,
        sample_id: int,
        parameter: str,
        value: float,
        unit: str | None = None,
        spec_min: float | None = None,
        spec_max: float | None = None,
        tester_id: int | None = None,
        notes: str | None = None,
    ) -> Dict[str, Any]:
        """添加测试结果"""
        sample = await self.db.get(Sample, sample_id)
        if not sample:
            raise ValueError(f"样品不存在: {sample_id}")

        # 判定结果
        result = TestResult.PENDING
        if value is not None and (spec_min is not None or spec_max is not None):
            if spec_min is not None and value < spec_min:
                result = TestResult.FAIL
            elif spec_max is not None and value > spec_max:
                result = TestResult.FAIL
            elif spec_min is not None and spec_max is not None:
                mid = (spec_min + spec_max) / 2
                range_val = (spec_max - spec_min) / 2
                if range_val > 0:
                    deviation = abs(value - mid) / range_val
                    if deviation > 0.8:
                        result = TestResult.WARN
                    else:
                        result = TestResult.PASS
                else:
                    result = TestResult.PASS if value == spec_min else TestResult.PASS
            else:
                result = TestResult.PASS

        test_report = TestReport(
            organization_id=sample.organization_id,
            sample_id=sample_id,
            parameter=parameter,
            value=value,
            unit=unit,
            spec_min=spec_min,
            spec_max=spec_max,
            result=result,
            tester_id=tester_id,
            tested_at=datetime.now(timezone.utc),
            notes=notes,
        )
        self.db.add(test_report)
        await self.db.commit()
        await self.db.refresh(test_report)

        return test_report.to_dict()

    async def get_sample_tests(self, sample_id: int) -> List[Dict[str, Any]]:
        """获取样品的所有测试报告"""
        stmt = select(TestReport).where(
            TestReport.sample_id == sample_id
        ).order_by(TestReport.created_at.desc())
        result = await self.db.execute(stmt)
        return [t.to_dict() for t in result.scalars().all()]

    async def _generate_sample_code(self, batch_code: str) -> str:
        """生成样品编号: SMP-{batch_code}-{seq}"""
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"SMP-{batch_code}-{date_str}-"

        stmt = select(func.count()).where(Sample.sample_code.like(f"{prefix}%"))
        result = await self.db.execute(stmt)
        seq = result.scalar_one() + 1

        return f"{prefix}{seq:03d}"


def create_sample_service(db: AsyncSession) -> SampleTrackingService:
    return SampleTrackingService(db)
