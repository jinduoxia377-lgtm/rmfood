"""
混合搜索 RRF (Reciprocal Rank Fusion) 融合算法

对标 Potion AI VFT 的混合搜索能力，将 BM25 关键词搜索和
向量语义搜索的结果按 RRF 算法融合，再辅以规则排序。

RRF 公式: score(d) = Σ (1 / (K + rank_d))
其中 K = 60 (常数), rank_d = 文档 d 在某个排名中的位置。
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

K_RRF = 60  # RRF 常数


@dataclass
class SearchResultItem:
    """搜索结果项"""
    id: int
    item_type: str  # "food_material" | "retail_product"
    name: str
    category: Optional[str] = None
    sub_category: Optional[str] = None
    score: float = 0.0
    bm25_score: float = 0.0
    vector_score: float = 0.0
    rule_score: float = 0.0
    similarity: Optional[float] = None
    extra: Dict[str, Any] = field(default_factory=dict)


class RRF_Fusion:
    """RRF 融合算法"""

    def __init__(
        self,
        bm25_weight: float = 0.4,
        vector_weight: float = 0.3,
        rule_weight: float = 0.3,
    ):
        self.bm25_weight = bm25_weight
        self.vector_weight = vector_weight
        self.rule_weight = rule_weight

    def fuse(
        self,
        bm25_results: List[Dict[str, Any]],
        vector_results: List[Dict[str, Any]],
        rule_results: Optional[List[Dict[str, Any]]] = None,
        query: str = "",
    ) -> List[Dict[str, Any]]:
        """
        融合多路搜索结果

        Args:
            bm25_results: BM25 搜索结果 (含 rank 字段)
            vector_results: 向量搜索结果 (含 similarity 字段)
            rule_results: 规则匹配结果 (含 rule_score 字段)
            query: 原始查询

        Returns:
            融合排序后的结果列表
        """
        # 构建 id -> item 映射
        items_map: Dict[int, SearchResultItem] = {}

        # 处理 BM25 结果
        for rank, item in enumerate(bm25_results):
            item_id = item.get("id")
            if item_id is None:
                continue
            rrf_score = 1.0 / (K_RRF + rank + 1)
            bm25_score = item.get("rank", 0.0)

            if item_id not in items_map:
                items_map[item_id] = SearchResultItem(
                    id=item_id,
                    item_type="food_material",
                    name=item.get("name_cn", ""),
                    category=item.get("category"),
                    bm25_score=rrf_score,
                )
            items_map[item_id].bm25_score += rrf_score
            items_map[item_id].extra.update({
                k: v for k, v in item.items()
                if k not in ("rank",)
            })

        # 处理向量结果
        for rank, item in enumerate(vector_results):
            item_id = item.get("id")
            if item_id is None:
                continue
            rrf_score = 1.0 / (K_RRF + rank + 1)
            similarity = item.get("similarity", 0.0)

            if item_id not in items_map:
                items_map[item_id] = SearchResultItem(
                    id=item_id,
                    item_type="food_material",
                    name=item.get("name_cn", ""),
                    category=item.get("category"),
                    vector_score=similarity,
                )
            items_map[item_id].vector_score += rrf_score

        # 处理规则结果
        if rule_results:
            for rank, item in enumerate(rule_results):
                item_id = item.get("id")
                if item_id is None:
                    continue
                rrf_score = 1.0 / (K_RRF + rank + 1)
                rule_score = item.get("rule_score", 0.0)

                if item_id not in items_map:
                    items_map[item_id] = SearchResultItem(
                        id=item_id,
                        item_type="food_material",
                        name=item.get("name_cn", ""),
                        category=item.get("category"),
                        rule_score=rule_score,
                    )
                items_map[item_id].rule_score += rule_score

        # 计算综合得分并排序
        results = []
        for item in items_map.values():
            final_score = (
                self.bm25_weight * item.bm25_score +
                self.vector_weight * item.vector_score +
                self.rule_weight * item.rule_score
            )
            item.score = final_score
            results.append(item)

        results.sort(key=lambda x: x.score, reverse=True)
        return [self._item_to_dict(r) for r in results]

    def _item_to_dict(self, item: SearchResultItem) -> Dict[str, Any]:
        return {
            "id": item.id,
            "item_type": item.item_type,
            "name": item.name,
            "category": item.category,
            "score": round(item.score, 6),
            "similarity": item.similarity,
            "extra": item.extra,
        }


class HybridSearchService:
    """混合搜索服务 (BM25 + Vector + RRF)"""

    def __init__(self, bm25_weight: float = 0.4, vector_weight: float = 0.3, rule_weight: float = 0.3):
        self.fusion = RRF_Fusion(bm25_weight, vector_weight, rule_weight)

    def search_food_materials(
        self,
        bm25_results: List[Dict],
        vector_results: List[Dict],
        query: str = "",
    ) -> List[Dict]:
        """融合食品原料搜索结果"""
        return self.fusion.fuse(bm25_results, vector_results, query=query)

    def search_retail_products(
        self,
        bm25_results: List[Dict],
        vector_results: List[Dict],
        query: str = "",
    ) -> List[Dict]:
        """融合零售产品搜索结果"""
        return self.fusion.fuse(bm25_results, vector_results, query=query)
