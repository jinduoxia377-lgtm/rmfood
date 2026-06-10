"""
SynergyEngine - 协同作用机制引擎

实现食源性活性多肽与药食同源成分的 5 种协同作用机制数学模型:
1. 药效增强协同 (Bliss Independence 模型)
2. 药代动力学协同 (PK Interaction 模型)
3. 结构稳定性协同 (Gibbs 自由能模型)
4. 靶点通路协同 (网络药理学模型)
5. 感官品质协同 (味觉矩阵模型)

技术规范:
- Python 3.9+ 类型注解
- dataclass 定义数据结构
- NumPy/SciPy 用于数值计算
- JSON Schema 用于输入验证
- 完整的 docstring 和类型提示
"""

import json
import logging
import math
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
import os

try:
    import numpy as np
    from scipy import stats
    from scipy.special import expit
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    logging.warning("NumPy/SciPy 未安装，将使用纯 Python 实现")

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False
    logging.warning("jsonschema 未安装，将使用简化验证")


logger = logging.getLogger(__name__)


# ============================================================
# Enums & Data Classes
# ============================================================

class MechanismType(str, Enum):
    """协同作用机制类型"""
    BLISS_INDEPENDENCE = "bliss_independence"          # 药效增强协同
    PK_INTERACTION = "pk_interaction"                  # 药代动力学协同
    GIBBS_STABILITY = "gibbs_stability"                # 结构稳定性协同
    NETWORK_PHARMACOLOGY = "network_pharmacology"      # 靶点通路协同
    TASTE_MATRIX = "taste_matrix"                      # 感官品质协同


class TasteType(str, Enum):
    """味觉类型"""
    BITTER = "bitter"           # 苦味
    ASTRINGENT = "astringent"   # 涩味
    UMAMI = "umami"             # 鲜味
    SWEET = "sweet"             # 甜味
    SOUR = "sour"               # 酸味
    SALTY = "salty"             # 咸味


@dataclass
class SynergyScore:
    """单个机制的协同得分"""
    mechanism_type: MechanismType
    score: float                           # 得分范围根据机制不同
    confidence: float                      # 置信度 [0, 1]
    parameters: Dict[str, Any] = field(default_factory=dict)
    details: Optional[str] = None


@dataclass
class SynergyReport:
    """协同作用分析报告"""
    ingredient_pair: Tuple[str, str]       # 成分对 (name_a, name_b)
    mechanisms: List[SynergyScore]         # 各机制得分列表
    overall_si: float                       # 综合协同指数 [0, 1]
    dominant_mechanism: Optional[MechanismType]  # 主导机制
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "ingredient_pair": list(self.ingredient_pair),
            "mechanisms": [
                {
                    "mechanism_type": m.mechanism_type.value,
                    "score": m.score,
                    "confidence": m.confidence,
                    "parameters": m.parameters,
                    "details": m.details,
                }
                for m in self.mechanisms
            ],
            "overall_si": self.overall_si,
            "dominant_mechanism": self.dominant_mechanism.value if self.dominant_mechanism else None,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class SynergyCoefficient:
    """协同系数记录"""
    ingredient_a: str
    ingredient_b: str
    mechanism: str
    coefficient: float
    source: str
    confidence: float
    version: int
    created_at: datetime
    updated_at: datetime
    notes: Optional[str] = None


@dataclass
class VersionRecord:
    """版本管理记录"""
    version: int
    timestamp: datetime
    source: str
    changes_count: int
    description: str
    checksum: str


# ============================================================
# Configuration
# ============================================================

