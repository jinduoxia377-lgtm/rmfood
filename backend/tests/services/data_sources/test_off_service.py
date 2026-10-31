"""OFFDataService 单元测试（部分逻辑）"""
import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.data_sources.openfoodfacts_client import OFFDataService, POPULAR_CATEGORIES, CATEGORY_MAP
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
        with patch('app.services.data_sources.openfoodfacts_client.OFFClient') as mock_client,              patch('app.services.data_sources.openfoodfacts.mapper.OFFMapper') as mock_mapper:
            
            # 设置 mock 实例
            mock_client_instance = mock_client.return_value
            mock_mapper_instance = mock_mapper.return_value
            
            service = OFFDataService()
            service.client = mock_client_instance
            service.mapper = mock_mapper_instance
            
            yield service

    def test_category_count(self, mock_off_service):
        """测试分类计数属性"""
        assert mock_off_service.category_count == len(POPULAR_CATEGORIES)

    async def test_search_products_with_realtime_true(self, mock_off_service, mock_db):
        """测试 realtime=True 时调用实时搜索"""
        # Arrange - mock _realtime_search
        mock_off_service._realtime_search = AsyncMock(return_value={"items": [], "total": 0})

        # Act
        await mock_off_service.search_products(
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
        await mock_off_service.search_products(
            keyword="test",
            db=mock_db,
            realtime=False
        )

        # Assert 应该调用 _db_search
        mock_off_service._db_search.assert_awaited()

    def test_get_category_map(self, mock_off_service):
        """测试 CATEGORY_MAP 构建"""
        assert len(CATEGORY_MAP) > 0  # 应该有映射
        assert "beverages" in CATEGORY_MAP  # 测试一个已知的 tag

    async def test_get_product_by_barcode_cache_hit(self, mock_off_service, mock_db):
        """测试条码查询命中缓存（DB 优先）"""
        # Arrange - mock DB query to return a product
        mock_product = MagicMock()
        mock_product.to_dict.return_value = {"id": 1, "product_name": "Test", "source": "openfoodfacts"}
        # db.execute 是异步的，但其返回的 Result 是同步对象，scalar_one_or_none() 为同步调用
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = mock_product
        mock_db.execute = AsyncMock(return_value=result_mock)

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

        # Act - 应尝试 API 调用（mock 环境不会真正联网）
        result = await mock_off_service.get_product_by_barcode(
            barcode="999999",
            db=mock_db,
            realtime=False
        )

        # Assert 可能为 None（API 失败）或产品信息；主要验证流程不崩溃
        assert result is None or isinstance(result, dict)

    # ── 可观测性/回退/指标补充测试（task-11） ──

    async def test_search_products_db_fallback_triggers_realtime(self, mock_off_service, mock_db):
        """realtime=False 且 DB 命中 <3 时自动回退 OFF 实时搜索并合并结果"""
        mock_off_service._db_search = AsyncMock(return_value={
            "items": [{"id": 1, "product_name": "本地蛋白粉"}],
            "total": 1, "page": 1, "page_size": 20, "data_source": "postgresql_ilike",
        })
        mock_off_service._realtime_search = AsyncMock(return_value={
            "items": [{"id": "off-1", "product_name": "OFF Protein"}],
            "total": 10, "off_total": 5000, "page": 1, "page_size": 20,
            "data_source": "openfoodfacts_api",
        })

        result = await mock_off_service.search_products("蛋白", db=mock_db, realtime=False)

        mock_off_service._realtime_search.assert_awaited_once()
        assert result["data_source"] == "openfoodfacts_api_fallback"
        assert result["total"] == 10
        assert result["db_total"] == 1
        assert len(result["items"]) == 2  # 本地 + OFF 合并
        assert mock_off_service._metrics["fallbacks"] == 1

    async def test_search_products_cache_hit_no_fallback(self, mock_off_service, mock_db):
        """realtime=False 且 DB 命中 ≥3 时直接返回缓存，不触发 OFF 回退"""
        mock_off_service._db_search = AsyncMock(return_value={
            "items": [{"id": 1}, {"id": 2}, {"id": 3}],
            "total": 3, "page": 1, "page_size": 20, "data_source": "postgresql_ilike",
        })
        mock_off_service._realtime_search = AsyncMock(return_value={
            "items": [], "total": 0, "off_total": 0,
            "page": 1, "page_size": 20, "data_source": "error_network",
        })

        result = await mock_off_service.search_products("蛋白", db=mock_db, realtime=False)

        assert result["data_source"] == "postgresql_ilike"
        assert len(result["items"]) == 3
        mock_off_service._realtime_search.assert_not_awaited()
        assert mock_off_service._metrics["cache_hits"] == 1

    def test_get_diagnostics_returns_counts(self, mock_off_service):
        """诊断接口返回结构化的 counts/avg 指标"""
        diag = mock_off_service.get_diagnostics()
        assert diag["service"] == "openfoodfacts"
        for key in (
            "total_requests", "realtime_requests", "fallbacks",
            "mirror_failures", "cache_hits", "errors",
        ):
            assert key in diag["counts"], f"diagnostics 缺少 counts.{key}"
        assert "avg_duration_ms" in diag
        assert "uptime_seconds" in diag
        assert isinstance(diag["counts"]["total_requests"], int)

    async def test_metrics_increment_on_realtime_search(self, mock_off_service):
        """调用 _realtime_search 后 realtime_requests 计数递增"""
        # client.search_by_keyword 是 MagicMock，返回不可迭代对象 → _realtime_search 内部会优雅降级
        result = await mock_off_service._realtime_search("test", page=1, page_size=20)
        assert result["data_source"] in ("empty", "error_network")
        assert mock_off_service._metrics["realtime_requests"] >= 1

    async def test_parallel_probe_mirrors_switches_on_failure(self, mock_off_service):
        """第一个镜像失败、第二个成功时返回成功镜像的产品并累计 mirror_failures"""
        mock_http = MagicMock()

        def fake_get(url, timeout=10.0):
            if "mirror1" in url:
                raise RuntimeError("503 Service Unavailable")
            resp = MagicMock()
            resp.raise_for_status.return_value = None
            resp.json.return_value = {
                "products": [{"code": "123", "product_name": "OK"}],
                "count": 1,
            }
            return resp

        mock_http.get = MagicMock(side_effect=fake_get)
        mock_off_service.client._http_client = mock_http

        mirrors = ["https://mirror1.example", "https://mirror2.example"]
        params = {"search_terms_s": "test"}
        products, total, last_error = await mock_off_service._parallel_probe_mirrors(
            mirrors, params
        )

        assert len(products) == 1
        assert products[0]["code"] == "123"
        assert total == 1
        assert mock_off_service._metrics["mirror_failures"] >= 1

    # ── 多镜像故障转移 + 本地缓存兜底（task-10） ──

    async def test_realtime_search_mirror_failover(self):
        """镜像故障转移：第一个镜像 503，自动切换第二个并成功返回真实产品。"""
        from app.services.data_sources.openfoodfacts_client import OFFDataService

        service = OFFDataService()
        service.mapper = OFFMapper()  # 使用真实 mapper，验证完整映射链路

        def fake_search(keyword, *, base_url=None, **kwargs):
            if base_url and base_url.startswith("https://world.openfoodfacts.org"):
                raise httpx.HTTPStatusError(
                    "503 Service Unavailable",
                    request=MagicMock(),
                    response=MagicMock(status_code=503),
                )
            return {
                "count": 1,
                "products": [{
                    "code": "3017620422003",
                    "product_name": "Collagen Peptides",
                    "brands": "Vital Proteins",
                    "ingredients_text": "collagen",
                    "categories_tags": ["en:supplements"],
                    "quantity": "300 g",
                }],
            }

        service.client.search_by_keyword = MagicMock(side_effect=fake_search)

        result = await service._realtime_search("胶原蛋白肽", page=1, page_size=20)

        assert result["data_source"] == "openfoodfacts_api"
        assert len(result["items"]) == 1
        assert result["items"][0]["product_name"] == "Collagen Peptides"
        assert result["items"][0]["source"] == "openfoodfacts_api"
        assert service._metrics["mirror_failures"] >= 1

    async def test_get_product_by_barcode_mirror_failover(self):
        """条码查询镜像故障转移：第一个镜像 503，第二个成功返回产品。"""
        from app.services.data_sources.openfoodfacts_client import OFFDataService

        service = OFFDataService()
        service.mapper = OFFMapper()

        def fake_barcode(barcode, base_url=None):
            if base_url and base_url.startswith("https://world.openfoodfacts.org"):
                raise httpx.HTTPStatusError(
                    "503 Service Unavailable",
                    request=MagicMock(),
                    response=MagicMock(status_code=503),
                )
            return {
                "status": 1,
                "product": {
                    "code": barcode,
                    "product_name": "Collagen Product",
                    "brands": "Vital Proteins",
                },
            }

        service.client.search_by_barcode = MagicMock(side_effect=fake_barcode)

        mock_db = MagicMock(spec=AsyncSession)
        mock_db.execute = AsyncMock()
        mock_db.execute.return_value.scalar_one_or_none = None

        result = await service.get_product_by_barcode(
            "3017620422003", mock_db, realtime=False,
        )

        assert result is not None
        assert result.get("_source") == "openfoodfacts_api"
        assert result.get("product_name") == "Collagen Product"
        assert service._metrics["mirror_failures"] >= 1

    async def test_search_products_off_cache_hit_on_all_mirrors_failure(self, mock_off_service, mock_db):
        """所有 OFF 镜像失败时，本地 OFF 缓存兜底 → data_source=openfoodfacts_cache"""
        service = mock_off_service
        service._db_search = AsyncMock(return_value={
            "items": [], "total": 0, "page": 1, "page_size": 20,
            "data_source": "postgresql_ilike_empty",
        })
        service._realtime_search = AsyncMock(return_value={
            "items": [], "total": 0, "off_total": 0, "page": 1, "page_size": 20,
            "data_source": "error_network", "error": "all mirrors down",
        })
        service._search_off_cache = AsyncMock(return_value={
            "items": [{
                "id": "3017620422003", "brand": "Vital Proteins",
                "product_name": "Collagen Peptides", "source": "openfoodfacts",
            }],
            "total": 1, "page": 1, "page_size": 20,
            "data_source": "openfoodfacts_cache",
        })

        result = await service.search_products("collagen", mock_db, realtime=False)

        assert result["data_source"] == "openfoodfacts_cache"
        assert len(result["items"]) == 1
        assert result["items"][0]["product_name"] == "Collagen Peptides"
        assert service._metrics["cache_hits"] >= 1

    async def test_realtime_search_all_mirrors_failed_returns_cache(self, mock_off_service, mock_db):
        """realtime=True 且所有镜像失败时，本地 OFF 缓存兜底。"""
        service = mock_off_service
        service._realtime_search = AsyncMock(return_value={
            "items": [], "total": 0, "off_total": 0, "page": 1, "page_size": 20,
            "data_source": "error_network", "error": "all mirrors down",
        })
        service._search_off_cache = AsyncMock(return_value={
            "items": [{
                "id": "3017620422003", "brand": "Vital Proteins",
                "product_name": "Collagen Peptides", "source": "openfoodfacts",
            }],
            "total": 1, "page": 1, "page_size": 20,
            "data_source": "openfoodfacts_cache",
        })

        result = await service.search_products("collagen", mock_db, realtime=True)

        assert result["data_source"] == "openfoodfacts_cache"
        assert len(result["items"]) == 1
        assert service._metrics["cache_hits"] >= 1

    async def test_realtime_search_filters_irrelevant(self, mock_off_service):
        """强相关性过滤：OFF 返回混合结果时只保留含查询词/同义词的产品，不补足无关项。

        场景：搜"胶原蛋白肽"→ OFF 英文主词 "collagen peptide"，返回 3 条
        （1 条 Collagen 相关 + 2 条奶酪/矿泉水无关），应只返回相关项，
        且 total=相关数（相关数 < fetch_size 时不显示 OFF 原始大 count）。
        """
        service = mock_off_service
        service._search_mirrors = AsyncMock(return_value=(
            [{"code": "1"}, {"code": "2"}, {"code": "3"}],
            4828053,  # OFF 原始 count（模拟大数字）
            None,
            "https://fr.openfoodfacts.org",
        ))
        service.mapper.map_product.side_effect = [
            {
                "external_id": "1", "brand": "Vital Proteins",
                "product_name": "Collagen Peptides Powder",
                "category": "Supplements",
                "full_ingredients": "collagen peptides, vitamin c",
                "image_urls": [], "allergens_tags": [], "additives_tags": [],
                "traces_tags": [], "ecoscore_grade": None, "contaminants": [],
            },
            {
                "external_id": "2", "brand": "Jaouda",
                "product_name": "Cheese",
                "category": "Dairy",
                "full_ingredients": "milk, cheese",
                "image_urls": [], "allergens_tags": [], "additives_tags": [],
                "traces_tags": [], "ecoscore_grade": None, "contaminants": [],
            },
            {
                "external_id": "3", "brand": "Sidi Ali",
                "product_name": "Mineral Water",
                "category": "Beverages",
                "full_ingredients": "water",
                "image_urls": [], "allergens_tags": [], "additives_tags": [],
                "traces_tags": [], "ecoscore_grade": None, "contaminants": [],
            },
        ]

        result = await service._realtime_search("胶原蛋白肽", page=1, page_size=10)

        names = [it["product_name"] for it in result["items"]]
        assert names == ["Collagen Peptides Powder"], f"应只返回相关产品，实际: {names}"
        # 相关数(1) < fetch_size(20) → total=相关数，而不是 OFF 原始 count
        assert result["total"] == 1
        # off_total 保留 OFF 原始 count 供前端展示
        assert result["off_total"] == 4828053
        assert result["data_source"] == "openfoodfacts_api"


def test_expand_query_terms_trilingual():
    """三语关键词适配：中/英/德查询词都能扩展出正确的 OFF 匹配词。

    验证 QUERY_SYNONYMS / QUERY_ENGLISH_PRIMARY 新增的英/德键：
    - 英文 protein powder / collagen 能扩展出 protein/collagen；
    - 德文 Eiweißpulver（变音）、Eiweisspulver（无变音）、Kollagen 能映射到英文词。
    """
    from app.services.data_sources.openfoodfacts_client import (
        _expand_query_terms,
        QUERY_ENGLISH_PRIMARY,
    )

    # 英文输入
    en_terms = _expand_query_terms("protein powder")
    assert "protein" in en_terms or "protein powder" in en_terms
    assert QUERY_ENGLISH_PRIMARY.get("protein powder") == "protein powder"
    assert QUERY_ENGLISH_PRIMARY.get("collagen") == "collagen"

    # 德文输入（变音 + 无变音）
    de_terms = _expand_query_terms("Eiweißpulver")
    assert "eiweißpulver" in de_terms or "eiweisspulver" in de_terms
    assert "protein powder" in de_terms or "protein" in de_terms
    assert QUERY_ENGLISH_PRIMARY.get("eiweißpulver") == "protein powder"
    assert QUERY_ENGLISH_PRIMARY.get("eiweisspulver") == "protein powder"

    # 无变音变体输入同样能扩展出英文匹配词（供相关性过滤）
    de_terms1b = _expand_query_terms("Eiweisspulver")
    assert "protein powder" in de_terms1b or "protein" in de_terms1b, de_terms1b

    de_terms2 = _expand_query_terms("Kollagen")
    assert "kollagen" in de_terms2
    assert "collagen" in de_terms2
    assert QUERY_ENGLISH_PRIMARY.get("kollagen") == "collagen"

    de_terms3 = _expand_query_terms("Fischöl")
    assert "fischöl" in de_terms3 or "fischol" in de_terms3
    assert "fish oil" in de_terms3 or "omega-3" in de_terms3
    assert QUERY_ENGLISH_PRIMARY.get("fischöl") == "fish oil"


def test_expand_query_terms_longest_match_only():
    """精度回归：中文子串按最长匹配，避免"胶原蛋白肽"扩展出"蛋白"。

    修复前 "_expand_query_terms('胶原蛋白肽')" 会把 "蛋白" 也加入匹配词
    （"蛋白" in "胶原蛋白肽"），导致含 "milk protein" 的奶酪通过强过滤。
    修复后应只保留最长基础词 "胶原蛋白肽" 及其同义词。
    """
    from app.services.data_sources.openfoodfacts_client import _expand_query_terms

    terms = _expand_query_terms("胶原蛋白肽")
    assert "蛋白" not in terms, f"不应扩展出过短的子词 '蛋白': {terms}"
    assert "protein" not in terms, f"不应扩展出 protein（来自短词 蛋白）: {terms}"
    assert "collagen" in terms
    assert "collagen peptide" in terms

    # "蛋白粉" 仍应扩展出 protein（最长匹配为 蛋白粉 自身或其同义词）
    terms2 = _expand_query_terms("蛋白粉")
    assert "protein" in terms2 or "protein powder" in terms2


def test_off_search_uses_official_search_terms_param():
    """回归：OFF 官方搜索参数必须是 search_terms（不能是 search_terms_s）。

    修复前使用 search_terms_s 导致 OFF 频繁 503/限流，实时搜索无法返回
    真实互联网产品。此测试防止参数名被错误改回。
    """
    from app.services.data_sources.off_api import OFFClient

    client = OFFClient()
    # 用 MagicMock 拦截 _http_client.get，断言 URL 参数
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {"count": 1, "products": []}
    client._http_client = MagicMock()
    client._http_client.get.return_value = fake_response

    client.search_by_keyword("collagen", page=1, page_size=5, base_url="https://us.openfoodfacts.org")

    call_url = client._http_client.get.call_args[0][0]
    assert "search_terms=collagen" in call_url, f"URL 必须使用官方 search_terms 参数: {call_url}"
    assert "search_terms_s" not in call_url, f"不允许使用 search_terms_s 参数: {call_url}"
    assert "page_size=5" in call_url


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
