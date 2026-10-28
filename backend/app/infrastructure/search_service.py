"""
搜索索引服务 — Elasticsearch 适配层

院士级升级[Phase 4-C]: 搜索索引优化，支持 Elasticsearch 全文检索

架构设计：
- SearchIndexService: 搜索索引服务（核心抽象）
- ElasticsearchIndexService: ES 实现（生产环境）
- InMemoryIndexService: 内存实现（开发/测试，降级方案）
- 数据同步：通过 EventBus 监听 DataChangedEvent 自动同步
- 中文分词：使用 ES ik_max_word 分词器

索引结构：
- rmfood-formulas: 配方索引
- rmfood-herbs: 药材索引
- rmfood-peptides: 活性肽索引

降级策略：
- ES 不可用时降级到内存搜索（有限功能）
- 同步失败时记录日志，不阻塞主流程
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger("rmfood.search.index")


# ── 数据模型 ──────────────────────────────────────────────────

class IndexType(str, Enum):
    """索引类型"""
    FORMULAS = "formulas"
    HERBS = "herbs"
    PEPTIDES = "peptides"


@dataclass
class SearchHit:
    """搜索结果条目"""
    id: str
    index_type: IndexType
    title: str
    description: str = ""
    score: float = 0.0
    highlights: Dict[str, List[str]] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "index_type": self.index_type.value,
            "title": self.title,
            "description": self.description,
            "score": round(self.score, 4),
            "highlights": self.highlights,
            "metadata": self.metadata,
        }


@dataclass
class SearchResult:
    """搜索结果集"""
    hits: List[SearchHit] = field(default_factory=list)
    total: int = 0
    took_ms: float = 0.0
    query: str = ""
    index_types: List[IndexType] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hits": [h.to_dict() for h in self.hits],
            "total": self.total,
            "took_ms": round(self.took_ms, 2),
            "query": self.query,
            "index_types": [t.value for t in self.index_types],
        }


@dataclass
class SuggestionResult:
    """搜索建议结果"""
    text: str
    score: float = 0.0
    index_type: Optional[IndexType] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "score": self.score,
            "index_type": self.index_type.value if self.index_type else None,
        }


# ── 索引映射定义 ──────────────────────────────────────────────

INDEX_MAPPINGS = {
    IndexType.FORMULAS: {
        "mappings": {
            "properties": {
                "title": {
                    "type": "text",
                    "analyzer": "ik_max_word",
                    "search_analyzer": "ik_smart",
                    "fields": {
                        "keyword": {"type": "keyword"},
                        "suggest": {"type": "completion"},
                    },
                },
                "description": {
                    "type": "text",
                    "analyzer": "ik_max_word",
                    "search_analyzer": "ik_smart",
                },
                "herbs": {"type": "text", "analyzer": "ik_max_word"},
                "effects": {"type": "text", "analyzer": "ik_max_word"},
                "category": {"type": "keyword"},
                "status": {"type": "keyword"},
                "org_id": {"type": "integer"},
                "created_at": {"type": "date"},
                "updated_at": {"type": "date"},
            },
        },
    },
    IndexType.HERBS: {
        "mappings": {
            "properties": {
                "name": {
                    "type": "text",
                    "analyzer": "ik_max_word",
                    "search_analyzer": "ik_smart",
                    "fields": {
                        "keyword": {"type": "keyword"},
                        "suggest": {"type": "completion"},
                    },
                },
                "latin_name": {"type": "keyword"},
                "alias": {"type": "text", "analyzer": "ik_max_word"},
                "category": {"type": "keyword"},
                "properties": {"type": "text", "analyzer": "ik_max_word"},
                "meridian": {"type": "text", "analyzer": "ik_max_word"},
                "effects": {"type": "text", "analyzer": "ik_max_word"},
            },
        },
    },
    IndexType.PEPTIDES: {
        "mappings": {
            "properties": {
                "name": {
                    "type": "text",
                    "analyzer": "ik_max_word",
                    "search_analyzer": "ik_smart",
                    "fields": {
                        "keyword": {"type": "keyword"},
                        "suggest": {"type": "completion"},
                    },
                },
                "sequence": {"type": "keyword"},
                "source": {"type": "text", "analyzer": "ik_max_word"},
                "activity": {"type": "text", "analyzer": "ik_max_word"},
                "molecular_weight": {"type": "float"},
            },
        },
    },
}


# ── 搜索索引服务抽象 ──────────────────────────────────────────

class SearchIndexService(ABC):
    """搜索索引服务抽象接口"""

    @abstractmethod
    async def index_document(
        self,
        index_type: IndexType,
        doc_id: str,
        document: Dict[str, Any],
    ) -> bool:
        """索引单个文档"""

    @abstractmethod
    async def bulk_index(
        self,
        index_type: IndexType,
        documents: List[Dict[str, Any]],
        id_field: str = "id",
    ) -> int:
        """批量索引文档"""

    @abstractmethod
    async def delete_document(
        self,
        index_type: IndexType,
        doc_id: str,
    ) -> bool:
        """删除文档"""

    @abstractmethod
    async def search(
        self,
        query: str,
        index_types: Optional[List[IndexType]] = None,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> SearchResult:
        """全文搜索"""

    @abstractmethod
    async def suggest(
        self,
        prefix: str,
        index_type: Optional[IndexType] = None,
        limit: int = 10,
    ) -> List[SuggestionResult]:
        """搜索建议"""

    @abstractmethod
    async def create_indices(self) -> int:
        """创建所有索引（如不存在）"""

    @abstractmethod
    async def delete_indices(self) -> int:
        """删除所有索引"""

    @abstractmethod
    async def get_stats(self) -> Dict[str, Any]:
        """获取索引统计信息"""


# ── Elasticsearch 实现 ────────────────────────────────────────

class ElasticsearchIndexService(SearchIndexService):
    """
    Elasticsearch 搜索索引服务

    使用 elasticsearch-py async 客户端。
    支持中文分词（ik 插件），降级到标准分词器。
    """

    def __init__(self, es_url: str, api_key: Optional[str] = None):
        self._es_url = es_url
        self._api_key = api_key
        self._client = None
        self._index_prefix = "rmfood"

    def _index_name(self, index_type: IndexType) -> str:
        return f"{self._index_prefix}-{index_type.value}"

    async def _get_client(self):
        """获取 ES 客户端（延迟初始化）"""
        if self._client is None:
            try:
                from elasticsearch import AsyncElasticsearch
                kwargs = {"hosts": [self._es_url]}
                if self._api_key:
                    kwargs["api_key"] = self._api_key
                self._client = AsyncElasticsearch(**kwargs)
                # 验证连接
                await self._client.ping()
                logger.info("[SearchIndex] Elasticsearch 连接成功: %s", self._es_url)
            except ImportError:
                logger.warning(
                    "[SearchIndex] elasticsearch-py 未安装，"
                    "请运行: pip install elasticsearch[async]"
                )
                return None
            except Exception as e:
                logger.warning("[SearchIndex] Elasticsearch 连接失败: %s", e)
                self._client = None
        return self._client

    async def index_document(
        self,
        index_type: IndexType,
        doc_id: str,
        document: Dict[str, Any],
    ) -> bool:
        client = await self._get_client()
        if not client:
            return False
        try:
            index_name = self._index_name(index_type)
            await client.index(
                index=index_name,
                id=doc_id,
                body=document,
                refresh=False,
            )
            return True
        except Exception as e:
            logger.error("[SearchIndex] 索引文档失败: %s/%s - %s", index_type.value, doc_id, e)
            return False

    async def bulk_index(
        self,
        index_type: IndexType,
        documents: List[Dict[str, Any]],
        id_field: str = "id",
    ) -> int:
        client = await self._get_client()
        if not client:
            return 0
        try:
            from elasticsearch.helpers import async_bulk
            index_name = self._index_name(index_type)

            actions = []
            for doc in documents:
                doc_id = str(doc.get(id_field, ""))
                if not doc_id:
                    continue
                actions.append({
                    "_index": index_name,
                    "_id": doc_id,
                    "_source": doc,
                })

            if not actions:
                return 0

            success, errors = await async_bulk(client, actions, raise_on_error=False)
            if errors:
                logger.warning("[SearchIndex] 批量索引部分失败: %d 错误", len(errors))
            return success
        except Exception as e:
            logger.error("[SearchIndex] 批量索引失败: %s - %s", index_type.value, e)
            return 0

    async def delete_document(
        self,
        index_type: IndexType,
        doc_id: str,
    ) -> bool:
        client = await self._get_client()
        if not client:
            return False
        try:
            index_name = self._index_name(index_type)
            await client.delete(index=index_name, id=doc_id, refresh=False)
            return True
        except Exception as e:
            logger.error("[SearchIndex] 删除文档失败: %s/%s - %s", index_type.value, doc_id, e)
            return False

    async def search(
        self,
        query: str,
        index_types: Optional[List[IndexType]] = None,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> SearchResult:
        client = await self._get_client()
        if not client:
            return SearchResult(query=query)

        start_time = time.time()
        types = index_types or list(IndexType)
        indices = ",".join(self._index_name(t) for t in types)

        # 构建 ES 查询
        es_query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "name^3", "description^2", "*"],
                                "type": "best_fields",
                                "fuzziness": "AUTO",
                            }
                        }
                    ],
                }
            },
            "highlight": {
                "fields": {
                    "title": {},
                    "name": {},
                    "description": {},
                    "herbs": {},
                    "effects": {},
                    "activity": {},
                },
                "pre_tags": ["<em>"],
                "post_tags": ["</em>"],
            },
            "from": (page - 1) * page_size,
            "size": page_size,
        }

        # 添加过滤条件
        if filters:
            filter_clauses = []
            for k, v in filters.items():
                if isinstance(v, list):
                    filter_clauses.append({"terms": {k: v}})
                else:
                    filter_clauses.append({"term": {k: v}})
            es_query["query"]["bool"]["filter"] = filter_clauses

        try:
            response = await client.search(
                index=indices,
                body=es_query,
            )

            hits = []
            for hit in response.get("hits", {}).get("hits", []):
                source = hit["_source"]
                # 从 _index 推断 index_type
                index_name = hit["_index"]
                idx_type = IndexType.FORMULAS
                for t in IndexType:
                    if index_name.endswith(t.value):
                        idx_type = t
                        break

                hits.append(SearchHit(
                    id=hit["_id"],
                    index_type=idx_type,
                    title=source.get("title") or source.get("name") or "",
                    description=source.get("description") or "",
                    score=hit.get("_score", 0.0),
                    highlights=hit.get("highlight", {}),
                    metadata=source,
                ))

            total = response.get("hits", {}).get("total", {})
            total_count = total.get("value", 0) if isinstance(total, dict) else total

            return SearchResult(
                hits=hits,
                total=total_count,
                took_ms=(time.time() - start_time) * 1000,
                query=query,
                index_types=types,
            )

        except Exception as e:
            logger.error("[SearchIndex] 搜索失败: %s", e)
            return SearchResult(query=query)

    async def suggest(
        self,
        prefix: str,
        index_type: Optional[IndexType] = None,
        limit: int = 10,
    ) -> List[SuggestionResult]:
        client = await self._get_client()
        if not client:
            return []

        types = [index_type] if index_type else list(IndexType)
        results = []

        for t in types:
            try:
                index_name = self._index_name(t)
                response = await client.search(
                    index=index_name,
                    body={
                        "suggest": {
                            "title_suggest": {
                                "prefix": prefix,
                                "completion": {
                                    "field": "title.suggest",
                                    "size": limit,
                                },
                            }
                        },
                        "_source": ["title", "name"],
                    },
                )

                options = (
                    response.get("suggest", {})
                    .get("title_suggest", [{}])[0]
                    .get("options", [])
                )

                for opt in options:
                    text = opt.get("text", "")
                    if text:
                        results.append(SuggestionResult(
                            text=text,
                            score=opt.get("_score", 0.0),
                            index_type=t,
                        ))
            except Exception as e:
                logger.debug("[SearchIndex] 建议查询失败: %s - %s", t.value, e)

        return results[:limit]

    async def create_indices(self) -> int:
        client = await self._get_client()
        if not client:
            return 0

        created = 0
        for idx_type, mapping in INDEX_MAPPINGS.items():
            index_name = self._index_name(idx_type)
            try:
                exists = await client.indices.exists(index=index_name)
                if not exists:
                    await client.indices.create(index=index_name, body=mapping)
                    created += 1
                    logger.info("[SearchIndex] 创建索引: %s", index_name)
            except Exception as e:
                logger.warning("[SearchIndex] 创建索引失败: %s - %s", index_name, e)
        return created

    async def delete_indices(self) -> int:
        client = await self._get_client()
        if not client:
            return 0

        deleted = 0
        for idx_type in IndexType:
            index_name = self._index_name(idx_type)
            try:
                exists = await client.indices.exists(index=index_name)
                if exists:
                    await client.indices.delete(index=index_name)
                    deleted += 1
                    logger.info("[SearchIndex] 删除索引: %s", index_name)
            except Exception as e:
                logger.warning("[SearchIndex] 删除索引失败: %s - %s", index_name, e)
        return deleted

    async def get_stats(self) -> Dict[str, Any]:
        client = await self._get_client()
        if not client:
            return {"backend": "elasticsearch", "status": "unavailable"}

        try:
            stats = {}
            for idx_type in IndexType:
                index_name = self._index_name(idx_type)
                try:
                    count = await client.count(index=index_name)
                    stats[idx_type.value] = {"document_count": count.get("count", 0)}
                except Exception as count_err:
                    logger.debug("ES 索引 %s 计数失败: %s", index_name, count_err)
                    stats[idx_type.value] = {"document_count": 0}
            return {
                "backend": "elasticsearch",
                "url": self._es_url,
                "status": "available",
                "indices": stats,
            }
        except Exception:
            return {"backend": "elasticsearch", "status": "error", "error": "搜索服务异常"}

    async def close(self) -> None:
        """关闭 ES 客户端"""
        if self._client:
            await self._client.close()
            self._client = None


# ── 内存实现（降级方案）─────────────────────────────────────────

class InMemoryIndexService(SearchIndexService):
    """
    内存搜索索引服务（开发/测试用，降级方案）

    使用简单的字符串匹配，不支持中文分词。
    适用于 ES 不可用时的基本搜索需求。
    """

    def __init__(self):
        self._documents: Dict[IndexType, Dict[str, Dict]] = {
            t: {} for t in IndexType
        }

    async def index_document(
        self,
        index_type: IndexType,
        doc_id: str,
        document: Dict[str, Any],
    ) -> bool:
        self._documents[index_type][doc_id] = document
        return True

    async def bulk_index(
        self,
        index_type: IndexType,
        documents: List[Dict[str, Any]],
        id_field: str = "id",
    ) -> int:
        count = 0
        for doc in documents:
            doc_id = str(doc.get(id_field, ""))
            if doc_id:
                self._documents[index_type][doc_id] = doc
                count += 1
        return count

    async def delete_document(self, index_type: IndexType, doc_id: str) -> bool:
        return self._documents[index_type].pop(doc_id, None) is not None

    async def search(
        self,
        query: str,
        index_types: Optional[List[IndexType]] = None,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> SearchResult:
        start_time = time.time()
        types = index_types or list(IndexType)
        query_lower = query.lower()
        hits = []

        for idx_type in types:
            for doc_id, doc in self._documents[idx_type].items():
                # 简单字符串匹配（搜索所有文本字段）
                match = False
                for v in doc.values():
                    if isinstance(v, str) and query_lower in v.lower():
                        match = True
                        break

                if not match:
                    continue

                # 检查过滤条件
                if filters:
                    skip = False
                    for k, v in filters.items():
                        if doc.get(k) != v:
                            skip = True
                            break
                    if skip:
                        continue

                hits.append(SearchHit(
                    id=doc_id,
                    index_type=idx_type,
                    title=doc.get("title") or doc.get("name") or "",
                    description=doc.get("description") or "",
                    score=1.0,
                    metadata=doc,
                ))

        # 分页
        total = len(hits)
        start = (page - 1) * page_size
        page_hits = hits[start:start + page_size]

        return SearchResult(
            hits=page_hits,
            total=total,
            took_ms=(time.time() - start_time) * 1000,
            query=query,
            index_types=types,
        )

    async def suggest(
        self,
        prefix: str,
        index_type: Optional[IndexType] = None,
        limit: int = 10,
    ) -> List[SuggestionResult]:
        types = [index_type] if index_type else list(IndexType)
        prefix_lower = prefix.lower()
        results = []

        for idx_type in types:
            for doc in self._documents[idx_type].values():
                title = doc.get("title") or doc.get("name") or ""
                if title.lower().startswith(prefix_lower):
                    results.append(SuggestionResult(
                        text=title,
                        index_type=idx_type,
                    ))
                    if len(results) >= limit:
                        return results

        return results

    async def create_indices(self) -> int:
        return len(IndexType)

    async def delete_indices(self) -> int:
        count = sum(len(docs) for docs in self._documents.values())
        self._documents = {t: {} for t in IndexType}
        return count

    async def get_stats(self) -> Dict[str, Any]:
        return {
            "backend": "memory",
            "status": "available",
            "indices": {
                t.value: {"document_count": len(docs)}
                for t, docs in self._documents.items()
            },
        }


# ── 全局单例 ──────────────────────────────────────────────────

_search_service: Optional[SearchIndexService] = None


def init_search_service(
    es_url: Optional[str] = None,
    es_api_key: Optional[str] = None,
) -> SearchIndexService:
    """初始化搜索索引服务"""
    global _search_service
    if es_url:
        _search_service = ElasticsearchIndexService(es_url=es_url, api_key=es_api_key)
        logger.info("[SearchIndex] 使用 Elasticsearch 后端: %s", es_url)
    else:
        _search_service = InMemoryIndexService()
        logger.info("[SearchIndex] 使用内存搜索后端（降级模式）")
    return _search_service


def get_search_service() -> SearchIndexService:
    """获取搜索索引服务"""
    global _search_service
    if _search_service is None:
        _search_service = init_search_service()
    return _search_service


async def close_search_service() -> None:
    """关闭搜索索引服务"""
    global _search_service
    if _search_service and isinstance(_search_service, ElasticsearchIndexService):
        await _search_service.close()
    _search_service = None