@dataclass
class SyngineConfig:
    """引擎配置参数"""
    # 权重配置（用于综合 SI 计算）
    weights: Dict[MechanismType, float] = field(default_factory=lambda: {
        MechanismType.BLISS_INDEPENDENCE: 0.25,
        MechanismType.PK_INTERACTION: 0.20,
        MechanismType.GIBBS_STABILITY: 0.15,
        MechanismType.NETWORK_PHARMACOLOGY: 0.25,
        MechanismType.TASTE_MATRIX: 0.15,
    })

    # 阈值配置
    confidence_threshold: float = 0.7       # 主导机制识别阈值
    synergy_threshold: float = 0.6          # 显著协同阈值
    antagonism_threshold: float = -0.3      # 拮抗效应阈值

    # 物理常数
    R: float = 8.314                        # 气体常数 J/(mol·K)
    T: float = 298.15                       # 标准温度 K (25°C)

    # 味觉矩阵默认相互作用
    default_taste_matrix: Dict[Tuple[TasteType, TasteType], int] = field(
        default_factory=lambda: {
            (TasteType.BITTER, TasteType.SWEET): -1,     # 苦-甜: 掩盖
            (TasteType.BITTER, TasteType.UMAMI): -1,     # 苦-鲜: 掩盖
            (TasteType.ASTRINGENT, TasteType.SWEET): -1,  # 涩-甜: 掩盖
            (TasteType.UMAMI, TasteType.SWEET): 1,        # 鲜-甜: 增强
            (TasteType.SOUR, TasteType.SWEET): 1,         # 酸-甜: 增强
            (TasteType.SALTY, TasteType.UMAMI): 1,        # 咸-鲜: 增强
        }
    )

    # 数据路径
    data_dir: str = "data/synergy"
    coefficients_file: str = "synergy_coefficients.json"
    versions_file: str = "version_history.json"


# ============================================================
# Main Engine Class
# ============================================================

