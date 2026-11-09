"""ImportEngine 单元测试"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.import_engine.adapters.base import BaseAdapter, FieldMapper
from app.services.import_engine.engine import ImportEngine, ImportReport, ImportStatus
from app.services.import_engine.models import ImportStats


@pytest.fixture
def mock_db():
    """创建一个模拟的数据库会话"""
    db = MagicMock(spec=AsyncSession)
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.fixture
def mock_adapter():
    """创建模拟的适配器"""
    adapter = MagicMock(spec=BaseAdapter)
    adapter.validate = AsyncMock(return_value=(True, "Valid"))
    adapter.count = AsyncMock(return_value=100)
    adapter.iterate = AsyncMock(return_value=iter([{"id": 1, "value": "test"}]))
    from app.services.import_engine.models import ImportStats as ModelImportStats
    adapter.stats = ModelImportStats(total_rows=100, valid_rows=95, invalid_rows=5, inserted=80, updated=15, skipped=0, errors=[])
    adapter.record_error = MagicMock()
    adapter.record_valid = MagicMock()
    adapter.get_stats = MagicMock(return_value=adapter.stats)
    return adapter


@pytest.fixture
def mock_mapper():
    """创建模拟的字段映射器"""
    mapper = MagicMock(spec=FieldMapper)
    mapper.map = AsyncMock(return_value=({"id": 1, "value": "mapped"}, []))
    mapper.add = MagicMock()
    return mapper


class TestImportEngine:
    """ImportEngine 测试套件"""

    async def test_run_valid_data_success(self, mock_db, mock_adapter, mock_mapper):
        """测试成功导入有效数据"""
        # Arrange
        engine = ImportEngine(mock_db)

        # Act
        report = await engine.run(
            adapter=mock_adapter,
            mapper=mock_mapper,
            target_table="test_table",
            id_field="external_id",
        )

        # Assert
        assert report.status == ImportStatus.COMPLETED
        assert isinstance(report.stats, ImportStats)
        assert report.duration_seconds >= 0
        assert "Imported" in report.message

    async def test_validation_failure(self, mock_db, mock_mapper):
        """测试验证失败的情况"""
        # Arrange
        mock_adapter = MagicMock(spec=BaseAdapter)
        mock_adapter.validate = AsyncMock(return_value=(False, "Validation error"))
        mock_adapter.count = AsyncMock(return_value=0)
        from app.services.import_engine.models import ImportStats as ModelImportStats
        mock_adapter.stats = ModelImportStats()
        mock_adapter.get_stats = MagicMock(return_value=mock_adapter.stats)

        engine = ImportEngine(mock_db)

        # Act
        report = await engine.run(
            adapter=mock_adapter,
            mapper=mock_mapper,
            target_table="test_table",
        )

        # Assert
        assert report.status == ImportStatus.FAILED
        assert "Validation error" in report.message

    async def test_row_processing_with_errors(self, mock_db, mock_adapter, mock_mapper):
        """测试带有错误的行处理流程"""
        # Arrange - 让一些行返回错误
        mock_adapter.map.side_effect = [
            ({"id": 1}, []),  # 第一行：无错误
            ({}, [{"field": "missing"}]),  # 第二行：有映射错误但 mapped 为空
            ({"id": 3}, []),  # 第三行：无错误
        ]

        engine = ImportEngine(mock_db)

        # Act
        report = await engine.run(
            adapter=mock_adapter,
            mapper=mock_mapper,
            target_table="test_table",
        )

        # Assert
        # 应该有 2 个插入（第 1 行和第 3 行），1 个错误（第 2 行）
        assert report.stats.inserted >= 2
        assert report.stats.error_rows >= 1

    async def test_batch_write_empty(self, mock_db):
        """测试空批次的写入"""
        engine = ImportEngine(mock_db)

        # Act
        result = await engine._write_batch([], "test_table", "external_id", None)

        # Assert
        assert result["inserted"] == 0
        assert result["updated"] == 0

@patch("app.services.import_engine.engine.text")
async def test_batch_write_correct_sql_structure(mock_text, mock_db):
    """测试 UPSERT SQL 结构是否正确"""
    # Arrange
    batch = [{"id": 1, "name": "test"}, {"id": 2, "name": "test2"}]
    mapper = MagicMock()

    # Mock text to just return a mock object with execute method
    mock_text.return_value = MagicMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(rowcount=2))
    mock_db.commit = AsyncMock()

    # Act
    engine = ImportEngine(mock_db)
    result = await engine._write_batch(batch, "test_table", "id", mapper)

    # Assert
    assert result["inserted"] > 0 or result["updated"] > 0
    mock_db.execute.assert_called_once()
    mock_db.commit.assert_called_once()


class TestImportStats:
    """ImportStats 测试"""

    def test_success_rate_with_total_rows(self):
        """测试成功率的计算"""
        from app.services.import_engine.models import ImportStats as ModelImportStats
        stats = ModelImportStats(total_rows=100, valid_rows=80)
        assert stats.success_rate == 80.0

    def test_success_rate_with_no_rows(self):
        """测试没有总行数时的成功率"""
        from app.services.import_engine.models import ImportStats as ModelImportStats
        stats = ModelImportStats()
        assert stats.success_rate == 0.0

    def test_to_dict_method(self):
        """测试 to_dict 方法"""
        from app.services.import_engine.models import ImportStats as ModelImportStats
        stats = ModelImportStats(
            total_rows=100,
            valid_rows=80,
            invalid_rows=20,
            inserted=70,
            updated=10,
            skipped=0,
            errors=[{"field": "error1"}],
        )
        data = stats.to_dict()
        assert data["total_rows"] == 100
        assert data["valid_rows"] == 80
        assert data["inserted"] == 70
        assert data["updated"] == 10
        assert data["error_count"] == 1
        assert len(data["errors"]) == 1


class TestImportReport:
    """ImportReport 测试"""

    def test_to_dict_method(self):
        """测试 to_dict 方法"""
        from app.services.import_engine.models import ImportStats as ModelImportStats
        from app.services.import_engine.models import ImportStatus
        stats = ModelImportStats(total_rows=100, valid_rows=90, inserted=80, updated=10)
        report = ImportReport(
            task_id="test-task",
            stats=stats,
            status=ImportStatus.COMPLETED,
            duration_seconds=5.5,
            message="Import completed successfully"
        )
        data = report.to_dict()
        assert data["task_id"] == "test-task"
        assert data["status"] == "completed"
        assert data["stats"]["total_rows"] == 100
        assert data["duration_seconds"] == 5.5
        assert data["message"] == "Import completed successfully"
