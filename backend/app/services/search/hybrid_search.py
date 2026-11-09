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

# RRF 分数地板（诚实空态）：低于此 final_score 视为「无真实命中」，fuse 返回 []，
# 让前端显示诚实空态，而不是用一堆弱相关结果凑满 per_page 误导用户。
#
# 标定（真实数据采样，见 git 历史 / 审计记录）：
#   - 乱码词（zzzqqq/QQQZZZ/xxxyyy/啊啊啊zzz/qqqqwwww）top final_score 全部 ≈ 0.00492
#     （仅单条弱向量路命中，0.3 * 1/(60+1) ≈ 0.00492；BM25 无命中）。
#   - 真词（肽/胶原蛋白/牛骨/蛋清/小麦/collagen + 黄芪/茯苓/砂仁/白术/紫苏/枸杞）
#     top final_score ≈ 0.0111 ~ 0.01148（BM25+向量多路一致命中，分数叠加）。
#   - 真词最低 top 分 = collagen 0.0111；乱码最高 = 0.00492。
# 阈值 0.008 取两者 gap 中点：真词（≥0.0111）有 ~39% 余量不被误杀，乱码（≤0.00492）被拦。
# 注意：只滤「最终融合分」，单路内部检索不受影响；肽源原料召回（上轮刚修）top 分均
# ≥0.0111，远高于阈值，不会被误伤。
MIN_FUSED_SCORE = 0.008


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


class RRFFusion:
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

            if item_id not in items_map:
                items_map[item_id] = SearchResultItem(
                    id=item_id,
                    item_type="food_material",
                    name=item.get("name_cn", ""),
                    category=item.get("category"),
                )
            # 统一在构造后累加一次 rrf，避免构造器赋初值 + 累加导致新项被算两次。
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

            if item_id not in items_map:
                items_map[item_id] = SearchResultItem(
                    id=item_id,
                    item_type="food_material",
                    name=item.get("name_cn", ""),
                    category=item.get("category"),
                )
            # 纯 RRF：vector_score 只累加 rrf 排名分，与 bm25 同一量纲。
            # 原实现误用 vector_score=similarity（余弦 ~0.6）作初值再叠加 rrf(~0.016)，
            # 使向量路量纲远大于 BM25 的纯 rrf——关键词精确命中（仅 bm25，
            # fused≈0.4*0.016=0.0066）被所有向量项（fused≈0.3*0.6=0.18）淹没，
            # 出现"搜枸杞返回一堆不相关药材、精确项消失"的回归。
            # similarity 仅存入 item.similarity 供展示/阈值，不参与融合排序。
            items_map[item_id].vector_score += rrf_score
            if items_map[item_id].similarity is None:
                items_map[item_id].similarity = item.get("similarity")
            # 与 BM25 路对称：向量路也要把原始字段（product_name/brand/effects/...）写入
            # extra。否则"仅向量命中"的项 extra 为空——食品原料靠 name 取到 name_cn 尚可显示，
            # 零售（标识字段是 product_name/brand 而非 name_cn）展开 extra 后 product_name
            # 为空，出现空名结果。merge 不覆盖 bm25 已写入的字段以外的新键。
            items_map[item_id].extra.update({
                k: v for k, v in item.items()
                if k not in ("rank", "similarity")
            })

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
        # 诚实空态：滤掉低于分数地板的弱命中。乱码/无意义词只有单条弱向量命中
        # （final_score ≈0.00492 < 0.008），被拦 → 返回 []，前端显空态。
        # 真词多路一致命中（≥0.0111）不受影响。标定见 MIN_FUSED_SCORE 注释。
        results = [r for r in results if r.score >= MIN_FUSED_SCORE]
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
        self.fusion = RRFFusion(bm25_weight, vector_weight, rule_weight)

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
        """融合零售产品搜索结果

        fuse() 是为食品原料设计的，输出 item_type="food_material"、name 取自 name_cn，
        其余字段埋在 extra 里。零售产品的标识字段是 product_name/brand（非 name_cn），
        且前端 RetailProductSearchResult 期望这些字段平铺在顶层。因此这里在融合后把
        extra 展开回顶层，并修正 item_type / product_name。
        """
        fused = self.fusion.fuse(bm25_results, vector_results, query=query)
        remapped: List[Dict] = []
        for item in fused:
            extra = item.get("extra") or {}
            flat = dict(extra)  # 展开零售原始字段到顶层（product_name/brand/price/...）
            flat["id"] = item.get("id")
            flat["item_type"] = "retail_product"
            flat["score"] = item.get("score", 0.0)
            # product_name 兜底：优先 extra.product_name，缺失时退回融合 name
            flat["product_name"] = extra.get("product_name") or item.get("name") or ""
            flat["brand"] = extra.get("brand", "")
            if item.get("similarity") is not None:
                flat["similarity"] = item["similarity"]
            remapped.append(flat)
        return remapped
