"""
配方可解释性报告生成服务

为每个 AI 推荐的配方自动生成包含以下内容的解释报告：
1. 关键efficacy贡献者分析
2. 拮抗与协同效应
3. 优化方向来源（基于约束条件）
4. 合规性说明

目标：从"黑盒推荐"变为"可信赖的专家建议"
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from app.services.compliance import get_compliance_service
from app.services.compliance.formula_compliance import FOOD_HERB_MAX_DOSAGE

logger = logging.getLogger(__name__)


class ContributionLevel(str, Enum):
    CORE = "core"          # 核心贡献者（君）
    PRIMARY = "primary"    # 主要贡献者（臣）
    SUPPORTING = "supporting"  # 辅助贡献者（佐）
    MODERATOR = "moderator"   # 调和剂（使）


@dataclass
class IngredientContribution:
    """单个成分的贡献分析"""
    name: str
    role: ContributionLevel
    efficacy_contribution: float = 0.0    # 0-1 efficacy贡献度
    safety_score: float = 0.0       # 0-100 安全评分
    dosage_ratio: float = 0.0       # 实际用量/限量比
    mechanism: str = ""              # 作用机制简述
    evidence: str = ""              # 证据来源
    suggestions: List[str] = field(default_factory=list)


@dataclass
class InteractionEffect:
    """成分间相互作用"""
    ingredient_a: str
    ingredient_b: str
    effect_type: str  # "synergy" | "antagonism" | "neutral"
    strength: float = 0.0           # 强度 0-1
    description: str = ""
    recommendation: str = ""


@dataclass
class OptimizationRationale:
    """优化决策依据"""
    constraint_name: str
    constraint_type: str  # "compliance" | "nutrition" | "cost" | "safety"
    value: float = 0.0
    target: float = 0.0
    satisfaction: float = 0.0    # 0-1
    reason: str = ""


@dataclass
class ExplainabilityReport:
    """可解释性报告"""
    formula_name: str
    generated_at: str
    overall_score: float = 0.0
    efficacy_score: float = 0.0
    safety_score: float = 0.0
    cost_score: float = 0.0

    # 贡献者分析
    core_ingredients: List[IngredientContribution] = field(default_factory=list)
    primary_ingredients: List[IngredientContribution] = field(default_factory=list)
    supporting_ingredients: List[IngredientContribution] = field(default_factory=list)

    # 相互作用
    synergies: List[InteractionEffect] = field(default_factory=list)
    antagonisms: List[InteractionEffect] = field(default_factory=list)

    # 优化依据
    optimization_rationales: List[OptimizationRationale] = field(default_factory=list)

    # 合规说明
    compliance_notes: List[str] = field(default_factory=list)

    # 总体建议
    summary: str = ""
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "formula_name": self.formula_name,
            "generated_at": self.generated_at,
            "scores": {
                "overall": round(self.overall_score, 1),
                "efficacy": round(self.efficacy_score, 1),
                "safety": round(self.safety_score, 1),
                "cost": round(self.cost_score, 1),
            },
            "core_ingredients": [
                {"name": i.name, "mechanism": i.mechanism, "evidence": i.evidence}
                for i in self.core_ingredients
            ],
            "primary_ingredients": [
                {"name": i.name, "mechanism": i.mechanism}
                for i in self.primary_ingredients
            ],
            "synergies": [
                {"a": s.ingredient_a, "b": s.ingredient_b,
                 "strength": round(s.strength, 2), "desc": s.description}
                for s in self.synergies
            ],
            "antagonisms": [
                {"a": a.ingredient_a, "b": a.ingredient_b,
                 "strength": round(a.strength, 2)}
                for a in self.antagonisms
            ],
            "optimization_rationales": [
                {
                    "constraint": r.constraint_name,
                    "type": r.constraint_type,
                    "satisfaction": round(r.satisfaction, 2),
                    "reason": r.reason,
                }
                for r in self.optimization_rationales
            ],
            "compliance_notes": self.compliance_notes,
            "summary": self.summary,
            "recommendations": self.recommendations,
        }


class ExplainabilityService:
    """
    配方可解释性分析服务

    分析配方中各成分的efficacy贡献、相互作用和优化决策依据，
    生成结构化的可解释报告。
    """

    # 成分efficacy数据库（简化版，实际应从知识库检索）
    _HERB_PROFILES: Dict[str, Dict[str, Any]] = {
        "枸杞": {
            "effects": ["免疫调节", "抗氧化", "护肝"],
            "mechanism": "枸杞多糖通过调节TLR4/MyD88信号通路增强免疫细胞活性；玉米黄质清除自由基",
            "evidence": "《中国药典》2020年版；J Ethnopharmacol. 2019",
            "role_priority": 3,
        },
        "黄芪": {
            "effects": ["免疫调节", "补气", "抗炎"],
            "mechanism": "黄芪多糖激活巨噬细胞和NK细胞；黄芪皂苷调节Th1/Th2平衡",
            "evidence": "《中华本草》；Phytomedicine. 2020",
            "role_priority": 3,
        },
        "人参": {
            "effects": ["大补元气", "安神", "抗疲劳"],
            "mechanism": "人参皂苷Rg1/Rb1调节HPA轴；多糖增强脾脏免疫器官重量",
            "evidence": "《中国药典》2020年版；Fitoterapia. 2018",
            "role_priority": 4,
        },
        "红枣": {
            "effects": ["补血", "健脾", "安神"],
            "mechanism": "环磷酸腺苷调节免疫；黄酮类化合物抗氧化",
            "evidence": "《本草纲目》；Food Chem. 2021",
            "role_priority": 2,
        },
        "茯苓": {
            "effects": ["利水渗湿", "健脾", "安神"],
            "mechanism": "茯苓多糖调节肠道菌群；三萜类化合物抗炎",
            "evidence": "《中国药典》2020年版；J Ethnopharmacol. 2017",
            "role_priority": 2,
        },
        "山药": {
            "effects": ["补脾养胃", "益肺补肾"],
            "mechanism": "薯蓣皂苷调节糖代谢；粘液蛋白保护胃黏膜",
            "evidence": "《本草纲目》；J Agric Food Chem. 2019",
            "role_priority": 2,
        },
        "菊花": {
            "effects": ["疏散风热", "清肝明目"],
            "mechanism": "芹菜素抑制NF-κB通路；黄酮类抗氧化",
            "evidence": "《中国药典》2020年版",
            "role_priority": 1,
        },
        "薄荷": {
            "effects": ["疏散风热", "利咽"],
            "mechanism": "薄荷脑激活TRPM8受体；挥发油解痉",
            "evidence": "《中国药典》2020年版",
            "role_priority": 1,
        },
    }

    # 已知协同/拮抗对
    _SYNERGY_PAIRS: Dict[tuple, Dict[str, Any]] = {
        ("黄芪", "人参"): {"type": "synergy", "strength": 0.85, "desc": "补气协同：黄芪 polysaccharide 与人参皂苷共同增强免疫", "recommendation": "推荐配伍，经典药对"},
        ("枸杞", "菊花"): {"type": "synergy", "strength": 0.75, "desc": "清肝明目协同：枸杞多糖保护视网膜，菊花黄酮清肝火", "recommendation": "推荐配伍，适用于眼疲劳人群"},
        ("黄芪", "茯苓"): {"type": "synergy", "strength": 0.70, "desc": "健脾利水协同：黄芪补气行水，茯苓利水渗湿", "recommendation": "推荐配伍，气虚水肿适用"},
        ("人参", "甘草"): {"type": "synergy", "strength": 0.65, "desc": "调和诸药：甘草皂苷缓释人参皂苷吸收", "recommendation": "常规配伍，注意甘草用量不超过6g"},
        ("枸杞", "红枣"): {"type": "synergy", "strength": 0.70, "desc": "气血双补协同", "recommendation": "推荐配伍，适合气血两虚人群"},
        ("薄荷", "菊花"): {"type": "synergy", "strength": 0.60, "desc": "疏散风热协同", "recommendation": "适合风热感冒初期"},
    }

    def __init__(self):
        self._compliance_svc = get_compliance_service()

    def analyze(
        self,
        formula_name: str,
        ingredients: List[Dict[str, Any]],
        target_effects: List[str],
        optimization_constraints: Optional[Dict[str, Any]] = None,
    ) -> ExplainabilityReport:
        """
        生成配方可解释性报告

        Args:
            formula_name: 配方名称
            ingredients: 成分列表 [{name, dosage_mg, ...}]
            target_effects: 目标efficacy列表
            optimization_constraints: 优化约束条件
        """
        report = ExplainabilityReport(
            formula_name=formula_name,
            generated_at=datetime.now().isoformat(),
        )

        # 1. 成分贡献分析
        contributions = self._analyze_contributions(ingredients, target_effects)
        report.core_ingredients = contributions["core"]
        report.primary_ingredients = contributions["primary"]
        report.supporting_ingredients = contributions["supporting"]

        # 2. 相互作用分析
        synergies, antagonisms = self._analyze_interactions(ingredients)
        report.synergies = synergies
        report.antagonisms = antagonisms

        # 3. 合规检查与说明
        compliance_result = self._compliance_svc.check_compliance(
            ingredients, population="adults"
        )
        report.compliance_notes = self._format_compliance_notes(compliance_result)

        # 4. 优化依据
        if optimization_constraints:
            report.optimization_rationales = self._analyze_optimization(
                ingredients, optimization_constraints
            )

        # 5. 综合评分
        report.overall_score = self._compute_overall_score(
            report, compliance_result
        )
        report.efficacy_score = self._compute_efficacy_score(ingredients, target_effects)
        report.safety_score = compliance_result.score
        report.cost_score = 85.0  # 简化：基于原料成本估算

        # 6. 生成摘要和建议
        report.summary = self._generate_summary(report)
        report.recommendations = self._generate_recommendations(report)

        logger.info(
            "Explainability report generated: formula=%s score=%.1f",
            formula_name, report.overall_score,
        )
        return report

    def _analyze_contributions(
        self,
        ingredients: List[Dict[str, Any]],
        target_effects: List[str],
    ) -> Dict[str, List[IngredientContribution]]:
        """分析各成分的efficacy贡献"""
        result = {"core": [], "primary": [], "supporting": []}

        for ing in ingredients:
            name = ing.get("name", "")
            dosage = ing.get("dosage_mg", 0)

            profile = self._HERB_PROFILES.get(name, {})
            effects = profile.get("effects", [])

            # 计算efficacy匹配度
            effect_match = sum(
                1 for eff in target_effects if any(eff in e for e in effects)
            ) / max(len(target_effects), 1)

            # 计算安全评分
            max_dosage = FOOD_HERB_MAX_DOSAGE.get(name, 9999)
            dosage_ratio = dosage / max_dosage if max_dosage > 0 else 1.0
            safety_score = max(0, 100 - dosage_ratio * 50)

            # 确定角色
            role_priority = profile.get("role_priority", 1)
            if role_priority >= 3 and effect_match >= 0.5:
                role = ContributionLevel.CORE
            elif role_priority >= 2 and effect_match >= 0.3:
                role = ContributionLevel.PRIMARY
            else:
                role = ContributionLevel.SUPPORTING

            contribution = IngredientContribution(
                name=name,
                role=role,
               efficacy_contribution=round(effect_match, 2),
                safety_score=round(safety_score, 1),
                dosage_ratio=round(dosage_ratio, 3),
                mechanism=profile.get("mechanism", ""),
                evidence=profile.get("evidence", ""),
                suggestions=[] if dosage_ratio < 0.8 else [
                    f"'{name}' 用量接近限量，建议监控"
                ],
            )

            if role == ContributionLevel.CORE:
                result["core"].append(contribution)
            elif role == ContributionLevel.PRIMARY:
                result["primary"].append(contribution)
            else:
                result["supporting"].append(contribution)

        # 按efficacy贡献排序
        for key in result:
            result[key].sort(key=lambda x: x.efficacy_contribution, reverse=True)

        return result

    def _analyze_interactions(
        self, ingredients: List[Dict[str, Any]]
    ) -> tuple[List[InteractionEffect], List[InteractionEffect]]:
        """分析成分间相互作用"""
        names = [ing.get("name", "") for ing in ingredients]
        synergies = []
        antagonisms = []

        for i, name_a in enumerate(names):
            for name_b in names[i + 1:]:
                pair = tuple(sorted([name_a, name_b]))
                if pair in self._SYNERGY_PAIRS:
                    info = self._SYNERGY_PAIRS[pair]
                    synergies.append(InteractionEffect(
                        ingredient_a=name_a,
                        ingredient_b=name_b,
                        effect_type=info["type"],
                        strength=info["strength"],
                        description=info["desc"],
                        recommendation=info["recommendation"],
                    ))

        # 检查禁忌搭配
        from app.services.compliance.formula_compliance import PROHIBITED_COMBINATIONS
        for combo in PROHIBITED_COMBINATIONS:
            matched = [h for h in combo if h in names]
            if len(matched) == 2:
                antagonisms.append(InteractionEffect(
                    ingredient_a=matched[0],
                    ingredient_b=matched[1],
                    effect_type="antagonism",
                    strength=1.0,
                    description=f"禁忌搭配：{matched[0]} 与 {matched[1]} 不可同用",
                    recommendation="建议移除其中一个成分",
                ))

        return synergies, antagonisms

    def _format_compliance_notes(
        self, compliance_result
    ) -> List[str]:
        """格式化合规说明"""
        notes = []
        if compliance_result.status == "compliant":
            notes.append("✓ 配方符合药食同源目录（2023版）要求")
        elif compliance_result.status == "warning":
            notes.append("⚠ 配方存在警告项，请检查违规详情")
            for w in compliance_result.warnings:
                notes.append(f"  - {w}")
        else:
            notes.append("✗ 配方存在违规项，需调整后再使用")
            for v in compliance_result.violations:
                notes.append(f"  - {v.message}")

        if compliance_result.suggestions:
            notes.append("建议：")
            for s in compliance_result.suggestions:
                notes.append(f"  - {s}")

        return notes

    def _analyze_optimization(
        self,
        ingredients: List[Dict[str, Any]],
        constraints: Dict[str, Any],
    ) -> List[OptimizationRationale]:
        """分析优化决策依据"""
        rationales = []

        # 合规约束
        for ing in ingredients:
            name = ing.get("name", "")
            dosage = ing.get("dosage_mg", 0)
            max_d = FOOD_HERB_MAX_DOSAGE.get(name)
            if max_d:
                satisfaction = min(1.0, max_d / max(dosage, 1))
                rationales.append(OptimizationRationale(
                    constraint_name=f"{name}用量上限",
                    constraint_type="compliance",
                    value=dosage,
                    target=max_d,
                    satisfaction=round(satisfaction, 2),
                    reason=f"药食同源目录规定最大日用量 {max_d}mg",
                ))

        # 成本约束
        if "budget" in constraints:
            budget = constraints["budget"]
            rationales.append(OptimizationRationale(
                constraint_name="成本控制",
                constraint_type="cost",
                value=budget,
                target=budget,
                satisfaction=1.0,
                reason=f"预算限制 {budget}元/kg",
            ))

        return rationales

    def _compute_overall_score(
        self, report: ExplainabilityReport, compliance_result
    ) -> float:
        """计算综合评分"""
        # efficacy分（基于核心成分efficacy匹配度）
        core_score = (
            sum(i.efficacy_contribution for i in report.core_ingredients)
            / max(len(report.core_ingredients), 1)
        ) * 40

        # 安全分
        safety_score = compliance_result.score * 0.35

        # 协同分
        synergy_bonus = sum(s.strength for s in report.synergies) * 5
        antagonism_penalty = sum(a.strength for a in report.antagonisms) * 20
        interaction_score = max(0, min(25, synergy_bonus - antagonism_penalty))

        return round(min(100, core_score + safety_score + interaction_score), 1)

    def _compute_efficacy_score(
        self, ingredients, target_effects
    ) -> float:
        """计算efficacy评分"""
        total_match = 0
        count = 0
        for ing in ingredients:
            name = ing.get("name", "")
            profile = self._HERB_PROFILES.get(name, {})
            effects = profile.get("effects", [])
            for effect in target_effects:
                if any(effect in e for e in effects):
                    total_match += 1
                    count += 1
                    break
        return round((total_match / max(len(target_effects), 1)) * 100, 1)

    def _generate_summary(self, report: ExplainabilityReport) -> str:
        """生成报告摘要"""
        parts = [
            f"配方「{report.formula_name}」综合评分 {report.overall_score} 分。",
        ]

        if report.core_ingredients:
            core_names = ", ".join(i.name for i in report.core_ingredients[:3])
            parts.append(f"核心成分包括 {core_names}，主要贡献efficacy匹配。")

        if report.synergies:
            syn_names = " + ".join(
                f"{s.ingredient_a}+{s.ingredient_b}" for s in report.synergies[:2]
            )
            parts.append(f"存在协同效应：{syn_names}。")

        if report.antagonisms:
            parts.append("⚠ 存在禁忌搭配，建议调整配方。")

        if report.compliance_notes and report.compliance_notes[0].startswith("✗"):
            parts.append("配方合规性存在问题，请修复后重新分析。")

        return " ".join(parts)

    def _generate_recommendations(self, report: ExplainabilityReport) -> List[str]:
        """生成改进建议"""
        recs = []

        # 基于合规结果
        if report.compliance_notes and any("✗" in n for n in report.compliance_notes):
            recs.append("建议先解决合规问题再推进研发")

        # 基于拮抗
        if report.antagonisms:
            recs.append("建议移除或替换存在禁忌搭配的成分")

        # 基于安全评分
        if report.safety_score < 70:
            recs.append("整体安全评分较低，建议降低各成分用量或替换为更安全的替代品")

        # 基于协同
        if len(report.synergies) == 0 and len(report.core_ingredients) >= 3:
            recs.append("建议增加已知的协同配伍以增强efficacy")

        if not recs:
            recs.append("配方整体设计合理，可进入下一阶段验证")

        return recs


# 全局单例
_service: Optional[ExplainabilityService] = None


def get_explainability_service() -> ExplainabilityService:
    global _service
    if _service is None:
        _service = ExplainabilityService()
    return _service
