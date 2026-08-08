"""OpenFoodFacts 配置类单元测试"""

from app.services.data_sources.openfoodfacts.config import OFFConfig


class TestOFFConfig:
    """OFFConfig配置测试"""

    def test_default_values(self):
        """测试默认配置值"""
        config = OFFConfig()
        assert config.BASE_URL == "https://world.openfoodfacts.org"
        assert config.DEFAULT_PAGE_SIZE == 20
        assert config.MAX_PAGE_SIZE == 100
        assert config.HTTP_TIMEOUT == 30.0
        assert len(config.MIRROR_URLS) >= 2
        assert config.USER_AGENT == "RMFOOD-DataPipeline/1.0"

    def test_api_endpoints(self):
        """测试API端点格式"""
        config = OFFConfig()
        # 检查端点是否包含正确的路径
        assert "/cgi/search.pl" in config.SEARCH_ENDPOINT
        assert "{code}" in config.PRODUCT_ENDPOINT
        assert "{code}" in config.BARCODES_ENDPOINT

    def test_frozen_dataclass(self):
        """测试dataclass是不可变的"""
        config = OFFConfig()
        with pytest.raises(Exception):
            config.BASE_URL = "http://example.com"
