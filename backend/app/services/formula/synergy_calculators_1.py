"""
SynergyEngine 协同机制计算模块 (第 1 部分)

实现前 3 种协同作用机制的数学模型:
1. 药效增强协同 (Bliss Independence 模型)
2. 药代动力学协同 (PK Interaction 模型)
3. 结构稳定性协同 (Gibbs 自由能模型)
"""

import logging
import math
from typing import List, Optional

try:
    import numpy as np
    from scipy import stats
    from scipy.special import expit
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

from .synergy_models import (
    MechanismType,
    SynergyScore,
)

logger = logging.getLogger(__name__)


class SynergyCalculatorMixin1:
    """
    协同机制计算 mixin (第 1 部分): Bliss, PK, Gibbs

    需要被混入拥有 self.config (SyngineConfig) 和
    self.get_coefficient() 方法的类中使用。
    """

    def bliss_independence(
        self,
        efficacy_a: float,
        efficacy_b: float,
        alpha: Optional[float] = None,
        ingredient_a: str = "",
        ingredient_b: str = "",
    ) -> SynergyScore:
        """
        计算药效增强协同 (Bliss Independence 模型)

        数学模型:
            E_synergy = E_A + E_B - E_A × E_B + α × √(E_A × E_B)

        其中:
            - E_A, E_B: 成分 A/B 的单独功效值 [0, 1]
            - α: 协同系数 [-0.5, 1.5]
              - α > 0: 正向协同（增强）
              - α = 0: 无协同（独立作用）
              - α < 0: 拮抗作用
            - 返回值范围: [0, 2]

        Args:
            efficacy_a: 成分 A 的功效值 [0, 1]
            efficacy_b: 成分 B 的功效值 [0, 1]
            alpha: 协同系数，如未提供则从数据库查询
            ingredient_a: 成分 A 名称（用于查询系数）
            ingredient_b: 成分 B 名称（用于查询系数）

        Returns:
            SynergyScore: 包含得分、置信度和详细参数

        Raises:
            ValueError: 输入值超出有效范围
        """
        # 参数验证
        if not (0 <= efficacy_a <= 1):
            raise ValueError(f"efficacy_a 必须在 [0, 1] 范围内，当前值: {efficacy_a}")
        if not (0 <= efficacy_b <= 1):
            raise ValueError(f"efficacy_b 必须在 [0, 1] 范围内，当前值: {efficacy_b}")

        # 获取协同系数 α
        if alpha is None and ingredient_a and ingredient_b:
            alpha = self.get_coefficient(
                ingredient_a, ingredient_b,
                MechanismType.BLISS_INDEPENDENCE.value,
                default=0.0,
            )
        elif alpha is None:
            alpha = 0.0

        # 限制 α 在合理范围内
        alpha = max(-0.5, min(1.5, alpha))

        # Bliss Independence 核心计算
        # 基础项: E_A + E_B - E_A × E_B （独立作用的期望效果）
        base_effect = efficacy_a + efficacy_b - efficacy_a * efficacy_b

        # 协同项: α × √(E_A × E_B) （协同/拮抗修正）
        interaction_term = alpha * math.sqrt(efficacy_a * efficacy_b)

        # 总协同效果
        e_synergy = base_effect + interaction_term

        # 限制输出范围 [0, 2]
        e_synergy = max(0.0, min(2.0, e_synergy))

        # 计算置信度（基于 α 的绝对值和数据可用性）
        confidence = min(1.0, abs(alpha) / 1.5 + 0.3)
        if alpha == 0.0 and not (ingredient_a and ingredient_b):
            confidence = 0.3  # 使用默认值时置信度较低

        # 判定协同类型
        if e_synergy > base_effect + 0.1:
            synergy_type = "正向协同"
        elif e_synergy < base_effect - 0.1:
            synergy_type = "拮抗作用"
        else:
            synergy_type = "近似独立"

        parameters = {
            "efficacy_a": efficacy_a,
            "efficacy_b": efficacy_b,
            "alpha": alpha,
            "base_effect": round(base_effect, 4),
            "interaction_term": round(interaction_term, 4),
            "synergy_type": synergy_type,
        }

        logger.debug(
            f"Bliss Independence: {ingredient_a}+{ingredient_b} = "
            f"{e_synergy:.4f} (α={alpha:.2f}, {synergy_type})"
        )

        return SynergyScore(
            mechanism_type=MechanismType.BLISS_INDEPENDENCE,
            score=round(e_synergy, 4),
            confidence=round(confidence, 4),
            parameters=parameters,
            details=f"Bliss Independence 模型: {synergy_type}，总功效={e_synergy:.4f}",
        )

    # ================================================================
    # MECHANISM-2: 药代动力学协同 (PK Interaction 模型)
    # ================================================================

    def pk_interaction(
        self,
        auc_a: float,
        auc_b: float,
        auc_combination: float,
        bioavailability_base: float = 1.0,
        inhibitor_concentration: Optional[float] = None,
        ki_value: Optional[float] = None,
        first_pass_effect: float = 0.0,
        gut_absorption_competition: float = 0.0,
        ingredient_a: str = "",
        ingredient_b: str = "",
    ) -> SynergyScore:
        """
        计算药代动力学协同 (PK Interaction 模型)

        数学模型:
            1. AUC_ratio = AUC_combination / (AUC_A + AUC_B)
            2. 生物利用度影响因子 F = F_base × (1 + β × C_inhibitor)
            3. 综合考虑抑制常数 Ki、首过效应、肠道吸收竞争

        Args:
            auc_a: 成分 A 的药时曲线下面积 (AUC)
            auc_b: 成分 B 的 AUC
            auc_combination: 联合用药的 AUC
            bioavailability_base: 基础生物利用度 [0, 1]
            inhibitor_concentration: 抑制剂浓度 (μM)
            ki_value: 抑制常数 Ki (μM)，可从数据库查询
            first_pass_effect: 首过效应系数 [0, 1]
            gut_absorption_competition: 肠道吸收竞争系数 [0, 1]
            ingredient_a: 成分 A 名称
            ingredient_b: 成分 B 名称

        Returns:
            SynergyScore: PK 相互作用分析结果
        """
        # 参数验证
        if auc_a < 0 or auc_b < 0 or auc_combination < 0:
            raise ValueError("AUC 值不能为负数")
        if not (0 <= bioavailability_base <= 1):
            raise ValueError("bioavailability_base 必须在 [0, 1] 范围内")

        # 从数据库查询 Ki 值
        if ki_value is None and ingredient_a and ingredient_b:
            ki_value = self.get_coefficient(
                ingredient_a, ingredient_b,
                "ki_value",
                default=None,
            )

        # 1. 计算 AUC_ratio
        auc_sum = auc_a + auc_b
        auc_ratio = auc_combination / auc_sum if auc_sum > 0 else 1.0

        # 2. 生物利用度影响因子 F
        beta = 0.0  # 默认无影响
        if inhibitor_concentration is not None and ki_value is not None and ki_value > 0:
            beta = inhibitor_concentration / (inhibitor_concentration + ki_value)
            beta = max(-1.0, min(1.0, beta))  # 限制范围

        f_factor = bioavailability_base * (1 + beta * (inhibitor_concentration or 0))
        f_factor = max(0.0, min(2.0, f_factor))  # 限制生物利用度 [0, 2]

        # 3. 首过效应修正
        first_pass_factor = 1.0 - first_pass_effect

        # 4. 肠道吸收竞争修正
        absorption_factor = 1.0 - gut_absorption_competition * 0.3  # 最大降低30%

        # 5. 综合评分
        pk_score = auc_ratio * f_factor * first_pass_factor * absorption_factor
        pk_score = max(0.0, min(2.0, pk_score))  # 限制范围

        # 归一化到 [0, 1] 用于综合 SI
        normalized_score = pk_score / 2.0

        # 置信度计算
        confidence_factors = []
        if auc_ratio > 0:
            confidence_factors.append(0.8)
        if ki_value is not None:
            confidence_factors.append(0.9)
        if inhibitor_concentration is not None:
            confidence_factors.append(0.7)
        confidence = sum(confidence_factors) / len(confidence_factors) if confidence_factors else 0.4

        # 判定 PK 相互作用类型
        if pk_score > 1.1:
            pk_type = "生物利用度增强"
        elif pk_score < 0.9:
            pk_type = "生物利用度降低"
        else:
            pk_type = "无明显 PK 相互作用"

        parameters = {
            "auc_a": auc_a,
            "auc_b": auc_b,
            "auc_combination": auc_combination,
            "auc_ratio": round(auc_ratio, 4),
            "bioavailability_base": bioavailability_base,
            "f_factor": round(f_factor, 4),
            "beta": round(beta, 4),
            "ki_value": ki_value,
            "first_pass_effect": first_pass_effect,
            "first_pass_factor": round(first_pass_factor, 4),
            "gut_absorption_competition": gut_absorption_competition,
            "absorption_factor": round(absorption_factor, 4),
            "pk_type": pk_type,
        }

        logger.debug(
            f"PK Interaction: {ingredient_a}+{ingredient_b} = "
            f"{pk_score:.4f} ({pk_type})"
        )

        return SynergyScore(
            mechanism_type=MechanismType.PK_INTERACTION,
            score=round(pk_score, 4),
            confidence=round(confidence, 4),
            parameters=parameters,
            details=f"PK Interaction: {pk_type}，AUC ratio={auc_ratio:.4f}",
        )

    # ================================================================
    # MECHANISM-3: 结构稳定性协同 (Gibbs 自由能模型)
    # ================================================================

    def gibbs_stability(
        self,
        delta_h: float,
        delta_s: float,
        interaction_terms: List[float],
        temperature: Optional[float] = None,
        ph: Optional[float] = None,
        pka_values: Optional[List[float]] = None,
        ingredient_a: str = "",
        ingredient_b: str = "",
    ) -> SynergyScore:
        """
        计算结构稳定性协同 (Gibbs 自由能模型)

        数学模型:
            1. ΔG_complex = ΔH - T×ΔS + γ × Σ(interaction_terms)
            2. 稳定性评分 = 1 / (1 + exp(ΔG_complex / RT))
            3. pH 敏感性: 质子化状态影响 ΔG
            4. 温度敏感性: Arrhenius 方程修正

        Args:
            delta_h: 焓变 ΔH (kJ/mol)
            delta_s: 熵变 ΔS (J/(mol·K))
            interaction_terms: 相互作用项列表 (氢键、疏水作用、静电等)
            temperature: 温度 (K)，默认使用配置值 (298.15K)
            ph: pH 值，用于 pH 敏感性分析
            pka_values: pKa 值列表，用于质子化状态计算
            ingredient_a: 成分 A 名称
            ingredient_b: 成分 B 名称

        Returns:
            SynergyScore: 结构稳定性分析结果
        """
        # 设置温度
        T = temperature or self.config.T

        # 获取协同系数 γ
        gamma = self.get_coefficient(
            ingredient_a, ingredient_b,
            "gamma_interaction",
            default=1.0,
        ) or 1.0

        # 1. 计算 ΔG_complex
        # 注意单位转换: ΔS 通常用 J/(mol·K)，ΔH 用 kJ/mol
        delta_g_base = delta_h - (T * delta_s / 1000)  # 转换为 kJ/mol

        # 相互作用项总和
        interaction_sum = sum(interaction_terms) if interaction_terms else 0.0

        # 总 Gibbs 自由能变化
        delta_g_complex = delta_g_base + gamma * interaction_sum

        # 2. pH 敏感性修正
        ph_correction = 0.0
        ph_sensitivity = 0.0
        if ph is not None and pka_values:
            for pka in pka_values:
                if pka > 0:
                    # Henderson-Hasselbalch 方程近似
                    protonation_fraction = 1 / (1 + 10 ** (ph - pka))
                    ph_correction += 2.303 * self.config.R * T / 1000 * math.log10(
                        max(protonation_fraction, 1e-10)
                    )
            ph_correction /= len(pka_values)
            ph_sensitivity = abs(ph_correction)

        delta_g_ph_corrected = delta_g_complex + ph_correction

        # 3. 温度敏感性 (Arrhenius 方程)
        temp_sensitivity = 0.0
        if temperature is not None:
            # d(ΔG)/dT ≈ -ΔS (van't Hoff 方程)
            temp_sensitivity = abs(delta_s) / 1000  # kJ/(mol·K)

        delta_g_final = delta_g_ph_corrected

        # 4. 稳定性评分 (sigmoid 函数映射到 [0, 1])
        rt = self.config.R * T / 1000  # 转换为 kJ/mol
        if rt > 0:
            if HAS_SCIPY:
                stability_score = expit(-delta_g_final / rt)
            else:
                stability_score = 1.0 / (1.0 + math.exp(delta_g_final / rt))
        else:
            stability_score = 0.5

        # 限制范围
        stability_score = max(0.0, min(1.0, stability_score))

        # 置信度计算
        confidence = 0.7
        if len(interaction_terms) > 0:
            confidence += 0.1
        if ph is not None:
            confidence += 0.1
        confidence = min(1.0, confidence)

        # 判定稳定性
        if stability_score > 0.8:
            stability_level = "高稳定性"
        elif stability_score > 0.5:
            stability_level = "中等稳定性"
        else:
            stability_level = "低稳定性"

        parameters = {
            "delta_h": delta_h,
            "delta_s": delta_s,
            "delta_g_base": round(delta_g_base, 4),
            "interaction_terms": interaction_terms,
            "interaction_sum": round(interaction_sum, 4),
            "gamma": gamma,
            "delta_g_complex": round(delta_g_complex, 4),
            "temperature": T,
            "ph": ph,
            "ph_correction": round(ph_correction, 4),
            "ph_sensitivity": round(ph_sensitivity, 4),
            "temp_sensitivity": round(temp_sensitivity, 6),
            "delta_g_final": round(delta_g_final, 4),
            "stability_score": round(stability_score, 4),
            "stability_level": stability_level,
        }

        logger.debug(
            f"Gibbs Stability: {ingredient_a}+{ingredient_b} = "
            f"{stability_score:.4f} ({stability_level}), ΔG={delta_g_final:.2f} kJ/mol"
        )

        return SynergyScore(
            mechanism_type=MechanismType.GIBBS_STABILITY,
            score=round(stability_score, 4),
            confidence=round(confidence, 4),
            parameters=parameters,
            details=f"Gibbs 自由能: {stability_level}，ΔG={delta_g_final:.2f} kJ/mol",
        )