class SynergyEngine:
    """
    协同作用机制引擎主类

    功能:
    - 实现 5 种协同作用机制的数学模型计算
    - 提供统一的分析接口
    - 支持动态更新协同系数库
    - 版本管理与变更追踪
    """

    def __init__(self, config: Optional[SyngineConfig] = None):
        """
        初始化协同作用引擎

        Args:
            config: 引擎配置，如未提供则使用默认配置
        """
        self.config = config or SyngineConfig()
        self._coefficients: Dict[str, SynergyCoefficient] = {}
        self._version_history: List[VersionRecord] = []
        self._current_version: int = 0

        # 初始化数据目录和加载已有系数
        self._init_data_storage()
        self._load_coefficients()
        self._load_version_history()

        logger.info(f"SynergyEngine 初始化完成，当前版本: v{self._current_version}")

    # ── 数据存储初始化 ──

    def _init_data_storage(self) -> None:
        """初始化数据存储目录"""
        os.makedirs(self.config.data_dir, exist_ok=True)

    def _get_coefficients_path(self) -> str:
        """获取系数文件路径"""
        return os.path.join(self.config.data_dir, self.config.coefficients_file)

    def _get_versions_path(self) -> str:
        """获取版本历史文件路径"""
        return os.path.join(self.config.data_dir, self.config.versions_file)

    # ── 系数管理 ──

    def _load_coefficients(self) -> None:
        """从文件加载协同系数"""
        path = self._get_coefficients_path()
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                for item in data.get("coefficients", []):
                    key = self._make_coefficient_key(
                        item["ingredient_a"],
                        item["ingredient_b"],
                        item["mechanism"]
                    )
                    self._coefficients[key] = SynergyCoefficient(
                        ingredient_a=item["ingredient_a"],
                        ingredient_b=item["ingredient_b"],
                        mechanism=item["mechanism"],
                        coefficient=item["coefficient"],
                        source=item["source"],
                        confidence=item["confidence"],
                        version=item["version"],
                        created_at=datetime.fromisoformat(item["created_at"]),
                        updated_at=datetime.fromisoformat(item["updated_at"]),
                        notes=item.get("notes"),
                    )
                self._current_version = data.get("current_version", 0)
                logger.info(f"加载了 {len(self._coefficients)} 条协同系数")
            except Exception as e:
                logger.error(f"加载协同系数失败: {e}")

    def _save_coefficients(self) -> None:
        """保存协同系数到文件"""
        path = self._get_coefficients_path()
        data = {
            "current_version": self._current_version,
            "coefficients": [asdict(c) for c in self._coefficients.values()],
            "updated_at": datetime.now().isoformat(),
        }
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _make_coefficient_key(self, a: str, b: str, mechanism: str) -> str:
        """生成系数唯一键（排序确保一致性）"""
        pair = tuple(sorted([a.lower(), b.lower()]))
        return f"{pair[0]}::{pair[1]}::{mechanism}"

    def get_coefficient(
        self,
        ingredient_a: str,
        ingredient_b: str,
        mechanism: str,
        default: Optional[float] = None,
    ) -> Optional[float]:
        """
        查询协同系数

        Args:
            ingredient_a: 成分 A 名称
            ingredient_b: 成分 B 名称
            mechanism: 机制类型
            default: 未找到时的默认值

        Returns:
            协同系数值，或 default
        """
        key = self._make_coefficient_key(ingredient_a, ingredient_b, mechanism)
        coeff = self._coefficients.get(key)
        if coeff:
            return coeff.coefficient
        return default

    # ── 版本管理 ──

    def _load_version_history(self) -> None:
        """加载版本历史"""
        path = self._get_versions_path()
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self._version_history = [
                    VersionRecord(**item) for item in data.get("versions", [])
                ]
            except Exception as e:
                logger.error(f"加载版本历史失败: {e}")

    def _save_version_history(self) -> None:
        """保存版本历史"""
        path = self._get_versions_path()
        data = {
            "versions": [asdict(v) for v in self._version_history],
        }
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def get_version_history(self) -> List[Dict[str, Any]]:
        """
        获取版本变更历史

        Returns:
            版本记录列表
        """
        return [asdict(v) for v in self._version_history]

    # ================================================================
    # MECHANISM-1: 药效增强协同 (Bliss Independence 模型)
    # ================================================================

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
            raise ValueError(f"bioavailability_base 必须在 [0, 1] 范围内")

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

    # ================================================================
    # MECHANISM-4: 靶点通路协同 (网络药理学模型)
    # ================================================================

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
                        except Exception:
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
        from math import comb

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

    # ================================================================
    # UNIFIED INTERFACE: analyze_synergy()
    # ================================================================

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

    # ================================================================
    # DYNAMIC UPDATE API: import_research_data()
    # ================================================================

    # JSON Schema 定义
    RESEARCH_DATA_SCHEMA = {
        "type": "object",
        "required": ["data_source", "coefficients"],
        "properties": {
            "data_source": {
                "type": "string",
                "description": "数据来源标识",
            },
            "research_paper": {
                "type": "string",
                "description": "参考文献（可选）",
            },
            "coefficients": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": [
                        "ingredient_a",
                        "ingredient_b",
                        "mechanism",
                        "coefficient",
                        "confidence",
                    ],
                    "properties": {
                        "ingredient_a": {"type": "string"},
                        "ingredient_b": {"type": "string"},
                        "mechanism": {
                            "type": "string",
                            "enum": [
                                "bliss_independence",
                                "pk_interaction",
                                "gibbs_stability",
                                "network_pharmacology",
                                "taste_matrix",
                                "ki_value",
                                "gamma_interaction",
                            ],
                        },
                        "coefficient": {"type": "number"},
                        "confidence": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                        },
                        "notes": {"type": "string"},
                    },
                },
            },
        },
    }

    def import_research_data(
        self,
        data: Dict[str, Any],
        validate_schema: bool = True,
    ) -> Dict[str, Any]:
        """
        导入研究数据以更新协同系数库

        功能:
        1. JSON Schema 验证输入数据格式
        2. 批量导入新的协同系数
        3. 版本管理: 记录时间戳、来源、变更内容
        4. 变更日志查询功能

        Args:
            data: 研究数据字典，符合 JSON Schema
            validate_schema: 是否验证 Schema

        Returns:
            导入结果报告 {
                "success": bool,
                "version": int,
                "imported_count": int,
                "updated_count": int,
                "errors": list,
                "warnings": list,
            }

        Raises:
            ValueError: 数据验证失败
            TypeError: 数据格式错误

        Example:
            >>> engine = SynergyEngine()
            >>> result = engine.import_research_data({
            ...     "data_source": "literature_review_2024",
            ...     "research_paper": "Zhang et al., Food Chem, 2024",
            ...     "coefficients": [
            ...         {
            ...             "ingredient_a": "黄芪",
            ...             "ingredient_b": "大豆肽",
            ...             "mechanism": "bliss_independence",
            ...             "coefficient": 0.85,
            ...             "confidence": 0.9,
            ...             "notes": "体外实验验证",
            ...         },
            ...     ],
            ... })
        """
        errors = []
        warnings = []
        imported_count = 0
        updated_count = 0

        # 1. Schema 验证
        if validate_schema and HAS_JSONSCHEMA:
            try:
                jsonschema.validate(data, self.RESEARCH_DATA_SCHEMA)
            except jsonschema.ValidationError as e:
                raise ValueError(f"JSON Schema 验证失败: {e.message}")
        elif validate_schema and not HAS_JSONSCHEMA:
            warnings.append("jsonschema 未安装，使用简化验证")
            self._simple_validate(data, errors, warnings)

        if errors:
            raise ValueError(f"数据验证错误: {errors}")

        # 2. 提取元信息
        data_source = data.get("data_source", "unknown")
        research_paper = data.get("research_paper", "")
        coefficients = data.get("coefficients", [])

        if not coefficients:
            raise ValueError("系数列表不能为空")

        # 3. 创建新版本
        new_version = self._current_version + 1
        now = datetime.now()

        # 4. 处理每个系数
        for coeff_data in coefficients:
            try:
                key = self._make_coefficient_key(
                    coeff_data["ingredient_a"],
                    coeff_data["ingredient_b"],
                    coeff_data["mechanism"],
                )

                # 检查是否已存在
                existing = self._coefficients.get(key)

                coefficient = SynergyCoefficient(
                    ingredient_a=coeff_data["ingredient_a"],
                    ingredient_b=coeff_data["ingredient_b"],
                    mechanism=coeff_data["mechanism"],
                    coefficient=float(coeff_data["coefficient"]),
                    source=data_source,
                    confidence=float(coeff_data["confidence"]),
                    version=new_version,
                    created_at=existing.created_at if existing else now,
                    updated_at=now,
                    notes=coeff_data.get("notes") or research_paper,
                )

                self._coefficients[key] = coefficient

                if existing:
                    updated_count += 1
                else:
                    imported_count += 1

            except Exception as e:
                errors.append(f"处理系数失败 {coeff_data}: {str(e)}")

        # 5. 更新版本号并保存
        self._current_version = new_version

        # 6. 创建版本记录
        version_record = VersionRecord(
            version=new_version,
            timestamp=now,
            source=data_source,
            changes_count=imported_count + updated_count,
            description=(
                f"导入 {imported_count} 个新系数，更新 {updated_count} 个现有系数"
            ),
            checksum=self._compute_checksum(coefficients),
        )
        self._version_history.append(version_record)

        # 7. 持久化存储
        self._save_coefficients()
        self._save_version_history()

        result = {
            "success": len(errors) == 0,
            "version": new_version,
            "imported_count": imported_count,
            "updated_count": updated_count,
            "errors": errors,
            "warnings": warnings,
            "timestamp": now.isoformat(),
        }

        logger.info(
            f"研究数据导入完成: v{new_version}, "
            f"新增={imported_count}, 更新={updated_count}, 来源={data_source}"
        )

        return result

    def _simple_validate(
        self,
        data: Dict[str, Any],
        errors: List[str],
        warnings: List[str],
    ) -> None:
        """简化的数据验证（当 jsonschema 不可用时）"""
        if "data_source" not in data:
            errors.append("缺少 data_source 字段")
        if "coefficients" not in data or not isinstance(data["coefficients"], list):
            errors.append("缺少或无效的 coefficients 字段")
            return

        required_fields = [
            "ingredient_a", "ingredient_b",
            "mechanism", "coefficient", "confidence",
        ]
        valid_mechanisms = {
            "bliss_independence", "pk_interaction",
            "gibbs_stability", "network_pharmacology",
            "taste_matrix", "ki_value", "gamma_interaction",
        }

        for i, coeff in enumerate(data["coefficients"]):
            for field in required_fields:
                if field not in coeff:
                    errors.append(f"系数 #{i+1} 缺少 {field} 字段")

            if "mechanism" in coeff and coeff["mechanism"] not in valid_mechanisms:
                warnings.append(f"系数 #{i+1} 未知的机制类型: {coeff['mechanism']}")

            if "confidence" in coeff and not (0 <= coeff["confidence"] <= 1):
                errors.append(f"系数 #{i+1} confidence 不在 [0, 1] 范围内")

    def _compute_checksum(self, data: Any) -> str:
        """计算数据的校验和"""
        import hashlib
        data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(data_str.encode()).hexdigest()[:12]

    # ================================================================
    # UTILITY METHODS
    # ================================================================

    def get_statistics(self) -> Dict[str, Any]:
        """
        获取引擎统计信息

        Returns:
            统计信息字典
        """
        mechanism_counts: Dict[str, int] = {}
        for coeff in self._coefficients.values():
            mechanism_counts[coeff.mechanism] = mechanism_counts.get(coeff.mechanism, 0) + 1

        return {
            "total_coefficients": len(self._coefficients),
            "current_version": self._current_version,
            "versions_count": len(self._version_history),
            "mechanism_distribution": mechanism_counts,
            "has_scipy": HAS_SCIPY,
            "has_jsonschema": HAS_JSONSCHEMA,
        }

    def clear_all_data(self) -> None:
        """清除所有数据（仅用于测试）"""
        self._coefficients.clear()
        self._version_history.clear()
        self._current_version = 0
        self._save_coefficients()
        self._save_version_history()
        logger.warning("已清除所有协同系数数据")


