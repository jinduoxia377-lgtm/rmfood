"""PubMed E-utilities API 适配器

集成 PubMed 文献检索，为 RAG 知识库提供现代科研证据支撑。

API 特性：
- 免费、无需 API Key
- ESearch + EFetch 两步查询
- 支持按药材/成分/靶点检索
- 返回 PMID、标题、作者、摘要、DOI 等结构化数据
- 缓存机制避免重复查询
"""

import hashlib
import json
import logging
import os
import time
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

# PubMed E-utilities API 端点
PUBMED_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
ESearch_URL = f"{PUBMED_BASE_URL}/esearch.fcgi"
EFetch_URL = f"{PUBMED_BASE_URL}/efetch.fcgi"

# 缓存配置
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache", "pubmed")
CACHE_TTL = 86400  # 24 小时缓存


class PubMedAdapter:
    """PubMed E-utilities API 适配器

    使用方式：
        adapter = PubMedAdapter()
        results = await adapter.search("Ginsenoside Rb1 anti-inflammatory", max_results=5)
        # 返回 [{pmid, title, authors, abstract, doi, year, ...}, ...]
    """

    def __init__(self, use_cache: bool = True, cache_ttl: int = CACHE_TTL):
        self.use_cache = use_cache
        self.cache_ttl = cache_ttl
        self._cache_dir = CACHE_DIR

        # 确保缓存目录存在
        if self.use_cache:
            os.makedirs(self._cache_dir, exist_ok=True)

    def _get_cache_path(self, query: str) -> str:
        """生成缓存文件路径"""
        query_hash = hashlib.md5(query.encode("utf-8")).hexdigest()[:12]
        return os.path.join(self._cache_dir, f"{query_hash}.json")

    def _load_cache(self, query: str) -> Optional[list[dict]]:
        """从缓存加载结果"""
        if not self.use_cache:
            return None

        cache_path = self._get_cache_path(query)
        if not os.path.exists(cache_path):
            return None

        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # 检查缓存是否过期
            if time.time() - data.get("timestamp", 0) > self.cache_ttl:
                logger.debug("缓存已过期: %s", query)
                return None
            logger.info("缓存命中: %s (%d 条结果)", query, len(data.get("results", [])))
            return data.get("results", [])
        except Exception as e:
            logger.warning("缓存加载失败: %s", e)
            return None

    def _save_cache(self, query: str, results: list[dict]) -> None:
        """保存结果到缓存"""
        if not self.use_cache:
            return

        cache_path = self._get_cache_path(query)
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump({
                    "query": query,
                    "timestamp": time.time(),
                    "results": results,
                }, f, ensure_ascii=False, indent=2)
            logger.info("缓存已保存: %s (%d 条结果)", query, len(results))
        except Exception as e:
            logger.warning("缓存保存失败: %s", e)

    async def search(
        self,
        query: str,
        max_results: int = 5,
        year_range: tuple[int, int] | None = None,
    ) -> list[dict]:
        """搜索 PubMed 文献

        Args:
            query: 检索查询（支持 PubMed 高级语法）
            max_results: 最大返回结果数
            year_range: 年份范围 (min_year, max_year)

        Returns:
            文献列表，每条包含 pmid, title, authors, abstract, doi, year 等
        """
        # 1. 检查缓存
        cached = self._load_cache(query)
        if cached is not None:
            return cached[:max_results]

        try:
            # 2. ESearch: 获取 PMID 列表
            pmids = await self._esearch(query, max_results, year_range)
            if not pmids:
                logger.info("PubMed 无结果: %s", query)
                return []

            # 3. EFetch: 获取文献详情
            results = await self._efetch(pmids)

            # 4. 保存缓存
            self._save_cache(query, results)

            return results[:max_results]
        except Exception as e:
            logger.error("PubMed 搜索失败: %s - %s", query, e, exc_info=True)
            return []

    async def _esearch(
        self,
        query: str,
        max_results: int,
        year_range: tuple[int, int] | None = None,
    ) -> list[str]:
        """ESearch: 获取 PMID 列表"""
        params = {
            "db": "pubmed",
            "term": query,
            "retmax": max_results,
            "retmode": "json",
            "sort": "relevance",
        }

        # 添加年份过滤
        if year_range:
            params["datetype"] = "pdat"
            params["reldate"] = "10000"  # 大范围
            # 或使用 retdate 和 edat
            params["filter"] = "0"

        url = f"{ESearch_URL}?{urlencode(params)}"
        logger.debug("ESearch URL: %s", url)

        try:
            req = Request(url, headers={"User-Agent": "RMFOODFP/1.0"})
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            id_list = data.get("esearchresult", {}).get("idlist", [])
            count = data.get("esearchresult", {}).get("count", 0)
            logger.info("ESearch 完成: %d 条结果 (%s)", count, query)
            return id_list
        except (URLError, HTTPError, TimeoutError) as e:
            logger.warning("ESearch 失败: %s", e)
            return []

    async def _efetch(self, pmids: list[str]) -> list[dict]:
        """EFetch: 获取文献详情"""
        if not pmids:
            return []

        params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "retmode": "xml",
        }
        url = f"{EFetch_URL}?{urlencode(params)}"
        logger.debug("EFetch URL: %s", url)

        try:
            req = Request(url, headers={"User-Agent": "RMFOODFP/1.0"})
            with urlopen(req, timeout=15) as resp:
                xml_content = resp.read().decode("utf-8")

            # 解析 XML
            results = self._parse_pubmed_xml(xml_content)
            logger.info("EFetch 完成: %d 条文献", len(results))
            return results
        except (URLError, HTTPError, TimeoutError) as e:
            logger.warning("EFetch 失败: %s", e)
            return []

    def _parse_pubmed_xml(self, xml_content: str) -> list[dict]:
        """解析 PubMed XML 响应"""
        import xml.etree.ElementTree as ET

        try:
            root = ET.fromstring(xml_content)
            articles = []

            for article in root.findall(".//PubmedArticle"):
                medline_cid = article.findtext(".//MedlineCitation/PMID")
                if not medline_cid:
                    continue

                # 标题
                title_elem = article.find(".//ArticleTitle")
                title = "".join(title_elem.itertext()) if title_elem is not None else ""

                # 摘要
                abstract_elem = article.find(".//Abstract")
                abstract = ""
                if abstract_elem is not None:
                    abstract_parts = [t.text for t in abstract_elem.findall(".//Text") if t.text]
                    abstract = " ".join(abstract_parts)

                # 作者
                authors = []
                for author in article.findall(".//Author"):
                    last_name = author.findtext("LastName", default="")
                    fore_name = author.findtext("ForeName", default="")
                    name = f"{last_name} {fore_name}".strip()
                    if name:
                        authors.append(name)

                # 年份
                pub_date = article.findtext(".//PubDate/Year") or article.findtext(".//PubDate/MedlineDate") or ""

                # DOI
                doi = ""
                for article_id in article.findall(".//ArticleId"):
                    if article_id.attrib.get("IdType") == "doi":
                        doi = article_id.text or ""
                        break

                # 期刊
                journal = article.findtext(".//Journal/Title", default="")

                articles.append({
                    "pmid": medline_cid,
                    "title": title,
                    "abstract": abstract[:500] if abstract else "",  # 截断摘要
                    "authors": authors[:5],  # 最多 5 位作者
                    "year": pub_date[:4] if pub_date else "",
                    "doi": doi,
                    "journal": journal,
                })

            return articles
        except ET.ParseError as e:
            logger.warning("XML 解析失败: %s", e)
            return []


# 全局单例
_adapter_instance: PubMedAdapter | None = None


def get_pubmed_adapter() -> PubMedAdapter:
    """获取全局 PubMed 适配器单例"""
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = PubMedAdapter()
    return _adapter_instance
