"""
SynergyEngine 统一分析接口模块

提供协同作用的统一分析接口、综合 SI 计算和主导机制识别。
"""

import logging
from typing import Any, Dict, List, Optional

try:
    import numpy as np
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

from .synergy_models import (
    MechanismType,
    TasteType,
    SynergyScore,
    SynergyReport,
)


logger = logging.getLogger(__name__)


class SynergyAnalysisMixin:
    """
    统一分析接口 mixin 类

    提供 analyze_synergy() 统一接口、综合 SI 计算和主导机制识别。
    需要被混入拥有 5 种机制方法和 _current_version 属性的类中使用。
    """

    def analyze_synergy(
        self,
        ingredient_a: str,
        ingredient_b: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> SynergyReport:
        """
        统一协同作用分析接口

        对给定的成分对执行全部 5 种协同机制分析，
        生成综合报告。

        Args:
            ingredient_a: 成分 A 名称/ID
            ingredient_b: 成分 B 名称/ID
            context: 可选上下文参数，包含各机制需要的具体数据:
                - bliss: {efficacy_a, efficacy_b, alpha}
                - pk: {auc_a, auc_b, auc_combination, ...}
                - gibbs: {delta_h, delta_s, interaction_terms, ...}
                - network: {targets_a, targets_b, pathways_database}
                - taste: {taste_profile_a, taste_profile_b}

        Returns:
            SynergyReport: 完整的协同作用分析报告

        Example:
            >>> engine = SynergyEngine()
            >>> report = engine.analyze_synergy(
            ...     "黄芪多糖",
            ...     "大豆肽",
            ...     context={
            ...         "bliss": {"efficacy_a": 0.7, "efficacy_b": 0.6},
            ...         "pk": {"auc_a": 100, "auc_b": 80, "auc_combination": 200},
            ...         "gibbs": {"delta_h": -20, "delta_s": 50, "interaction_terms": [-5, -3]},
            ...         "network": {
            ...             "targets_a": ["EGFR", "VEGF", "TNF"],
            ...             "targets_b": ["EGFR", "IL6", "NFkB"],
            ...         },
            ...         "taste": {
            ...             "taste_profile_a": {TasteType.BITTER: 0.3, TasteType.UMAMI: 0.2},
            ...             "taste_profile_b": {TasteType.BITTER: 0.4, TasteType.SWEET: 0.3},
            ...         },
            ...     },
            ... )
            >>> print(report.overall_si)
            >>> print(report.dominant_mechanism)
        """
        ctx = context or {}
        mechanisms: List[SynergyScore] = []

        # Mechanism-1: Bliss Independence
        try:
            bliss_ctx = ctx.get("bliss", {})
            mechanisms.append(self.bliss_independence(
                efficacy_a=bliss_ctx.get("efficacy_a", 0.5),
                efficacy_b=bliss_ctx.get("efficacy_b", 0.5),
                alpha=bliss_ctx.get("alpha"),
                ingredient_a=ingredient_a,
                ingredient_b=ingredient_b,
            ))
        except Exception as e:
            logger.warning(f"Bliss Independence 计算失败: {e}")
            mechanisms.append(SynergyScore(
                mechanism_type=MechanismType.BLISS_INDEPENDENCE,
                score=0.0,
                confidence=0.0,
                details=f"计算失败: {str(e)}",
            ))

        # Mechanism-2: PK Interaction
        try:
            pk_ctx = ctx.get("pk", {})
            mechanisms.append(self.pk_interaction(
                auc_a=pk_ctx.get("auc_a", 100.0),
                auc_b=pk_ctx.get("auc_b", 100.0),
                auc_combination=pk_ctx.get("auc_combination", 220.0),
                bioavailability_base=pk_ctx.get("bioavailability_base", 1.0),
                inhibitor_concentration=pk_ctx.get("inhibitor_concentration"),
                ki_value=pk_ctx.get("ki_value"),
                first_pass_effect=pk_ctx.get("first_pass_effect", 0.0),
                gut_absorption_competition=pk_ctx.get("gut_absorption_competition", 0.0),
                ingredient_a=ingredient_a,
                ingredient_b=ingredient_b,
            ))
        except Exception as e:
            logger.warning(f"PK Interaction 计算失败: {e}")
            mechanisms.append(SynergyScore(
                mechanism_type=MechanismType.PK_INTERACTION,
                score=0.0,
                confidence=0.0,
                details=f"计算失败: {str(e)}",
            ))

        # Mechanism-3: Gibbs Stability
        try:
            gibbs_ctx = ctx.get("gibbs", {})
            mechanisms.append(self.gibbs_stability(
                delta_h=gibbs_ctx.get("delta_h", -15.0),
                delta_s=gibbs_ctx.get("delta_s", 40.0),
                interaction_terms=gibbs_ctx.get("interaction_terms", []),
                temperature=gibbs_ctx.get("temperature"),
                ph=gibbs_ctx.get("ph"),
                pka_values=gibbs_ctx.get("pka_values"),
                ingredient_a=ingredient_a,
                ingredient_b=ingredient_b,
            ))
        except Exception as e:
            logger.warning(f"Gibbs Stability 计算失败: {e}")
            mechanisms.append(SynergyScore(
                mechanism_type=MechanismType.GIBBS_STABILITY,
                score=0.0,
                confidence=0.0,
                details=f"计算失败: {str(e)}",
            ))

        # Mechanism-4: Network Pharmacology
        try:
            network_ctx = ctx.get("network", {})
            targets_a = network_ctx.get("targets_a", [])
            targets_b = network_ctx.get("targets_b", [])

            if targets_a and targets_b:
                mechanisms.append(self.network_pharmacology(
                    targets_a=targets_a,
                    targets_b=targets_b,
                    pathways_database=network_ctx.get("pathways_database"),
                    total_pathways=network_ctx.get("total_pathways", 500),
                    ingredient_a=ingredient_a,
                    ingredient_b=ingredient_b,
                ))
            else:
                mechanisms.append(SynergyScore(
                    mechanism_type=MechanismType.NETWORK_PHARMACOLOGY,
                    score=0.0,
                    confidence=0.0,
                    details="缺少靶点数据",
                ))
        except Exception as e:
            logger.warning(f"Network Pharmacology 计算失败: {e}")
            mechanisms.append(SynergyScore(
                mechanism_type=MechanismType.NETWORK_PHARMACOLOGY,
                score=0.0,
                confidence=0.0,
                details=f"计算失败: {str(e)}",
            ))

        # Mechanism-5: Taste Matrix
        try:
            taste_ctx = ctx.get("taste", {})
            profile_a_raw = taste_ctx.get("taste_profile_a", {})
            profile_b_raw = taste_ctx.get("taste_profile_b", {})

            # 转换字符串键为枚举
            profile_a = {}
            for k, v in profile_a_raw.items():
                if isinstance(k, TasteType):
                    profile_a[k] = v
                elif isinstance(k, str):
                    try:
                        profile_a[TasteType(k)] = v
                    except ValueError:
                        pass

            profile_b = {}
            for k, v in profile_b_raw.items():
                if isinstance(k, TasteType):
                    profile_b[k] = v
                elif isinstance(k, str):
                    try:
                        profile_b[TasteType(k)] = v
                    except ValueError:
                        pass

            if profile_a or profile_b:
                mechanisms.append(self.taste_matrix(
                    taste_profile_a=profile_a,
                    taste_profile_b=profile_b,
                    custom_matrix=taste_ctx.get("custom_matrix"),
                    suppression_threshold=taste_ctx.get("suppression_threshold", 0.3),
                    ingredient_a=ingredient_a,
                    ingredient_b=ingredient_b,
                ))
            else:
                mechanisms.append(SynergyScore(
                    mechanism_type=MechanismType.TASTE_MATRIX,
                    score=0.5,
                    confidence=0.3,
                    details="使用默认味觉特征",
                ))
        except Exception as e:
            logger.warning(f"Taste Matrix 计算失败: {e}")
            mechanisms.append(SynergyScore(
                mechanism_type=MechanismType.TASTE_MATRIX,
                score=0.5,
                confidence=0.0,
                details=f"计算失败: {str(e)}",
            ))

        # 计算综合协同指数 SI
        overall_si = self._calculate_overall_si(mechanisms)

        # 识别主导机制
        dominant_mechanism = self._identify_dominant_mechanism(mechanisms)

        # 构建报告
        report = SynergyReport(
            ingredient_pair=(ingredient_a, ingredient_b),
            mechanisms=mechanisms,
            overall_si=overall_si,
            dominant_mechanism=dominant_mechanism,
            metadata={
                "engine_version": self._current_version,
                "config_weights": {k.value: v for k, v in self.config.weights.items()},
            },
        )

        logger.info(
            f"协同分析完成: {ingredient_a} + {ingredient_b} → "
            f"SI={overall_si:.4f}, 主导={dominant_mechanism.value if dominant_mechanism else 'None'}"
        )

        return report

    def _calculate_overall_si(
        self,
        mechanisms: List[SynergyScore],
        method: str = "weighted_average",
    ) -> float:
        """
        计算综合协同指数 SI

        支持两种方法:
        1. weighted_average: 加权平均法（基于配置权重）
        2. pca: 主成分分析法（需 SciPy）

        Args:
            mechanisms: 各机制的得分列表
            method: 计算方法

        Returns:
            综合协同指数 [0, 1]
        """
        if method == "weighted_average":
            return self._weighted_average_si(mechanisms)
        elif method == "pca":
            return self._pca_si(mechanisms)
        else:
            raise ValueError(f"未知的 SI 计算方法: {method}")

    def _weighted_average_si(self, mechanisms: List[SynergyScore]) -> float:
        """加权平均法计算 SI"""
        total_weight = 0.0
        weighted_sum = 0.0

        for mech in mechanisms:
            weight = self.config.weights.get(mech.mechanism_type, 0.0)

            # 如果置信度为 0，跳过该机制
            if mech.confidence <= 0:
                continue

            # 归一化各机制的得分到 [0, 1]
            normalized_score = self._normalize_mechanism_score(mech)

            weighted_sum += weight * normalized_score * mech.confidence
            total_weight += weight * mech.confidence

        if total_weight == 0:
            return 0.0

        si = weighted_sum / total_weight
        return max(0.0, min(1.0, si))

    def _normalize_mechanism_score(self, mech: SynergyScore) -> float:
        """归一化机制得分到 [0, 1]"""
        if mech.mechanism_type == MechanismType.BLISS_INDEPENDENCE:
            return mech.score / 2.0  # 范围 [0, 2]
        elif mech.mechanism_type == MechanismType.PK_INTERACTION:
            return mech.score / 2.0  # 范围 [0, 2]
        elif mech.mechanism_type in [
            MechanismType.GIBBS_STABILITY,
            MechanismType.NETWORK_PHARMACOLOGY,
            MechanismType.TASTE_MATRIX,
        ]:
            return mech.score  # 已经在 [0, 1]
        else:
            return mech.score

    def _pca_si(self, mechanisms: List[SynergyScore]) -> float:
        """主成分分析法计算 SI（需 SciPy）"""
        if not HAS_SCIPY:
            logger.warning("SciPy 未安装，回退到加权平均法")
            return self._weighted_average_si(mechanisms)

        scores = np.array([
            self._normalize_mechanism_score(m) * m.confidence
            for m in mechanisms
            if m.confidence > 0
        ])

        if len(scores) < 2:
            return float(scores[0]) if len(scores) == 1 else 0.0

        # 标准化
        scores_std = (scores - np.mean(scores)) / (np.std(scores) + 1e-10)

        # PCA（取第一主成分）
        cov_matrix = np.cov(scores_std.reshape(1, -1))
        eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

        # 第一主成分解释的方差比例
        si = float(np.abs(eigenvectors[-1][0]))
        return max(0.0, min(1.0, si))

    def _identify_dominant_mechanism(
        self,
        mechanisms: List[SynergyScore],
    ) -> Optional[MechanismType]:
        """
        识别主导机制

        条件:
        - 得分最高
        - 置信度 > confidence_threshold (默认 0.7)

        Args:
            mechanisms: 机制得分列表

        Returns:
            主导机制类型，如果没有满足条件的则返回 None
        """
        valid_mechanisms = [
            m for m in mechanisms
            if m.confidence >= self.config.confidence_threshold
        ]

        if not valid_mechanisms:
            return None

        # 找出归一化后得分最高的机制
        best = max(
            valid_mechanisms,
            key=lambda m: self._normalize_mechanism_score(m),
        )

        return best.mechanism_type