# ============================================================
# Example Usage & Testing
# ============================================================

def example_usage():
    """示例用法演示"""

    print("=" * 70)
    print("SynergyEngine 示例用法演示")
    print("=" * 70)

    # 初始化引擎
    engine = SynergyEngine()

    # 示例 1: 单独调用各机制
    print("\n--- 示例 1: 单独调用各机制 ---\n")

    # 1.1 Bliss Independence
    bliss_result = engine.bliss_independence(
        efficacy_a=0.7,
        efficacy_b=0.6,
        alpha=0.8,
        ingredient_a="黄芪多糖",
        ingredient_b="大豆肽",
    )
    print(f"Bliss Independence: {bliss_result.score:.4f} (置信度: {bliss_result.confidence:.2f})")
    print(f"  详情: {bliss_result.details}")
    print(f"  参数: {bliss_result.parameters}")

    # 1.2 PK Interaction
    pk_result = engine.pk_interaction(
        auc_a=120.0,
        auc_b=95.0,
        auc_combination=250.0,
        bioavailability_base=0.85,
        inhibitor_concentration=10.0,
        ki_value=5.0,
        first_pass_effect=0.15,
        ingredient_a="姜黄素",
        ingredient_b="胡椒碱",
    )
    print(f"\nPK Interaction: {pk_result.score:.4f} (置信度: {pk_result.confidence:.2f})")
    print(f"  详情: {pk_result.details}")
    print(f"  类型: {pk_result.parameters['pk_type']}")

    # 1.3 Gibbs Stability
    gibbs_result = engine.gibbs_stability(
        delta_h=-25.0,
        delta_s=60.0,
        interaction_terms=[-5.0, -3.0, -2.0],
        temperature=310.0,
        ph=7.0,
        pka_values=[4.5, 8.0],
        ingredient_a="乳清蛋白",
        ingredient_b="胶原蛋白肽",
    )
    print(f"\nGibbs Stability: {gibbs_result.score:.4f} (置信度: {gibbs_result.confidence:.2f})")
    print(f"  详情: {gibbs_result.details}")
    print(f"  等级: {gibbs_result.parameters['stability_level']}")
    print(f"  ΔG: {gibbs_result.parameters['delta_g_final']:.2f} kJ/mol")

    # 1.4 Network Pharmacology
    network_result = engine.network_pharmacology(
        targets_a=["EGFR", "VEGF", "TNF", "IL6", "NFkB", "AKT1"],
        targets_b=["EGFR", "IL6", "NFkB", "MAPK1", "TP53", "CASP3"],
        pathways_database={
            "PI3K-Akt signaling pathway": ["EGFR", "AKT1", "VEGF"],
            "NF-kappa B signaling pathway": ["TNF", "IL6", "NFkB", "NFKBIA"],
            "MAPK signaling pathway": ["MAPK1", "EGFR", "TNF"],
            "Apoptosis": ["CASP3", "TP53", "NFkB"],
        },
        total_pathways=500,
        ingredient_a="人参皂苷",
        ingredient_b="灵芝多糖",
    )
    print(f"\nNetwork Pharmacology: {network_result.score:.4f} (置信度: {network_result.confidence:.2f})")
    print(f"  详情: {network_result.details}")
    print(f"  Jaccard: {network_result.parameters['jaccard_coefficient']:.4f}")
    print(f"  共同靶点: {network_result.parameters['intersect_count']}")

    # 1.5 Taste Matrix
    taste_result = engine.taste_matrix(
        taste_profile_a={
            TasteType.BITTER: 0.4,
            TasteType.UMAMI: 0.3,
            TasteType.ASTRINGENT: 0.2,
        },
        taste_profile_b={
            TasteType.BITTER: 0.3,
            TasteType.SWEET: 0.5,
            TasteType.UMAMI: 0.4,
        },
        ingredient_a="绿茶提取物",
        ingredient_b="罗汉果甜苷",
    )
    print(f"\nTaste Matrix: {taste_result.score:.4f} (置信度: {taste_result.confidence:.2f})")
    print(f"  详情: {taste_result.details}")
    print(f"  等级: {taste_result.parameters['quality_level']}")

    # 示例 2: 统一接口
    print("\n" + "=" * 70)
    print("--- 示例 2: 统一接口 analyze_synergy() ---")
    print("=" * 70 + "\n")

    report = engine.analyze_synergy(
        ingredient_a="黄芪多糖",
        ingredient_b="大豆肽",
        context={
            "bliss": {
                "efficacy_a": 0.75,
                "efficacy_b": 0.65,
                "alpha": 0.7,
            },
            "pk": {
                "auc_a": 110.0,
                "auc_b": 90.0,
                "auc_combination": 230.0,
                "bioavailability_base": 0.88,
                "first_pass_effect": 0.1,
            },
            "gibbs": {
                "delta_h": -20.0,
                "delta_s": 55.0,
                "interaction_terms": [-4.0, -2.5],
                "temperature": 310.0,
                "ph": 7.2,
            },
            "network": {
                "targets_a": ["EGFR", "VEGF", "TNF", "IL6"],
                "targets_b": ["EGFR", "IL6", "NFkB", "AKT1", "MTOR"],
                "pathways_database": {
                    "PI3K-Akt signaling": ["EGFR", "AKT1", "MTOR", "VEGF"],
                    "Inflammatory response": ["TNF", "IL6", "NFkB"],
                },
            },
            "taste": {
                "taste_profile_a": {
                    "bitter": 0.35,
                    "umami": 0.25,
                },
                "taste_profile_b": {
                    "bitter": 0.25,
                    "sweet": 0.4,
                    "umami": 0.35,
                },
            },
        },
    )

    print(f"\n{'='*50}")
    print(f"协同分析报告: {report.ingredient_pair[0]} + {report.ingredient_pair[1]}")
    print(f"{'='*50}")
    print(f"综合协同指数 (SI): {report.overall_si:.4f}")
    print(f"主导机制: {report.dominant_mechanism.value if report.dominant_mechanism else 'None'}")
    print(f"\n各机制得分:")
    for mech in report.mechanisms:
        status = "✓" if mech.confidence > 0 else "✗"
        print(f"  [{status}] {mech.mechanism_type.value:25s}: {mech.score:.4f} (置信度: {mech.confidence:.2f})")
        if mech.details:
            print(f"       {mech.details}")

    # 示例 3: 动态更新 API
    print("\n" + "=" * 70)
    print("--- 示例 3: 动态更新 API ---")
    print("=" * 70 + "\n")

    import_result = engine.import_research_data({
        "data_source": "test_literature",
        "research_paper": "Test Paper et al., 2024",
        "coefficients": [
            {
                "ingredient_a": "黄芪",
                "ingredient_b": "大豆肽",
                "mechanism": "bliss_independence",
                "coefficient": 0.72,
                "confidence": 0.85,
                "notes": "测试数据",
            },
            {
                "ingredient_a": "黄芪",
                "ingredient_b": "大豆肽",
                "mechanism": "ki_value",
                "coefficient": 8.5,
                "confidence": 0.78,
            },
        ],
    })

    print(f"导入成功: {import_result['success']}")
    print(f"新版本: v{import_result['version']}")
    print(f"新增系数: {import_result['imported_count']}")
    print(f"更新系数: {import_result['updated_count']}")

    # 查询新导入的系数
    alpha_new = engine.get_coefficient("黄芪", "大豆肽", "bliss_independence")
    print(f"\n查询新系数: 黄豆-大豆肽 (bliss) = {alpha_new}")

    # 版本历史
    print(f"\n版本历史:")
    history = engine.get_version_history()
    for ver in history[-3:]:
        print(f"  v{ver['version']}: {ver['source']} - {ver['changes_count']} 条变更")

    # 统计信息
    stats = engine.get_statistics()
    print(f"\n引擎统计:")
    print(f"  总系数数量: {stats['total_coefficients']}")
    print(f"  当前版本: v{stats['current_version']}")
    print(f"  SciPy 可用: {stats['has_scipy']}")
    print(f"  JSONSchema 可用: {stats['has_jsonschema']}")

    print("\n" + "=" * 70)
    print("示例演示完成!")
    print("=" * 70)


if __name__ == "__main__":
    example_usage()
