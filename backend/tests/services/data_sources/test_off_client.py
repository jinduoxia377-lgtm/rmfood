"""OFFClient 单元测试（使用 mock）"""
import pytest
from unittest.mock import MagicMock, patch
from app.services.data_sources.off_api import OFFClient


class TestOFFClient:
    """OFFClient 测试套件"""

    def test_initialization(self):
        """测试客户端初始化"""
        client = OFFClient()
        assert client._http_client is not None
        # httpx.Client 应该有 timeout 和 headers 属性
        assert hasattr(client._http_client, 'timeout')

    @patch.object(OFFClient, '_http_client')
    def test_search_by_keyword_success(self, mock_http, caplog):
        """测试关键词搜索成功响应"""
        # Arrange
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "count": 10,
            "products": [{"code": "123", "product_name": "Test"}]
        }
        mock_http.get.return_value = mock_response

        client = OFFClient()

        # Act
        result = client.search_by_keyword("test product")

        # Assert
        assert result["count"] == 10
        assert len(result["products"]) == 1
        assert result["products"][0]["code"] == "123"
        mock_http.get.assert_called_once()
        call_args = mock_http.get.call_args[0][0]
        assert "search_terms_s=test product" in call_args

    @patch.object(OFFClient, '_http_client')
    def test_search_by_keyword_with_filters(self, mock_http):
        """测试带过滤器的关键词搜索"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"count": 0, "products": []}
        mock_http.get.return_value = mock_response

        client = OFFClient()
        client.search_by_keyword(
            "test",
            brand="BrandX",
            category_tag="en:snacks"
        )

        # Assert品牌和分类参数被包含在请求中
        call_url = mock_http.get.call_args[0][0]
        assert "brands=BrandX" in call_url
        assert "categories_tags_contains=en:snacks" in call_url

    @patch.object(OFFClient, '_http_client')
    def test_search_by_barcode_found(self, mock_http):
        """测试条码查询找到产品"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"product": {"code": "12345", "product_name": "Test"}}
        mock_http.get.return_value = mock_response

        client = OFFClient()
        result = client.search_by_barcode("12345")

        assert result is not None
        assert result["product"]["code"] == "12345"

    @patch.object(OFFClient, '_http_client')
    def test_search_by_barcode_not_found(self, mock_http):
        """测试条码查询未找到产品（返回 404）"""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_http.get.return_value = mock_response

        client = OFFClient()
        result = client.search_by_barcode("99999")

        assert result is None

    @patch.object(OFFClient, '_http_client')
    def test_search_by_category(self, mock_http):
        """测试分类搜索"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"count": 5, "products": []}
        mock_http.get.return_value = mock_response

        client = OFFClient()
        result = client.search_by_category("en:snacks")

        assert result["count"] == 5
        call_url = mock_http.get.call_args[0][0]
        assert "categories_tags_contains=en:snacks" in call_url

    @patch.object(OFFClient, '_http_client')
    def test_search_by_keyword_on_error(self, mock_http):
        """测试关键词搜索时发生错误应返回空结果而非崩溃"""
        mock_http.get.side_effect = Exception("Network error")

        client = OFFClient()
        result = client.search_by_keyword("test")

        # 应该返回空结果而不是抛出异常
        assert result["count"] == 0
        assert result["products"] == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
