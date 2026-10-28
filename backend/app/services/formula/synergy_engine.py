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
import os
from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from .synergy_analysis import SynergyAnalysisMixin
from .synergy_calculators_1 import SynergyCalculatorMixin1
from .synergy_calculators_2 import SynergyCalculatorMixin2
from .synergy_data import SynergyDataMixin

# Re-export all public symbols for backward compatibility
from .synergy_models import (  # noqa: F401
    MechanismType,
    SynergyCoefficient,
    SynergyReport,
    SynergyScore,
    SyngineConfig,
    TasteType,
    VersionRecord,
)

logger = logging.getLogger(__name__)


# ============================================================
# Main Engine Class
# ============================================================

class SynergyEngine(
    SynergyCalculatorMixin1,
    SynergyCalculatorMixin2,
    SynergyAnalysisMixin,
    SynergyDataMixin,
):
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



# ============================================================
# Example Usage & Testing
# ============================================================

def example_usage():
    """示例用法演示"""

    logger.info("=" * 70)
    logger.info("SynergyEngine 示例用法演示")
    logger.info("=" * 70)
    # 初始化引擎
    engine = SynergyEngine()

    # 示例 1: 单独调用各机制
    logger.info("\n--- 示例 1: 单独调用各机制 ---\n")
    # 1.1 Bliss Independence
    bliss_result = engine.bliss_independence(
        efficacy_a=0.7,
        efficacy_b=0.6,
        alpha=0.8,
        ingredient_a="黄芪多糖",
        ingredient_b="大豆肽",
    )
    logger.info(f"Bliss Independence: {bliss_result.score:.4f} (置信度: {bliss_result.confidence:.2f})")
    logger.info(f"  详情: {bliss_result.details}")
    logger.info(f"  参数: {bliss_result.parameters}")
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
    logger.info(f"\nPK Interaction: {pk_result.score:.4f} (置信度: {pk_result.confidence:.2f})")
    logger.info(f"  详情: {pk_result.details}")
    logger.info(f"  类型: {pk_result.parameters['pk_type']}")
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
    logger.info(f"\nGibbs Stability: {gibbs_result.score:.4f} (置信度: {gibbs_result.confidence:.2f})")
    logger.info(f"  详情: {gibbs_result.details}")
    logger.info(f"  等级: {gibbs_result.parameters['stability_level']}")
    logger.info(f"  ΔG: {gibbs_result.parameters['delta_g_final']:.2f} kJ/mol")
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
    logger.info(f"\nNetwork Pharmacology: {network_result.score:.4f} (置信度: {network_result.confidence:.2f})")
    logger.info(f"  详情: {network_result.details}")
    logger.info(f"  Jaccard: {network_result.parameters['jaccard_coefficient']:.4f}")
    logger.info(f"  共同靶点: {network_result.parameters['intersect_count']}")
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
    logger.info(f"\nTaste Matrix: {taste_result.score:.4f} (置信度: {taste_result.confidence:.2f})")
    logger.info(f"  详情: {taste_result.details}")
    logger.info(f"  等级: {taste_result.parameters['quality_level']}")
    # 示例 2: 统一接口
    logger.info("\n" + "=" * 70)
    logger.info("--- 示例 2: 统一接口 analyze_synergy() ---")
    logger.info("=" * 70 + "\n")
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

    logger.info(f"\n{'='*50}")
    logger.info(f"协同分析报告: {report.ingredient_pair[0]} + {report.ingredient_pair[1]}")
    logger.info(f"{'='*50}")
    logger.info(f"综合协同指数 (SI): {report.overall_si:.4f}")
    logger.info(f"主导机制: {report.dominant_mechanism.value if report.dominant_mechanism else 'None'}")
    logger.info("\n各机制得分:")
    for mech in report.mechanisms:
        status = "✓" if mech.confidence > 0 else "✗"
        logger.info(f"  [{status}] {mech.mechanism_type.value:25s}: {mech.score:.4f} (置信度: {mech.confidence:.2f})")
        if mech.details:
            logger.info(f"       {mech.details}")
    # 示例 3: 动态更新 API
    logger.info("\n" + "=" * 70)
    logger.info("--- 示例 3: 动态更新 API ---")
    logger.info("=" * 70 + "\n")
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

    logger.info(f"导入成功: {import_result['success']}")
    logger.info(f"新版本: v{import_result['version']}")
    logger.info(f"新增系数: {import_result['imported_count']}")
    logger.info(f"更新系数: {import_result['updated_count']}")
    # 查询新导入的系数
    alpha_new = engine.get_coefficient("黄芪", "大豆肽", "bliss_independence")
    logger.info(f"\n查询新系数: 黄豆-大豆肽 (bliss) = {alpha_new}")
    # 版本历史
    logger.info("\n版本历史:")
    history = engine.get_version_history()
    for ver in history[-3:]:
        logger.info(f"  v{ver['version']}: {ver['source']} - {ver['changes_count']} 条变更")
    # 统计信息
    stats = engine.get_statistics()
    logger.info("\n引擎统计:")
    logger.info(f"  总系数数量: {stats['total_coefficients']}")
    logger.info(f"  当前版本: v{stats['current_version']}")
    logger.info(f"  SciPy 可用: {stats['has_scipy']}")
    logger.info(f"  JSONSchema 可用: {stats['has_jsonschema']}")
    logger.info("\n" + "=" * 70)
    logger.info("示例演示完成!")
    logger.info("=" * 70)
if __name__ == "__main__":
    example_usage()
