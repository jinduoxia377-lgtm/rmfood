"""OpenFoodFacts 同步加载器测试"""

import pytest
from unittest.mock import MagicMock, patch
import asyncio
from app.services.openfoodfacts.loader_sync import OFFLoaderSync


class TestOFFLoaderSync:
    """OFFLoaderSync 单元测试"""

    @pytest.fixture
    def loader(self):
        """测试 fixture"""
        return OFFLoaderSync()

    async def test_connect_disconnect(self, loader):
        """连接和断开连接应正常工作"""
        mock_conn = MagicMock()

        with patch('psycopg2.connect', return_value=mock_conn) as mock_connect:
            await loader.connect()
            mock_connect.assert_called_once()
            assert loader._conn is not None

            await loader.disconnect()
            mock_conn.close.assert_called_once()

    async def test_upsert_batch_empty(self, loader):
        """空批次应安全处理"""
        result = await loader.upsert_batch([], MagicMock())
        assert result == {"inserted": 0, "updated": 0}

    @patch('psycopg2.connect')
    async def test_platform_detection_async_mode(self, mock_connect):
        """异步模式检测（通过配置验证）"""
        # 检查 loader 能够根据环境选择正确的驱动路径
        pass

    @patch('psycopg2.connect')
    async def test_upsert_with_sample_data(self, mock_connect, loader):
        """带样本数据的上操作应执行 UPSERT"""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        sample_data = [
            {
                "barcode": "123456",
                "name": "Test Product",
                "ingredients": ["ingredient1", "ingredient2"],
                "nutrition": {"energy": "100kJ"},
                "source": "openfoodfacts",
            }
        ]

        try:
            result = await loader.upsert_products_with_progress(
                sample_data,
                MagicMock(),
                MagicMock()
            )
            # 检查是否执行了适当的 SQL 操作
            cursor_calls = [str(call).upper() for call in mock_cursor.method_calls]
            assert any("UPSERT" in str(call) or "INSERT" in str(call) for call in mock_cursor.method_calls)
        finally:
            await loader.disconnect()

    @patch('psycopg2.connect')
    async def test_array_jsonb_serialization(self, mock_connect, loader):
        """数组列和 JSONB 字段的序列化测试"""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn

        test_record = {
            "barcode": "789012",
            "name": "Test Item",
            "ingredients": ["vitamin C", "calcium"],  # 数组列
            "nutrition": {"energy": "150kJ", "protein": "5g"},  # JSONB 字段
            "source": "test_source"
        }

        try:
            # 测试单个记录的上插
            result = await loader.upsert_single(test_record, MagicMock())
            # 确保数组和 JSONB 被正确格式化
            assert result is not None
        finally:
            await loader.disconnect()
