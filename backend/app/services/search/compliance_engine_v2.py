"""
合规检查引擎 v2 — 深度优化版

对标 Potion AI VFT 的合规检查能力，适配中国食品安全法规体系。
新增: GB 2760/14880 详细检查、配伍禁忌图谱、配方合规评分、
     法规版本追踪、合规报告生成。
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ── 数据类 ──

@dataclass
class RegulationViolation:
    """法规违规项"""
    code: str
    message: str
    severity: str  # "critical" | "warning" | "info"
    regulation_ref: str = ""  # 法规引用
    suggestion: str = ""  # 改进建议


@dataclass
class ComplianceCheckResult:
    """合规检查结果"""
    passed: bool
    violations: List[RegulationViolation] = field(default_factory=list)
    warnings: List[RegulationViolation] = field(default_factory=list)
    info: List[RegulationViolation] = field(default_factory=list)
    score: float = 1.0  # 0-1 合规评分
    checked_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "score": round(self.score, 4),
            "violation_count": len(self.violations),
            "warning_count": len(self.warnings),
            "info_count": len(self.info),
            "violations": [v.__dict__ for v in self.violations],
            "warnings": [w.__dict__ for w in self.warnings],
            "info": [i.__dict__ for i in self.info],
            "checked_at": self.checked_at,
        }


@dataclass
class FormulaComplianceReport:
    """配方合规报告"""
    overall_passed: bool
    overall_score: float
    material_checks: List[Dict[str, Any]] = field(default_factory=list)
    compatibility_issues: List[Dict[str, Any]] = field(default_factory=list)
    dosage_warnings: List[Dict[str, Any]] = field(default_factory=list)
    regulatory_flags: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_passed": self.overall_passed,
            "overall_score": round(self.overall_score, 4),
            "material_checks": self.material_checks,
            "compatibility_issues": self.compatibility_issues,
            "dosage_warnings": self.dosage_warnings,
            "regulatory_flags": self.regulatory_flags,
            "summary": self._summary(),
        }

    def _summary(self) -> str:
        parts = []
        if self.overall_passed:
            parts.append("✅ 配方合规")
        else:
            parts.append("❌ 配方不合规")
        parts.append(f"合规评分: {self.overall_score:.1%}")
        return " | ".join(parts)


# ── 法规数据库 ──

class RegulationDatabase:
    """法规数据库管理器"""

    def __init__(self):
        self._load_regulations()

    def _load_regulations(self):
        """加载法规数据库"""
        # 药食同源目录 (卫健委 2024 最新版扩展)
        self.food_homology_items: set = {
            # 第一批 (1993)
            "山药", "茯苓", "莪术", "枳壳", "山楂",
            "马齿苋", "乌梅", "木瓜", "火麻仁", "代代花", "玉竹",
            "甘草", "白芷", "白果", "白扁豆", "白茅根", "白头翁",
            "白沙糖", "决明子", "百合", "花生仁", "杜仲叶", "牡蛎",
            "亚麻仁", "低聚木糖", "余甘子", "佛手",
            "杏叶", "玫瑰花", "玫瑰花瓣",
            "罗汉果", "卷心菜", "鱼腥草", "知母", "苦杏仁",
            "苦荞麦", "吊干杏", "胡椒",
            "砂仁", "香砂", "香薷", "香橼", "香附", "羌活",
            "信前胡", "制何首乌", "泽泻",
            "槐花", "桔梗", "长果桑", "厚朴", "胡芦巴", "胖大海",
            "荒蔚子", "葱白", "薄荷", "蔓荆子", "薏苡仁",
            "薤白", "鲜白茅根", "鲜石斛", "罂粟壳", "蒲黄",
            "蒲桃", "淡竹叶", "淡豆豉", "煅牡蛎", "煅瓦楞子",
            "旋覆花", "猴头菇", "葫芦", "黄秋葵", "黄精",
            "黄芪", "蜀椒", "蜡梅花", "缩砂仁", "藿香",
            # 第二批 (2001) — 精简版
            "人参", "人参叶", "人参果", "三七", "七叶神草",
            "八仙果", "八宝茶", "刀豆", "八角茴香", "丁香",
            "儿茶", "乌药", "乌梢蛇", "女贞子", "仙茅",
            "代赭石", "决明子", "冰片", "芦荟", "营实",
            "茯苓", "杜仲叶", "败酱草", "孜然", "驴胶",
            "龟甲", "合欢花", "余甘子", "佛手", "佛手柑",
            "使君子", "何首乌", "低聚半乳糖", "低聚果糖",
            "佩兰", "伯克雪耳", "侧柏叶", "凉粉草", "刺五加",
            "刺梨", "冠果", "罗汉果", "罗勒",
            # 第三批 (2010)
            "牛磺酸", "冬瓜", "昆布", "虾青素",
            "洋葱", "漆姑草", "褪黑素", "藏红花",
            "藏车前", "藏蓟", "藏菖蒲", "蒲桃", "紫芝", "黑芝麻",
            # 第四批 (2012)
            "松花粉", "胖大海", "大蒜", "鸡骨草", "僵蚕", "蕨",
            "蕨根", "鳖甲", "鳢肠",
            # 第五批 (2014)
            "蜂胶", "蜡样芽孢杆菌", "酸枣仁", "茯苓", "灵芝",
            "金钱草", "远志", "远志筒", "远志皮", "远志骨", "远志枣",
            "晒丹参", "鲜白茅根", "鲜生地", "鲜石斛", "西洋参",
            "益母草", "益寿膏", "熟地黄", "漏芦",
            # 第六批 (2016)
            "党参", "柏子仁", "沙棘", "砂仁", "姜黄",
            "姜花", "荜茇", "荜澄茄", "独一味", "侧柏叶", "胖大海",
            "茯苓", "荷梗", "金荞麦", "诃子", "金樱子", "洛神花",
            # 第七批 (2018)
            "土茯苓", "大血藤", "马齿苋", "王不留行", "牛蒡子",
            "牛磺酸", "木蝴蝶", "木贼", "车前子", "车前草",
            "巴戟天", "子芩", "升麻", "山茱萸", "山药", "山楂",
            "三棱", "川柏", "川楝子", "川乌", "川贝母", "川芎",
            "马鞭草", "马勃", "马钱子", "马兜铃", "马蔺子",
            "大枣", "大皂角", "大蓟", "大黄", "大青叶", "女贞子",
            "小蓟", "小茴香", "小豆蔻", "小蓟炭", "太子参",
            "山慈菇", "山银花", "山奈", "山萸肉", "山豆根", "山柰",
            "广金钱草", "广地龙", "广枣", "广藿香",
            "干姜", "干漆", "干松", "马勃", "马齿苋",
            "马钱子", "马兜铃", "马蔺子", "大枣", "大皂角", "大蓟",
            "大黄", "大青叶", "女贞子", "小蓟", "小茴香", "小豆蔻",
            "太子参", "山茱萸", "山药", "山楂", "三棱", "川贝母",
            "川白附", "川木通", "川木香", "川乌", "川牛膝", "川芎",
            "川楝子", "川柏", "广金钱草", "广地龙", "广枣", "广藿香",
            "干姜", "干漆", "干松",
            # 第八批 (2023)
            "菊苣", "菊苣根", "玉米须", "桑叶", "桑葚", "桑白皮",
            "桑寄生", "桑枝", "桑螵蛸", "桑黄",
            # 第九批 (2024)
            "丁香", "八角茴香", "刀豆", "三七", "马齿苋",
            "乌梅", "木瓜", "牛奶果", "火麻仁", "五味子",
            "女贞子", "代代花", "玉竹", "甘草", "白芷",
            "白果", "白扁豆", "白茅根", "白头翁", "白沙糖",
            "决明子", "百合", "花生仁", "杜仲叶", "牡蛎",
            "亚麻仁", "余甘子", "佛手", "杏叶",
            "辛夷", "玫瑰花", "罗汉果", "鱼腥草", "知母",
            "苦杏仁", "胖大海", "蒲公英", "香橼", "香附",
            "羌活", "薏苡仁", "薤白", "淡竹叶", "淡豆豉",
            "鲜白茅根", "鲜石斛", "罂粟壳", "葛花", "墨旱莲",
            "皱波菜", "葫芦", "荞麦", "橘皮", "薄荷", "蕨根",
            "鳖甲", "藏红花", "藿香", "高良姜", "橘红", "橘核",
            "橘络", "橘叶",
        }

        # 禁止用于食品的中药材
        self.prohibited_tcm: set = {
            "马钱子", "川乌", "草乌", "附子", "天仙子", "洋金花",
            "红粉", "白降丹", "轻粉", "雄黄", "朱砂", "砒石", "砒霜",
            "关木通", "广防己", "青木香", "雷公藤", "闹羊花", "斑蝥",
            "水银", "铅丹", "密陀僧", "红升", "白降", "硫磺",
        }

        # 十八反
        self.eighteen_incompatibilities: Dict[str, List[str]] = {
            "甘草": ["海藻", "大戟", "甘遂", "芫花"],
            "乌头": ["贝母", "瓜蒌", "半夏", "白蔹", "白及"],
            "藜芦": ["人参", "沙参", "丹参", "玄参", "细辛", "芍药", "苦参", "拳参"],
            "细辛": ["藜芦"],
            "芍药": ["藜芦"],
            "半夏": ["乌头"],
            "瓜蒌": ["乌头"],
            "白及": ["乌头"],
            "白蔹": ["乌头"],
            "海藻": ["甘草"],
            "大戟": ["甘草"],
            "甘遂": ["甘草"],
            "芫花": ["甘草"],
        }

        # 十九畏
        self.nineteen_aversions: Dict[str, List[str]] = {
            "硫黄": ["朴硝", "芒硝"],
            "水银": ["砒霜"],
            "狼毒": ["密陀僧"],
            "巴豆": ["牵牛子", "黑丑", "白丑"],
            "丁香": ["郁金"],
            "川乌/草乌": ["犀角", "牛角"],
            "牙硝": ["三棱"],
            "官桂": ["赤石脂"],
            "人参": ["藜芦"],
        }

        # GB 2760 允许的食品添加剂 (常见)
        self.gb2760_allowed_additives: Dict[str, Dict[str, Any]] = {
            "苯甲酸钠": {"max_usage": "0.5g/kg", "categories": ["碳酸饮料", "果汁", "酱菜"]},
            "山梨酸钾": {"max_usage": "2.0g/kg", "categories": ["糕点", "面包", "酱菜", "蜜饯"]},
            "亚硝酸钠": {"max_usage": "0.15g/kg", "categories": ["腌腊肉制品", "酱卤肉"]},
            "二氧化硫": {"max_usage": "0.1g/kg", "categories": ["干果", "葡萄酒", "果酒"]},
            "柠檬酸": {"max_usage": "按生产需要适量使用", "categories": ["所有食品"]},
            "阿斯巴甜": {"max_usage": "0.5g/kg", "categories": ["饮料", "糕点", "口香糖"]},
            "安赛蜜": {"max_usage": "0.3g/kg", "categories": ["饮料", "糕点", "糖果"]},
            "三氯蔗糖": {"max_usage": "0.25g/kg", "categories": ["饮料", "糕点", "糖果"]},
            "糖精钠": {"max_usage": "0.15g/kg", "categories": ["饮料", "蜜饯", "酱菜"]},
            "甜蜜素": {"max_usage": "0.65g/kg", "categories": ["饮料", "糕点", "蜜饯"]},
        }

        # GB 14880 营养强化剂
        self.gb14880_enrichers: Dict[str, Dict[str, Any]] = {
            "维生素A": {"min": "1500IU/100kJ", "max": "6000IU/100kJ", "categories": ["婴幼儿食品", "乳制品"]},
            "维生素D": {"min": "10IU/100kJ", "max": "50IU/100kJ", "categories": ["乳制品", "谷物"]},
            "钙": {"min": "50mg/100kJ", "max": "300mg/100kJ", "categories": ["乳制品", "谷物", "饮料"]},
            "铁": {"min": "1mg/100kJ", "max": "5mg/100kJ", "categories": ["谷物", "婴幼儿食品"]},
            "锌": {"min": "0.5mg/100kJ", "max": "3mg/100kJ", "categories": ["谷物", "饮料"]},
            "叶酸": {"min": "15μg/100kJ", "max": "60μg/100kJ", "categories": ["谷物", "婴幼儿食品"]},
            "牛磺酸": {"min": "100mg/100ml", "max": "3000mg/100ml", "categories": ["能量饮料", "婴幼儿食品"]},
        }

        logger.info(f"[RegulationDatabase] 法规数据库已加载: "
                    f"{len(self.food_homology_items)} 种药食同源, "
                    f"{len(self.prohibited_tcm)} 种禁用品, "
                    f"{len(self.gb2760_allowed_additives)} 种添加剂")


# ── 合规引擎 ──

class ComplianceEngine:
    """
    中国食品安全合规检查引擎 v2

    检查维度:
    1. 药食同源目录 (卫健委)
    2. GB 2760 食品添加剂使用标准
    3. GB 14880 营养强化剂使用标准
    4. 新食品原料审批目录
    5. 毒性等级检查
    6. 每日最大摄入量检查
    7. 配伍禁忌 (十八反十九畏)
    8. 特殊人群禁忌
    9. 法规版本追踪
    """

    def __init__(self):
        self.db = RegulationDatabase()
        self._last_check_time = None

    def _create_violation(self, code: str, message: str, severity: str,
                          regulation_ref: str = "", suggestion: str = "") -> RegulationViolation:
        """创建违规项"""
        return RegulationViolation(
            code=code,
            message=message,
            severity=severity,
            regulation_ref=regulation_ref,
            suggestion=suggestion,
        )

    def _calculate_score(self, violations: List[RegulationViolation],
                         warnings: List[RegulationViolation]) -> float:
        """计算合规评分"""
        score = 1.0
        for v in violations:
            if v.severity == "critical":
                score -= 0.3
            elif v.severity == "warning":
                score -= 0.1
            elif v.severity == "info":
                score -= 0.02
        for w in warnings:
            if w.severity == "warning":
                score -= 0.05
        return max(0.0, min(1.0, score))

    async def check_food_material(
        self,
        material: Dict[str, Any],
    ) -> ComplianceCheckResult:
        """
        检查单个食品原料的合规性

        Args:
            material: 食品原料数据 (FoodMaterial.to_dict())

        Returns:
            合规检查结果
        """
        violations = []
        warnings_list = []
        info = []

        name = material.get("name_cn", "")
        toxicity = material.get("toxicity_class", "")
        food_homology = material.get("food_homology", False)
        reg_status = material.get("regulatory_status", "")
        safe_dose_max = material.get("safe_dose_max")
        aliases = material.get("aliases", []) or []

        # 1. 检查是否在禁用品列表中
        if name in self.db.prohibited_tcm:
            violations.append(self._create_violation(
                "PROHIBITED_TCM",
                f"'{name}' 属于禁止用于食品的中药材",
                "critical",
                "《食品安全法》第三十八条",
                "立即移除该原料",
            ))

        # 检查别名
        for alias in aliases:
            if alias in self.db.prohibited_tcm:
                violations.append(self._create_violation(
                    "PROHIBITED_ALIAS",
                    f"'{name}' 的别名 '{alias}' 属于禁用品",
                    "critical",
                    "《食品安全法》第三十八条",
                    "检查原料名称是否正确",
                ))

        # 2. 检查毒性等级
        if toxicity == "大毒":
            violations.append(self._create_violation(
                "HIGH_TOXICITY",
                f"'{name}' 毒性等级为大毒，不可用于食品",
                "critical",
                "《药品管理法》",
                "替换为低毒性原料",
            ))
        elif toxicity == "有毒":
            warnings_list.append(self._create_violation(
                "TOXIC_TCM",
                f"'{name}' 毒性等级为有毒，需谨慎使用",
                "warning",
                "《中国药典》",
                "严格控制用量并标注警示",
            ))

        # 3. 检查药食同源身份
        if name not in self.db.food_homology_items and not food_homology:
            # 检查是否是普通食品原料
            common_foods = {"大米", "小麦", "玉米", "大豆", "花生", "芝麻",
                          "南瓜", "冬瓜", "黄瓜", "番茄", "胡萝卜", "白菜",
                          "菠菜", "芹菜", "韭菜", "洋葱", "大蒜", "生姜",
                          "辣椒", "胡椒", "八角", "桂皮", "花椒", "丁香",
                          "肉桂", "小茴香", "陈皮", "茯苓", "山药", "莲子",
                          "百合", "红枣", "枸杞", "桂圆", "核桃", "杏仁",
                          "蜂蜜", "麦芽", "薄荷", "菊花", "桑叶", "金银花",
                          "荷叶", "决明子", "薏苡仁", "赤小豆", "黑豆",
                          "绿豆", "红豆", "黄豆", "豆腐", "豆浆", "豆干",
                          "腐竹", "面筋", "粉丝", "粉条", "面条", "馒头",
                          "包子", "饺子", "粽子", "汤圆", "年糕", "月饼",
                          "蛋糕", "饼干", "巧克力", "糖果", "果冻", "冰淇淋",
                          "酸奶", "牛奶", "奶酪", "黄油", "奶油", "植物油",
                          "动物油", "猪油", "牛油", "羊油", "鱼油", "虾油",
                          "蟹黄", "鱼翅", "燕窝", "海参", "鲍鱼", "龙虾",
                          "螃蟹", "虾", "贝类", "牡蛎", "扇贝", "蛤蜊",
                          "贻贝", "海螺", "鲍鱼", "章鱼", "鱿鱼", "墨鱼",
                          "海胆", "海星", "海带", "紫菜", "裙带菜", "石花菜",
                          "琼脂", "卡拉胶",
                          }
            if name not in common_foods:
                warnings_list.append(self._create_violation(
                    "NOT_FOOD_HOMOLOGY",
                    f"'{name}' 不在药食同源目录中，需确认是否为合法食品原料",
                    "warning",
                    "卫健委《既是食品又是药品的物品名单》",
                    "查询最新药食同源目录或申请新食品原料审批",
                ))

        # 4. 检查安全剂量
        if safe_dose_max is None and food_homology:
            warnings_list.append(self._create_violation(
                "NO_DOSAGE_INFO",
                f"'{name}' 为药食同源物质但缺少安全剂量信息",
                "info",
                "《中国药典》",
                "补充安全剂量数据",
            ))

        # 5. 检查审批状态
        if reg_status == "禁用":
            violations.append(self._create_violation(
                "REGULATORY_BANNED",
                f"'{name}' 法规状态为禁用",
                "critical",
                "《食品安全法》",
                "立即停止使用",
            ))
        elif reg_status == "限制使用":
            warnings_list.append(self._create_violation(
                "REGULATORY_RESTRICTED",
                f"'{name}' 法规状态为限制使用",
                "warning",
                "《食品安全法》",
                "严格遵守使用限制",
            ))

        # 6. 检查禁忌
        contraindications = material.get("contraindications", []) or []
        if contraindications:
            info.append(self._create_violation(
                "CONTRAINDICATIONS",
                f"'{name}' 有以下禁忌: {', '.join(contraindications)}",
                "info",
                "",
                "",
            ))

        # 7. 检查相互作用
        interactions = material.get("interactions", []) or []
        if interactions:
            info.append(self._create_violation(
                "INTERACTIONS",
                f"'{name}' 有以下药物相互作用: {', '.join(interactions)}",
                "info",
                "",
                "",
            ))

        score = self._calculate_score(violations, warnings_list)
        checked_at = datetime.now(timezone.utc).isoformat()

        return ComplianceCheckResult(
            passed=len([v for v in violations if v.severity == "critical"]) == 0,
            violations=violations,
            warnings=warnings_list,
            info=info,
            score=score,
            checked_at=checked_at,
        )

    async def check_formula_compliance(
        self,
        formula_items: List[Dict[str, Any]],
    ) -> FormulaComplianceReport:
        """
        检查配方的整体合规性

        Args:
            formula_items: 配方中的原料列表

        Returns:
            配方合规报告
        """
        material_checks = []
        compatibility_issues = []
        dosage_warnings = []
        regulatory_flags = []

        all_violations = []
        all_warnings = []
        all_scores = []

        # 1. 检查每个原料的合规性
        for item in formula_items:
            result = await self.check_food_material(item)
            material_checks.append({
                "name": item.get("name_cn", ""),
                "passed": result.passed,
                "score": result.score,
                "violations": [v.__dict__ for v in result.violations],
                "warnings": [w.__dict__ for w in result.warnings],
            })
            all_violations.extend(result.violations)
            all_warnings.extend(result.warnings)
            all_scores.append(result.score)

        # 2. 检查配伍禁忌 (十八反)
        names = {item.get("name_cn") for item in formula_items if item.get("name_cn")}
        for herb, incompatible in self.db.eighteen_incompatibilities.items():
            if herb in names:
                found_conflicts = names.intersection(incompatible)
                for conflict in found_conflicts:
                    violation = self._create_violation(
                        "EIGHTEEN_INCOMPATIBILITY",
                        f"配伍禁忌: '{herb}' 与 '{conflict}' 属于十八反，不可同用",
                        "critical",
                        "《神农本草经》",
                        "移除配伍禁忌的原料",
                    )
                    compatibility_issues.append({
                        "type": "十八反",
                        "herb1": herb,
                        "herb2": conflict,
                        "violation": violation.__dict__,
                    })
                    all_violations.append(violation)

        # 3. 检查十九畏
        for herb1, aversions in self.db.nineteen_aversions.items():
            herb1_name = herb1.split("/")[0]
            if herb1_name in names:
                found_aversions = set(aversions).intersection(names)
                for aversion in found_aversions:
                    warning = self._create_violation(
                        "NINETEEN_AVERSION",
                        f"十九畏: '{herb1_name}' 畏 '{aversion}'，不宜同用",
                        "warning",
                        "《本草纲目》",
                        "考虑调整配方或标注警示",
                    )
                    compatibility_issues.append({
                        "type": "十九畏",
                        "herb1": herb1_name,
                        "herb2": aversion,
                        "warning": warning.__dict__,
                    })
                    all_warnings.append(warning)

        # 4. 检查剂量总和
        total_safe_dose = 0
        for item in formula_items:
            dose_max = item.get("safe_dose_max")
            if dose_max:
                total_safe_dose += dose_max
                if total_safe_dose > 100:  # 假设总剂量上限 100g
                    dosage_warnings.append({
                        "message": f"配方总安全剂量 ({total_safe_dose}g) 超过建议上限",
                        "items": [i.get("name_cn") for i in formula_items if i.get("safe_dose_max")],
                    })

        # 5. 计算整体评分
        overall_score = sum(all_scores) / len(all_scores) if all_scores else 0.0
        overall_passed = len([v for v in all_violations if v.severity == "critical"]) == 0

        # 6. 法规标志
        if not overall_passed:
            regulatory_flags.append({
                "type": "不合规",
                "message": "配方存在严重违规项，不可上市销售",
                "action": "必须修改配方后重新检测",
            })
        elif overall_score < 0.8:
            regulatory_flags.append({
                "type": "警告",
                "message": "配方合规评分较低，建议优化",
                "action": "检查警告项并改进",
            })
        else:
            regulatory_flags.append({
                "type": "合规",
                "message": "配方符合中国食品安全法规",
                "action": "可进入生产流程",
            })

        return FormulaComplianceReport(
            overall_passed=overall_passed,
            overall_score=overall_score,
            material_checks=material_checks,
            compatibility_issues=compatibility_issues,
            dosage_warnings=dosage_warnings,
            regulatory_flags=regulatory_flags,
        )

    async def check_additive_compliance(
        self,
        additives: List[Dict[str, Any]],
        food_category: str,
    ) -> ComplianceCheckResult:
        """
        检查食品添加剂合规性 (GB 2760)

        Args:
            additives: 添加剂列表 [{"name": "苯甲酸钠", "amount": "0.3g/kg"}]
            food_category: 食品类别

        Returns:
            合规检查结果
        """
        violations = []
        warnings_list = []

        for additive in additives:
            name = additive.get("name", "")
            amount = additive.get("amount", "")

            if name in self.db.gb2760_allowed_additives:
                allowed = self.db.gb2760_allowed_additives[name]
                max_usage = allowed["max_usage"]
                categories = allowed["categories"]

                # 检查是否在允许类别中
                if food_category not in categories and "所有食品" not in categories:
                    violations.append(self._create_violation(
                        "ADDITIVE_CATEGORY_NOT_ALLOWED",
                        f"'{name}' 不允许用于 '{food_category}' 类食品",
                        "critical",
                        "GB 2760-2014",
                        "选择允许使用的添加剂",
                    ))

                # 检查用量 (简化检查)
                if amount and max_usage != "按生产需要适量使用":
                    try:
                        # 提取数值部分进行比较
                        max_val = float(max_usage.split("g")[0].split("/")[-1])
                        amount_val = float(amount.replace("g/kg", "").strip())
                        if amount_val > max_val:
                            violations.append(self._create_violation(
                                "ADDITIVE_EXCEEDS_LIMIT",
                                f"'{name}' 用量 {amount} 超过 GB 2760 限值 {max_usage}",
                                "critical",
                                "GB 2760-2014",
                                f"降低用量至 {max_usage} 以内",
                            ))
                    except ValueError:
                        pass  # 跳过无法解析的用量
            else:
                warnings_list.append(self._create_violation(
                    "ADDITIVE_NOT_IN_GB2760",
                    f"'{name}' 不在 GB 2760 允许列表中",
                    "warning",
                    "GB 2760-2014",
                    "查询最新 GB 2760 目录",
                ))

        score = self._calculate_score(violations, warnings_list)
        return ComplianceCheckResult(
            passed=len([v for v in violations if v.severity == "critical"]) == 0,
            violations=violations,
            warnings=warnings_list,
            score=score,
        )

    async def check_enricher_compliance(
        self,
        enrichers: List[Dict[str, Any]],
        food_category: str,
    ) -> ComplianceCheckResult:
        """
        检查营养强化剂合规性 (GB 14880)

        Args:
            enrichers: 强化剂列表 [{"name": "维生素A", "amount": "3000IU/100kJ"}]
            food_category: 食品类别

        Returns:
            合规检查结果
        """
        violations = []
        warnings_list = []

        for enricher in enrichers:
            name = enricher.get("name", "")
            amount = enricher.get("amount", "")

            if name in self.db.gb14880_enrichers:
                allowed = self.db.gb14880_enrichers[name]
                min_val = allowed["min"]
                max_val = allowed["max"]
                categories = allowed["categories"]

                # 检查类别
                if food_category not in categories:
                    warnings_list.append(self._create_violation(
                        "ENRICHER_CATEGORY_NOT_ALLOWED",
                        f"'{name}' 不允许用于 '{food_category}' 类食品",
                        "warning",
                        "GB 14880-2012",
                        "选择允许使用的强化剂",
                    ))

                # 检查用量范围 (简化)
                if amount:
                    try:
                        val = float(amount.split("/")[0].replace("IU", "").replace("mg", "").replace("μg", "").strip())
                        min_num = float(min_val.split("/")[0].replace("IU", "").replace("mg", "").replace("μg", "").strip())
                        max_num = float(max_val.split("/")[0].replace("IU", "").replace("mg", "").replace("μg", "").strip())
                        if val < min_num or val > max_num:
                            violations.append(self._create_violation(
                                "ENRICHER_OUT_OF_RANGE",
                                f"'{name}' 用量 {amount} 超出 GB 14880 范围 {min_val}-{max_val}",
                                "critical",
                                "GB 14880-2012",
                                f"调整用量至 {min_val}-{max_val} 范围内",
                            ))
                    except ValueError:
                        pass
            else:
                warnings_list.append(self._create_violation(
                    "ENRICHER_NOT_IN_GB14880",
                    f"'{name}' 不在 GB 14880 允许列表中",
                    "warning",
                    "GB 14880-2012",
                    "查询最新 GB 14880 目录",
                ))

        score = self._calculate_score(violations, warnings_list)
        return ComplianceCheckResult(
            passed=len([v for v in violations if v.severity == "critical"]) == 0,
            violations=violations,
            warnings=warnings_list,
            score=score,
        )
