"""安全数据统一服务 — 配伍禁忌 + 食物相克 + 药物相互作用

整合传统中医药配伍禁忌（十八反、十九畏）、食物相克、
现代药物-食物相互作用数据，提供统一的安全检查接口。

数据来源：
- 《本草纲目》、《本草经集注》等传统典籍
- 国家药典配伍禁忌规定
- 现代营养学食物相互作用研究
- FDA/EMA 药物相互作用数据库
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set


@dataclass
class SafetyWarning:
    """安全警告信息"""
    herb1: str
    herb2: str
    type: str  # "contraindication" | "caution" | "food_clash"
    severity: str  # "danger" | "warning" | "info"
    description: str
    source: str = ""


@dataclass
class HerbSafetyProfile:
    """药材安全档案"""
    name_cn: str
    max_dosage: Optional[str] = None
    min_dosage: Optional[str] = None
    contraindications: List[str] = field(default_factory=list)
    special_population: Dict[str, str] = field(default_factory=dict)
    food_clashes: List[str] = field(default_factory=list)
    drug_interactions: List[str] = field(default_factory=list)
    toxicity_level: str = "low"  # low/medium/high


# ═══════════════════════════════════════════
# 十八反（药物配伍禁忌）
# ═══════════════════════════════════════════

CONTRAINDICATIONS_18: List[Dict[str, Any]] = [
    {
        "herb1": "甘草",
        "herb2": "海藻",
        "description": "甘草反海藻，同用可能产生毒性反应",
        "severity": "danger",
    },
    {
        "herb1": "甘草",
        "herb2": "大戟",
        "description": "甘草反大戟，两者相畏，不宜同用",
        "severity": "danger",
    },
    {
        "herb1": "甘草",
        "herb2": "甘遂",
        "description": "甘草反甘遂，配伍可能增强毒性",
        "severity": "danger",
    },
    {
        "herb1": "甘草",
        "herb2": "芫花",
        "description": "甘草反芫花，传统禁忌配伍",
        "severity": "danger",
    },
    {
        "herb1": "甘草",
        "herb2": "京大戟",
        "description": "甘草反京大戟，不宜同用",
        "severity": "danger",
    },
    {
        "herb1": "甘草",
        "herb2": "红大戟",
        "description": "甘草反红大戟，传统禁忌",
        "severity": "danger",
    },
    {
        "herb1": "甘草",
        "herb2": "芫花",
        "description": "甘草反芫花，配伍禁忌",
        "severity": "danger",
    },
    {
        "herb1": "乌头",
        "herb2": "半夏",
        "description": "乌头反半夏，同用毒性剧烈",
        "severity": "danger",
    },
    {
        "herb1": "乌头",
        "herb2": "瓜萎",
        "description": "乌头反瓜萎，传统禁忌配伍",
        "severity": "danger",
    },
    {
        "herb1": "乌头",
        "herb2": "贝母",
        "description": "乌头反贝母，配伍可能中毒",
        "severity": "danger",
    },
    {
        "herb1": "乌头",
        "herb2": "白蔹",
        "description": "乌头反白蔹，不宜同用",
        "severity": "danger",
    },
    {
        "herb1": "乌头",
        "herb2": "附子",
        "description": "附子同乌头，均为乌头类，反同",
        "severity": "danger",
    },
    {
        "herb1": "乌头",
        "herb2": "贝母",
        "description": "乌头反贝母，传统禁忌",
        "severity": "danger",
    },
    {
        "herb1": "附子",
        "herb2": "半夏",
        "description": "附子反半夏，同用毒性剧烈",
        "severity": "danger",
    },
    {
        "herb1": "附子",
        "herb2": "瓜萎",
        "description": "附子反瓜萎，传统禁忌配伍",
        "severity": "danger",
    },
    {
        "herb1": "附子",
        "herb2": "贝母",
        "description": "附子反贝母，配伍禁忌",
        "severity": "danger",
    },
    {
        "herb1": "附子",
        "herb2": "白蔹",
        "description": "附子反白蔹，不宜同用",
        "severity": "danger",
    },
    {
        "herb1": "人参",
        "herb2": "藜芦",
        "description": "人参反藜芦，同用可能产生毒性",
        "severity": "danger",
    },
    {
        "herb1": "人参",
        "herb2": "五灵脂",
        "description": "人参畏五灵脂，传统禁忌",
        "severity": "warning",
    },
    {
        "herb1": "藜芦",
        "herb2": "人参",
        "description": "藜芦反人参，传统禁忌配伍",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "沙参",
        "description": "藜芦反沙参，不宜同用",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "丹参",
        "description": "藜芦反丹参，传统禁忌",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "玄参",
        "description": "藜芦反玄参，配伍禁忌",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "苦参",
        "description": "藜芦反苦参，不宜同用",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "细辛",
        "description": "藜芦反细辛，传统禁忌",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "芍药",
        "description": "藜芦反芍药，配伍禁忌",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "当归",
        "description": "藜芦反当归，不宜同用",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "白蔹",
        "description": "藜芦反白蔹，传统禁忌",
        "severity": "danger",
    },
    {
        "herb1": "藜芦",
        "herb2": "防风",
        "description": "藜芦反防风，配伍禁忌",
        "severity": "danger",
    },
]


# ═══════════════════════════════════════════
# 十九畏（药物相畏）
# ═══════════════════════════════════════════

CAUTIONS_19: List[Dict[str, Any]] = [
    {
        "herb1": "人参",
        "herb2": "五灵脂",
        "description": "人参畏五灵脂，降低人参补气功效",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "三棱",
        "description": "人参畏三棱，破血耗气",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "藓虫",
        "description": "人参畏藓虫，耗气伤正",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "莱菔子",
        "description": "人参畏莱菔子，萝卜子解人参补益",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "皂荚",
        "description": "人参畏皂荚，攻补相逆",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "五灵脂",
        "description": "人参畏五灵脂，传统相畏",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "藓虫",
        "description": "人参畏藓虫，不宜同用",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "五灵脂",
        "description": "人参畏五灵脂，相畏禁忌",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "皂荚",
        "description": "人参畏皂荚，攻补相逆",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "莱菔子",
        "description": "人参畏莱菔子，萝卜子解人参",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "五灵脂",
        "description": "人参畏五灵脂，相畏",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "藓虫",
        "description": "人参畏藓虫，相畏",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "皂荚",
        "description": "人参畏皂荚，相畏",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "五灵脂",
        "description": "人参畏五灵脂，相畏",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "三棱",
        "description": "人参畏三棱，相畏",
        "severity": "warning",
    },
    {
        "herb1": "人参",
        "herb2": "五灵脂",
        "description": "人参畏五灵脂，相畏",
        "severity": "warning",
    },
]


# ═══════════════════════════════════════════
# 食物相克（常见组合）
# ═══════════════════════════════════════════

FOOD_CLASHES: List[Dict[str, Any]] = [
    {
        "herb1": "银杏果",
        "herb2": "酒",
        "description": "银杏果与酒同食可能引起中毒",
        "severity": "danger",
    },
    {
        "herb1": "银杏果",
        "herb2": "蟹",
        "description": "银杏果与蟹同食可能引起消化不良",
        "severity": "warning",
    },
    {
        "herb1": "银杏果",
        "herb2": "小鱼",
        "description": "银杏果与小鱼同食可能引起中毒",
        "severity": "danger",
    },
    {
        "herb1": "山楂",
        "herb2": "人参",
        "description": "山楂与人参同食会降低人参补气功效",
        "severity": "warning",
    },
    {
        "herb1": "山楂",
        "herb2": "补药",
        "description": "山楂能解补药，不宜同服",
        "severity": "warning",
    },
    {
        "herb1": "山楂",
        "herb2": "海味",
        "description": "山楂与海味同食可能引起消化不良",
        "severity": "warning",
    },
    {
        "herb1": "山楂",
        "herb2": "糖",
        "description": "山楂与糖同食可能引起中毒",
        "severity": "warning",
    },
    {
        "herb1": "山楂",
        "herb2": "蜂蜜",
        "description": "山楂与蜂蜜同食可能引起腹泻",
        "severity": "warning",
    },
    {
        "herb1": "山楂",
        "herb2": "猪肝",
        "description": "山楂与猪肝同食可能影响铁吸收",
        "severity": "info",
    },
    {
        "herb1": "山楂",
        "herb2": "海鲜",
        "description": "山楂与海鲜同食可能引起不适",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "葱",
        "description": "蜂蜜与葱同食可能引起腹泻",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "豆腐",
        "description": "蜂蜜与豆腐同食可能引起不适",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "韭菜",
        "description": "蜂蜜与韭菜同食可能引起腹泻",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "芥末",
        "description": "蜂蜜与芥末同食可能引起中毒",
        "severity": "danger",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "牛肉",
        "description": "蜂蜜与牛肉同食可能引起腹胀",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "莴苣",
        "description": "蜂蜜与莴苣同食可能引起腹泻",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "甘薯",
        "description": "蜂蜜与甘薯同食可能引起腹胀",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "大蒜",
        "description": "蜂蜜与大蒜同食可能引起胃肠不适",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "白菜",
        "description": "蜂蜜与白菜同食可能引起腹泻",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "黄瓜",
        "description": "蜂蜜与黄瓜同食可能降低蜂蜜功效",
        "severity": "info",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "豆腐",
        "description": "蜂蜜与豆腐同食可能引起消化不良",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "豆浆",
        "description": "蜂蜜与豆浆同食可能引起不适",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "莴苣",
        "description": "蜂蜜与莴苣同食可能引起腹泻",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "甘薯",
        "description": "蜂蜜与甘薯同食可能引起腹胀",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "大蒜",
        "description": "蜂蜜与大蒜同食可能引起胃肠不适",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "白菜",
        "description": "蜂蜜与白菜同食可能引起腹泻",
        "severity": "warning",
    },
    {
        "herb1": "蜂蜜",
        "herb2": "黄瓜",
        "description": "蜂蜜与黄瓜同食可能降低功效",
        "severity": "info",
    },
]


# ═══════════════════════════════════════════
# 药物-食物相互作用
# ═══════════════════════════════════════════

DRUG_FOOD_INTERACTIONS: List[Dict[str, Any]] = [
    {
        "herb": "人参",
        "drug": "华法林",
        "description": "人参可能增强华法林的抗凝作用，增加出血风险",
        "severity": "danger",
    },
    {
        "herb": "人参",
        "drug": "胰岛素",
        "description": "人参可能降低血糖，与胰岛素同用需监测血糖",
        "severity": "warning",
    },
    {
        "herb": "人参",
        "drug": "雌激素",
        "description": "人参可能增强雌激素作用",
        "severity": "warning",
    },
    {
        "herb": "人参",
        "drug": "镇静剂",
        "description": "人参可能对抗镇静剂的中枢抑制作用",
        "severity": "warning",
    },
    {
        "herb": "当归",
        "drug": "华法林",
        "description": "当归可能增强华法林的抗凝作用",
        "severity": "danger",
    },
    {
        "herb": "当归",
        "drug": "抗血小板药",
        "description": "当归可能增强抗血小板作用，增加出血风险",
        "severity": "warning",
    },
    {
        "herb": "当归",
        "drug": "降糖药",
        "description": "当归可能增强降糖作用，需监测血糖",
        "severity": "warning",
    },
    {
        "herb": "丹参",
        "drug": "华法林",
        "description": "丹参可能增强华法林的抗凝作用",
        "severity": "danger",
    },
    {
        "herb": "丹参",
        "drug": "阿司匹林",
        "description": "丹参与阿司匹林同用增加出血风险",
        "severity": "danger",
    },
    {
        "herb": "丹参",
        "drug": "氯吡格雷",
        "description": "丹参可能增强氯吡格雷的抗血小板作用",
        "severity": "warning",
    },
    {
        "herb": "枸杞",
        "drug": "降压药",
        "description": "枸杞可能增强降压药的作用",
        "severity": "warning",
    },
    {
        "herb": "枸杞",
        "drug": "降糖药",
        "description": "枸杞可能增强降糖作用",
        "severity": "warning",
    },
    {
        "herb": "黄芪",
        "drug": "降压药",
        "description": "黄芪可能增强降压作用",
        "severity": "warning",
    },
    {
        "herb": "黄芪",
        "drug": "降糖药",
        "description": "黄芪可能增强降糖作用",
        "severity": "warning",
    },
    {
        "herb": "黄芪",
        "drug": "免疫抑制剂",
        "description": "黄芪可能增强免疫功能，与免疫抑制剂相抗",
        "severity": "warning",
    },
    {
        "herb": "甘草",
        "drug": "降压药",
        "description": "甘草可能减弱降压药作用，引起血压升高",
        "severity": "danger",
    },
    {
        "herb": "甘草",
        "drug": "利尿剂",
        "description": "甘草可能增强利尿剂排钾作用，导致低钾血症",
        "severity": "danger",
    },
    {
        "herb": "甘草",
        "drug": "地高辛",
        "description": "甘草可能增强地高辛的毒性",
        "severity": "danger",
    },
    {
        "herb": "甘草",
        "drug": "糖皮质激素",
        "description": "甘草可能增强糖皮质激素的不良反应",
        "severity": "warning",
    },
    {
        "herb": "生姜",
        "drug": "阿司匹林",
        "description": "生姜可能增强阿司匹林的抗血小板作用",
        "severity": "warning",
    },
    {
        "herb": "生姜",
        "drug": "华法林",
        "description": "生姜可能增强华法林的抗凝作用",
        "severity": "warning",
    },
    {
        "herb": "银杏果",
        "drug": "华法林",
        "description": "银杏果可能增强华法林的抗凝作用",
        "severity": "danger",
    },
    {
        "herb": "银杏果",
        "drug": "阿司匹林",
        "description": "银杏果可能增强抗血小板作用",
        "severity": "warning",
    },
    {
        "herb": "银杏果",
        "drug": "NSAIDs",
        "description": "银杏果可能增强 NSAIDs 的胃肠刺激",
        "severity": "warning",
    },
]


# ═══════════════════════════════════════════
# 安全数据服务类
# ═══════════════════════════════════════════

class SafetyKnowledgeService:
    """安全数据统一服务

    提供统一的配伍禁忌、食物相克、药物相互作用查询接口。
    """

    def __init__(self):
        self._build_indexes()

    def _build_indexes(self):
        """构建索引以加速查询"""
        # 药材对索引
        self._contraindication_pairs: Set[tuple] = set()
        for item in CONTRAINDICATIONS_18:
            self._contraindication_pairs.add((item["herb1"], item["herb2"]))
            self._contraindication_pairs.add((item["herb2"], item["herb1"]))

        self._caution_pairs: Set[tuple] = set()
        for item in CAUTIONS_19:
            self._caution_pairs.add((item["herb1"], item["herb2"]))
            self._caution_pairs.add((item["herb2"], item["herb1"]))

        self._food_clash_pairs: Set[tuple] = set()
        for item in FOOD_CLASHES:
            self._food_clash_pairs.add((item["herb1"], item["herb2"]))
            self._food_clash_pairs.add((item["herb2"], item["herb1"]))

        # 药物-食物索引
        self._drug_food_map: Dict[str, List[Dict]] = {}
        for item in DRUG_FOOD_INTERACTIONS:
            herb = item["herb"]
            if herb not in self._drug_food_map:
                self._drug_food_map[herb] = []
            self._drug_food_map[herb].append(item)

    def check_contraindication(self, herb1: str, herb2: str) -> Optional[SafetyWarning]:
        """检查两种药材的配伍禁忌"""
        for item in CONTRAINDICATIONS_18:
            if (item["herb1"] == herb1 and item["herb2"] == herb2) or \
               (item["herb1"] == herb2 and item["herb2"] == herb1):
                return SafetyWarning(
                    herb1=herb1,
                    herb2=herb2,
                    type="contraindication",
                    severity=item["severity"],
                    description=item["description"],
                    source="十八反",
                )
        return None

    def check_caution(self, herb1: str, herb2: str) -> Optional[SafetyWarning]:
        """检查两种药材的相畏关系"""
        for item in CAUTIONS_19:
            if (item["herb1"] == herb1 and item["herb2"] == herb2) or \
               (item["herb1"] == herb2 and item["herb2"] == herb1):
                return SafetyWarning(
                    herb1=herb1,
                    herb2=herb2,
                    type="caution",
                    severity=item["severity"],
                    description=item["description"],
                    source="十九畏",
                )
        return None

    def check_food_clash(self, herb1: str, herb2: str) -> Optional[SafetyWarning]:
        """检查食物相克"""
        for item in FOOD_CLASHES:
            if (item["herb1"] == herb1 and item["herb2"] == herb2) or \
               (item["herb1"] == herb2 and item["herb2"] == herb1):
                return SafetyWarning(
                    herb1=herb1,
                    herb2=herb2,
                    type="food_clash",
                    severity=item["severity"],
                    description=item["description"],
                    source="食物相克",
                )
        return None

    def check_drug_interaction(self, herb: str, drug: str) -> Optional[SafetyWarning]:
        """检查药物-食物相互作用"""
        if herb not in self._drug_food_map:
            return None
        for item in self._drug_food_map[herb]:
            if item["drug"].lower() in drug.lower() or drug.lower() in item["drug"].lower():
                return SafetyWarning(
                    herb1=herb,
                    herb2=drug,
                    type="drug_interaction",
                    severity=item["severity"],
                    description=item["description"],
                    source="药物相互作用",
                )
        return None

    def check_formula_safety(
        self,
        herbs: List[str],
        drugs: List[str] = None,
    ) -> List[SafetyWarning]:
        """检查配方整体安全性

        Args:
            herbs: 药材名称列表
            drugs: 正在服用的药物列表（可选）

        Returns:
            安全警告列表
        """
        warnings = []

        # 1. 检查药材间配伍禁忌
        for i, herb1 in enumerate(herbs):
            for herb2 in herbs[i+1:]:
                # 检查十八反
                warning = self.check_contraindication(herb1, herb2)
                if warning:
                    warnings.append(warning)

                # 检查十九畏
                warning = self.check_caution(herb1, herb2)
                if warning:
                    warnings.append(warning)

        # 2. 检查药物-食物相互作用
        if drugs:
            for herb in herbs:
                for drug in drugs:
                    warning = self.check_drug_interaction(herb, drug)
                    if warning:
                        warnings.append(warning)

        return warnings

    def get_herb_safety_profile(self, herb_name: str) -> Optional[HerbSafetyProfile]:
        """获取药材的安全档案"""
        from ..data_sources.herb_dosage_database import (
            get_dosage_by_name,
        )

        dosage_info = get_dosage_by_name(herb_name)
        if not dosage_info:
            return None

        profile = HerbSafetyProfile(
            name_cn=herb_name,
            max_dosage=dosage_info.get("dosage_unit"),
            min_dosage=f"{dosage_info.get('dosage_min')}g",
            contraindications=dosage_info.get("restrictions", []),
            special_population=dosage_info.get("special_population", {}),
            toxicity_level="medium" if herb_name in ["人参", "附子", "乌头"] else "low",
        )

        # 获取该药材的相克信息
        for item in FOOD_CLASHES:
            if item["herb1"] == herb_name or item["herb2"] == herb_name:
                other = item["herb2"] if item["herb1"] == herb_name else item["herb1"]
                profile.food_clashes.append(other)

        # 获取该药材的药物相互作用
        if herb_name in self._drug_food_map:
            for item in self._drug_food_map[herb_name]:
                profile.drug_interactions.append(f"{item['drug']}: {item['description']}")

        return profile

    def get_stats(self) -> Dict[str, int]:
        """获取安全数据统计"""
        return {
            "contraindications": len(CONTRAINDICATIONS_18),
            "cautions": len(CAUTIONS_19),
            "food_clashes": len(FOOD_CLASHES),
            "drug_food_interactions": len(DRUG_FOOD_INTERACTIONS),
            "total_rules": len(CONTRAINDICATIONS_18) + len(CAUTIONS_19) + len(FOOD_CLASHES) + len(DRUG_FOOD_INTERACTIONS),
        }


# 全局单例
_service_instance: SafetyKnowledgeService | None = None


def get_safety_service() -> SafetyKnowledgeService:
    """获取全局安全服务单例"""
    global _service_instance
    if _service_instance is None:
        _service_instance = SafetyKnowledgeService()
    return _service_instance
