"""
数据库查询单元测试
测试中药材和肽数据的查询功能
"""
import pytest
import time
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import TCMHerb, BioactivePeptide


class TestTCMHerbQueries:
    """中药材查询测试"""

    async def test_herb_count(self, db_session: AsyncSession):
        """测试中药材总数查询"""
        count = (await db_session.execute(select(func.count()).select_from(TCMHerb))).scalar()
        assert count >= 0, "药材数量不能为负数"

    async def test_herb_search_by_name(self, db_session: AsyncSession):
        """测试中药材按名称搜索"""
        result = (await db_session.execute(
            select(TCMHerb).where(TCMHerb.name_cn.ilike("%人参%"))
        )).scalars().all()
        assert isinstance(result, list)
        if len(result) > 0:
            assert any("人参" in h.name_cn for h in result), "搜索结果应包含人参"

    async def test_herb_search_by_category(self, db_session: AsyncSession):
        """测试中药材按分类过滤"""
        result = (await db_session.execute(
            select(TCMHerb).where(TCMHerb.category == "补气药")
        )).scalars().all()
        assert isinstance(result, list)
        for herb in result:
            assert herb.category == "补气药", "分类过滤不正确"

    async def test_herb_food_homology_filter(self, db_session: AsyncSession):
        """测试药食同源过滤"""
        result = (await db_session.execute(
            select(TCMHerb).where(TCMHerb.is_food_homology == True)
        )).scalars().all()
        assert isinstance(result, list)
        for herb in result:
            assert herb.is_food_homology == True, "药食同源过滤不正确"

    async def test_herb_pagination(self, db_session: AsyncSession):
        """测试中药材分页查询"""
        result = (await db_session.execute(
            select(TCMHerb).order_by(TCMHerb.name_cn).offset(0).limit(20)
        )).scalars().all()
        assert isinstance(result, list)
        assert len(result) <= 20, "分页限制应生效"

    async def test_herb_compound_target_count(self, db_session: AsyncSession):
        """测试药材化合物和靶点数量计算"""
        herbs = (await db_session.execute(select(TCMHerb).limit(10))).scalars().all()
        for herb in herbs:
            compound_count = len(herb.compounds) if isinstance(herb.compounds, list) else 0
            target_count = len(herb.targets) if isinstance(herb.targets, list) else 0
            assert compound_count >= 0, "化合物数量不能为负数"
            assert target_count >= 0, "靶点数量不能为负数"


class TestBioactivePeptideQueries:
    """活性肽查询测试"""

    async def test_peptide_count(self, db_session: AsyncSession):
        """测试活性肽总数查询"""
        count = (await db_session.execute(select(func.count()).select_from(BioactivePeptide))).scalar()
        assert count >= 0, "肽数量不能为负数"

    async def test_peptide_search_by_sequence(self, db_session: AsyncSession):
        """测试肽按序列搜索"""
        result = (await db_session.execute(
            select(BioactivePeptide).where(BioactivePeptide.sequence.ilike("%Gly%"))
        )).scalars().all()
        assert isinstance(result, list)

    async def test_peptide_search_by_activity_type(self, db_session: AsyncSession):
        """测试肽按活性类型过滤"""
        result = (await db_session.execute(
            select(BioactivePeptide).where(BioactivePeptide.activity_type == "ACE inhibitory")
        )).scalars().all()
        assert isinstance(result, list)

    async def test_peptide_pagination(self, db_session: AsyncSession):
        """测试肽分页查询"""
        result = (await db_session.execute(
            select(BioactivePeptide).order_by(BioactivePeptide.sequence).offset(0).limit(20)
        )).scalars().all()
        assert isinstance(result, list)
        assert len(result) <= 20, "分页限制应生效"

    async def test_peptide_activity_value_range(self, db_session: AsyncSession):
        """测试肽活性值范围"""
        peptides = (await db_session.execute(select(BioactivePeptide).limit(10))).scalars().all()
        for peptide in peptides:
            if peptide.activity_value is not None:
                assert isinstance(peptide.activity_value, (int, float)), "活性值应为数值类型"


class TestDatabasePerformance:
    """数据库性能测试"""

    async def test_herb_query_performance(self, db_session: AsyncSession):
        """测试中药材查询性能（应<200ms）"""
        start = time.perf_counter()
        await db_session.execute(select(TCMHerb).where(TCMHerb.name_cn.ilike("%当归%")))
        elapsed = (time.perf_counter() - start) * 1000

        assert elapsed < 200, f"查询响应时间超过200ms，实际: {elapsed:.2f}ms"

    async def test_peptide_query_performance(self, db_session: AsyncSession):
        """测试肽查询性能（应<200ms）"""
        start = time.perf_counter()
        await db_session.execute(select(BioactivePeptide).limit(20))
        elapsed = (time.perf_counter() - start) * 1000

        assert elapsed < 200, f"查询响应时间超过200ms，实际: {elapsed:.2f}ms"


class TestDataCompleteness:
    """数据完整性测试"""

    async def test_herb_required_fields(self, db_session: AsyncSession):
        """测试中药材必填字段"""
        herbs = (await db_session.execute(select(TCMHerb).limit(5))).scalars().all()
        for herb in herbs:
            assert herb.name_cn is not None, "药材名称不能为空"
            assert isinstance(herb.name_cn, str), "药材名称应为字符串"

    async def test_peptide_required_fields(self, db_session: AsyncSession):
        """测试肽必填字段"""
        peptides = (await db_session.execute(select(BioactivePeptide).limit(5))).scalars().all()
        for peptide in peptides:
            assert peptide.sequence is not None, "肽序列不能为空"
            assert isinstance(peptide.sequence, str), "肽序列应为字符串"


class TestDatabaseConnection:
    """数据库连接测试"""

    async def test_connection_health(self, db_session: AsyncSession):
        """测试数据库连接健康状态"""
        result = await db_session.execute(select(func.count()).select_from(TCMHerb))
        assert result.scalar() is not None, "数据库查询应正常返回"

    async def test_session_commit_rollback(self, db_session: AsyncSession):
        """测试事务提交和回滚"""
        original_count = (await db_session.execute(select(func.count()).select_from(TCMHerb))).scalar()
        
        # 测试回滚
        await db_session.rollback()
        after_rollback_count = (await db_session.execute(select(func.count()).select_from(TCMHerb))).scalar()
        assert original_count == after_rollback_count, "回滚后记录数应保持不变"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])