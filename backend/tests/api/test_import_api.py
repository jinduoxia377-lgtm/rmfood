"""导入 API 集成测试"""
import secrets

import pytest
from fastapi.testclient import TestClient
from app.main import create_app


@pytest.fixture()
def client():
    """创建测试客户端（带一致的 CSRF cookie/header）"""
    app = create_app()
    c = TestClient(app)
    token = secrets.token_hex(32)
    c.cookies.clear()
    c.cookies.set("csrf_token", token)
    c.headers["X-CSRF-Token"] = token
    return c


class TestImportAPI:
    """导入端点集成测试"""

    def test_upload_file_endpoint_exists(self, client):
        """测试上传文件端点存在"""
        # POST 到 /api/v1/imports/upload
        response = client.post(
            "/api/v1/imports/upload",
            files={"file": ("test.csv", "content")},
            data={"file_type": "csv", "delimiter": ","}
        )
        # 返回 200 或 401（如果鉴权要求认证）
        assert response.status_code in [200, 401, 403]
        if response.status_code == 200:
            data = response.json()
            assert "task_id" in data

    def test_preview_endpoint_requires_uploaded_task(self, client):
        """测试预览端点需要有效的 task_id"""
        # 先尝试无效的 task_id
        response = client.post("/api/v1/imports/invalid-task-id/preview")
        assert response.status_code in [404, 400]

    def test_list_imports_returns_structure(self, client):
        """测试列出导入任务返回正确结构"""
        response = client.get("/api/v1/imports")
        assert response.status_code in [200, 401]
        if response.status_code == 200:
            data = response.json()
            assert "tasks" in data
            assert "total" in data


class TestRetailProductAPI:
    """零售产品 API 测试"""

    def test_list_products_returns_structure(self, client):
        """测试返回列表产品结构"""
        response = client.get("/api/v1/databases/retail-products")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "data_source" in data

    def test_search_product_requires_query(self, client):
        """测试搜索参数校验"""
        response = client.get("/api/v1/databases/retail-products/search")
        assert response.status_code in [400, 422]  # 缺少 query 参数


if __name__ == "__main__":
    pytest.main([__file__, "-v"])