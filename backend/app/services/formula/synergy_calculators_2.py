"""
SynergyEngine 协同机制计算模块 (第 2 部分)

实现后 2 种协同作用机制的数学模型:
4. 靶点通路协同 (网络药理学模型)
5. 感官品质协同 (味觉矩阵模型)
"""

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

try:
    import numpy as np
    from scipy import stats
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

from .synergy_models import (
    MechanismType,
    SynergyScore,
    TasteType,
)

logger = logging.getLogger(__name__)


class SynergyCalculatorMixin2:
    """
    协同机制计算 mixin (第 2 部分): Network Pharmacology, Taste Matrix

    需要被混入拥有 self.config (SyngineConfig) 和
    self.get_coefficient() 方法的类中使用。
    """

    def network_pharmacology(
        self,
        targets_a: List[str],
        targets_b: List[str],
        pathways_database: Optional[Dict[str, List[str]]] = None,
        total_pathways: int = 500,
        ingredient_a: str = "",
        ingredient_b: str = "",
    ) -> SynergyScore:
        """
        计算靶点通路协同 (网络药理学模型)

        数学模型:
            1. 靶点集合运算: T_union = T_A ∪ T_B, T_intersect = T_A ∩ T_B
            2. Jaccard 相似系数 = |T_intersect| / |T_union|
            3. Tanimoto 系数 = |T_intersect| / (|T_A| + |T_B| - |T_intersect|)
            4. 通路富集分析: 超几何检验 p-value

        Args:
            targets_a: 成分 A 的靶点集合
            targets_b: 成分 B 的靶点集合
            pathways_database: 通路数据库 {pathway_name: [targets]}
                支持 KEGG/Reactome 格式导入
            total_pathways: 背景通路总数（用于超几何检验）
            ingredient_a: 成分 A 名称
            ingredient_b: 成分 B 名称

        Returns:
            SynergyScore: 靶点通路分析结果
        """
        # 参数验证
        if not targets_a or not targets_b:
            raise ValueError("靶点集合不能为空")

        # 转换为集合进行运算
        set_a = set(targets_a)
        set_b = set(targets_b)

        # 1. 集合运算
        union_targets = set_a | set_b
        intersect_targets = set_a & set_b
        unique_to_a = set_a - set_b
        unique_to_b = set_b - set_a

        # 2. Jaccard 相似系数
        jaccard = (
            len(intersect_targets) / len(union_targets)
            if union_targets
            else 0.0
        )

        # 3. Tanimoto 系数（扩展 Jaccard）
        tanimoto = (
            len(intersect_targets) / (len(set_a) + len(set_b) - len(intersect_targets))
            if (len(set_a) + len(set_b) - len(intersect_targets)) > 0
            else 0.0
        )

        # 4. 通路富集分析
        enrichment_results = []
        combined_pvalue = 1.0

        if pathways_database and intersect_targets:
            for pathway_name, pathway_targets in pathways_database.items():
                pathway_set = set(pathway_targets)
                pathway_intersection = intersect_targets & pathway_set

                if pathway_intersection:
                    # 超几何检验
                    # N = 总基因数, K = 通路中基因数, n = 靶点并集大小, k = 重叠数
                    N = total_pathways
                    K = len(pathway_set)
                    n = len(union_targets)
                    k = len(pathway_intersection)

                    if HAS_SCIPY:
                        try:
                            pvalue = stats.hypergeom.sf(k - 1, N, K, n)
                        except Exception as e:
                            logger.debug("超几何检验失败，返回默认 p-value: %s", e)
                            pvalue = 1.0
                    else:
                        pvalue = self._hypergeometric_test(N, K, n, k)

                    enrichment_results.append({
                        "pathway": pathway_name,
                        "overlap_count": k,
                        "pvalue": pvalue,
                        "targets_in_pathway": sorted(pathway_intersection),
                    })

            # 取最小 p-value 作为组合 p-value
            if enrichment_results:
                combined_pvalue = min(r["pvalue"] for r in enrichment_results)
                enrichment_results.sort(key=lambda x: x["pvalue"])

        # 5. 综合评分
        # 基于靶点重叠度和通路富集显著性
        target_overlap_score = jaccard
        enrichment_score = -math.log10(combined_pvalue + 1e-10) / 10  # 归一化
        enrichment_score = min(1.0, enrichment_score)

        # 综合网络药理学评分
        network_score = 0.6 * target_overlap_score + 0.4 * enrichment_score
        network_score = max(0.0, min(1.0, network_score))

        # 置信度计算
        confidence = 0.6
        if len(intersect_targets) > 0:
            confidence += 0.2
        if pathways_database:
            confidence += 0.2
        confidence = min(1.0, confidence)

        # 判定协同水平
        if jaccard > 0.5:
            synergy_level = "高度靶点重叠"
        elif jaccard > 0.2:
            synergy_level = "中度靶点重叠"
        elif jaccard > 0:
            synergy_level = "低度靶点重叠"
        else:
            synergy_level = "无共同靶点"

        parameters = {
            "targets_a_count": len(set_a),
            "targets_b_count": len(set_b),
            "union_count": len(union_targets),
            "intersect_count": len(intersect_targets),
            "unique_to_a_count": len(unique_to_a),
            "unique_to_b_count": len(unique_to_b),
            "jaccard_coefficient": round(jaccard, 4),
            "tanimoto_coefficient": round(tanimoto, 4),
            "enrichment_results": enrichment_results[:10],  # 只保留前10个
            "combined_pvalue": combined_pvalue,
            "enrichment_score": round(enrichment_score, 4),
            "network_score": round(network_score, 4),
            "synergy_level": synergy_level,
        }

        logger.debug(
            f"Network Pharmacology: {ingredient_a}+{ingredient_b} = "
            f"{network_score:.4f} (Jaccard={jaccard:.4f}, {synergy_level})"
        )

        return SynergyScore(
            mechanism_type=MechanismType.NETWORK_PHARMACOLOGY,
            score=round(network_score, 4),
            confidence=round(confidence, 4),
            parameters=parameters,
            details=f"网络药理学: {synergy_level}，Jaccard={jaccard:.4f}",
        )

    def _hypergeometric_test(
        self,
        N: int,
        K: int,
        n: int,
        k: int,
    ) -> float:
        """
        纯 Python 实现的超几何检验（备选方案）

        P(X >= k) = Σ_{i=k}^{min(K,n)} C(K,i) * C(N-K, n-i) / C(N, n)

        Args:
            N: 总体大小
            K: 总体中成功数
            n: 抽样数
            k: 观察到的成功数

        Returns:
            p-value
        """

        if k == 0:
            return 1.0

        def log_comb(n_val: int, k_val: int) -> float:
            """计算对数组合数防止溢出"""
            if k_val < 0 or k_val > n_val:
                return float('-inf')
            return (
                sum(math.log(i) for i in range(n_val - k_val + 1, n_val + 1))
                - sum(math.log(i) for i in range(1, k_val + 1))
            )

        log_denom = log_comb(N, n)
        if log_denom == float('-inf'):
            return 1.0

        log_pvalue = float('-inf')
        max_k = min(K, n)

        for i in range(k, max_k + 1):
            log_numer = log_comb(K, i) + log_comb(N - K, n - i)
            log_term = log_numer - log_denom

            if log_pvalue == float('-inf'):
                log_pvalue = log_term
            else:
                log_pvalue = math.log(math.exp(log_pvalue) + math.exp(log_term))

        return math.exp(log_pvalue) if log_pvalue != float('-inf') else 1.0

    # ================================================================
    # MECHANISM-5: 感官品质协同 (味觉矩阵模型)
    # ================================================================

    def taste_matrix(
        self,
        taste_profile_a: Dict[TasteType, float],
        taste_profile_b: Dict[TasteType, float],
        custom_matrix: Optional[Dict[Tuple[TasteType, TasteType], int]] = None,
        suppression_threshold: float = 0.3,
        ingredient_a: str = "",
        ingredient_b: str = "",
    ) -> SynergyScore:
        """
        计算感官品质协同 (味觉矩阵模型)

        数学模型:
            S = Σ(w_i × s_i) + Σ(t_ij × √(s_i × s_j))

        其中:
            - s_i: 第 i 种味觉强度 [0, 1]
            - w_i: 味觉权重
            - t_ij ∈ {-1, 0, 1}: 味觉相互作用矩阵
              - -1: 掩盖效应
              - 0: 中性
              - 1: 增强效应

        支持的味觉类型: 苦、涩、鲜、甜、酸、咸

        Args:
            taste_profile_a: 成分 A 的味觉特征 {taste_type: intensity}
            taste_profile_b: 成分 B 的味觉特征
            custom_matrix: 自定义味觉相互作用矩阵
            suppression_threshold: 掩盖效应阈值
            ingredient_a: 成分 A 名称
            ingredient_b: 成分 B 名称

        Returns:
            SynergyScore: 感官品质分析结果
        """
        # 使用自定义矩阵或默认矩阵
        matrix = custom_matrix or self.config.default_taste_matrix

        # 定义味觉权重
        taste_weights = {
            TasteType.BITTER: -0.25,       # 苦味负面
            TasteType.ASTRINGENT: -0.20,   # 涩味负面
            TasteType.UMAMI: 0.25,         # 鲜味正面
            TasteType.SWEET: 0.20,         # 甜味正面
            TasteType.SOUR: 0.05,          # 酸味轻微正面
            TasteType.SALTY: 0.05,         # 咸味轻微正面
        }

        # 合并两个成分的味觉特征
        all_tastes = set(taste_profile_a.keys()) | set(taste_profile_b.keys())
        combined_taste: Dict[TasteType, float] = {}

        for taste in all_tastes:
            intensity_a = taste_profile_a.get(taste, 0.0)
            intensity_b = taste_profile_b.get(taste, 0.0)
            combined_taste[taste] = (intensity_a + intensity_b) / 2

        # 1. 计算基础感官品质 S_base = Σ(w_i × s_i)
        s_base = sum(
            taste_weights.get(taste, 0) * intensity
            for taste, intensity in combined_taste.items()
        )

        # 2. 计算味觉相互作用 S_interaction = Σ(t_ij × √(s_i × s_j))
        s_interaction = 0.0
        interaction_details: List[Dict[str, Any]] = []

        taste_list = list(all_tastes)
        for i, taste_i in enumerate(taste_list):
            for j, taste_j in enumerate(taste_list):
                if i >= j:
                    continue

                s_i = combined_taste.get(taste_i, 0.0)
                s_j = combined_taste.get(taste_j, 0.0)

                # 查找相互作用类型
                pair_1 = (taste_i, taste_j)
                pair_2 = (taste_j, taste_i)
                t_ij = matrix.get(pair_1, matrix.get(pair_2, 0))

                # 计算相互作用贡献
                interaction_value = t_ij * math.sqrt(max(0, s_i * s_j))
                s_interaction += interaction_value

                # 记录显著的相互作用
                if abs(interaction_value) > suppression_threshold * 0.5:
                    interaction_type = "增强" if t_ij == 1 else ("掩盖" if t_ij == -1 else "中性")
                    interaction_details.append({
                        "pair": f"{taste_i.value}-{taste_j.value}",
                        "type": interaction_type,
                        "value": round(interaction_value, 4),
                        "t_ij": t_ij,
                    })

        # 3. 最终感官品质评分
        s_total = s_base + s_interaction

        # 归一化到 [0, 1]
        # s_base 范围约 [-0.45, 0.50]，s_interaction 范围约 [-1, 1]
        taste_score = (s_total + 1.0) / 2.0  # 映射到 [0, 1]
        taste_score = max(0.0, min(1.0, taste_score))

        # 4. 分析掩盖效应
        suppressions = [
            detail for detail in interaction_details
            if detail["type"] == "掩盖" and abs(detail["value"]) > suppression_threshold
        ]

        enhancements = [
            detail for detail in interaction_details
            if detail["type"] == "增强" and detail["value"] > suppression_threshold
        ]

        # 置信度计算
        confidence = 0.7
        if len(combined_taste) >= 4:
            confidence += 0.1
        if interaction_details:
            confidence += 0.1
        confidence = min(1.0, confidence)

        # 判定感官品质等级
        if taste_score > 0.75:
            quality_level = "优秀"
        elif taste_score > 0.55:
            quality_level = "良好"
        elif taste_score > 0.40:
            quality_level = "一般"
        else:
            quality_level = "较差"

        parameters = {
            "taste_profile_a": {k.value: v for k, v in taste_profile_a.items()},
            "taste_profile_b": {k.value: v for k, v in taste_profile_b.items()},
            "combined_taste": {k.value: round(v, 4) for k, v in combined_taste.items()},
            "s_base": round(s_base, 4),
            "s_interaction": round(s_interaction, 4),
            "s_total": round(s_total, 4),
            "taste_score": round(taste_score, 4),
            "quality_level": quality_level,
            "suppression_effects": suppressions,
            "enhancement_effects": enhancements,
            "interaction_details": interaction_details[:10],
        }

        logger.debug(
            f"Taste Matrix: {ingredient_a}+{ingredient_b} = "
            f"{taste_score:.4f} ({quality_level})"
        )

        return SynergyScore(
            mechanism_type=MechanismType.TASTE_MATRIX,
            score=round(taste_score, 4),
            confidence=round(confidence, 4),
            parameters=parameters,
            details=f"感官品质: {quality_level}，评分={taste_score:.4f}",
        )

