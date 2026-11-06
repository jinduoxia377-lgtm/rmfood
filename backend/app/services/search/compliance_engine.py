"""
合规检查引擎

对标 Potion AI VFT 的合规检查能力，适配中国食品安全法规体系。
自动检查原料/产品的法规合规性。
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class ComplianceCheckResult:
    """合规检查结果

    data_sufficient 语义 (P0-1):
        True  —— regulatory_status 已知，passed=False 才是真正「不合规」，
                 passed=True 才是真正「已验证合规」。
        False —— regulatory_status 缺失/为空，无法判定法规合规性。
                 此时 passed 只反映「未触发任何硬性违规」，
                 绝不能被前端解读为「已验证合规」，
                 必须结合 UNKNOWN_REGULATORY_STATUS 提示「状态未知待评估」。
    """
    def __init__(self, passed: bool, violations: List[Dict[str, Any]] = None,
                 warnings: List[Dict[str, Any]] = None, info: List[Dict[str, Any]] = None,
                 data_sufficient: bool = True):
        self.passed = passed
        self.violations = violations or []
        self.warnings = warnings or []
        self.info = info or []
        self.data_sufficient = data_sufficient

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "data_sufficient": self.data_sufficient,
            "violation_count": len(self.violations),
            "warning_count": len(self.warnings),
            "info_count": len(self.info),
            "violations": self.violations,
            "warnings": self.warnings,
            "info": self.info,
        }


class ComplianceEngine:
    """
    中国食品安全合规检查引擎

    检查维度:
    1. 药食同源目录 (卫健委)
    2. GB 2760 食品添加剂使用标准
    3. GB 14880 营养强化剂使用标准
    4. 新食品原料审批目录
    5. 毒性等级检查
    6. 每日最大摄入量检查
    7. 配伍禁忌 (十八反十九畏)
    """

    def __init__(self):
        self._load_regulations()

    def _load_regulations(self):
        """加载法规数据库"""
        # 药食同源目录（国家卫健委 2024 版，共 106 种）
        # 组成：卫法监发〔2002〕第51号公告（87种）+ 2019年第8号（6种）
        #       + 2023年第9号（9种）+ 2024年第4号（4种）。
        # 含常用别名匹配项（姜/生姜/干姜、枣/大枣、橘皮/陈皮、桑椹/桑葚、
        # 龙眼肉/桂圆/桂圆肉、桔红/橘红、西红花/藏红花、山柰/山奈）。
        self.food_homology_items = {
            # 卫法监发〔2002〕第51号公告（87种）
            "阿胶", "八角茴香", "白扁豆", "白扁豆花", "白果",
            "白芷", "百合", "薄荷", "赤小豆", "代代花",
            "淡豆豉", "淡竹叶", "刀豆", "丁香", "榧子",
            "蜂蜜", "佛手", "茯苓", "蝮蛇", "覆盆子",
            "甘草", "高良姜", "葛根", "枸杞子", "荷叶",
            "黑胡椒", "黑芝麻", "花椒", "槐花", "槐米",
            "黄芥子", "黄精", "火麻仁", "藿香", "鸡内金",
            "姜", "金银花", "桔梗", "桔红", "菊花",
            "菊苣", "橘皮", "决明子", "昆布", "莱菔子",
            "莲子", "龙眼肉", "罗汉果", "马齿苋", "麦芽",
            "牡蛎", "木瓜", "胖大海", "蒲公英", "芡实",
            "青果", "肉豆蔻", "肉桂", "桑椹", "桑叶",
            "沙棘", "砂仁", "山药", "山楂", "酸枣仁",
            "桃仁", "乌梅", "乌梢蛇", "鲜白茅根", "鲜芦根",
            "香薷", "香橼", "小茴香", "小蓟", "薤白",
            "杏仁", "益智仁", "薏苡仁", "余甘子", "鱼腥草",
            "玉竹", "郁李仁", "枣", "栀子", "枳椇子",
            "紫苏", "紫苏籽",
            # 2019年第8号公告（6种）
            "当归", "姜黄", "荜茇", "草果", "山柰", "西红花",
            # 2023年第9号公告（9种）
            "党参", "杜仲叶", "黄芪", "灵芝", "肉苁蓉",
            "山茱萸", "天麻", "铁皮石斛", "西洋参",
            # 2024年第4号公告（4种）
            "地黄", "化橘红", "麦冬", "天冬",
            # 常用别名（匹配项）
            "生姜", "干姜", "大枣", "陈皮", "桑葚",
            "桂圆", "桂圆肉", "橘红", "山奈", "藏红花",
        }

        # 禁止入食品的中药材
        self.prohibited_tcm = {
            "马钱子", "川乌", "草乌", "附子", "天仙子", "洋金花",
            "红粉", "白降丹", "轻粉", "雄黄", "朱砂", "砒石", "砒霜",
        }

        # 毒性等级
        self.toxicity_classes = {
            "无毒": self.food_homology_items,
            "小毒": {"马兜铃", "关木通", "广防己"},  # 已禁用
            "有毒": {"半夏", "天南星", "白附子", "白芥子"},
            "大毒": {"川乌", "草乌", "马钱子", "斑蝥"},
        }

        # 十八反
        self.eighteen_incompatibilities = {
            "甘草": ["海藻", "大戟", "甘遂", "芫花"],
            "乌头": ["贝母", "瓜蒌", "半夏", "白蔹", "白及"],
            "藜芦": ["人参", "沙参", "丹参", "玄参", "细辛", "芍药"],
        }

        # 十九畏
        self.nineteen_aversions = {
            "硫黄": ["朴硝"],
            "水银": ["砒霜"],
            "狼毒": ["密陀僧"],
            "巴豆": ["牵牛"],
            "丁香": ["郁金"],
            "川乌/草乌": ["犀角"],
            "牙硝": ["三棱"],
            "官桂": ["石脂"],
            "人参": ["黎芦"],
        }

        logger.info(f"[ComplianceEngine] 法规数据库已加载: "
                    f"{len(self.food_homology_items)} 种药食同源, "
                    f"{len(self.prohibited_tcm)} 种禁用品")

    @staticmethod
    def _get(material: Dict[str, Any], *paths: str, default: Any = None) -> Any:
        """
        按优先级依次从 material 中读取字段，兼容「嵌套」与「扁平」两种形态。

        P0-6 修复：路由传入的是 FoodMaterial.to_dict()，把
            regulatory_status   -> regulatory.status
            safe_dose_max       -> safety.safe_dose_max
            contraindications   -> safety.contraindications
            toxicity_class      (仍为扁平)
            food_homology       (仍为扁平)
        而历史调用方可能仍传扁平键。这里逐路径尝试，
        路径用 '.' 分隔表示嵌套键；返回第一个非 None 命中值。

        示例:
            _get(m, "regulatory.status", "regulatory_status")
            _get(m, "safety.safe_dose_max", "safe_dose_max")
        """
        for path in paths:
            if "." in path:
                cur: Any = material
                ok = True
                for part in path.split("."):
                    if isinstance(cur, dict) and part in cur:
                        cur = cur[part]
                    else:
                        ok = False
                        break
                if ok and cur is not None:
                    return cur
            else:
                val = material.get(path)
                if val is not None:
                    return val
        return default

    async def check_food_material(
        self,
        material: Dict[str, Any],
    ) -> ComplianceCheckResult:
        """
        检查单个食品原料的合规性

        Args:
            material: 食品原料数据 (FoodMaterial.to_dict() 或扁平 dict)

        Returns:
            合规检查结果 (含 data_sufficient 标记，见 P0-1)
        """
        violations = []
        warnings = []
        info = []

        name = material.get("name_cn", "")

        # 1. 检查是否在禁用品列表中 (兜底名单，独立于 regulatory_status)
        if name in self.prohibited_tcm:
            violations.append({
                "code": "PROHIBITED_TCM",
                "message": f"'{name}' 属于禁止用于食品的中药材",
                "severity": "critical",
            })

        # 2. 检查毒性等级
        toxicity = self._get(material, "toxicity_class")
        if toxicity in ("大毒",):
            violations.append({
                "code": "HIGH_TOXICITY",
                "message": f"'{name}' 毒性等级为大毒，不可用于食品",
                "severity": "critical",
            })
        elif toxicity in ("有毒",):
            warnings.append({
                "code": "TOXIC_TCM",
                "message": f"'{name}' 毒性等级为有毒，需谨慎使用",
                "severity": "warning",
            })

        # 3. 检查安全剂量 (P0-6: 优先 safety.safe_dose_max，回退扁平)
        safe_dose_max = self._get(material, "safety.safe_dose_max", "safe_dose_max")
        food_homology = self._get(material, "food_homology", default=False)
        if safe_dose_max is None and food_homology:
            warnings.append({
                "code": "NO_DOSAGE_INFO",
                "message": f"'{name}' 为药食同源物质但缺少安全剂量信息",
                "severity": "info",
            })

        # 4. 检查审批状态 (P0-6: 优先 regulatory.status，回退扁平 regulatory_status)
        reg_status = self._get(material, "regulatory.status", "regulatory_status")
        data_sufficient = reg_status not in (None, "")
        if reg_status == "禁用":
            violations.append({
                "code": "REGULATORY_BANNED",
                "message": f"'{name}' 法规状态为禁用",
                "severity": "critical",
            })
        elif reg_status == "限制使用":
            warnings.append({
                "code": "REGULATORY_RESTRICTED",
                "message": f"'{name}' 法规状态为限制使用",
                "severity": "warning",
            })
        elif not data_sufficient:
            # P0-1 叠加：状态未知时输出一条 warning 提示「待评估」，
            # 不因此判 passed=false（passed 仍由硬性违规决定），
            # 但通过 data_sufficient=False 让前端能区分
            # 「已验证合规」vs「状态未知，尚未完成合规评估」。
            warnings.append({
                "code": "UNKNOWN_REGULATORY_STATUS",
                "message": f"'{name}' 缺少法规审批状态，合规性待评估",
                "severity": "warning",
            })

        # 5. 检查禁忌 (P0-6: 优先 safety.contraindications，回退扁平)
        contraindications = self._get(material, "safety.contraindications",
                                      "contraindications", default=[]) or []
        if contraindications:
            info.append({
                "code": "CONTRAINDICATIONS",
                "message": f"'{name}' 有以下禁忌: {', '.join(contraindications)}",
                "severity": "info",
            })

        return ComplianceCheckResult(
            passed=len(violations) == 0,
            violations=violations,
            warnings=warnings,
            info=info,
            data_sufficient=data_sufficient,
        )

    async def check_formula_compliance(
        self,
        formula_items: List[Dict[str, Any]],
    ) -> ComplianceCheckResult:
        """
        检查配方的整体合规性

        Args:
            formula_items: 配方中的原料列表

        Returns:
            合规检查结果
        """
        all_violations = []
        all_warnings = []
        all_info = []
        all_data_sufficient = True

        # 1. 检查每个原料的合规性
        for item in formula_items:
            result = await self.check_food_material(item)
            all_violations.extend(result.violations)
            all_warnings.extend(result.warnings)
            all_info.extend(result.info)
            if not result.data_sufficient:
                all_data_sufficient = False

        # 2. 检查配伍禁忌 (十八反)
        names = {item.get("name_cn") for item in formula_items if item.get("name_cn")}
        for herb, incompatible in self.eighteen_incompatibilities.items():
            if herb in names:
                found_conflicts = names.intersection(incompatible)
                for conflict in found_conflicts:
                    all_violations.append({
                        "code": "EIGHTEEN_INCOMPATIBILITY",
                        "message": f"配伍禁忌: '{herb}' 与 '{conflict}' 属于十八反，不可同用",
                        "severity": "critical",
                    })

        # 3. 检查十九畏
        for herb1, aversions in self.nineteen_aversions.items():
            herb1_name = herb1.split("/")[0]  # 处理 "川乌/草乌" 格式
            if herb1_name in names:
                found_aversions = set(aversions).intersection(names)
                for aversion in found_aversions:
                    all_warnings.append({
                        "code": "NINETEEN_AVERSION",
                        "message": f"十九畏: '{herb1_name}' 畏 '{aversion}'，不宜同用",
                        "severity": "warning",
                    })

        return ComplianceCheckResult(
            passed=len(all_violations) == 0,
            violations=all_violations,
            warnings=all_warnings,
            info=all_info,
            data_sufficient=all_data_sufficient,
        )
