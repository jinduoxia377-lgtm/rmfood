"""RMFOOD 肽服务"""
from typing import List, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..models.formula import Peptide
from ..schemas.peptide import PeptideCreate, PeptideUpdate, PeptideResponse


class PeptideService:
    """肽服务类"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_peptides(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        activity_type: Optional[str] = None,
    ) -> Tuple[List[Peptide], int]:
        """获取肽列表"""
        query = select(Peptide)

        if search:
            query = query.filter(
                or_(
                    Peptide.sequence.ilike(f"%{search}%"),
                    Peptide.source_protein.ilike(f"%{search}%"),
                    Peptide.source_organism.ilike(f"%{search}%")
                )
            )

        if activity_type:
            query = query.filter(Peptide.activity_type == activity_type)

        # 计算总数
        count_query = select(Peptide.id).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # 分页
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await self.db.execute(query)
        peptides = result.scalars().all()

        return peptides, total

    async def get_peptide(self, peptide_id: int) -> Peptide:
        """获取肽详情"""
        result = await self.db.execute(
            select(Peptide).where(Peptide.id == peptide_id)
        )
        peptide = result.scalar_one_or_none()

        if not peptide:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="肽不存在")

        return peptide

    async def create_peptide(self, data: PeptideCreate) -> Peptide:
        """创建肽"""
        peptide = Peptide(**data.model_dump())
        self.db.add(peptide)
        await self.db.commit()
        await self.db.refresh(peptide)
        return peptide

    async def update_peptide(self, peptide_id: int, data: PeptideUpdate) -> Peptide:
        """更新肽"""
        peptide = await self.get_peptide(peptide_id)

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(peptide, field, value)

        await self.db.commit()
        await self.db.refresh(peptide)
        return peptide

    async def delete_peptide(self, peptide_id: int) -> None:
        """删除肽"""
        peptide = await self.get_peptide(peptide_id)
        await self.db.delete(peptide)
        await self.db.commit()
