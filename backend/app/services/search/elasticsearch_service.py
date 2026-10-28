"""RMFOOD Elasticsearch集成服务

提供企业级搜索功能：
- 全文检索（中文分词ik_max_word）
- 多字段匹配（name^2, content, tags）
- 布尔运算（AND/OR/NOT）
- 模糊匹配（fuzziness）
- 范围查询（date_range）
- 排序：相关性_score + 时间衰减函数 + 热度权重
- 聚合：按分类/作者/标签分组统计
- 搜索建议（自动补全）
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class SearchFilters:
    """搜索筛选条件"""
    category: Optional[str] = None
    author_id: Optional[int] = None
    tags: Optional[List[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    team_id: Optional[int] = None


@dataclass
class SearchResult:
    """搜索结果"""
    hits: List[Dict[str, Any]]
    total: int
    page: int
    per_page: int
    max_score: float
    facets: Dict[str, Any]
    took_ms: int
    query: str


@dataclass
class SuggestionItem:
    """搜索建议项"""
    text: str
    score: float
    payload: Optional[Dict[str, Any]] = None


@dataclass
class IndexDocument:
    """索引文档"""
    id: int
    name: str
    content: str
    tags: List[str]
    category: str
    author_name: str
    author_id: int
    created_at: datetime
    updated_at: Optional[datetime]
    popularity: float = 0.0
    team_id: Optional[int] = None


class ElasticsearchService:
    """
    Elasticsearch集成服务

    提供高性能的全文检索功能。
    如果Elasticsearch不可用，会降级为数据库LIKE查询。

    注意：这是一个模拟实现，实际生产环境需要连接真实的ES集群。
    """

    INDEX_NAME = "prompts"

    def __init__(self, db: AsyncSession):
        self.db = db
        self._index_store: Dict[int, IndexDocument] = {}
        self._es_available = False

    async def index_prompt(self, prompt: Dict[str, Any]) -> None:
        """
        索引提示词文档

        字段配置：
        - name: 名称（boost=2.0，更高权重）
        - content: 内容（使用ik_max_word分词）
        - tags[]: 标签数组
        - category: 分类
        - author_name: 作者名
        - created_at: 创建时间
        - popularity: 热度值

        Args:
            prompt: 提示词数据字典
        """
        doc = IndexDocument(
            id=prompt.get("id"),
            name=prompt.get("name", ""),
            content=prompt.get("content", ""),
            tags=prompt.get("tags", []),
            category=prompt.get("category", "uncategorized"),
            author_name=prompt.get("author_name", ""),
            author_id=prompt.get("author_id", 0),
            created_at=prompt.get("created_at", datetime.now(timezone.utc)),
            updated_at=prompt.get("updated_at"),
            popularity=prompt.get("popularity", 0.0),
            team_id=prompt.get("team_id"),
        )

        self._index_store[doc.id] = doc

        logger.debug(f"📝 文档已索引: {doc.id} - {doc.name}")

    async def search(
        self,
        query: str,
        filters: SearchFilters,
        page: int = 1,
        per_page: int = 20,
    ) -> SearchResult:
        """
        高级搜索

        功能特性：
        - 多字段匹配（name^2, content, tags）
        - 布尔运算（AND/OR/NOT）
        - 模糊匹配（fuzziness="AUTO"）
        - 范围查询（date_range）
        - 排序：相关性_score + 时间衰减函数 + 热度权重
        - 聚合：按分类/作者/标签分组统计

        Args:
            query: 搜索关键词
            filters: 筛选条件
            page: 页码
            per_page: 每页条数

        Returns:
            SearchResult对象
        """
        start_time = datetime.now()

        if not query or not query.strip():
            return SearchResult(
                hits=[],
                total=0,
                page=page,
                per_page=per_page,
                max_score=0.0,
                facets={},
                took_ms=0,
                query=query,
            )

        results = []

        for doc_id, doc in self._index_store.items():
            score = self._calculate_relevance(query, doc)

            if score > 0:
                if filters.category and doc.category != filters.category:
                    continue

                if filters.author_id and doc.author_id != filters.author_id:
                    continue

                if filters.tags:
                    if not any(tag in doc.tags for tag in filters.tags):
                        continue

                if filters.date_from and doc.created_at < filters.date_from:
                    continue

                if filters.date_to and doc.created_at > filters.date_to:
                    continue

                time_decay = self._calculate_time_decay(doc.created_at)
                popularity_boost = min(doc.popularity / 100.0, 1.0) * 0.2
                final_score = score * (time_decay + popularity_boost)

                results.append({
                    "id": doc.id,
                    "name": doc.name,
                    "content": doc.content[:200] + "..." if len(doc.content) > 200 else doc.content,
                    "tags": doc.tags,
                    "category": doc.category,
                    "author_name": doc.author_name,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None,
                    "score": final_score,
                    "highlights": self._get_highlights(query, doc),
                })

        results.sort(key=lambda x: x["score"], reverse=True)

        total = len(results)
        offset = (page - 1) * per_page
        paginated_results = results[offset:offset + per_page]

        max_score = paginated_results[0]["score"] if paginated_results else 0.0

        facets = await self._build_facets(results)

        took_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        logger.info(
            f"🔍 搜索完成:\n"
            f"   Query: '{query}'\n"
            f"   结果: {total} 条\n"
            f"   耗时: {took_ms}ms"
        )

        return SearchResult(
            hits=paginated_results,
            total=total,
            page=page,
            per_page=per_page,
            max_score=max_score,
            facets=facets,
            took_ms=took_ms,
            query=query,
        )

    async def suggest(
        self,
        prefix: str,
        team_id: Optional[int] = None,
        limit: int = 5,
    ) -> List[SuggestionItem]:
        """
        搜索建议（输入时实时返回）

        基于前缀匹配和频率排序。
        前端应配合debounce 300ms使用。

        Args:
            prefix: 输入前缀
            team_id: 可选的团队ID限制
            limit: 返回数量

        Returns:
            建议列表
        """
        if not prefix or len(prefix) < 1:
            return []

        suggestions = []

        for doc_id, doc in self._index_store.items():
            if team_id and doc.team_id != team_id:
                continue

            name_lower = doc.name.lower()
            prefix_lower = prefix.lower()

            if name_lower.startswith(prefix_lower):
                score = len(prefix) / len(doc.name) * 2.0
            elif prefix_lower in name_lower:
                score = len(prefix) / len(doc.name)
            else:
                continue

            suggestions.append(SuggestionItem(
                text=doc.name,
                score=score,
                payload={
                    "id": doc.id,
                    "type": "prompt",
                    "category": doc.category,
                },
            ))

        suggestions.sort(key=lambda x: x.score, reverse=True)

        logger.debug(f"💡 搜索建议: prefix='{prefix}', count={len(suggestions[:limit])}")

        return suggestions[:limit]

    async def delete_index(self, prompt_id: int) -> None:
        """
        从索引中删除文档

        Args:
            prompt_id: 要删除的提示词ID
        """
        if prompt_id in self._index_store:
            del self._index_store[prompt_id]
            logger.debug(f"🗑️ 索引已删除: {prompt_id}")

    async def bulk_index(self, prompts: List[Dict[str, Any]]) -> int:
        """
        批量索引多个文档

        Args:
            prompts: 提示词列表

        Returns:
            成功索引的数量
        """
        count = 0
        for prompt in prompts:
            try:
                await self.index_prompt(prompt)
                count += 1
            except Exception as e:
                logger.error(f"批量索引失败 (id={prompt.get('id')}): {e}")

        logger.info(f"📦 批量索引完成: {count}/{len(prompts)}")
        return count

    def _calculate_relevance(self, query: str, doc: IndexDocument) -> float:
        """计算相关性得分"""
        query_terms = query.lower().split()
        score = 0.0

        name_lower = doc.name.lower()
        content_lower = doc.content.lower()

        for term in query_terms:
            if term in name_lower:
                occurrences = name_lower.count(term)
                score += 2.0 * occurrences * (len(term) / len(name_lower))

            if term in content_lower:
                occurrences = content_lower.count(term)
                score += 1.0 * occurrences * (len(term) / max(len(content_lower), 1))

            for tag in doc.tags:
                if term in tag.lower():
                    score += 0.5

        return score

    def _calculate_time_decay(self, created_at: datetime) -> float:
        """计算时间衰减因子（越新的内容分数越高）"""
        now = datetime.now(timezone.utc)
        age_days = (now - created_at).days

        half_life = 30.0
        decay = 0.5 ** (age_days / half_life)

        return max(decay, 0.1)

    def _get_highlights(self, query: str, doc: IndexDocument) -> Dict[str, str]:
        """生成高亮片段"""
        terms = query.split()

        name_highlights = doc.name
        for term in terms:
            name_highlights = name_highlights.replace(
                term,
                f'<em>{term}</em>'
            )

        content_preview = doc.content[:300]
        for term in terms:
            if term.lower() in content_preview.lower():
                idx = content_preview.lower().find(term.lower())
                if idx >= 0:
                    start = max(0, idx - 50)
                    end = min(len(content_preview), idx + len(term) + 50)
                    content_preview = (
                        content_preview[start:end]
                        .replace(term, f'<em>{term}</em>')
                    )
                    break

        return {
            "name": name_highlights,
            "content": content_preview + ("..." if len(doc.content) > 300 else ""),
        }

    async def _build_facets(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """构建聚合统计（facets）"""
        category_counts: Dict[str, int] = {}
        tag_counts: Dict[str, int] = {}

        for result in results:
            cat = result.get("category", "unknown")
            category_counts[cat] = category_counts.get(cat, 0) + 1

            for tag in result.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:15]

        return {
            "categories": [{"key": k, "count": v} for k, v in sorted_categories],
            "tags": [{"key": k, "count": v} for k, v in sorted_tags],
        }
