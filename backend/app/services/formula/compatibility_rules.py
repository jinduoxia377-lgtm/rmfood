"""
兼容性规则库扩展版
覆盖 50+ 条规则，包括化学层、药理学层、营养学层、法规层
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List

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
class CompatibilityRule:
    """兼容性规则"""
    rule_id: str
    rule_type: str  # "precipitation", "enzyme_interaction", "receptor_competition",
                    # "antioxidant", "nutrient_interaction", "regulatory", "allergenic"
    ingredient_a: str
    ingredient_b: str
    severity: IssueLevel
    description: str
    scientific_basis: str
    suggestion: str
    reference: str = ""

    def to_dict(self) -> Dict:
        return {
            "rule_id": self.rule_id,
            "rule_type": self.rule_type,
            "ingredient_a": self.ingredient_a,
            "ingredient_b": self.ingredient_b,
            "severity": self.severity.value,
            "description": self.description,
            "scientific_basis": self.scientific_basis,
            "suggestion": self.suggestion,
            "reference": self.reference
        }


# ==================== 规则库 ====================

COMPATIBILITY_RULES: List[CompatibilityRule] = [
    # === Layer 1: 化学层 - 沉淀反应 (15条) ===
    CompatibilityRule(
        rule_id="CHEM-001",
        rule_type="precipitation",
        ingredient_a="钙离子",
        ingredient_b="草酸",
        severity=IssueLevel.ERROR,
        description="形成难溶性草酸钙沉淀",
        scientific_basis="Ksp(CaC2O4) = 2.32×10^-9",
        suggestion="避免钙剂与高草酸食物同服",
        reference="《中药配伍禁忌研究》"
    ),
    CompatibilityRule(
        rule_id="CHEM-002",
        rule_type="precipitation",
        ingredient_a="铁离子",
        ingredient_b="多酚",
        severity=IssueLevel.WARNING,
        description="形成深色络合物，降低生物利用度",
        scientific_basis="Fe3+ + 多酚 → 深色络合物",
        suggestion="铁剂与茶、咖啡间隔2小时服用",
        reference="Journal of Agricultural and Food Chemistry"
    ),
    CompatibilityRule(
        rule_id="CHEM-003",
        rule_type="precipitation",
        ingredient_a="蛋白质",
        ingredient_b="单宁",
        severity=IssueLevel.WARNING,
        description="蛋白质-单宁复合物沉淀",
        scientific_basis="单宁与蛋白质氢键结合",
        suggestion="避免高蛋白食物与浓茶同服",
        reference="Food Chemistry"
    ),
    CompatibilityRule(
        rule_id="CHEM-004",
        rule_type="precipitation",
        ingredient_a="锌离子",
        ingredient_b="植酸",
        severity=IssueLevel.ERROR,
        description="形成难溶性植酸锌沉淀",
        scientific_basis="Ksp(Zn3(Phy2)2) 极低",
        suggestion="补锌剂与谷物、豆类间隔服用",
        reference="《营养学杂志》"
    ),
    CompatibilityRule(
        rule_id="CHEM-005",
        rule_type="precipitation",
        ingredient_a="钙离子",
        ingredient_b="植酸",
        severity=IssueLevel.ERROR,
        description="形成难溶性植酸钙沉淀",
        scientific_basis="Ksp(Ca3(Phy2)2) 极低",
        suggestion="补钙与高植酸食物间隔服用",
        reference="《中国营养学报》"
    ),
    CompatibilityRule(
        rule_id="CHEM-006",
        rule_type="precipitation",
        ingredient_a="铁离子",
        ingredient_b="草酸",
        severity=IssueLevel.WARNING,
        description="形成草酸铁沉淀",
        scientific_basis="FeC2O4 Ksp = 2×10^-7",
        suggestion="补铁与高草酸食物间隔服用",
        reference="《药物化学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-007",
        rule_type="precipitation",
        ingredient_a="铝离子",
        ingredient_b="磷酸盐",
        severity=IssueLevel.ERROR,
        description="形成磷酸铝沉淀",
        scientific_basis="AlPO4 Ksp = 9.8×10^-21",
        suggestion="含铝抗酸药与磷酸盐补充剂间隔",
        reference="《临床药理学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-008",
        rule_type="precipitation",
        ingredient_a="银离子",
        ingredient_b="氯化物",
        severity=IssueLevel.ERROR,
        description="形成氯化银沉淀",
        scientific_basis="AgCl Ksp = 1.8×10^-10",
        suggestion="避免银制剂与高盐食物同服",
        reference="《无机化学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-009",
        rule_type="precipitation",
        ingredient_a="镁离子",
        ingredient_b="磷酸盐",
        severity=IssueLevel.WARNING,
        description="形成磷酸镁沉淀",
        scientific_basis="Mg3(PO4)2 Ksp = 1×10^-25",
        suggestion="补镁与高磷食物间隔服用",
        reference="《营养学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-010",
        rule_type="precipitation",
        ingredient_a="铜离子",
        ingredient_b="硫化物",
        severity=IssueLevel.ERROR,
        description="形成硫化铜沉淀",
        scientific_basis="CuS Ksp = 6×10^-36",
        suggestion="避免铜剂与含硫食物同服",
        reference="《生物无机化学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-011",
        rule_type="precipitation",
        ingredient_a="大豆肽",
        ingredient_b="单宁",
        severity=IssueLevel.WARNING,
        description="蛋白质-单宁复合物降低肽吸收",
        scientific_basis="单宁与肽链氢键结合",
        suggestion="肽类补充剂避免与浓茶同服",
        reference="《食品科学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-012",
        rule_type="precipitation",
        ingredient_a="胶原蛋白肽",
        ingredient_b="钙离子",
        severity=IssueLevel.INFO,
        description="可能形成肽-钙复合物",
        scientific_basis="肽链羧基与钙配位",
        suggestion="一般无显著影响，可同服",
        reference="《肽类科学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-013",
        rule_type="precipitation",
        ingredient_a="维生素C",
        ingredient_b="铜离子",
        severity=IssueLevel.WARNING,
        description="维生素C还原Cu2+为Cu+，影响稳定性",
        scientific_basis="Cu2+ + VC → Cu+ + 脱氢VC",
        suggestion="避免高剂量VC与铜剂长期同服",
        reference="《维生素化学》"
    ),
    CompatibilityRule(
        rule_id="CHEM-014",
        rule_type="precipitation",
        ingredient_a="黄芪多糖",
        ingredient_b="乙醇",
        severity=IssueLevel.INFO,
        description="多糖在乙醇中可能沉淀",
        scientific_basis="多糖醇溶性差",
        suggestion="含醇制剂与多糖制剂间隔服用",
        reference="《中药提取工艺》"
    ),
    CompatibilityRule(
        rule_id="CHEM-015",
        rule_type="precipitation",
        ingredient_a="枸杞多糖",
        ingredient_b="酸性环境",
        severity=IssueLevel.INFO,
        description="多糖在强酸中可能降解",
        scientific_basis="多糖糖苷键酸催化水解",
        suggestion="避免与强酸性食物长期同服",
        reference="《 carbohydrate chemistry》"
    ),

    # === Layer 2: 药理学层 - 酶互作 (10条) ===
    CompatibilityRule(
        rule_id="PHARM-001",
        rule_type="enzyme_interaction",
        ingredient_a="人参皂苷",
        ingredient_b="CYP3A4底物",
        severity=IssueLevel.WARNING,
        description="人参皂苷抑制CYP3A4，升高底物血药浓度",
        scientific_basis="Ginsenoside Rg1抑制CYP3A4活性",
        suggestion="与人参同服的CYP3A4底物药物需监测浓度",
        reference="Drug Metabolism and Disposition 2020"
    ),
    CompatibilityRule(
        rule_id="PHARM-002",
        rule_type="enzyme_interaction",
        ingredient_a="圣约翰草提取物",
        ingredient_b="CYP3A4底物",
        severity=IssueLevel.ERROR,
        description="强效诱导CYP3A4，显著降低底物药物浓度",
        scientific_basis="Hypericin诱导CYP3A4表达",
        suggestion="避免与口服避孕药、免疫抑制剂同用",
        reference="Clinical Pharmacology Therapeutics"
    ),
    CompatibilityRule(
        rule_id="PHARM-003",
        rule_type="enzyme_interaction",
        ingredient_a="姜黄素",
        ingredient_b="CYP2D6底物",
        severity=IssueLevel.WARNING,
        description="姜黄素抑制CYP2D6，可能升高底物浓度",
        scientific_basis="Curcumin抑制CYP2D6活性",
        suggestion="大剂量姜黄素与CYP2D6底物药物间隔服用",
        reference="Pharmacological Research"
    ),
    CompatibilityRule(
        rule_id="PHARM-004",
        rule_type="enzyme_interaction",
        ingredient_a="槲皮素",
        ingredient_b="CYP1A2底物",
        severity=IssueLevel.WARNING,
        description="槲皮素抑制CYP1A2",
        scientific_basis="Quercetin抑制CYP1A2活性",
        suggestion="避免与大剂量咖啡因同服",
        reference="Journal of Pharmacology"
    ),
    CompatibilityRule(
        rule_id="PHARM-005",
        rule_type="enzyme_interaction",
        ingredient_a="甘草酸",
        ingredient_b="地高辛",
        severity=IssueLevel.ERROR,
        description="甘草酸抑制P-gp，升高地高辛浓度",
        scientific_basis="Glycyrrhizin抑制P-gp转运体",
        suggestion="甘草制剂与地高辛需监测血药浓度",
        reference="Clinical Pharmacokinetics"
    ),
    CompatibilityRule(
        rule_id="PHARM-006",
        rule_type="enzyme_interaction",
        ingredient_a="银杏叶提取物",
        ingredient_b="华法林",
        severity=IssueLevel.ERROR,
        description="银杏可能增强华法林抗凝作用",
        scientific_basis="银杏黄酮抑制血小板活化",
        suggestion="银杏与华法林同用需监测INR",
        reference="New England Journal of Medicine"
    ),
    CompatibilityRule(
        rule_id="PHARM-007",
        rule_type="enzyme_interaction",
        ingredient_a="大豆异黄酮",
        ingredient_b="他莫昔芬",
        severity=IssueLevel.WARNING,
        description="大豆异黄酮可能干扰他莫昔芬疗效",
        scientific_basis="植物雌激素竞争性结合ER",
        suggestion="乳腺癌患者慎用大豆异黄酮补充剂",
        reference="Cancer Epidemiology Biomarkers"
    ),
    CompatibilityRule(
        rule_id="PHARM-008",
        rule_type="enzyme_interaction",
        ingredient_a="黄芪甲苷",
        ingredient_b="CYP2C9底物",
        severity=IssueLevel.INFO,
        description="黄芪甲苷可能轻度抑制CYP2C9",
        scientific_basis="Astragaloside IV体外抑制CYP2C9",
        suggestion="一般剂量下临床意义不大",
        reference="《中草药》"
    ),
    CompatibilityRule(
        rule_id="PHARM-009",
        rule_type="enzyme_interaction",
        ingredient_a="当归多糖",
        ingredient_b="免疫抑制剂",
        severity=IssueLevel.WARNING,
        description="当归多糖增强免疫，可能对抗免疫抑制剂",
        scientific_basis="PS-PG增强NK细胞活性",
        suggestion="器官移植患者慎用当归制剂",
        reference="Journal of Ethnopharmacology"
    ),
    CompatibilityRule(
        rule_id="PHARM-010",
        rule_type="enzyme_interaction",
        ingredient_a="丹参酮",
        ingredient_b="CYP2C9底物",
        severity=IssueLevel.WARNING,
        description="丹参酮诱导CYP2C9，降低底物浓度",
        scientific_basis="Tanshinone IIA诱导CYP2C9表达",
        suggestion="丹参与华法林等药物需监测",
        reference="Drug Metabolism and Disposition"
    ),

    # === Layer 2: 药理学层 - 受体竞争 (8条) ===
    CompatibilityRule(
        rule_id="PHARM-R01",
        rule_type="receptor_competition",
        ingredient_a="大豆异黄酮",
        ingredient_b="植物雌激素",
        severity=IssueLevel.WARNING,
        description="竞争性结合雌激素受体",
        scientific_basis="异黄酮与ERα/ERβ结合",
        suggestion="激素依赖性肿瘤患者慎用",
        reference="Endocrinology 1998"
    ),
    CompatibilityRule(
        rule_id="PHARM-R02",
        rule_type="receptor_competition",
        ingredient_a="淫羊藿苷",
        ingredient_b="PDE5抑制剂",
        severity=IssueLevel.WARNING,
        description="淫羊藿苷抑制PDE5，与西地那非叠加",
        scientific_basis="Icariin抑制PDE5活性",
        suggestion="避免与PDE5抑制剂药物同用",
        reference="Journal of Urology"
    ),
    CompatibilityRule(
        rule_id="PHARM-R03",
        rule_type="receptor_competition",
        ingredient_a="甘草酸",
        ingredient_b="糖皮质激素",
        severity=IssueLevel.ERROR,
        description="甘草酸抑制11β-HSD2，增强糖皮质激素效应",
        scientific_basis="甘草酸抑制皮质醇灭活",
        suggestion="避免与糖皮质激素长期同用",
        reference="Clinical Endocrinology"
    ),
    CompatibilityRule(
        rule_id="PHARM-R04",
        rule_type="receptor_competition",
        ingredient_a="葛根素",
        ingredient_b="β受体阻滞剂",
        severity=IssueLevel.INFO,
        description="葛根素可能增强β阻滞剂降压作用",
        scientific_basis="Puerarin扩张血管",
        suggestion="监测血压，必要时调整剂量",
        reference="Phytomedicine"
    ),
    CompatibilityRule(
        rule_id="PHARM-R05",
        rule_type="receptor_competition",
        ingredient_a="黄芩苷",
        ingredient_b="GABA受体",
        severity=IssueLevel.INFO,
        description="黄芩苷可能调节GABA受体",
        scientific_basis="Baicalin调节GABA_A受体",
        suggestion="与大剂量镇静催眠药间隔服用",
        reference="European Journal of Pharmacology"
    ),
    CompatibilityRule(
        rule_id="PHARM-R06",
        rule_type="receptor_competition",
        ingredient_a="红景天苷",
        ingredient_b="SSRI抗抑郁药",
        severity=IssueLevel.WARNING,
        description="红景天可能增强5-HT能作用",
        scientific_basis="Rhodiola抑制5-HT再摄取",
        suggestion="避免与SSRI长期同用",
        reference="Phytomedicine"
    ),
    CompatibilityRule(
        rule_id="PHARM-R07",
        rule_type="receptor_competition",
        ingredient_a="人参皂苷",
        ingredient_b="尼古丁受体",
        severity=IssueLevel.INFO,
        description="人参皂苷调节nAChR",
        scientific_basis="Ginsenoside Rg1调节nAChR",
        suggestion="一般剂量下临床意义不大",
        reference="British Journal of Pharmacology"
    ),
    CompatibilityRule(
        rule_id="PHARM-R08",
        rule_type="receptor_competition",
        ingredient_a="灵芝多糖",
        ingredient_b="TNF-α",
        severity=IssueLevel.INFO,
        description="灵芝多糖抑制TNF-α产生",
        scientific_basis="PSK抑制NF-κB通路",
        suggestion="与抗TNF药物联用需监测",
        reference="Journal of Ethnopharmacology"
    ),

    # === Layer 3: 营养学层 - 抗营养因子 (8条) ===
    CompatibilityRule(
        rule_id="NUTRI-001",
        rule_type="nutrient_interaction",
        ingredient_a="植酸",
        ingredient_b="铁",
        severity=IssueLevel.ERROR,
        description="植酸显著降低铁吸收",
        scientific_basis="植酸与Fe3+形成不溶性盐",
        suggestion="补铁剂与高植酸食物间隔2小时",
        reference="American Journal of Clinical Nutrition"
    ),
    CompatibilityRule(
        rule_id="NUTRI-002",
        rule_type="nutrient_interaction",
        ingredient_a="植酸",
        ingredient_b="锌",
        severity=IssueLevel.ERROR,
        description="植酸显著降低锌吸收",
        scientific_basis="植酸与Zn2+形成不溶性盐",
        suggestion="补锌剂与高植酸食物间隔2小时",
        reference="Journal of Nutrition"
    ),
    CompatibilityRule(
        rule_id="NUTRI-003",
        rule_type="nutrient_interaction",
        ingredient_a="植酸",
        ingredient_b="钙",
        severity=IssueLevel.WARNING,
        description="植酸降低钙吸收",
        scientific_basis="植酸与Ca2+形成不溶性盐",
        suggestion="补钙与高植酸食物间隔服用",
        reference="Journal of Bone and Mineral Research"
    ),
    CompatibilityRule(
        rule_id="NUTRI-004",
        rule_type="nutrient_interaction",
        ingredient_a="单宁",
        ingredient_b="蛋白质",
        severity=IssueLevel.WARNING,
        description="单宁与蛋白质结合降低消化",
        scientific_basis="单宁与蛋白氢键结合沉淀",
        suggestion="高蛋白食物避免与浓茶同服",
        reference="Food Chemistry"
    ),
    CompatibilityRule(
        rule_id="NUTRI-005",
        rule_type="nutrient_interaction",
        ingredient_a="单宁",
        ingredient_b="铁",
        severity=IssueLevel.ERROR,
        description="单宁显著降低非血红素铁吸收",
        scientific_basis="单宁与Fe3+络合",
        suggestion="补铁剂避免与茶、咖啡同服",
        reference="American Journal of Clinical Nutrition"
    ),
    CompatibilityRule(
        rule_id="NUTRI-006",
        rule_type="nutrient_interaction",
        ingredient_a="草酸",
        ingredient_b="钙",
        severity=IssueLevel.ERROR,
        description="草酸与钙形成草酸钙沉淀",
        scientific_basis="CaC2O4 Ksp极低",
        suggestion="高草酸食物与钙剂间隔服用",
        reference="Kidney International"
    ),
    CompatibilityRule(
        rule_id="NUTRI-007",
        rule_type="nutrient_interaction",
        ingredient_a="膳食纤维",
        ingredient_b="药物",
        severity=IssueLevel.WARNING,
        description="膳食纤维可能吸附药物降低吸收",
        scientific_basis="纤维物理吸附作用",
        suggestion="高纤维食物与药物间隔1-2小时",
        reference="Journal of Clinical Pharmacology"
    ),
    CompatibilityRule(
        rule_id="NUTRI-008",
        rule_type="nutrient_interaction",
        ingredient_a="维生素C",
        ingredient_b="铜",
        severity=IssueLevel.WARNING,
        description="高剂量VC降低铜吸收",
        scientific_basis="VC竞争性抑制铜转运",
        suggestion="大剂量VC与铜剂间隔服用",
        reference="Journal of Trace Elements"
    ),

    # === Layer 4: 法规层 - GB标准 (10条) ===
    CompatibilityRule(
        rule_id="REG-001",
        rule_type="regulatory",
        ingredient_a="维生素C",
        ingredient_b="max_daily",
        severity=IssueLevel.ERROR,
        description="维生素C每日最大摄入量2000mg",
        scientific_basis="GB 14880-2012",
        suggestion="配方中VC含量不得超过2000mg/天",
        reference="GB 14880-2012"
    ),
    CompatibilityRule(
        rule_id="REG-002",
        rule_type="regulatory",
        ingredient_a="维生素E",
        ingredient_b="max_daily",
        severity=IssueLevel.ERROR,
        description="维生素E每日最大摄入量800mg",
        scientific_basis="GB 14880-2012",
        suggestion="配方中VE含量不得超过800mg/天",
        reference="GB 14880-2012"
    ),
    CompatibilityRule(
        rule_id="REG-003",
        rule_type="regulatory",
        ingredient_a="钙",
        ingredient_b="max_daily",
        severity=IssueLevel.ERROR,
        description="钙每日最大摄入量2000mg",
        scientific_basis="GB 14880-2012",
        suggestion="配方中钙含量不得超过2000mg/天",
        reference="GB 14880-2012"
    ),
    CompatibilityRule(
        rule_id="REG-004",
        rule_type="regulatory",
        ingredient_a="铁",
        ingredient_b="max_daily",
        severity=IssueLevel.ERROR,
        description="铁每日最大摄入量30mg",
        scientific_basis="GB 14880-2012",
        suggestion="配方中铁含量不得超过30mg/天",
        reference="GB 14880-2012"
    ),
    CompatibilityRule(
        rule_id="REG-005",
        rule_type="regulatory",
        ingredient_a="锌",
        ingredient_b="max_daily",
        severity=IssueLevel.ERROR,
        description="锌每日最大摄入量25mg",
        scientific_basis="GB 14880-2012",
        suggestion="配方中锌含量不得超过25mg/天",
        reference="GB 14880-2012"
    ),
    CompatibilityRule(
        rule_id="REG-006",
        rule_type="regulatory",
        ingredient_a="孕妇",
        ingredient_b="人参皂苷",
        severity=IssueLevel.ERROR,
        description="孕妇慎用含人参皂苷产品",
        scientific_basis="可能影响胎儿发育",
        suggestion="孕妇配方避免添加人参皂苷",
        reference="《中国药典》"
    ),
    CompatibilityRule(
        rule_id="REG-007",
        rule_type="regulatory",
        ingredient_a="儿童",
        ingredient_b="麻黄碱类",
        severity=IssueLevel.ERROR,
        description="儿童禁用含麻黄碱产品",
        scientific_basis="可能引起中枢兴奋",
        suggestion="儿童配方避免添加麻黄",
        reference="《儿童用药指导原则》"
    ),
    CompatibilityRule(
        rule_id="REG-008",
        rule_type="regulatory",
        ingredient_a="大豆异黄酮",
        ingredient_b="乳腺癌病史",
        severity=IssueLevel.WARNING,
        description="有乳腺癌病史者慎用大豆异黄酮",
        scientific_basis="植物雌激素可能刺激肿瘤",
        suggestion="乳腺癌患者避免大豆异黄酮补充",
        reference="Cancer Epidemiology Biomarkers"
    ),
    CompatibilityRule(
        rule_id="REG-009",
        rule_type="regulatory",
        ingredient_a="银杏叶",
        ingredient_b="抗凝药物",
        severity=IssueLevel.ERROR,
        description="银杏叶增强抗凝药作用",
        scientific_basis="银杏抑制血小板活化",
        suggestion="服用抗凝药者慎用银杏制剂",
        reference="Clinical Pharmacology"
    ),
    CompatibilityRule(
        rule_id="REG-010",
        rule_type="regulatory",
        ingredient_a="圣约翰草",
        ingredient_b="多种药物",
        severity=IssueLevel.ERROR,
        description="圣约翰草与多种药物相互作用",
        scientific_basis="强效CYP3A4诱导剂",
        suggestion="服用多种药物者避免圣约翰草",
        reference="Drug Metabolism Reviews"
    ),
]


def get_rules() -> List[CompatibilityRule]:
    """获取所有兼容性规则"""
    return COMPATIBILITY_RULES


def get_rules_by_type(rule_type: str) -> List[CompatibilityRule]:
    """按类型获取规则"""
    return [r for r in COMPATIBILITY_RULES if r.rule_type == rule_type]


def get_rules_by_category(category: CheckCategory) -> List[CompatibilityRule]:
    """按类别获取规则"""
    type_map = {
        CheckCategory.CHEMICAL: ["precipitation"],
        CheckCategory.PHARMACOLOGICAL: ["enzyme_interaction", "receptor_competition"],
        CheckCategory.NUTRITIONAL: ["nutrient_interaction"],
        CheckCategory.REGULATORY: ["regulatory"]
    }
    types = type_map.get(category, [])
    return [r for r in COMPATIBILITY_RULES if r.rule_type in types]


def get_rule_count() -> Dict[str, int]:
    """获取规则统计"""
    stats = {
        "total": len(COMPATIBILITY_RULES),
        "by_type": {}
    }
    for rule in COMPATIBILITY_RULES:
        stats["by_type"][rule.rule_type] = stats["by_type"].get(rule.rule_type, 0) + 1
    return stats


if __name__ == "__main__":
    stats = get_rule_count()
    print("兼容性规则库统计:")
    print(f"  总规则数: {stats['total']}")
    for rule_type, count in stats['by_type'].items():
        print(f"  {rule_type}: {count}条")
