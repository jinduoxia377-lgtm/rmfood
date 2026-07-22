"""
Open Food Facts 数据客户端

提供 REST API 查询和批量数据下载能力。
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

from .config import OFFConfig

logger = logging.getLogger(__name__)


class TokenBucket:
    """令牌桶限速器 — 只限流不阻塞（异步端点在线程池中调用时不需 sleep）"""

    def __init__(self, rate: int = 60):
        self.rate = rate
        self._last_request = 0.0

    def acquire(self):
        """非阻塞式限速 — 仅确保最小请求间隔"""
        import time
        elapsed = time.time() - self._last_request
        min_interval = 60.0 / self.rate
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        self._last_request = time.time()


class OFFClient:
    """Open Food Facts 数据客户端"""

    def __init__(self, config: OFFConfig = None):
        self.config = config or OFFConfig()
        self._bucket = TokenBucket(rate=self.config.RATE_LIMIT_RPM)
        self._http_client = httpx.Client(
            timeout=self.config.API_TIMEOUT,
            headers={"User-Agent": "RMFOOD-DataPipeline/1.0"},
        )

    # ── REST API 查询 ──

    def search_by_keyword(
        self,
        keyword: str,
        page_size: int = 100,
        fields: str = None,
    ) -> Dict[str, Any]:
        """
        通过关键词搜索产品

        Args:
            keyword: 搜索关键词
            page_size: 每页结果数 (最大 1000)
            fields: 指定返回字段，逗号分隔

        Returns:
            {"count": int, "page": int, "products": list[dict]}
        """
        self._bucket.acquire()

        params = {
            "search_terms_s": keyword,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page_size": min(page_size, 1000),
            "page": 1,
        }
        if fields:
            params["fields"] = fields

        url = f"{self.config.API_SEARCH}?{urlencode(params)}"
        logger.info(f"[OFFClient] 搜索: {keyword} → {url[:120]}...")

        response = None  # 初始化 response 避免 UnboundLocalError
        for attempt in range(self.config.MAX_RETRIES):
            try:
                response = self._http_client.get(url)
                response.raise_for_status()
                data = response.json()
                logger.info(
                    f"[OFFClient] 搜索结果: count={data.get('count', 0)}, "
                    f"products={len(data.get('products', []))}"
                )
                return data
            except httpx.HTTPError as e:
                if response.status_code in (503, 502, 504):
                    # 服务器暂时不可用，指数退避重试
                    wait = self.config.RETRY_BACKOFF_FACTOR ** attempt
                    logger.warning(
                        f"[OFFClient] 服务器错误 {response.status_code}, "
                        f"{wait}s 后重试 ({attempt+1}/{self.config.MAX_RETRIES})"
                    )
                    time.sleep(wait)
                    continue
                logger.error(f"[OFFClient] API 请求失败: {e}")
                break
        return {"count": 0, "products": []}

    def search_by_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        通过条形码查询单个产品

        Args:
            barcode: EAN-13 条码

        Returns:
            产品数据 dict 或 None
        """
        self._bucket.acquire()

        url = f"{self.config.API_BASE}/api/v2/product/{barcode}.json"
        response = None  # 初始化 response 避免 UnboundLocalError
        for attempt in range(self.config.MAX_RETRIES):
            try:
                response = self._http_client.get(url)
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                data = response.json()
                product = data.get("product") or data.get("products", [{}])[0]
                return product if product else None
            except httpx.HTTPError as e:
                if response.status_code in (503, 502, 504):
                    wait = self.config.RETRY_BACKOFF_FACTOR ** attempt
                    logger.warning(f"[OFFClient] 服务器错误 {response.status_code}, {barcode} 重试 ({attempt+1}/{self.config.MAX_RETRIES})")
                    time.sleep(wait)
                    continue
                logger.warning(f"[OFFClient] 条码查询失败 {barcode}: {e}")
                break
        return None

    def search_products_batch(
        self,
        categories: List[str],
        countries: List[str] = None,
        max_products: int = 1000,
    ) -> List[Dict[str, Any]]:
        """
        按分类批量搜索产品

        Args:
            categories: 分类标签列表
            countries: 国家过滤
            max_products: 最大返回产品数

        Returns:
            产品列表
        """
        all_products = []

        for category in categories:
            if len(all_products) >= max_products:
                break

            self._bucket.acquire()

            params = {
                "search_terms_s": category,
                "search_simple": "1",
                "action": "process",
                "json": "1",
                "page_size": min(100, max_products - len(all_products)),
                "fields": self.config.API_FIELDS,
            }
            if countries:
                params["countries_tags_contains"] = ",".join(countries)

            url = f"{self.config.API_SEARCH}?{urlencode(params)}"
            try:
                response = self._http_client.get(url)
                response.raise_for_status()
                data = response.json()
                products = data.get("products", [])
                all_products.extend(products)
                logger.info(
                    f"[OFFClient] 分类 '{category}': 获取 {len(products)} 条, "
                    f"累计 {len(all_products)}/{max_products}"
                )
            except httpx.HTTPError as e:
                logger.warning(f"[OFFClient] 分类搜索失败 '{category}': {e}")

        return all_products[:max_products]

    # ── 批量数据下载 ──

    def download_jsonl_diffs(
        self,
        from_date: date,
        to_date: date = None,
    ) -> Iterator[Dict[str, Any]]:
        """
        下载 JSONL 日增量数据

        Args:
            from_date: 起始日期
            to_date: 结束日期 (默认今天)

        Yields:
            逐条产品数据
        """
        if to_date is None:
            to_date = datetime.now().date()

        current_date = from_date
        while current_date <= to_date:
            date_str = current_date.strftime("%Y-%m-%d")
            url = self.config.JSONL_DIFFS_URL_TEMPLATE.format(date=date_str)
            logger.info(f"[OFFClient] 下载增量: {url}")

            try:
                response = self._http_client.get(url)
                response.raise_for_status()

                # JSONL 可能压缩
                if url.endswith(".gz"):
                    data = gzip.decompress(response.content)
                else:
                    data = response.content

                # 逐行解析
                for line in data.decode("utf-8").split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        product = json.loads(line)
                        yield product
                    except json.JSONDecodeError:
                        logger.warning(f"[OFFClient] 跳过无效 JSON: {line[:100]}")

            except httpx.HTTPError as e:
                logger.warning(f"[OFFClient] 增量下载失败 {date_str}: {e}")

            current_date += timedelta(days=1)

    # ── 中国产品过滤 ──

    @staticmethod
    def is_china_product(countries_str: str) -> bool:
        """
        判断产品是否在中国销售

        Args:
            countries_str: OFF countries 字段值 (逗号分隔的多语言字符串)

        Returns:
            True if 中国相关产品
        """
        if not countries_str:
            return False

        countries_lower = countries_str.lower()
        for keyword in OFFConfig.CHINA_COUNTRY_KEYWORDS:
            if keyword.lower() in countries_lower:
                return True
        return False

    @staticmethod
    def parse_quantity(qty_str: str) -> tuple:
        """
        解析产品数量描述

        Args:
            qty_str: 如 "500ml", "250g", "30 x 10ml"

        Returns:
            (volume_ml, weight_g)
        """
        if not qty_str:
            return None, None

        # 尝试解析体积
        vol_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ml|milliliter|liter)", qty_str, re.I)
        weight_match = re.search(r"(\d+(?:\.\d+)?)\s*g(?:ram)?(?:s)?\b", qty_str, re.I)

        volume = float(vol_match.group(1)) if vol_match else None
        weight = float(weight_match.group(1)) if weight_match else None

        # 处理 "30 x 10ml" 这种格式
        mult_match = re.search(r"(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|g)", qty_str, re.I)
        if mult_match:
            multiplier = float(mult_match.group(1))
            amount = float(mult_match.group(2))
            unit = mult_match.group(3).lower()
            if unit in ("ml", "milliliter"):
                volume = amount * multiplier
            elif unit == "g":
                weight = amount * multiplier

        return volume, weight

    def close(self):
        """关闭 HTTP 客户端"""
        if self._http_client:
            self._http_client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
