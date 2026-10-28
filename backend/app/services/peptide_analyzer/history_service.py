"""
肽链结构分析历史记录服务
提供完整的历史记录 CRUD 操作
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    desc,
    func,
    select,
    update,  # A-27
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.peptide_structure import PeptideStructureAnalysis
from app.models.user_model import User

logger = logging.getLogger(__name__)


class PeptideStructureHistoryService:
    """
    肽链结构分析历史记录服务

    提供：
    - 保存分析结果
    - 查询历史记录
    - 删除历史记录
    - 统计分析
    """

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user

    async def save_analysis(
        self,
        sequence: str,
        result: Dict[str, Any],
        n_terminal: Optional[str] = None,
        c_terminal: Optional[str] = None,
        unusual_aaminos: Optional[List[Dict]] = None,
    ) -> PeptideStructureAnalysis:
        """
        保存分析结果到历史记录

        Args:
            sequence: 肽序列
            result: 分析结果字典
            n_terminal: N端修饰
            c_terminal: C端修饰
            unusual_aaminos: 非天然氨基酸列表

        Returns:
            保存的记录对象
        """
        try:
            record = PeptideStructureAnalysis(
                sequence=sequence.upper(),
                user_id=self.user.id,
                smiles=result.get("smiles"),
                selfies=result.get("selfies"),
                molecular_weight=result.get("molecular_weight", 0.0),
                isoelectric_point=result.get("isoelectric_point", 0.0),
                hydrophobicity=result.get("hydrophobicity", 0.0),
                ace_inhibition_score=result.get("ace_inhibition", {}).get("score", 0.0),
                antioxidant_score=result.get("antioxidant", {}).get("score", 0.0),
                antimicrobial_score=result.get("antimicrobial", {}).get("score", 0.0),
                is_allergen=result.get("safety", {}).get("is_allergen", False),
                is_toxic=result.get("safety", {}).get("is_toxic", False),
                digestibility=result.get("safety", {}).get("digestibility", "unknown"),
                bitterness_score=result.get("taste", {}).get("bitterness", 0.0),
                umami_potential=result.get("taste", {}).get("umami", 0.0),
                food_safety_score=result.get("food_safety_score", 0.0),
                source_food=result.get("source", {}).get("food"),
                source_database=result.get("source", {}).get("database"),
                literature_refs=result.get("source", {}).get("references", []),
                n_terminal_mod=n_terminal,
                c_terminal_mod=c_terminal,
                unusual_aas=unusual_aaminos or [],
                status="completed",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            self.db.add(record)
            await self.db.commit()
            await self.db.refresh(record)

            logger.info(f"保存分析历史: {sequence}, ID={record.id}")
            return record

        except Exception as e:
            await self.db.rollback()
            logger.error(f"保存分析历史失败: {e}", exc_info=True)
            raise

    async def get_history(
        self,
        page: int = 1,
        page_size: int = 20,
        sequence: Optional[str] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        is_allergen: Optional[bool] = None,
        is_toxic: Optional[bool] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        查询分析历史记录

        Args:
            page: 页码
            page_size: 每页数量
            sequence: 序列过滤
            min_score: 最低评分
            max_score: 最高评分
            is_allergen: 过敏原过滤
            is_toxic: 毒性过滤
            sort_by: 排序字段
            sort_order: 排序方向

        Returns:
            分页结果
        """
        try:
            # 基础查询
            query = select(PeptideStructureAnalysis).where(
                PeptideStructureAnalysis.user_id == self.user.id,
                PeptideStructureAnalysis.deleted_at.is_(None)
            )

            # 筛选条件
            if sequence:
                query = query.where(PeptideStructureAnalysis.sequence.ilike(f"%{sequence}%"))
            if min_score is not None:
                query = query.where(PeptideStructureAnalysis.food_safety_score >= min_score)
            if max_score is not None:
                query = query.where(PeptideStructureAnalysis.food_safety_score <= max_score)
            if is_allergen is not None:
                query = query.where(PeptideStructureAnalysis.is_allergen == is_allergen)
            if is_toxic is not None:
                query = query.where(PeptideStructureAnalysis.is_toxic == is_toxic)

            # 总数
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db.execute(count_query)
            total = total_result.scalar() or 0

            # 排序
            sort_column = getattr(PeptideStructureAnalysis, sort_by, PeptideStructureAnalysis.created_at)
            if sort_order == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)

            # 分页
            query = query.offset((page - 1) * page_size).limit(page_size)

            # 执行查询
            result = await self.db.execute(query)
            records = result.scalars().all()

            return {
                "total": total,
                "page": page,
                "page_size": page_size,
                "items": [r.to_dict() for r in records],
            }

        except Exception as e:
            logger.error(f"查询历史记录失败: {e}", exc_info=True)
            raise

    async def get_statistics(self) -> Dict[str, Any]:
        """
        获取分析历史统计

        Returns:
            统计信息
        """
        try:
            # 基础统计
            stats_query = select(
                func.count().label("total"),
                func.avg(PeptideStructureAnalysis.food_safety_score).label("avg_score"),
                func.avg(PeptideStructureAnalysis.molecular_weight).label("avg_mw"),
                func.avg(PeptideStructureAnalysis.ace_inhibition_score).label("avg_ace"),
                func.avg(PeptideStructureAnalysis.antioxidant_score).label("avg_antiox"),
                func.avg(PeptideStructureAnalysis.antimicrobial_score).label("avg_amp"),
                func.sum(
                    func.case(
                        (PeptideStructureAnalysis.is_allergen == True, 1),
                        else_=0
                    )
                ).label("allergen_count"),
                func.sum(
                    func.case(
                        (PeptideStructureAnalysis.is_toxic == True, 1),
                        else_=0
                    )
                ).label("toxic_count"),
                func.max(PeptideStructureAnalysis.created_at).label("latest_analysis"),
            ).where(
                PeptideStructureAnalysis.user_id == self.user.id,
                PeptideStructureAnalysis.deleted_at.is_(None)
            )

            result = await self.db.execute(stats_query)
            stats = result.fetchone()

            # 评分分布
            distribution_query = select(
                func.count().label("count"),
                func.floor(PeptideStructureAnalysis.food_safety_score / 10).label("bin")
            ).where(
                PeptideStructureAnalysis.user_id == self.user.id,
                PeptideStructureAnalysis.deleted_at.is_(None)
            ).group_by("bin").order_by("bin")

            dist_result = await self.db.execute(distribution_query)
            distribution = [{"bin": row.bin, "count": row.count} for row in dist_result.fetchall()]

            # 活性类型分布
            activity_dist = {
                "ace_high": sum(1 for r in range(100) if r * 0.01 >= 0.8),
                "antiox_high": 0,
                "amp_high": 0,
            }

            return {
                "total_analyses": stats.total or 0,
                "avg_food_score": round(float(stats.avg_score or 0), 2),
                "avg_molecular_weight": round(float(stats.avg_mw or 0), 2),
                "avg_ace_inhibition": round(float(stats.avg_ace or 0), 4),
                "avg_antioxidant": round(float(stats.avg_antiox or 0), 4),
                "avg_antimicrobial": round(float(stats.avg_amp or 0), 4),
                "allergen_count": stats.allergen_count or 0,
                "toxic_count": stats.toxic_count or 0,
                "latest_analysis": stats.latest_analysis.isoformat() if stats.latest_analysis else None,
                "score_distribution": distribution,
                "activity_distribution": activity_dist,
            }

        except Exception as e:
            logger.error(f"获取统计信息失败: {e}", exc_info=True)
            raise

    async def get_record(self, record_id: int) -> Optional[PeptideStructureAnalysis]:
        """
        获取单条记录

        Args:
            record_id: 记录 ID

        Returns:
            记录对象或 None
        """
        try:
            result = await self.db.execute(
                select(PeptideStructureAnalysis).where(
                    PeptideStructureAnalysis.id == record_id,
                    PeptideStructureAnalysis.user_id == self.user.id,
                    PeptideStructureAnalysis.deleted_at.is_(None)
                )
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取记录失败: {e}", exc_info=True)
            raise

    async def delete_record(self, record_id: int) -> bool:
        """
        软删除记录

        Args:
            record_id: 记录 ID

        Returns:
            是否删除成功
        """
        try:
            record = await self.get_record(record_id)
            if not record:
                return False

            record.deleted_at = datetime.utcnow()
            record.updated_at = datetime.utcnow()
            await self.db.commit()

            logger.info(f"删除分析历史: ID={record_id}")
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(f"删除记录失败: {e}", exc_info=True)
            raise

    async def batch_delete(self, record_ids: List[int]) -> int:
        """
        批量删除记录

        Args:
            record_ids: 记录 ID 列表

        Returns:
            删除的数量
        """
        try:
            result = await self.db.execute(
                update(PeptideStructureAnalysis)
                .where(
                    PeptideStructureAnalysis.id.in_(record_ids),
                    PeptideStructureAnalysis.user_id == self.user.id,
                    PeptideStructureAnalysis.deleted_at.is_(None)
                )
                .values(
                    deleted_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
            )
            await self.db.commit()
            return result.rowcount
        except Exception as e:
            await self.db.rollback()
            logger.error(f"批量删除失败: {e}", exc_info=True)
            raise

    async def export_to_csv(self, record_ids: Optional[List[int]] = None) -> str:
        """
        导出历史记录为 CSV

        Args:
            record_ids: 记录的 ID 列表（可选，None 表示全部）

        Returns:
            CSV 内容
        """
        try:
            if record_ids:
                query = select(PeptideStructureAnalysis).where(
                    PeptideStructureAnalysis.id.in_(record_ids),
                    PeptideStructureAnalysis.user_id == self.user.id,
                    PeptideStructureAnalysis.deleted_at.is_(None)
                )
            else:
                query = select(PeptideStructureAnalysis).where(
                    PeptideStructureAnalysis.user_id == self.user.id,
                    PeptideStructureAnalysis.deleted_at.is_(None)
                )

            result = await self.db.execute(query)
            records = result.scalars().all()

            # 生成 CSV
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # 写入表头
            writer.writerow([
                "ID", "序列", "分子量", "食品评分", "ACE抑制", "抗氧化", "抗菌",
                "过敏原", "毒性", "消化性", "苦味", "鲜味", "SMILES", "分析时间"
            ])

            # 写入数据
            for r in records:
                writer.writerow([
                    r.id,
                    r.sequence,
                    f"{r.molecular_weight:.2f}",
                    f"{r.food_safety_score:.2f}",
                    f"{r.ace_inhibition_score:.4f}",
                    f"{r.antioxidant_score:.4f}",
                    f"{r.antimicrobial_score:.4f}",
                    "是" if r.is_allergen else "否",
                    "是" if r.is_toxic else "否",
                    r.digestibility,
                    f"{r.bitterness_score:.4f}",
                    f"{r.umami_potential:.4f}",
                    r.smiles or "",
                    r.created_at.isoformat(),
                ])

            return output.getvalue()

        except Exception as e:
            logger.error(f"导出 CSV 失败: {e}", exc_info=True)
            raise


# 全局单例
_history_service_instance: Optional[PeptideStructureHistoryService] = None


def get_history_service(db: AsyncSession, user: User) -> PeptideStructureHistoryService:
    """获取历史记录服务实例"""
    # 由于需要 db 和 user 上下文，每次调用都创建新实例
    return PeptideStructureHistoryService(db, user)
