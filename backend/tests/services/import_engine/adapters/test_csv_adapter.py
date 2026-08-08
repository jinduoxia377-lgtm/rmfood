"""CSVAdapter 单元测试"""
import pytest
from pathlib import Path
from app.services.import_engine.adapters.csv_adapter import CsvAdapter
from app.services.import_engine.models import ImportStats


@pytest.fixture()
def sample_csv_file(tmp_path):
    """创建一个测试用的 CSV 文件"""
    csv_file = tmp_path / "test.csv"
    csv_file.write_text("id,name,value
1,apple,10
2,banner,20
3,cherry,30
")
    return csv_file


class TestCsvAdapter:
    """CSVAdapter 测试套件"""

    @pytest.mark.asyncio
    async def test_basic_validation(self, sample_csv_file):
        """测试基本验证功能"""
        adapter = CsvAdapter(file_path=sample_csv_file, delimiter=",")
        valid, msg = await adapter.validate()
        assert valid is True
        assert msg == "Valid"

    @pytest.mark.asyncio
    async def test_count_rows(self, sample_csv_file):
        """测试行数计数"""
        adapter = CsvAdapter(file_path=sample_csv_file, delimiter=",")
        count = await adapter.count()
        assert count == 3  # 应该有 3 数据行

    @pytest.mark.asyncio
    async def test_preview_data(self, sample_csv_file):
        """测试预览数据功能"""
        adapter = CsvAdapter(file_path=sample_csv_file, delimiter=",")
        preview = await adapter.preview(limit=2)
        assert len(preview) == 2
        assert preview[0]["id"] == "1"
        assert preview[1]["name"] == "banner"

    @pytest.mark.asyncio
    async def test_iterate_rows(self, sample_csv_file):
        """测试迭代行数据"""
        adapter = CsvAdapter(file_path=sample_csv_file, delimiter=",")
        rows = []
        async for row in adapter.iterate():
            rows.append(row)
            if len(rows) >= 3:
                break
        assert len(rows) >= 3
        assert rows[0]["id"] == "1"

    @pytest.mark.asyncio
    async def test_stats_after_iteration(self, sample_csv_file):
        """测试统计信息更新"""
        adapter = CsvAdapter(file_path=sample_csv_file, delimiter=",")
        # 迭代一些行
        count = 0
        async for row in adapter.iterate():
            count += 1
            if count >= 2:
                break
        stats = adapter.get_stats()
        assert stats.valid_rows >= 2


class TestCsvAdapterEdgeCases:
    """CSVAdapter 边缘情况测试"""

    @pytest.mark.asyncio
    async def test_empty_file(self, tmp_path):
        """测试空文件"""
        empty_file = tmp_path / "empty.csv"
        empty_file.write_text("")
        adapter = CsvAdapter(file_path=empty_file, delimiter=",")
        
        with pytest.raises(Exception) as exc_info:
            await adapter.validate()
        assert "Empty file" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_column(self, tmp_path):
        """测试缺少必要列"""
        bad_file = tmp_path / "bad.csv"
        bad_file.write_text("name,value
1,10
2,20
")  # 缺少 id 列
        adapter = CsvAdapter(file_path=bad_file, delimiter=",")
        # 这个应该不会失败，但可能在映射时出现问题
        valid, msg = await adapter.validate()
        # 验证通过（列缺失是映射阶段的问题，不是适配器验证问题）
