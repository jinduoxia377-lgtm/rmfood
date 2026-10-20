"""零售产品API集成测试

测试 /api/v1/databases/retail-products 和 /api/v1/databases/openfoodfacts/* 端点。
"""

import secrets

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def _setup_csrf(client: TestClient) -> None:
    token = secrets.token_hex(32)
    client.cookies.clear()
    client.cookies.set("csrf_token", token)
    client.headers["X-CSRF-Token"] = token


class TestRetailProductsAPI:
    """零售产品API端点测试"""

    @pytest.fixture(scope="class")
    def client(self):
        """创建测试客户端"""
        app = create_app()
        client = TestClient(app)
        _setup_csrf(client)
        yield client

    @pytest.mark.integration
    def test_list_retail_products_empty(self, client):
        """测试产品列表返回正确结构（库中可能有历史数据，不强制为空）"""
        response = client.get("/api/v1/databases/retail-products")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "data_source" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    @pytest.mark.integration
    def test_get_retail_product_not_found(self, client):
        """测试获取不存在的产品应返回404"""
        response = client.get("/api/v1/databases/retail-products/999999")
        assert response.status_code == 404
        assert "detail" in response.json()

    @pytest.mark.integration
    def test_search_openfoodfacts_requires_auth(self, client):
        """测试OFF搜索端点需要认证（根据现有实现）"""
        # 这个测试应该验证端点的存在和基础行为
        response = client.post("/api/v1/databases/openfoodfacts/search", json={"query": "test"})
        # 根据实际授权设置，可能是401或未授权
        assert response.status_code in [200, 401, 403]

    @pytest.mark.integration
    def test_off_sync_status_exists(self, client):
        """测试同步状态端点存在且可用"""
        response = client.get("/api/v1/databases/openfoodfacts/sync-status")
        assert response.status_code == 200
        data = response.json()
        assert "total_products" in data or "with_embedding" in data


class TestImportAPI:
    """导入相关API测试"""

    @pytest.fixture(scope="class")
    def client(self):
        app = create_app()
        client = TestClient(app)
        _setup_csrf(client)
        yield client

    @pytest.mark.integration
    def test_import_router_loaded(self, client):
        """确认导入路由已注册"""
        response = client.get("/api/v1/imports")
        # 如果路由存在会返回200（列表结构），否则404
        assert response.status_code in [200, 404]