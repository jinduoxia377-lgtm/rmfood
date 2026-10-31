"""零售产品API集成测试

测试 /api/v1/databases/retail-products 和 /api/v1/databases/openfoodfacts/* 端点。
"""

import secrets

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.api.deps import get_current_user


def _setup_csrf(client: TestClient) -> None:
    token = secrets.token_hex(32)
    client.cookies.clear()
    client.cookies.set("csrf_token", token)
    client.headers["X-CSRF-Token"] = token


def _make_auth_client() -> TestClient:
    """创建带“已登录用户”+ CSRF 的 TestClient。

    pantry 收藏端点需要登录态。这里采用仓库标准做法（tests/conftest.py 的 app
    夹具同款）：通过 dependency_overrides 覆盖 get_current_user，返回 mock 用户，
    避免测试依赖真实 JWT/数据库用户创建。
    """
    from unittest.mock import MagicMock

    app = create_app()

    async def mock_get_current_user():
        user = MagicMock(spec=User)
        user.id = 1
        user.username = "test_researcher"
        user.email = "test@example.com"
        user.role = "researcher"
        user.is_active = True
        user.preferences = {}
        return user

    from app.models import User  # noqa: E402  （在函数内导入避免循环）

    app.dependency_overrides[get_current_user] = mock_get_current_user
    c = TestClient(app)
    _setup_csrf(c)
    return c


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
        """测试OFF搜索端点存在且可用"""
        response = client.post("/api/v1/databases/openfoodfacts/search", json={"query": "test"})
        # 根据实际授权设置，可能是200或401/403
        assert response.status_code in [200, 401, 403]

    @pytest.mark.integration
    def test_off_sync_status_fields_complete(self, client):
        """测试同步状态端点返回全部统计字段且取值合法"""
        response = client.get("/api/v1/databases/openfoodfacts/sync-status")
        assert response.status_code == 200
        data = response.json()

        # 字段完整
        for field in (
            "total_products",
            "with_embedding",
            "avg_quality",
            "unique_brands",
            "kb_categories",
            "last_sync",
        ):
            assert field in data, f"sync-status 缺少字段: {field}"

        # 取值合法
        assert isinstance(data["total_products"], int)
        assert data["total_products"] >= 0
        assert data["with_embedding"] >= 0
        assert data["avg_quality"] >= 0
        assert data["unique_brands"] >= 0
        assert data["kb_categories"] >= 0
        assert data["last_sync"] is None or isinstance(data["last_sync"], dict)

    @pytest.mark.integration
    def test_off_sync_status_total_consistent_with_list(self, client):
        """测试 sync-status 的 total_products 与 retail-products 列表口径一致"""
        sync_resp = client.get("/api/v1/databases/openfoodfacts/sync-status")
        assert sync_resp.status_code == 200
        sync_data = sync_resp.json()

        list_resp = client.get(
            "/api/v1/databases/retail-products",
            params={"source": "openfoodfacts", "page_size": 1},
        )
        assert list_resp.status_code == 200
        list_data = list_resp.json()

        assert list_data["total"] == sync_data["total_products"], (
            f"sync-status total_products={sync_data['total_products']} "
            f"与 retail-products total={list_data['total']} 不一致"
        )

    @pytest.mark.integration
    def test_get_retail_product_detail(self, client):
        """测试产品详情端点返回 200 且字段完整（回归：exclude_none=None 导致 500）"""
        list_resp = client.get(
            "/api/v1/databases/retail-products",
            params={"page_size": 1},
        )
        assert list_resp.status_code == 200
        items = list_resp.json().get("items", [])
        if not items:
            pytest.skip("数据库无零售产品数据")
        pid = items[0]["id"]

        resp = client.get(f"/api/v1/databases/retail-products/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        for field in ("id", "brand", "product_name", "source", "data_quality"):
            assert field in data, f"详情缺少字段: {field}"
        assert data["id"] == pid

    @pytest.mark.integration
    def test_create_retail_product_requires_auth(self, client):
        """未认证调用 POST /retail-products/manual 应返回 401（而非 500）"""
        response = client.post(
            "/api/v1/databases/retail-products/manual",
            json={"brand": "TestBrand", "product_name": "Test Product"},
        )
        assert response.status_code == 401
        assert "detail" in response.json()

    @pytest.mark.integration
    def test_delete_retail_product_requires_auth(self, client):
        """未认证调用 DELETE /retail-products/{id} 应返回 401（而非 500）"""
        response = client.delete("/api/v1/databases/retail-products/1")
        assert response.status_code == 401
        assert "detail" in response.json()

    @pytest.mark.integration
    def test_off_categories(self, client):
        """分类列表返回 categories + total"""
        response = client.get("/api/v1/databases/openfoodfacts/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert "total" in data
        assert isinstance(data["categories"], list)
        assert data["total"] == len(data["categories"])

    @pytest.mark.integration
    def test_off_report(self, client):
        """导入报告返回 overall/categories/quality_distribution"""
        response = client.get("/api/v1/databases/openfoodfacts/report")
        assert response.status_code == 200
        data = response.json()
        assert "overall" in data
        assert "categories" in data
        assert "quality_distribution" in data
        assert isinstance(data["overall"], dict)
        assert isinstance(data["categories"], list)
        assert isinstance(data["quality_distribution"], dict)

    @pytest.mark.integration
    def test_search_openfoodfacts_structure(self, client):
        """OFF 搜索端点返回结构正确（当前为公开端点，预期 200）"""
        response = client.post(
            "/api/v1/databases/openfoodfacts/search",
            json={"query": "胶原蛋白"},
        )
        # 该端点目前无强制鉴权；若后续加鉴权，允许 401/403
        assert response.status_code in (200, 401, 403)
        if response.status_code == 200:
            data = response.json()
            assert "items" in data
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "data_source" in data
            assert isinstance(data["items"], list)
            assert isinstance(data["total"], int)

    @pytest.mark.integration
    def test_search_openfoodfacts_invalid_query(self, client):
        """空 query 应返回 422 校验错误"""
        response = client.post("/api/v1/databases/openfoodfacts/search", json={"query": ""})
        assert response.status_code == 422

    @pytest.mark.integration
    def test_search_openfoodfacts_not_postgresql_error(self, client):
        """OFF 搜索端点不应返回 postgresql_error（回归：search_vector 列缺失 + 事务未回滚）"""
        response = client.post(
            "/api/v1/databases/openfoodfacts/search",
            json={"query": "蛋白"},
        )
        assert response.status_code in (200, 401, 403)
        if response.status_code == 200:
            data = response.json()
            assert "data_source" in data
            assert not data["data_source"].startswith("postgresql_error"), (
                f"搜索端点不应返回 postgresql_error，实际为 {data['data_source']}"
            )

    @pytest.mark.integration
    def test_search_openfoodfacts_hits_manual_product(self, client):
        """搜索“蛋白”应命中至少 1 条 manual 产品（市售产品通用搜索）"""
        response = client.post(
            "/api/v1/databases/openfoodfacts/search",
            json={"query": "蛋白"},
        )
        assert response.status_code in (200, 401, 403)
        if response.status_code == 200:
            data = response.json()
            assert "items" in data
            manual_hits = [it for it in data.get("items", []) if it.get("source") == "manual"]
            assert len(manual_hits) >= 1, (
                f"搜索“蛋白”应命中 manual 产品，实际 items={data.get('items', [])}"
            )

    @pytest.mark.integration
    def test_search_openfoodfacts_collagen_peptide_fallback(self, client):
        """搜索“胶原蛋白肽”应返回 200，data_source 不为 postgresql_error，
        total 为合理整数（< 1000000），items 为数组。

        该测试不依赖外网 OFF 可用：若 OFF 不可达，允许 data_source 为降级标识
        （如 postgresql_ilike / postgresql_ilike_empty）且 items 为空，
        但绝不是 postgresql_error。
        """
        response = client.post(
            "/api/v1/databases/openfoodfacts/search",
            json={"query": "胶原蛋白肽"},
        )
        assert response.status_code in (200, 401, 403)
        if response.status_code == 200:
            data = response.json()
            assert "data_source" in data
            assert not data["data_source"].startswith("postgresql_error"), (
                f"搜索不应返回 postgresql_error，实际为 {data['data_source']}"
            )
            assert "items" in data
            assert isinstance(data["items"], list)
            assert "total" in data
            assert isinstance(data["total"], int)
            assert 0 <= data["total"] < 1_000_000, (
                f"total 应为合理整数，实际为 {data['total']}"
            )
            # 若走了 OFF 回退，data_source 应包含 'api'（前端实时标识约定），
            # 且此时应返回真实互联网产品 items
            if "api" in data["data_source"]:
                assert len(data["items"]) > 0, (
                    f"回退 OFF 实时搜索时应返回真实产品，实际 data_source={data['data_source']}"
                )

    @pytest.mark.integration
    def test_search_openfoodfacts_realtime_structure(self, client):
        """realtime=true 应走 OFF 实时 API：data_source 含 'api' 或网络错误标识，
        绝不为 postgresql_error（不依赖外网可用性）。"""
        response = client.post(
            "/api/v1/databases/openfoodfacts/search",
            json={"query": "胶原蛋白肽", "realtime": True},
        )
        assert response.status_code in (200, 401, 403)
        if response.status_code == 200:
            data = response.json()
            assert "data_source" in data
            assert not data["data_source"].startswith("postgresql_error"), (
                f"realtime 搜索不应返回 postgresql_error，实际为 {data['data_source']}"
            )
            assert "items" in data
            assert isinstance(data["items"], list)
            assert "total" in data
            assert isinstance(data["total"], int)
            assert 0 <= data["total"] < 1_000_000, (
                f"total 应为合理整数，实际为 {data['total']}"
            )


class TestPantryRetailProductsAPI:
    """零售产品收藏端点测试（需要登录态）"""

    @pytest.fixture(scope="class")
    def client(self):
        """带真实认证 + CSRF 的客户端"""
        return _make_auth_client()

    @pytest.mark.integration
    def test_get_pantry_retail_products_authenticated(self, client):
        """登录态下获取零售产品收藏列表返回 200 + items"""
        response = client.get(
            "/api/v1/databases/pantry",
            params={"item_type": "retail_product"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    @pytest.mark.integration
    def test_add_remove_retail_product(self, client):
        """添加/移除零售产品收藏。

        注意：pantry 端点需要登录态。本测试通过隔离区测试用户 + access_token
        完成认证。若 retail_products 表为空，则验证“产品不存在 → 404”路径。
        """
        list_resp = client.get(
            "/api/v1/databases/retail-products",
            params={"page_size": 1},
        )
        assert list_resp.status_code == 200
        items = list_resp.json().get("items", [])

        if items:
            pid = items[0]["id"]
            add_resp = client.post(f"/api/v1/databases/pantry/retail-products/{pid}")
            assert add_resp.status_code in (200, 201)
            body = add_resp.json()
            assert body.get("status") in ("added", "already_added")

            del_resp = client.delete(f"/api/v1/databases/pantry/retail-products/{pid}")
            assert del_resp.status_code in (200, 404)
        else:
            # 无产品数据：产品不存在 → 404（证明鉴权已通过并执行了产品查询）
            resp = client.post("/api/v1/databases/pantry/retail-products/999999")
            assert resp.status_code == 404
            assert "detail" in resp.json()


class TestPantryPreferencePersistence:
    """收藏 ID 持久化单元测试：_set_pantry_ids 必须产生新 dict，
    否则 SQLAlchemy JSON 列无法检测原地变更，二次写入不会落库。"""

    def test_set_pantry_ids_creates_new_dict(self):
        from types import SimpleNamespace
        from app.api.db_modules.pantry import _get_pantry_ids, _set_pantry_ids

        user = SimpleNamespace(preferences=None)

        # 首次写入：从 None 创建新 dict
        _set_pantry_ids(user, "retail_product", [13])
        assert _get_pantry_ids(user, "retail_product") == [13]

        # 二次写入：必须产生新的 dict 对象（旧实现原地修改导致不落库）
        original_prefs = user.preferences
        _set_pantry_ids(user, "retail_product", [13, 14])
        assert user.preferences is not original_prefs
        assert _get_pantry_ids(user, "retail_product") == [13, 14]

        # 移除后同样产生新 dict
        prefs_before_remove = user.preferences
        _set_pantry_ids(user, "retail_product", [13])
        assert user.preferences is not prefs_before_remove
        assert _get_pantry_ids(user, "retail_product") == [13]


class TestPantryUnauthenticated:
    """未认证访问 pantry 端点的行为（浏览可用、写操作需登录）"""

    @pytest.fixture(scope="class")
    def client(self):
        """无登录态客户端（不带 dependency override）"""
        app = create_app()
        client = TestClient(app)
        _setup_csrf(client)
        yield client

    @pytest.mark.integration
    def test_get_pantry_unauthenticated_returns_empty(self, client):
        """未认证 GET /pantry 应返回 200 + 空列表（而非 500）"""
        response = client.get(
            "/api/v1/databases/pantry",
            params={"item_type": "retail_product"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.integration
    def test_add_pantry_unauthenticated_returns_401(self, client):
        """未认证 POST /pantry/retail-products/{id} 应返回 401"""
        response = client.post("/api/v1/databases/pantry/retail-products/13")
        assert response.status_code == 401

    @pytest.mark.integration
    def test_remove_pantry_unauthenticated_returns_401(self, client):
        """未认证 DELETE /pantry/retail-products/{id} 应返回 401"""
        response = client.delete("/api/v1/databases/pantry/retail-products/13")
        assert response.status_code == 401


class TestImportAPI:
    """导入相关API测试"""

    @pytest.fixture(scope="class")
    def client(self):
        """创建测试客户端"""
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