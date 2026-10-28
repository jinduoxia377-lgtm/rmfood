"""
SynergyEngine 数据模块

定义协同作用引擎的枚举、数据类和配置参数:
- MechanismType: 协同作用机制类型
- TasteType: 味觉类型
- SynergyScore: 单个机制的协同得分
- SynergyReport: 协同作用分析报告
- SynergyCoefficient: 协同系数记录
- VersionRecord: 版本管理记录
- SyngineConfig: 引擎配置参数
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


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

