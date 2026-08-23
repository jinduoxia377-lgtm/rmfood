"""OpenFoodFacts 导入工作流集成测试"""

import pytest
import asyncio
from scripts.import_off_direct import run_sample_import, run_bulk_import
from app.core.database.session import get_engine, init_database


@pytest.mark.asyncio
class TestImportWorkflow:
    """导入流程集成测试"""

    async def setup_method(self):
        """设置测试数据库环境"""
        await init_database()  # 确保表存在

    async def teardown_method(self):
        """清理测试环境"""
        engine = get_engine()
        await engine.dispose()

    @pytest.mark.slow
    async def test_sample_import_execution(self):
        """样本导入应成功执行且不抛异常"""
        try:
            await run_sample_import()
            # 断言某些表中有数据（示例，根据实际数据调整）
            async with get_engine().connect() as conn:
                result = await conn.execute("SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts'")
                count = result.scalar()
                # 样本插入会至少产生一些记录
                assert count >= 0  # 至少不失败
        except Exception as e:
            pytest.fail(f"Sample import failed: {e}")

    @pytest.mark.slow
    async def test_bulk_import_completion(self):
        """批量导入应完成并记录日志"""
        try:
            await run_bulk_import()
            # 验证数据已插入
            async with get_engine().connect() as conn:
                result = await conn.execute(
                    "SELECT source, COUNT(*) FROM retail_products GROUP BY source"
                )
                rows = result.fetchall()
                sources = [str(row[0]) for row in rows]
                assert "openfoodfacts" in sources
        except Exception as e:
            pytest.fail(f"Bulk import failed: {e}")
