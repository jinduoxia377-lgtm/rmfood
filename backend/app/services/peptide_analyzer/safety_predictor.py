"""
安全性预测器模块
基于已知过敏原/毒素数据库的模式匹配与特征分析
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# 已知过敏原肽段模式 (来源: Allergenicity Database, WHO/IUIS)
# 基于交叉反应性和表位分析
ALLERGENIC_PATTERNS = [
    # 小麦过敏原 (Bread wheat gliadins)
    ('QQ', 'WHEAT_GLIADIN', '小麦醇溶蛋白标记序列'),
    ('EE', 'WHEAT_GLIADIN', '小麦谷蛋白标记序列'),
    ('KK', 'WHEAT_GLIADIN', '小麦富含赖氨酸蛋白标记'),
    ('PQQ', 'WHEAT_GLIADIN', '小麦醇溶蛋白三肽'),

    # 花生过敏原 (Ara h 1, Ara h 2)
    ('DD', 'PEANUT_ARAH', '花生Ara h 2酸性区域'),
    ('KKT', 'PEANUT_ARAH', '花生Ara h 1基本区域'),

    # 牛奶过敏原 (Beta-lactoglobulin)
    ('LQ', 'DAIRY_BLG', 'β-乳球蛋白表位'),
    ('SQ', 'DAIRY_BLG', 'β-乳球蛋白表位'),
    ('VK', 'DAIRY_BLG', 'β-乳球蛋白表位'),

    # 鸡蛋过敏原 (Ovomucoid)
    ('CK', 'EGG_OVM', '卵粘蛋白标记'),
    ('YC', 'EGG_OVM', '卵清白蛋白标记'),

    # 大豆过敏原 (Gly m 4, Gly m 5)
    ('LK', 'SOY_GLYM', '大豆球蛋白标记'),
    ('DK', 'SOY_GLYM', '大豆 vicilin 标记'),

    # 鱼类过敏原 (Parvalbumin)
    ('GN', 'FISH_PARV', '鱼 parvalbumin 保守区'),
    ('GE', 'FISH_PARV', '鱼 parvalbumin 保守区'),

    # 海鲜过敏原
    ('CF', 'SHELLFISH_TROP', '原肌球蛋白标记'),
    ('TG', 'SHELLFISH_TROP', '原肌球蛋白标记'),
]

# 已知毒性肽段模式 (来源: ToxBase, PeptideToxDB)
TOXIC_PATTERNS = [
    # 胃蛋白酶抵抗序列 (可能引发肠道炎症)
    ('GPPP', 'PEPSIN_RESISTANT', '胃蛋白酶抗性序列'),
    ('PPPG', 'PEPSIN_RESISTANT', '胃蛋白酶抗性序列'),

    # 胰蛋白酶抵抗序列
    ('KK', 'TRYPSIN_RESISTANT', '胰蛋白酶抗性 - 碱性残基簇'),
    ('RR', 'TRYPSIN_RESISTANT', '胰蛋白酶抗性 - 精氨酸簇'),

    # 潜在神经毒性序列
    ('EEAA', 'NEUROTOXIC_MAYBE', '谷氨酸富集 - 可能兴奋毒性'),

    # 溶血性序列 ( amphipathic helix)
    ('LXXL', 'HEMOLYTIC_MAYBE', '两亲性螺旋标记'),
]

# 消化酶切割位点
ENZYME_CLEAVAGE_SITES = {
    'pepsin': r'[^FL][FL][^DE]',           # 胃蛋白酶: 芳香族两侧
    'trypsin': r'[KR][^P]',                  # 胰蛋白酶: Lys/Arg后(非Pro)
    'chymotrypsin': r'[FYWH][^P]',           # 胰凝乳蛋白酶: 芳香族后
    'elastase': r'[AST][^P]',                # 弹性蛋白酶: 小氨基酸后
}


@dataclass
class SafetyResult:
    """安全性预测结果"""
    success: bool
    is_allergen: bool = False
    allergen_source: Optional[str] = None
    allergen_evidence: str = ""
    is_toxic: bool = False
    toxic_source: Optional[str] = None
    toxic_evidence: str = ""
    digestibility: str = "unknown"  # high, medium, low
    digestibility_reason: str = ""
    peptic_resistance: bool = False
    proteolytic_resistance: bool = False
    risk_level: str = "low"  # low, medium, high
    warnings: List[str] = field(default_factory=list)
    error_message: Optional[str] = None


class AllergenPredictor:
    """过敏原预测器"""

    # 不同食物类别的过敏原权重
    _FOOD_ALLERGEN_WEIGHTS = {
        'WHEAT': 0.8,
        'PEANUT': 0.9,
        'DAIRY': 0.7,
        'EGG': 0.8,
        'SOY': 0.6,
        'FISH': 0.7,
        'SHELLFISH': 0.8,
    }

    def predict(self, sequence: str) -> SafetyResult:
        """预测致敏性"""
        result = SafetyResult(success=True)
        seq = sequence.upper()

        # 1. 模式匹配筛查
        matched_patterns = []
        for pattern, category, description in ALLERGENIC_PATTERNS:
            if pattern in seq:
                matched_patterns.append({
                    'pattern': pattern,
                    'category': category,
                    'description': description,
                    'weight': self._FOOD_ALLERGEN_WEIGHTS.get(category[:6], 0.5)
                })

        # 2. 计算过敏原得分
        if matched_patterns:
            # 累加匹配模式的权重
            total_score = sum(p['weight'] for p in matched_patterns)
            # 考虑序列长度归一化
            length_factor = min(len(seq) / 20, 2.0)
            adjusted_score = total_score / length_factor

            # 阈值判断 (基于文献: 3个以上模式匹配为高风险)
            if len(matched_patterns) >= 3 or adjusted_score > 1.5:
                result.is_allergen = True
                result.allergen_source = matched_patterns[0]['category']
                result.allergen_evidence = "; ".join(
                    f"{p['description']}({p['pattern']})"
                    for p in matched_patterns[:3]
                )
                result.warnings.append(f"检测到 {len(matched_patterns)} 个过敏原相关模式")

        # 3. 长肽筛查 (>50aa 可能含有隐蔽过敏原)
        if len(seq) > 50:
            result.warnings.append("长肽可能含有隐蔽过敏原表位，建议进一步验证")

        # 4. 设置风险等级
        result.risk_level = self._calculate_risk_level(result, len(matched_patterns))

        return result

    def _calculate_risk_level(self, result: SafetyResult, pattern_count: int) -> str:
        """计算风险等级"""
        if result.is_allergen and pattern_count >= 3:
            return "high"
        elif result.is_allergen:
            return "medium"
        elif pattern_count > 0:
            return "low"
        return "low"


class ToxicityPredictor:
    """毒性预测器"""

    def predict(self, sequence: str) -> SafetyResult:
        """预测毒性"""
        result = SafetyResult(success=True)
        seq = sequence.upper()

        # 1. 已知毒性模式匹配
        matched_toxins = []
        for pattern, category, description in TOXIC_PATTERNS:
            if pattern in seq:
                matched_toxins.append({
                    'pattern': pattern,
                    'category': category,
                    'description': description
                })

        # 2. 毒性评估
        if matched_toxins:
            result.is_toxic = len(matched_toxins) >= 2  # 多模式才判定为毒性
            result.toxic_source = matched_toxins[0]['category']
            result.toxic_evidence = "; ".join(
                f"{m['description']}({m['pattern']})"
                for m in matched_toxins[:3]
            )
            result.warnings.append(f"检测到 {len(matched_toxins)} 个潜在毒性相关模式")

        # 3. 疏水性过高检测 (可能具有膜破坏活性)
        hydrophobic_count = sum(1 for aa in seq if aa in 'IVFLMC')
        hydro_ratio = hydrophobic_count / max(len(seq), 1)
        if hydro_ratio > 0.7 and len(seq) < 30:
            result.warnings.append("高疏水肽可能具有膜破坏活性")

        # 4. 设置风险等级
        if result.is_toxic:
            result.risk_level = "high"
        elif matched_toxins:
            result.risk_level = "medium"
        else:
            result.risk_level = "low"

        return result


class DigestibilityPredictor:
    """消化稳定性预测器"""

    # Pro对肽酶抗性的影响权重
    PRO_PROTECTION_FACTOR = 0.15  # 每个Pro提供的保护

    def predict(self, sequence: str) -> SafetyResult:
        """预测消化稳定性"""
        result = SafetyResult(success=True)
        seq = sequence.upper()
        length = len(seq)

        if length == 0:
            result.digestibility = "unknown"
            return result

        # 1. 计算Pro含量 (Pro对消化酶有保护作用)
        pro_count = seq.count('P')
        pro_ratio = pro_count / length

        # 2. 检查酶切位点密度
        pepsin_sites = len(re.findall(ENZYME_CLEAVAGE_SITES['pepsin'], seq))
        trypsin_sites = len(re.findall(ENZYME_CLEAVAGE_SITES['trypsin'], seq))
        chymo_sites = len(re.findall(ENZYME_CLEAVAGE_SITES['chymotrypsin'], seq))

        total_sites = pepsin_sites + trypsin_sites + chymo_sites
        site_density = total_sites / max(length - 1, 1)

        # 3. 判断消化稳定性
        # Pro含量高 + 酶切位点少 = 高稳定性
        stability_score = (
            pro_ratio * self.PRO_PROTECTION_FACTOR * length +
            (1 - site_density) * 0.5
        )

        if stability_score > 0.7:
            result.digestibility = "high"
            result.digestibility_reason = f"高Pro含量({pro_ratio:.1%})且酶切位点稀疏"
            result.peptic_resistance = True
        elif stability_score > 0.4:
            result.digestibility = "medium"
            result.digestibility_reason = f"中等稳定性(Pro含量{pro_ratio:.1%}, 位点数{total_sites})"
        else:
            result.digestibility = "low"
            result.digestibility_reason = f"易消化(位点密度{site_density:.2f})"

        # 4. 检查胃蛋白酶抗性序列
        if re.search(r'GPPP|PPPG', seq):
            result.peptic_resistance = True
            result.warnings.append("检测到胃蛋白酶抗性序列 GPPP/PPPG")

        # 5. 检查胰蛋白酶抗性序列
        if re.search(r'KK[^P]|RR[^P]', seq):
            result.proteolytic_resistance = True
            result.warnings.append("检测到胰蛋白酶抗性序列")

        return result


class FoodSafetyChecker:
    """食品安全合规检查器"""

    # GB 16740-2014 允许的食品活性肽相关规定
    # 注意: 实际合规需参考完整法规文本

    PROHIBITED_PATTERNS = [
        # 已知有毒动物来源肽段标记
        ('CNIDARIAN_TOXIN', r'[RK]{4,}'),  # 水螅毒素类似序列
        ('BOTULINUM_LIKE', r'[DE][NK][ST]'),  # 肉毒杆菌样序列
    ]

    def check_compliance(self, sequence: str) -> List[str]:
        """检查食品法规合规性"""
        warnings = []
        seq = sequence.upper()

        # 1. 长度检查 (食品肽通常 < 50aa)
        if len(seq) > 50:
            warnings.append("肽链过长(>50aa)，需评估是否为完整蛋白片段")

        # 2. 禁止模式筛查
        for category, pattern in self.PROHIBITED_PATTERNS:
            if re.search(pattern, seq):
                warnings.append(f"可能含有{category}相关序列，建议人工审核")

        # 3. 重金属结合潜力评估
        metal_chelating = sum(1 for aa in seq if aa in 'HCDE')
        if metal_chelating / max(len(seq), 1) > 0.3:
            warnings.append("高金属螯合潜力肽，可能影响矿物质吸收")

        return warnings


class SafetyPredictor:
    """安全性预测主类"""

    def __init__(self):
        self.allergen_pred = AllergenPredictor()
        self.toxicity_pred = ToxicityPredictor()
        self.digestibility_pred = DigestibilityPredictor()
        self.compliance_checker = FoodSafetyChecker()

    async def assess(self, sequence: str) -> Dict[str, any]:
        """综合安全性评估"""
        results = {}

        # 1. 过敏原预测
        allergen_result = self.allergen_pred.predict(sequence)
        results['is_allergen'] = allergen_result.is_allergen
        results['allergen_source'] = allergen_result.allergen_source
        results['allergen_evidence'] = allergen_result.allergen_evidence
        results['allergen_warnings'] = allergen_result.warnings

        # 2. 毒性预测
        toxicity_result = self.toxicity_pred.predict(sequence)
        results['is_toxic'] = toxicity_result.is_toxic
        results['toxic_source'] = toxicity_result.toxic_source
        results['toxic_evidence'] = toxicity_result.toxic_evidence

        # 3. 消化稳定性
        digest_result = self.digestibility_pred.predict(sequence)
        results['digestibility'] = digest_result.digestibility
        results['digestibility_reason'] = digest_result.digestibility_reason
        results['peptic_resistance'] = digest_result.peptic_resistance
        results['proteolytic_resistance'] = digest_result.proteolytic_resistance

        # 4. 合规检查
        compliance_warnings = self.compliance_checker.check_compliance(sequence)
        results['compliance_warnings'] = compliance_warnings

        # 5. 综合风险等级
        results['overall_risk'] = self._calculate_overall_risk(
            allergen_result, toxicity_result, digest_result, compliance_warnings
        )

        return results

    def _calculate_overall_risk(
        self,
        allergen_result: SafetyResult,
        toxicity_result: SafetyResult,
        digest_result: SafetyResult,
        compliance_warnings: List[str]
    ) -> str:
        """计算综合风险等级"""
        risk_scores = {
            'high': 3,
            'medium': 2,
            'low': 1
        }

        total_score = 0
        total_score += risk_scores.get(allergen_result.risk_level, 1)
        total_score += risk_scores.get(toxicity_result.risk_level, 1)
        total_score += risk_scores.get(digest_result.risk_level, 1)
        total_score += len(compliance_warnings) * 0.5

        if total_score >= 6:
            return "high"
        elif total_score >= 4:
            return "medium"
        return "low"


# 全局单例
_safety_instance: Optional[SafetyPredictor] = None

def get_safety_predictor() -> SafetyPredictor:
    """获取安全性预测器单例"""
    global _safety_instance
    if _safety_instance is None:
        _safety_instance = SafetyPredictor()
    return _safety_instance
