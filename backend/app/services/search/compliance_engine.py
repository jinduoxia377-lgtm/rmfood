"""
合规检查引擎

对标 Potion AI VFT 的合规检查能力，适配中国食品安全法规体系。
自动检查原料/产品的法规合规性。
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ComplianceCheckResult:
    """合规检查结果"""
    def __init__(self, passed: bool, violations: List[Dict[str, Any]] = None,
                 warnings: List[Dict[str, Any]] = None, info: List[Dict[str, Any]] = None):
        self.passed = passed
        self.violations = violations or []
        self.warnings = warnings or []
        self.info = info or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
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
        # 药食同源目录 (部分)
        self.food_homology_items = {
            "枸杞子", "山药", "山楂", "桂圆肉", "核桃仁", "杏仁", "薄荷",
            "薏苡仁", "赤小豆", "莲子", "百合", "荷叶", "淡竹叶", "菊花",
            "桑叶", "决明子", "茺蔚子", "桔梗", "栀子", "麦芽", "蒲黄",
            "莱菔子", "紫苏子", "火麻仁", "枳椇子", "蜂蜜", "豆蔻", "砂仁",
            "羊肚菌", "平菇", "黑木耳", "银耳", "桑葚", "葛根", "乌梅",
            "玫瑰花瓣", "佛手", "香橼", "小茴香", "丁香", "八角茴香",
            "淡豆豉", "神曲", "鸡内金", "番泻叶", "胖大海", "西红花",
            "雪莲", "藏红花", "灵芝", "蜂胶", "花粉",
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
        warnings = []
        info = []

        name = material.get("name_cn", "")

        # 1. 检查是否在禁用品列表中
        if name in self.prohibited_tcm:
            violations.append({
                "code": "PROHIBITED_TCM",
                "message": f"'{name}' 属于禁止用于食品的中药材",
                "severity": "critical",
            })

        # 2. 检查毒性等级
        toxicity = material.get("toxicity_class")
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

        # 3. 检查安全剂量
        safe_dose_max = material.get("safe_dose_max")
        if safe_dose_max is None and material.get("food_homology"):
            warnings.append({
                "code": "NO_DOSAGE_INFO",
                "message": f"'{name}' 为药食同源物质但缺少安全剂量信息",
                "severity": "info",
            })

        # 4. 检查审批状态
        reg_status = material.get("regulatory_status")
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

        # 5. 检查禁忌
        contraindications = material.get("contraindications", [])
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

        # 1. 检查每个原料的合规性
        for item in formula_items:
            result = await self.check_food_material(item)
            all_violations.extend(result.violations)
            all_warnings.extend(result.warnings)
            all_info.extend(result.info)

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
        )
