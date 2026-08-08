"""
OpenFoodFacts REST API 客户端

完全对标 OFF 官方 API 文档:
https://openfoodfacts.github.io/openfoodfacts-server/api/

核心端点:
- GET /cgi/search.pl — 产品搜索 (search_terms_s, categories_tags_contains, page, page_size, json=1)
- GET /api/v2/{product_code}.json — 按条码查询单个产品
- GET /data/barcodes/{barcode}.json — 批量条码查询
"""
import gzip
import io
import json
import logging
import re
import time
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Iterator
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)


class OFFClient:
    """Open Food Facts REST API 客户端"""

    def __init__(self):
        self._http_client = httpx.Client(
            timeout=30.0,
            headers={"User-Agent": "RMFOOD-DataPipeline/1.0"},
        )

    # ── 产品搜索 ──────────────────────────────────────────────

    def search_by_keyword(self, keyword: str, page: int = 1, page_size: int = 20,
                          fields: str = None, brand: str = None, category_tag: str = None) -> Dict[str, Any]:
        """
        关键词搜索产品

        官方参数: https://world.openfoodfacts.org/cgi/search.pl
        - search_terms_s: 搜索关键词 (必填)
        - search_simple: 1 = 简化返回
        - action: process
        - json: 1 = JSON 响应
        - page / page_size: 分页
        - fields: 指定返回字段，逗号分隔
        - brands: 按品牌过滤 (新增)
        - categories_tags_contains: 按分类标签过滤 (新增)
        """
        params = {
            "search_terms_s": keyword,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page": page,
            "page_size": min(page_size, 100),
        }
        if brand:
            params["brands"] = brand
        if category_tag:
            params["categories_tags_contains"] = category_tag
        if fields:
            params["fields"] = fields

        url = f"https://world.openfoodfacts.org/cgi/search.pl?{urlencode(params)}"

        try:
            response = self._http_client.get(url)
            response.raise_for_status()
            data = response.json()
            logger.info(f"[OFF] search '{keyword}': count={data.get('count', 0)}, products={len(data.get('products', []))}")
            return data
        except httpx.HTTPError as e:
            logger.error(f"[OFF] search failed: {e}")
            return {"count": 0, "page": page, "page_count": 0, "page_size": page_size, "products": []}

    def search_by_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        按条码查询单个产品

        官方端点: https://world.openfoodfacts.org/api/v2/{product_code}.json
        返回完整响应（包含 product 和 status 字段），由调用方决定如何解析。
        """
        url = f"https://world.openfoodfacts.org/api/v2/{barcode}.json"

        try:
            response = self._http_client.get(url)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            # 返回完整响应，让调用方决定如何处理
            return data
        except httpx.HTTPError as e:
            logger.warning(f"[OFF] barcode query failed for {barcode}: {e}")
            return None

    def search_by_category(self, category_tag: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """
        按分类标签搜索产品

        官方参数: categories_tags_contains
        """
        params = {
            "categories_tags_contains": category_tag,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page": page,
            "page_size": min(page_size, 100),
        }
        url = f"https://world.openfoodfacts.org/cgi/search.pl?{urlencode(params)}"

        try:
            response = self._http_client.get(url)
            response.raise_for_status()
            data = response.json()
            logger.info(f"[OFF] category '{category_tag}': count={data.get('count', 0)}")
            return data
        except httpx.HTTPError as e:
            logger.error(f"[OFF] category search failed: {e}")
            return {"count": 0, "page": page, "page_count": 0, "page_size": page_size, "products": []}

    def download_jsonl_diffs(self, from_date: date, to_date: date = None) -> Iterator[Dict[str, Any]]:
        """下载 JSONL 日增量数据"""
        if to_date is None:
            to_date = datetime.now().date()

        current_date = from_date
        while current_date <= to_date:
            date_str = current_date.strftime("%Y-%m-%d")
            url = f"https://static.openfoodfacts.org/data/diffs/{date_str}.jsonl.gz"

            try:
                response = self._http_client.get(url)
                response.raise_for_status()

                if url.endswith(".gz"):
                    data = gzip.decompress(response.content)
                else:
                    data = response.content

                for line in data.decode("utf-8").split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        pass

            except httpx.HTTPError as e:
                logger.warning(f"[OFF] diff download failed {date_str}: {e}")

            current_date += timedelta(days=1)

    def close(self):
        if self._http_client:
            self._http_client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
