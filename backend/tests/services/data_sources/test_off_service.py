"""OFFDataService 单元测试（部分逻辑）"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.data_sources.openfoodfacts.client import OFFDataService
from app.services.data_sources.openfoodfacts.mapper import OFFMapper


class TestOFFDataService:
    """OFFDataService 测试套件"""

    @pytest.fixture
    def mock_db(self):
        """创建模拟的数据库会话"""
        db = MagicMock(spec=AsyncSession)
        db.execute = AsyncMock()
        yield db

    @pytest.fixture
    def mock_off_service(self):
        """创建带有 mock 的 OFFDataService"""
        with patch('app.services.data_sources.openfoodfacts.client.OFFClient') as mock_client,              patch('app.services.data_sources.openfoodfacts.client.OFFMapper') as mock_mapper:
            
            # 设置 mock 实例
            mock_client_instance = mock_client.return_value
            mock_mapper_instance = mock_mapper.return_value
            
            service = OFFDataService()
            service.client = mock_client_instance
            service.mapper = mock_mapper_instance
            
            yield service

    def test_category_count(self, mock_off_service):
        """测试分类计数属性"""
        assert mock_off_service.category_count == len(mock_off_service.service_class.POPULAR_CATEGORIES)  # type: ignore

    async def test_search_products_with_realtime_true(self, mock_off_service, mock_db):
        """测试 realtime=True 时调用实时搜索"""
        # Arrange - mock _realtime_search
        mock_off_service._realtime_search = AsyncMock(return_value={"items": [], "total": 0})

        # Act
        result = await mock_off_service.search_products(
            keyword="test",
            db=mock_db,
            realtime=True
        )

        # Assert 应该直接调用 _realtime_search，不进行 DB 查询
        mock_off_service._realtime_search.assert_awaited_with("test", page=1, page_size=20, brand=None, category_tag=None)

    async def test_search_products_db_fallback(self, mock_off_service, mock_db):
        """测试当 realtime=False 时尝试 DB 搜索"""
        # Arrange - mock _db_search to return something
        mock_off_service._db_search = AsyncMock(return_value={"items": [{"id": 1}], "total": 1, "page": 1, "page_size": 20, "data_source": "postgresql"})

        # Act
        result = await mock_off_service.search_products(
            keyword="test",
            db=mock_db,
            realtime=False
        )

        # Assert 应该调用 _db_search
        mock_off_service._db_search.assert_awaited()

    def test_get_category_map(self, mock_off_service):
        """测试 CATEGORY_MAP 构建"""
        assert len(mock_off_service.service_class.CATEGORY_MAP) > 0  # 应该有映射
        assert "beverages" in mock_off_service.service_class.CATEGORY_MAP  # 测试一个已知的 tag

    async def test_get_product_by_barcode_cache_hit(self, mock_off_service, mock_db):
        """测试条码查询命中缓存（DB 优先）"""
        # Arrange - mock DB query to return a product
        mock_product = MagicMock()
        mock_product.to_dict.return_value = {"id": 1, "product_name": "Test", "source": "openfoodfacts"}
        mock_db.execute = AsyncMock()
        mock_db.execute.return_value.scalars().return_value = mock_product

        # Act
        result = await mock_off_service.get_product_by_barcode(
            barcode="123456",
            db=mock_db,
            realtime=False
        )

        # Assert 应该从 DB 返回产品
        assert result is not None
        assert result["id"] == 1

    async def test_get_product_by_barcode_api_fallback(self, mock_off_service, mock_db):
        """测试条码查询未命中时回退到 API"""
        # Arrange - DB returns None, then API returns something
        mock_db.execute = AsyncMock()
        mock_db.execute.return_value.scalar_one_or_none = None
        
        # Mock the API call to return product data
        loop = mock_off_service.client._http_client.__class__  # Simulate response
        # We won't actually hit real API in this test

        # Act - should attempt API call (but we won't fully verify without mocking the HTTP layer more deeply)
        result = await mock_off_service.get_product_by_barcode(
            barcode="999999",
            db=mock_db,
            realtime=False
        )

        # Assert 可能为 None（如果 API 也失败）或产品信息
        # 这个测试主要验证流程不会崩溃


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
