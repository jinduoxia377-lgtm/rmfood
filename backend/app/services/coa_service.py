"""
食源性多肽COA服务层
提供COA和检验单项的完整CRUD操作
"""
import logging
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.peptide_batch_coa import COATestItem, PeptideBatchCOA
from app.schemas.coa import COACreate, COATestItemCreate, COATestItemUpdate, COAUpdate

logger = logging.getLogger(__name__)


class COAService:
    """COA业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── 创建 ────────────────────────────────────────────────

    async def create_coa(self, data: COACreate) -> PeptideBatchCOA:
        """创建COA记录（含检验单项）"""
        coa = PeptideBatchCOA(
            peptide_id=data.peptide_id,
            product_name_cn=data.product_name_cn,
            product_name_en=data.product_name_en,
            product_type=data.product_type,
            product_code=data.product_code,
            spec=data.spec,
            batch_no=data.batch_no,
            mfg_date=data.mfg_date,
            expiry_date=data.expiry_date,
            production_line=data.production_line,
            gb_standard=data.gb_standard,
            enterprise_standard=data.enterprise_standard,
            inspection_basis=data.inspection_basis,
            test_conclusion=data.test_conclusion,
            qualified=data.qualified,
            coa_pdf_url=data.coa_pdf_url,
            coa_word_url=data.coa_word_url,
            test_report_image_url=data.test_report_image_url,
            tested_by=data.tested_by,
            checked_by=data.checked_by,
            approved_by=data.approved_by,
            supplier_name=data.supplier_name,
            supplier_batch_ref=data.supplier_batch_ref,
        )
        self.db.add(coa)
        await self.db.flush()

        # 创建检验单项
        if data.test_items:
            for item_data in data.test_items:
                item = COATestItem(
                    coa_id=coa.id,
                    category=item_data.category,
                    item_name=item_data.item_name,
                    item_name_en=item_data.item_name_en,
                    standard=item_data.standard,
                    result=item_data.result,
                    unit=item_data.unit,
                    judgment=item_data.judgment,
                    remark=item_data.remark,
                    sort_order=item_data.sort_order,
                )
                self.db.add(item)

        await self.db.commit()
        await self.db.refresh(coa)
        return coa

    # ─── 查询 ────────────────────────────────────────────────

    async def get_coa(self, coa_id: int) -> Optional[PeptideBatchCOA]:
        """获取COA详情（含检验单项）"""
        result = await self.db.execute(
            select(PeptideBatchCOA)
            .where(
                PeptideBatchCOA.id == coa_id,
                PeptideBatchCOA.deleted_at.is_(None)
            )
            .options(selectinload(PeptideBatchCOA.test_items))
        )
        return result.scalar_one_or_none()

    async def list_coas(
        self,
        page: int = 1,
        page_size: int = 20,
        peptide_id: Optional[int] = None,
        batch_no: Optional[str] = None,
        product_name_cn: Optional[str] = None,
        gb_standard: Optional[str] = None,
        test_conclusion: Optional[str] = None,
        qualified: Optional[bool] = None,
        supplier_name: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[PeptideBatchCOA], int]:
        """分页查询COA列表"""
        query = select(PeptideBatchCOA).where(PeptideBatchCOA.deleted_at.is_(None))

        # 筛选条件
        if peptide_id is not None:
            query = query.where(PeptideBatchCOA.peptide_id == peptide_id)
        if batch_no:
            query = query.where(PeptideBatchCOA.batch_no.ilike(f"%{batch_no}%"))
        if product_name_cn:
            query = query.where(PeptideBatchCOA.product_name_cn.ilike(f"%{product_name_cn}%"))
        if gb_standard:
            query = query.where(PeptideBatchCOA.gb_standard.ilike(f"%{gb_standard}%"))
        if test_conclusion:
            query = query.where(PeptideBatchCOA.test_conclusion == test_conclusion)
        if qualified is not None:
            query = query.where(PeptideBatchCOA.qualified == qualified)
        if supplier_name:
            query = query.where(PeptideBatchCOA.supplier_name.ilike(f"%{supplier_name}%"))
        if start_date:
            query = query.where(PeptideBatchCOA.mfg_date >= start_date)
        if end_date:
            query = query.where(PeptideBatchCOA.mfg_date <= end_date)

        # 排序
        order_col = getattr(PeptideBatchCOA, sort_by, PeptideBatchCOA.created_at)
        if sort_order == "desc":
            query = query.order_by(order_col.desc())
        else:
            query = query.order_by(order_col.asc())

        # 分页
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(total_query)
        total = total_result.scalar_one()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(
            query.options(selectinload(PeptideBatchCOA.test_items))
        )
        items = result.scalars().all()
        return items, total

    async def get_coas_by_peptide(self, peptide_id: int) -> List[PeptideBatchCOA]:
        """按多肽ID获取所有批次COA"""
        result = await self.db.execute(
            select(PeptideBatchCOA)
            .where(
                PeptideBatchCOA.peptide_id == peptide_id,
                PeptideBatchCOA.deleted_at.is_(None)
            )
            .options(selectinload(PeptideBatchCOA.test_items))
            .order_by(PeptideBatchCOA.mfg_date.desc())
        )
        return result.scalars().all()

    async def get_coa_by_batch_no(self, batch_no: str) -> Optional[PeptideBatchCOA]:
        """按批号查询COA"""
        result = await self.db.execute(
            select(PeptideBatchCOA)
            .where(
                PeptideBatchCOA.batch_no == batch_no,
                PeptideBatchCOA.deleted_at.is_(None)
            )
            .options(selectinload(PeptideBatchCOA.test_items))
        )
        return result.scalar_one_or_none()

    # ─── 更新 ────────────────────────────────────────────────

    async def update_coa(self, coa_id: int, data: COAUpdate) -> Optional[PeptideBatchCOA]:
        """更新COA元数据"""
        coa = await self.get_coa(coa_id)
        if not coa:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(coa, field):
                setattr(coa, field, value)

        await self.db.commit()
        await self.db.refresh(coa)
        return coa

    async def update_test_items(self, coa_id: int, items: List[COATestItemUpdate]) -> List[COATestItem]:
        """批量更新检验单项"""
        coa = await self.get_coa(coa_id)
        if not coa:
            raise ValueError(f"COA {coa_id} 不存在")

        # 删除旧项
        await self.db.execute(
            delete(COATestItem).where(COATestItem.coa_id == coa_id)
        )

        # 创建新项
        for item_data in items:
            item = COATestItem(
                coa_id=coa_id,
                category=item_data.category or "sensory",
                item_name=item_data.item_name or "",
                item_name_en=item_data.item_name_en,
                standard=item_data.standard or "",
                result=item_data.result,
                unit=item_data.unit,
                judgment=item_data.judgment,
                remark=item_data.remark,
                sort_order=item_data.sort_order or 0,
            )
            self.db.add(item)

        await self.db.commit()

        # 刷新并返回
        result = await self.db.execute(
            select(COATestItem)
            .where(COATestItem.coa_id == coa_id)
            .order_by(COATestItem.sort_order)
        )
        return result.scalars().all()

    async def create_test_item(self, coa_id: int, data: COATestItemCreate) -> COATestItem:
        """创建单个检验单项"""
        coa = await self.get_coa(coa_id)
        if not coa:
            raise ValueError(f"COA {coa_id} 不存在")

        item = COATestItem(
            coa_id=coa_id,
            category=data.category,
            item_name=data.item_name,
            item_name_en=data.item_name_en,
            standard=data.standard,
            result=data.result,
            unit=data.unit,
            judgment=data.judgment,
            remark=data.remark,
            sort_order=data.sort_order,
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update_test_item(self, item_id: int, data: COATestItemUpdate) -> Optional[COATestItem]:
        """更新单个检验单项"""
        result = await self.db.execute(
            select(COATestItem).where(COATestItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(item, field):
                setattr(item, field, value)

        await self.db.commit()
        await self.db.refresh(item)
        return item

    # ─── 删除 ────────────────────────────────────────────────

    async def delete_coa(self, coa_id: int) -> bool:
        """软删除COA"""
        coa = await self.get_coa(coa_id)
        if not coa:
            return False
        coa.soft_delete()
        await self.db.commit()
        return True

    # ─── 批量操作 ────────────────────────────────────────────

    async def batch_import(self, coa_data_list: List[COACreate]) -> List[PeptideBatchCOA]:
        """批量导入COA"""
        results = []
        for data in coa_data_list:
            coa = await self.create_coa(data)
            results.append(coa)
        return results
