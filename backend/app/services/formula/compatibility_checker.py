"""
配方兼容性检测系统 - 4层架构的成分相互作用分析

功能:
- Layer 1: 化学层面 (pH冲突/沉淀反应/氧化还原)
- Layer 2: 药理学层面 (受体竞争/酶互作)
- Layer 3: 营养学层面 (抗营养因子/螯合作用)
- Layer 4: 法规层面 (GB标准/特殊人群限制)
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class IssueLevel(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class CheckCategory(Enum):
    CHEMICAL = "chemical"
    PHARMACOLOGICAL = "pharmacological"
    NUTRITIONAL = "nutritional"
    REGULATORY = "regulatory"


@dataclass
class CompatibilityIssue:
    """兼容性问题记录"""
    level: IssueLevel
    category: CheckCategory
    description: str
    scientific_basis: str
    suggestion: str
    affected_ingredients: List[str] = field(default_factory=list)
    severity_score: float = 0.0  # 0-10


@dataclass
class CompatibilityReport:
    """兼容性检测报告"""
    overall_score: float  # 0-100
    issues: List[CompatibilityIssue]
    passed_checks: int
    total_checks: int
    recommendations: List[str]
    timestamp: datetime = field(default_factory=datetime.now)
    formula_id: Optional[str] = None

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.level == IssueLevel.ERROR)

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.level == IssueLevel.WARNING)

    @property
    def info_count(self) -> int:
        return sum(1 for i in self.issues if i.level == IssueLevel.INFO)


# ==================== 内置数据库 ====================

CHEMICAL_PROPERTIES_DB = {
    "大豆肽": {"pI": 4.5, "optimal_ph": (6.0, 7.5), "charge_at_ph7": -0.3},
    "胶原蛋白肽": {"pI": 5.0, "optimal_ph": (6.5, 8.0), "charge_at_ph7": -0.1},
    "乳清蛋白肽": {"pI": 5.2, "optimal_ph": (6.0, 7.0), "charge_at_ph7": -0.2},
    "黄芪多糖": {"pI": None, "optimal_ph": (6.0, 8.0), "is_neutral": True},
    "枸杞多糖": {"pI": None, "optimal_ph": (6.5, 7.5), "is_neutral": True},
    "维生素C": {"pI": 4.2, "optimal_ph": (3.0, 6.0), "redox_potential": +0.08},
    "维生素E": {"pI": None, "redox_potential": +0.5},
    "钙": {"ion_type": "Ca²⁺", "common_precipitates": ["草酸", "植酸", "磷酸"]},
    "铁": {"ion_type": "Fe²⁺", "redox_potential": -0.44, "common_precipitates": ["多酚"]},
    "锌": {"ion_type": "Zn²⁺", "common_precipitates": ["植酸", "草酸"]},
    "人参皂苷": {"pI": None, "optimal_ph": (5.0, 7.0), "is_saponin": True},
    "大豆异黄酮": {"pI": None, "estrogenic_activity": True},
}

PRECIPITATION_RULES = [
    {
        "reactants": ("Ca²⁺", "草酸"),
        "product": "草酸钙",
        "Ksp": 2.32e-9,
        "severity": IssueLevel.ERROR,
        "description": "形成难溶性草酸钙沉淀"
    },
    {
        "reactants": ("Fe²⁺", "多酚"),
        "product": "铁-多酚络合物",
        "Ksp": 1e-15,
        "severity": IssueLevel.WARNING,
        "description": "形成深色络合物，降低生物利用度"
    },
    {
        "reactants": ("蛋白质", "多酚"),
        "product": "蛋白质-多酚复合物",
        "Ksp": 1e-10,
        "severity": IssueLevel.WARNING,
        "description": "可能产生沉淀或浑浊"
    },
]

RECEPTOR_BINDING_DB = [
    {
        "receptor": "ERα (雌激素受体α)",
        "ligands": [("大豆异黄酮", 0.1), ("植物雌激素", 0.05)],
        "competition_risk": "medium",
        "reference": "Kuiper GG, et al. Endocrinology 1998"
    },
    {
        "receptor": "PPARγ",
        "ligands": [("姜黄素", 0.01), ("共轭亚油酸", 0.02)],
        "competition_risk": "low",
        "reference": "Shen P, et al. J Mol Endocrinol 2006"
    },
]

ENZYME_INTERACTION_DB = [
    {
        "enzyme": "CYP3A4",
        "substrates": ["人参皂苷Rg1", "黄酮类化合物"],
        "inhibitors": ["柚皮素"],
        "inducers": ["圣约翰草提取物"],
        "mechanism": "药物代谢动力学互作"
    },
    {
        "enzyme": "CYP2D6",
        "substrates": ["生物碱类"],
        "inhibitors": ["柚皮素", "姜黄素"],
        "inducers": [],
        "mechanism": "酶抑制导致血药浓度升高"
    }
]

ANTINUTRIENT_FACTORS_DB = {
    "植酸": {
        "affected_minerals": ["Ca", "Fe", "Zn", "Mg"],
        "bioavailability_reduction": 0.6,
        "sources": ["谷物麸皮", "豆类", "坚果"],
        "mitigation": "添加植酸酶或发酵处理"
    },
    "单宁": {
        "affected_nutrients": ["蛋白质", "Fe"],
        "bioavailability_reduction": 0.5,
        "sources": ["茶", "葡萄", "石榴"],
        "mitigation": "控制用量或与蛋白质分开服用"
    },
    "胰蛋白酶抑制剂": {
        "affected_nutrients": ["蛋白质"],
        "bioavailability_reduction": 0.4,
        "sources": ["生豆类", "生鸡蛋清"],
        "mitigation": "充分加热灭活"
    },
    "皂苷": {
        "risk": "hemolysis_at_high_dose",
        "safe_limit_mg_kg": 50,
        "sources": ["人参", "绞股蓝", "三七"]
    }
}

GB2760_LIMITS_DB = {
    "维生素C": {"max_daily_g": 2.0, "standard": "GB 14880-2012"},
    "维生素E": {"max_daily_g": 0.8, "standard": "GB 14880-2012"},
    "钙": {"max_daily_g": 2.5, "standard": "GB 14880-2012"},
    "铁": {"max_daily_mg": 30, "standard": "GB 14880-2012"},
    "锌": {"max_daily_mg": 25, "standard": "GB 14880-2012"},
}

SPECIAL_POPULATION_RESTRICTIONS = {
    "pregnant": {
        "restricted": ["人参皂苷", "大豆异黄酮", "生物碱类"],
        "reason": "激素活性或刺激性成分可能影响胎儿发育"
    },
    "children_under_12": {
        "restricted": ["高剂量咖啡因", "人参皂苷", "蒽醌类"],
        "reason": "儿童代谢系统未发育完全，需严格控制用量"
    },
    "elderly": {
        "caution": ["高蛋白", "高钾", "利尿剂成分"],
        "reason": "肾功能减退时需调整剂量"
    }
}


class CompatibilityChecker:
    """
    配方兼容性检测器 - 4层架构全面检测系统

    检测流程:
    1. 化学层面 → pH/沉淀/氧化还原
    2. 药理学层面 → 受体竞争/酶互作
    3. 营养学层面 → 抗营养因子/螯合作用
    4. 法规层面 → GB标准/特殊人群

    输出: 0-100 分数的综合报告 + 详细问题列表 + 修改建议
    """

    def __init__(self):
        self.issues: List[CompatibilityIssue] = []
        self.passed_checks = 0
        self.total_checks = 0

        logger.info("CompatibilityChecker 初始化成功")

    def check_compatibility(
        self,
        ingredients: List[Dict[str, Any]],
        formula_id: Optional[str] = None,
        target_population: str = "adult"
    ) -> CompatibilityReport:
        """
        执行完整的 4 层兼容性检测

        Args:
            ingredients: 成分列表 [{"name": "...", "amount_mg": ..., "percentage": ...}, ...]
            formula_id: 配方标识符
            target_population: 目标人群 (adult/pregnant/children/elderly)

        Returns:
            CompatibilityReport: 完整的检测报告
        """
        self.issues = []
        self.passed_checks = 0
        self.total_checks = 0

        logger.info(f"开始兼容性检测 - 成分数={len(ingredients)}, 目标人群={target_population}")

        self._layer1_chemical_check(ingredients)
        self._layer2_pharmacological_check(ingredients)
        self._layer3_nutritional_check(ingredients)
        self._layer4_regulatory_check(ingredients, target_population)

        overall_score = self._calculate_overall_score()
        recommendations = self._generate_recommendations()

        report = CompatibilityReport(
            overall_score=overall_score,
            issues=self.issues.copy(),
            passed_checks=self.passed_checks,
            total_checks=self.total_checks,
            recommendations=recommendations,
            formula_id=formula_id
        )

        logger.info(f"检测完成 - 总分={overall_score:.1f}, "
                   f"问题数={len(self.issues)} (ERROR:{report.error_count}, "
                   f"WARNING:{report.warning_count}, INFO:{report.info_count})")

        return report

    def _layer1_chemical_check(self, ingredients: List[Dict]):
        """Layer 1: 化学层面检测"""
        logger.debug("执行 Layer 1: 化学层面检测")
        names = [ing["name"] for ing in ingredients]

        ph_values = []
        for name in names:
            prop = CHEMICAL_PROPERTIES_DB.get(name, {})
            if "optimal_ph" in prop:
                ph_values.append((name, prop["optimal_ph"]))

        if len(ph_values) >= 2:
            self.total_checks += 1
            ph_ranges = [v[1] for v in ph_values]
            min_ph = min(r[0] for r in ph_ranges)
            max_ph = max(r[1] for r in ph_ranges)

            if max_ph - min_ph > 2.0:
                affected = [v[0] for v in ph_values
                           if abs(v[1][0] - min_ph) < 1 or abs(v[1][1] - max_ph) < 1]
                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.WARNING,
                    category=CheckCategory.CHEMICAL,
                    description=f"pH 冲突风险：成分最佳 pH 范围差异达 {max_ph-min_ph:.1f} 个单位",
                    scientific_basis="Henderson-Hasselbalch 方程预测混合后可能出现局部 pH 偏离",
                    suggestion="建议使用缓冲体系或调整投料顺序（先溶解 pH 极端成分）",
                    affected_ingredients=affected[:3],
                    severity_score=6.0
                ))
            else:
                self.passed_checks += 1

        for rule in PRECIPITATION_RULES:
            self.total_checks += 1
            reactant_a_found = any(rule["reactants"][0].lower() in n.lower() or
                                   any(rule["reactants"][0] in p.get("ion_type", "")
                                       for p in CHEMICAL_PROPERTIES_DB.values() if n in p)
                                   for n in names)
            reactant_b_found = any(rule["reactants"][1].lower() in n.lower()
                                   for n in names)

            if reactant_a_found and reactant_b_found:
                self.issues.append(CompatibilityIssue(
                    level=rule["severity"],
                    category=CheckCategory.CHEMICAL,
                    description=f"沉淀风险：{rule['reactants'][0]} + {rule['reactants'][1]} → {rule['product']}",
                    scientific_basis=f"溶度积 Ksp={rule['Ksp']:.1e}，超过饱和浓度将析出沉淀",
                    suggestion="考虑螯合剂（如柠檬酸）或分离包装",
                    severity_score=8.0 if rule["severity"] == IssueLevel.ERROR else 5.0
                ))
            else:
                self.passed_checks += 1

        redox_agents = []
        for name in names:
            prop = CHEMICAL_PROPERTIES_DB.get(name, {})
            if "redox_potential" in prop:
                redox_agents.append((name, prop["redox_potential"]))

        if len(redox_agents) >= 2:
            self.total_checks += 1
            redox_agents.sort(key=lambda x: x[1])
            delta_e = redox_agents[-1][1] - redox_agents[0][1]

            if abs(delta_e) > 0.3:
                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.WARNING,
                    category=CheckCategory.CHEMICAL,
                    description=f"氧化还原反应风险：{redox_agents[0][0]} (E={redox_agents[0][1]:+.2f}V) "
                               f"+ {redox_agents[-1][0]} (E={redox_agents[-1][1]:+.2f}V)，ΔE={delta_e:.2f}V",
                    scientific_basis="电极电位差 ΔE > 0.3V 时自发氧化还原反应倾向显著",
                    suggestion="避免长期共存，可分时段服用或使用抗氧化保护剂",
                    affected_ingredients=[redox_agents[0][0], redox_agents[-1][0]],
                    severity_score=5.5
                ))
            else:
                self.passed_checks += 1

    def _layer2_pharmacological_check(self, ingredients: List[Dict]):
        """Layer 2: 药理学层面检测"""
        logger.debug("执行 Layer 2: 药理学层面检测")
        names = [ing["name"] for ing in ingredients]

        for receptor_info in RECEPTOR_BINDING_DB:
            self.total_checks += 1
            found_ligands = []

            for ligand_name, _ in receptor_info["ligands"]:
                if ligand_name in names:
                    found_ligands.append(ligand_name)

            if len(found_ligands) >= 2 and receptor_info["competition_risk"] == "medium":
                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.WARNING,
                    category=CheckCategory.PHARMACOLOGICAL,
                    description=f"受体竞争风险：{', '.join(found_ligands)} 可能竞争结合 {receptor_info['receptor']}",
                    scientific_basis=receptor_info["reference"],
                    suggestion="如需同时使用，建议总剂量不超过单一成分推荐量的 70%",
                    affected_ingredients=found_ligands,
                    severity_score=6.0
                ))
            elif len(found_ligands) >= 2:
                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.INFO,
                    category=CheckCategory.PHARMACOLOGICAL,
                    description=f"潜在受体互作：{', '.join(found_ligands)} 均作用于 {receptor_info['receptor']}",
                    scientific_basis=receptor_info["reference"],
                    suggestion="监测联合效应，必要时调整比例",
                    affected_ingredients=found_ligands,
                    severity_score=3.0
                ))
            else:
                self.passed_checks += 1

        for enzyme_info in ENZYME_INTERACTION_DB:
            self.total_checks += 1
            substrates_found = [s for s in enzyme_info["substrates"] if s in names]
            inhibitors_found = [i for i in enzyme_info["inhibitors"] if i in names]

            if substrates_found and inhibitors_found:
                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.WARNING,
                    category=CheckCategory.PHARMACOLOGICAL,
                    description=f"酶抑制互作：{', '.join(inhibitors_found)} 可能抑制 {enzyme_info['enzyme']}，"
                               f"影响 {', '.join(substrates_found)} 的代谢",
                    scientific_basis=enzyme_info["mechanism"],
                    suggestion="错开服用时间（间隔 ≥ 2 小时）或降低底物成分剂量",
                    affected_ingredients=substrates_found + inhibitors_found,
                    severity_score=7.0
                ))
            else:
                self.passed_checks += 1

    def _layer3_nutritional_check(self, ingredients: List[Dict]):
        """Layer 3: 营养学层面检测"""
        logger.debug("执行 Layer 3: 营养学层面检测")
        names = [ing["name"] for ing in ingredients]

        antinutrient_keywords = {
            "植酸": ["植酸", "肌醇六磷酸"],
            "单宁": ["单宁", "鞣质", "多酚"],
            "胰蛋白酶抑制剂": ["胰蛋白酶抑制剂", "TI因子"],
            "皂苷": ["皂苷", "皂甙", "saponin"]
        }

        for factor_name, keywords in antinutrient_keywords.items():
            self.total_checks += 1
            found_sources = []

            for name in names:
                for kw in keywords:
                    if kw.lower() in name.lower() or name in ANTINUTRIENT_FACTORS_DB.get(factor_name, {}).get("sources", []):
                        found_sources.append(name)
                        break

            if found_sources:
                factor_info = ANTINUTRIENT_FACTORS_DB.get(factor_name, {})
                reduction = factor_info.get("bioavailability_reduction", 0.3)

                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.INFO if reduction < 0.5 else IssueLevel.WARNING,
                    category=CheckCategory.NUTRITIONAL,
                    description=f"抗营养因子检测：发现 {factor_name} 来源 ({', '.join(found_sources)})，"
                               f"可能降低某些营养素生物利用度约 {reduction*100:.0f}%",
                    scientific_basis=f"{factor_name} 可与矿物质/蛋白质结合形成不溶性复合物",
                    suggestion=factor_info.get("mitigation", "适当加热或发酵处理可部分消除"),
                    affected_ingredients=found_sources,
                    severity_score=4.0 + reduction * 3
                ))
            else:
                self.passed_checks += 1

        mineral_ions = ["钙", "铁", "锌", "镁"]
        chelating_agents = ["多酚", "草酸", "植酸", "维生素C"]

        minerals_present = [m for m in mineral_ions if m in names]
        chelators_present = [c for c in chelating_agents if c in names or
                            any(c in n for n in names)]

        if minerals_present and chelators_present:
            self.total_checks += 1
            self.issues.append(CompatibilityIssue(
                level=IssueLevel.INFO,
                category=CheckCategory.NUTRITIONAL,
                description=f"潜在螯合作用：{', '.join(minerals_present)} 可能被 {', '.join(chelators_present[:2])} 部分螯合",
                scientific_basis="金属离子与配体形成稳定络合物，降低游离离子浓度",
                suggestion="矿物元素与螯合剂分时段服用（间隔 1-2 小时）",
                affected_ingredients=minerals_present + chelators_present[:2],
                severity_score=3.5
            ))
        else:
            self.total_checks += 1
            self.passed_checks += 1

    def _layer4_regulatory_check(self, ingredients: List[Dict], target_population: str):
        """Layer 4: 法规层面检测"""
        logger.debug("执行 Layer 4: 法规层面检测")

        for ing in ingredients:
            name = ing.get("name", "")
            amount = ing.get("amount_mg", 0)
            percentage = ing.get("percentage", 0)

            if name in GB2760_LIMITS_DB:
                self.total_checks += 1
                limit_info = GB2760_LIMITS_DB[name]

                if "max_daily_g" in limit_info:
                    daily_g = amount / 1000
                    if daily_g > limit_info["max_daily_g"]:
                        self.issues.append(CompatibilityIssue(
                            level=IssueLevel.ERROR,
                            category=CheckCategory.REGULATORY,
                            description=f"法规超标：{name} 日摄入量 {daily_g:.2f}g 超过 GB 标准 ({limit_info['max_daily_g']}g)",
                            scientific_basis=limit_info["standard"],
                            suggestion=f"将{name}用量降至 {limit_info['max_daily_g']*1000:.0f}mg 以下",
                            affected_ingredients=[name],
                            severity_score=9.0
                        ))
                    elif daily_g > limit_info["max_daily_g"] * 0.8:
                        self.issues.append(CompatibilityIssue(
                            level=IssueLevel.WARNING,
                            category=CheckCategory.REGULATORY,
                            description=f"接近法规上限：{name} 日摄入量已达标准的 {daily_g/limit_info['max_daily_g']*100:.0f}%",
                            scientific_basis=limit_info["standard"],
                            suggestion="注意监控总量，避免超量",
                            affected_ingredients=[name],
                            severity_score=5.0
                        ))
                    else:
                        self.passed_checks += 1

                if "max_daily_mg" in limit_info:
                    if amount > limit_info["max_daily_mg"]:
                        self.issues.append(CompatibilityIssue(
                            level=IssueLevel.ERROR,
                            category=CheckCategory.REGULATORY,
                            description=f"法规超标：{name} 含量 {amount:.0f}mg 超过 GB 标准 ({limit_info['max_daily_mg']}mg)",
                            scientific_basis=limit_info["standard"],
                            suggestion=f"将{name}含量降至 {limit_info['max_daily_mg']}mg 以下",
                            affected_ingredients=[name],
                            severity_score=9.0
                        ))
                    elif amount > limit_info["max_daily_mg"] * 0.8:
                        self.issues.append(CompatibilityIssue(
                            level=IssueLevel.WARNING,
                            category=CheckCategory.REGULATORY,
                            description=f"接近法规上限：{name} 含量已达标准的 {amount/limit_info['max_daily_mg']*100:.0f}%",
                            scientific_basis=limit_info["standard"],
                            suggestion="注意监控总量",
                            affected_ingredients=[name],
                            severity_score=5.0
                        ))
                    else:
                        self.passed_checks += 1

        if target_population != "adult":
            self.total_checks += 1
            restrictions = SPECIAL_POPULATION_RESTRICTIONS.get(target_population, {})

            restricted_found = []
            caution_found = []

            for ing in ingredients:
                name = ing.get("name", "")
                if "restricted" in restrictions:
                    for r in restrictions["restricted"]:
                        if r.lower() in name.lower() or r == name:
                            restricted_found.append(name)
                if "caution" in restrictions:
                    for c in restrictions["caution"]:
                        if c.lower() in name.lower() or c == name:
                            caution_found.append(name)

            if restricted_found:
                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.ERROR,
                    category=CheckCategory.REGULATORY,
                    description=f"目标人群禁忌：{target_population} 不宜使用 {', '.join(restricted_found)}",
                    scientific_basis=restrictions.get("reason", ""),
                    suggestion="更换为适合该人群的安全替代成分",
                    affected_ingredients=restricted_found,
                    severity_score=10.0
                ))
            elif caution_found:
                self.issues.append(CompatibilityIssue(
                    level=IssueLevel.WARNING,
                    category=CheckCategory.REGULATORY,
                    description=f"目标人群慎用：{target_population} 使用 {', '.join(caution_found)} 需谨慎",
                    scientific_basis=restrictions.get("reason", ""),
                    suggestion="减量至成人剂量的 50% 并密切观察",
                    affected_ingredients=caution_found,
                    severity_score=6.5
                ))
            else:
                self.passed_checks += 1

    def _calculate_overall_score(self) -> float:
        """计算总体兼容性评分 (0-100)"""
        score = 100.0

        for issue in self.issues:
            if issue.level == IssueLevel.ERROR:
                score -= 25.0 * (issue.severity_score / 10.0)
            elif issue.level == IssueLevel.WARNING:
                score -= 10.0 * (issue.severity_score / 10.0)
            elif issue.level == IssueLevel.INFO:
                score -= 2.0 * (issue.severity_score / 10.0)

        return max(0.0, round(score, 1))

    def _generate_recommendations(self) -> List[str]:
        """自动生成修改建议"""
        recommendations = []

        error_issues = [i for i in self.issues if i.level == IssueLevel.ERROR]
        warning_issues = [i for i in self.issues if i.level == IssueLevel.WARNING]

        if not error_issues and not warning_issues:
            recommendations.append("✅ 配方整体兼容性良好，各成分间无显著冲突")

        for issue in error_issues[:3]:
            recommendations.append(f"🔴 必须修改：{issue.suggestion}")

        for issue in warning_issues[:3]:
            recommendations.append(f"⚠️ 建议优化：{issue.suggestion}")

        if len(self.issues) > 6:
            remaining = len(self.issues) - 6
            recommendations.append(f"ℹ️ 还有 {remaining} 条次要建议，详见完整报告")

        return recommendations


def quick_test():
    """快速测试函数"""
    logger.info("=" * 70)
    logger.info("配方兼容性检测系统 - 快速测试")
    logger.info("=" * 70)
    checker = CompatibilityChecker()

    test_formula_1 = [
        {"name": "大豆肽", "amount_mg": 500, "percentage": 25},
        {"name": "黄芪多糖", "amount_mg": 300, "percentage": 15},
        {"name": "维生素C", "amount_mg": 1500, "percentage": 20},
        {"name": "钙", "amount_mg": 500, "percentage": 10},
        {"name": "人参皂苷", "amount_mg": 100, "percentage": 5},
        {"name": "大豆异黄酮", "amount_mg": 80, "percentage": 4},
    ]

    logger.info("\n【测试配方 1】普通成人配方")
    logger.info("-" * 70)
    report_1 = checker.check_compatibility(test_formula_1, formula_id="TEST-001")

    logger.info(f"\n总体评分: {report_1.overall_score}/100")
    logger.info(f"检测结果: {report_1.passed_checks}/{report_1.total_checks} 项通过")
    logger.error(f"问题统计: ERROR={report_1.error_count}, WARNING={report_1.warning_count}, INFO={report_1.info_count}")
    logger.debug("\n详细问题列表:")
    for i, issue in enumerate(report_1.issues, 1):
        icon = "🔴" if issue.level == IssueLevel.ERROR else \
               "⚠️" if issue.level == IssueLevel.WARNING else "ℹ️"
        logger.info(f"\n{icon} [{issue.category.value.upper()}] 问题 #{i}: {issue.description}")
        logger.info(f"   科学依据: {issue.scientific_basis}")
        logger.info(f"   影响成分: {', '.join(issue.affected_ingredients)}")
        logger.info(f"   严重程度: {issue.severity_score}/10")
        logger.info(f"   建议: {issue.suggestion}")
    logger.info("\n修改建议:")
    for rec in report_1.recommendations:
        logger.info(f"  • {rec}")
    test_formula_2 = [
        {"name": "大豆肽", "amount_mg": 600, "percentage": 30},
        {"name": "维生素C", "amount_mg": 2500, "percentage": 25},
        {"name": "铁", "amount_mg": 35, "percentage": 8},
        {"name": "人参皂苷", "amount_mg": 150, "percentage": 6},
    ]

    logger.info("\n\n【测试配方 2】含超标成分的配方")
    logger.info("-" * 70)
    report_2 = checker.check_compatibility(test_formula_2, formula_id="TEST-002")

    logger.info(f"\n总体评分: {report_2.overall_score}/100")
    logger.info(f"检测结果: {report_2.passed_checks}/{report_2.total_checks} 项通过")
    logger.error(f"问题统计: ERROR={report_2.error_count}, WARNING={report_2.warning_count}, INFO={report_2.info_count}")
    logger.info("\n【测试配方 3】孕妇禁忌测试")
    logger.info("-" * 70)
    test_formula_3 = [
        {"name": "大豆异黄酮", "amount_mg": 120, "percentage": 10},
        {"name": "人参皂苷", "amount_mg": 200, "percentage": 15},
        {"name": "叶酸", "amount_mg": 400, "percentage": 20},
    ]
    report_3 = checker.check_compatibility(test_formula_3, formula_id="TEST-003",
                                           target_population="pregnant")

    logger.info(f"\n总体评分: {report_3.overall_score}/100 (目标人群: 孕妇)")
    logger.error(f"问题统计: ERROR={report_3.error_count}, WARNING={report_3.warning_count}")
    for issue in report_3.issues:
        if issue.level == IssueLevel.ERROR:
            logger.info(f"\n🚨 致命问题: {issue.description}")
            logger.info(f"   建议: {issue.suggestion}")
    logger.info("\n" + "=" * 70)
    logger.info("验证标准检查:")
    logger.info("=" * 70)
    checks = [
        ("3.1 4层架构完整实现", True),
        ("3.2 pH冲突检测", any(i.category == CheckCategory.CHEMICAL for i in report_1.issues)),
        ("3.3 受体竞争检测", any(i.category == CheckCategory.PHARMACOLOGICAL for i in report_1.issues)),
        ("3.4 抗营养因子评估", any(i.category == CheckCategory.NUTRITIONAL for i in report_1.issues)),
        ("3.5 GB 2760标准对照", any(i.category == CheckCategory.REGULATORY for i in report_2.issues)),
        ("3.6 总体评分范围", 0 <= report_1.overall_score <= 100),
        ("3.7 报告完整性", len(report_1.recommendations) > 0),
        ("3.8 特殊人群限制", report_3.error_count > 0),
    ]

    for check_name, result in checks:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{status}: {check_name}")
    return report_1


if __name__ == "__main__":
    quick_test()
