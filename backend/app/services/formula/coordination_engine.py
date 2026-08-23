"""
CoordinationEngine — 配方协调分析引擎

基于中医"君臣佐使"理论和现代药代动力学，对多成分配方进行四维协调分析：
1. 结构协调 (Structure)   — 君臣佐使角色分配是否完整合理
2. 比例协调 (Proportion)  — 各成分比例是否在产品形态法定区间
3. 功效协调 (Functional)  — 目标功效覆盖是否完整，有无冗余/冲突
4. 时序协调 (Temporal)    — 各成分吸收/代谢时序是否匹配

复用策略：
- 结构评分 → 复用 FrameworkEngine._evaluate_structure_compliance() 逻辑
- 比例检查 → 复用 ProductFormRules 比例范围
- 功效协调 → 基于已有功效-药材映射数据库
- 时序协调 → 复用 PK_PARAMETERS_DB + EffectSimulator 时序模型
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# 产品形态协调规则（基于 ProductFormRules 提取）
# ═══════════════════════════════════════════════════════════════

COORDINATION_RULES: Dict[str, Dict[str, Tuple[float, float]]] = {
    "保健饮品": {
        "jun": (0.30, 0.45),
        "chen": (0.15, 0.25),
        "zuo": (0.10, 0.20),
        "shi": (0.05, 0.10),
    },
    "代茶饮": {
        "jun": (0.35, 0.50),
        "chen": (0.15, 0.25),
        "zuo": (0.10, 0.15),
        "shi": (0.05, 0.10),
    },
    "膏方": {
        "jun": (0.20, 0.35),
        "chen": (0.15, 0.25),
        "zuo": (0.15, 0.25),
        "shi": (0.05, 0.10),
    },
    "散剂": {
        "jun": (0.25, 0.40),
        "chen": (0.15, 0.25),
        "zuo": (0.10, 0.20),
        "shi": (0.05, 0.10),
    },
    "丸剂": {
        "jun": (0.30, 0.45),
        "chen": (0.15, 0.25),
        "zuo": (0.10, 0.20),
        "shi": (0.05, 0.10),
    },
    "口服液": {
        "jun": (0.30, 0.45),
        "chen": (0.15, 0.25),
        "zuo": (0.10, 0.20),
        "shi": (0.05, 0.10),
    },
    "功能性食品": {
        "jun": (0.10, 0.25),
        "chen": (0.10, 0.20),
        "zuo": (0.10, 0.20),
        "shi": (0.03, 0.08),
    },
    "压片糖果": {
        "jun": (0.20, 0.35),
        "chen": (0.15, 0.25),
        "zuo": (0.10, 0.20),
        "shi": (0.05, 0.10),
    },
}

# 默认规则（产品形态未知时使用）
DEFAULT_RULES = {"jun": (0.25, 0.40), "chen": (0.15, 0.25), "zuo": (0.10, 0.20), "shi": (0.05, 0.10)}

# 产品形态规则中的额外约束
FORM_CONSTRAINTS: Dict[str, Dict[str, Any]] = {
    "保健饮品": {"min_herbs": 3, "max_herbs": 8},
    "代茶饮": {"min_herbs": 3, "max_herbs": 6},
    "膏方": {"min_herbs": 5, "max_herbs": 12},
    "散剂": {"min_herbs": 3, "max_herbs": 10},
    "丸剂": {"min_herbs": 3, "max_herbs": 8},
    "口服液": {"min_herbs": 3, "max_herbs": 6},
    "功能性食品": {"min_herbs": 5, "max_herbs": 15},
    "压片糖果": {"min_herbs": 3, "max_herbs": 8},
}

# 简易功效-药材知识（用于功效协调评分）
HERB_EFFICACY_MAP: Dict[str, List[str]] = {
    "黄芪": ["免疫调节", "补气", "抗氧化"],
    "人参": ["补气", "益智", "抗疲劳", "免疫调节"],
    "枸杞": ["抗氧化", "滋补肝肾", "明目"],
    "党参": ["补气", "健脾"],
    "甘草": ["调和诸药", "解毒", "补气"],
    "山药": ["健脾", "补气", "益肾"],
    "茯苓": ["健脾", "利水", "安神"],
    "当归": ["补血", "活血", "调经"],
    "红枣": ["补气", "养血", "安神"],
    "菊花": ["清热解毒", "明目", "平肝"],
    "山楂": ["消食", "活血", "降脂"],
    "决明子": ["清热", "明目", "润肠"],
    "酸枣仁": ["安神", "敛汗", "补肝"],
    "百合": ["养阴", "润肺", "安神"],
    "桑叶": ["疏散风热", "清肺", "明目"],
    "玉竹": ["养阴", "润燥", "生津"],
    "麦冬": ["养阴", "润肺", "清心"],
    "陈皮": ["理气", "健脾", "燥湿"],
    "金银花": ["清热解毒", "疏散风热"],
    "连翘": ["清热解毒", "消肿散结"],
    "黄芩": ["清热燥湿", "泻火解毒"],
    "黄连": ["清热燥湿", "泻火解毒"],
    "丹参": ["活血化瘀", "安神", "清心除烦"],
    "川芎": ["活血行气", "祛风止痛"],
    "天麻": ["平肝息风", "通络止痛"],
    "杜仲": ["补肝肾", "强筋骨"],
    "枸杞子": ["滋补肝肾", "明目"],
    "五味子": ["敛肺", "滋肾", "生津", "安神"],
    "灵芝": ["免疫调节", "安神", "止咳"],
    "雪莲": ["免疫调节", "抗氧化", "抗疲劳"],
    "牛磺酸": ["抗疲劳", "神经保护", "免疫调节"],
    "大豆肽": ["易吸收", "抗疲劳", "免疫调节"],
    "胶原蛋白肽": ["美容", "关节健康", "皮肤弹性"],
    "乳清蛋白肽": ["肌肉修复", "免疫调节", "易吸收"],
    "茯苓多糖": ["免疫调节", "抗肿瘤"],
    "人参皂苷": ["抗疲劳", "益智", "免疫调节"],
    "大豆异黄酮": [" hormonal平衡", "抗氧化"],
    "维生素C": ["抗氧化", "免疫调节", "胶原蛋白合成"],
    "褪黑素": ["改善睡眠", "抗氧化"],
}

# 功效协调权重（不同功效的优先级）
EFFICACY_WEIGHTS: Dict[str, float] = {
    "免疫调节": 1.0,
    "补气": 0.9,
    "抗氧化": 0.9,
    "安神": 0.8,
    "抗疲劳": 0.8,
    "健脾": 0.7,
    "滋补肝肾": 0.7,
    "活血": 0.7,
    "清热解毒": 0.6,
    "明目": 0.6,
    "补血": 0.6,
    "降脂": 0.5,
    "美容": 0.5,
}


# ═══════════════════════════════════════════════════════════════
# 数据类定义
# ═══════════════════════════════════════════════════════════════

@dataclass
class CoordinationIssue:
    """协调问题记录"""
    type: str                      # "missing_role" | "ratio_violation" | "effect_gap" | "temporal_conflict" | "redundant_effect"
    severity: str                  # "error" | "warning" | "info"
    dimension: str                 # "structure" | "ratio" | "functional" | "temporal"
    ingredient: str                # 涉及的成分名（可为空）
    message: str
    suggestion: str
    severity_score: float = 0.0    # 0-10


@dataclass
class DimensionScore:
    """单维度评分"""
    score: float                   # 0.0 - 1.0
    weight: float                  # 维度权重
    issues: List[CoordinationIssue] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OptimizationSuggestion:
    """优化建议"""
    type: str                      # "add_ingredient" | "adjust_ratio" | "remove_ingredient" | "change_role"
    target_ingredient: str
    action: str
    impact: str                    # "high" | "medium" | "low"
    description: str


@dataclass
class CoordinationReport:
    """协调分析报告"""
    overall_score: float           # 综合协调分 0-100
    structure: DimensionScore
    ratio: DimensionScore
    functional: DimensionScore
    temporal: DimensionScore
    problems: List[CoordinationIssue]
    suggestions: List[OptimizationSuggestion]
    role_assignment: Dict[str, str] = field(default_factory=dict)  # herb_name -> role
    synergy_highlights: List[Dict] = field(default_factory=list)    # 高协同配对
    product_form: str = ""


# ═══════════════════════════════════════════════════════════════
# 协调分析引擎
# ═══════════════════════════════════════════════════════════════

class CoordinationEngine:
    """
    配方协调分析引擎

    输入格式:
        herbs = [
            {"name": "黄芪", "ratio": 0.35, "role": "君"},
            {"name": "人参", "ratio": 0.20, "role": "臣"},
            ...
        ]

    输出: CoordinationReport
    """

    # 四维权重
    DIMENSION_WEIGHTS = {
        "structure": 0.25,
        "ratio": 0.30,
        "functional": 0.25,
        "temporal": 0.20,
    }

    def __init__(self):
        self.pk_db = self._load_pk_db()

    def _load_pk_db(self) -> Dict[str, Dict[str, float]]:
        """加载PK参数数据库（用于时序协调分析）"""
        try:
            from .pk_pd_database import PK_PARAMETERS_DB
            return PK_PARAMETERS_DB
        except ImportError:
            logger.warning("PK参数数据库不可用，时序协调分析将使用默认值")
            return {}

    def analyze(
        self,
        herbs: List[Dict[str, Any]],
        product_form: str = "保健饮品",
        target_effects: Optional[List[str]] = None,
        target_population: str = "adult",
        synergy_data: Optional[Dict[str, Any]] = None,
    ) -> CoordinationReport:
        """
        主分析入口

        Args:
            herbs: 成分列表，每项包含 name, ratio(0-1), role(可选)
            product_form: 产品形态
            target_effects: 目标功效列表
            target_population: 目标人群
            synergy_data: 可选的协同分析数据（来自 SynergyNet），用于联动展示

        Returns:
            CoordinationReport
        """
        if target_effects is None:
            target_effects = []

        problems: List[CoordinationIssue] = []
        suggestions: List[OptimizationSuggestion] = []
        role_assignment: Dict[str, str] = {}

        # ── 1. 结构协调分析 ───────────────────────────────────────
        structure = self._analyze_structure(herbs, problems, suggestions, role_assignment)

        # ── 2. 比例协调分析 ───────────────────────────────────────
        ratio = self._analyze_ratio(herbs, product_form, problems, suggestions)

        # ── 3. 功效协调分析 ───────────────────────────────────────
        functional = self._analyze_functional(herbs, target_effects, problems, suggestions)

        # ── 4. 时序协调分析 ───────────────────────────────────────
        temporal = self._analyze_temporal(herbs, problems, suggestions)

        # ── 5. 协同数据联动 ───────────────────────────────────────
        synergy_highlights = self._integrate_synergy(herbs, synergy_data)

        # ── 6. 综合评分 ───────────────────────────────────────────
        overall = self._calculate_overall(structure, ratio, functional, temporal)

        # ── 7. 问题排序（错误优先） ───────────────────────────────
        severity_order = {"error": 0, "warning": 1, "info": 2}
        problems.sort(key=lambda p: severity_order.get(p.severity, 3))

        return CoordinationReport(
            overall_score=overall,
            structure=structure,
            ratio=ratio,
            functional=functional,
            temporal=temporal,
            problems=problems,
            suggestions=suggestions,
            role_assignment=role_assignment,
            synergy_highlights=synergy_highlights,
            product_form=product_form,
        )

    # ═══════════════════════════════════════════════════════════
    # 维度1: 结构协调
    # ═══════════════════════════════════════════════════════════

    def _analyze_structure(
        self,
        herbs: List[Dict],
        problems: List[CoordinationIssue],
        suggestions: List[OptimizationSuggestion],
        role_assignment: Dict[str, str],
    ) -> DimensionScore:
        """
        结构协调分析 — 君臣佐使角色分配是否完整合理

        评分维度：
        1. 角色完整性 (0-0.4): 君/臣/佐/使是否齐全
        2. 数量合理性 (0-0.3): 各角色数量是否在合理范围
        3. 剂量递减 (0-0.3): 君药剂量 >= 臣药 >= 佐药 >= 使药
        """
        issues: List[CoordinationIssue] = []
        score_parts: List[float] = []

        n = len(herbs)

        # 分配角色（如用户未指定）
        for i, herb in enumerate(herbs):
            name = herb.get("name", "")
            if herb.get("role"):
                role_assignment[name] = herb["role"]
            else:
                role_assignment[name] = self._infer_role(i, n)

        roles_present = set(role_assignment.values())

        # ── 1a. 角色完整性 ────────────────────────────────────
        role_scores = {}
        for role in ["君", "臣", "佐", "使"]:
            members = [name for name, r in role_assignment.items() if r == role]
            if role in roles_present:
                role_scores[role] = 1.0
            elif n >= 3:
                # 缺失角色扣分
                role_scores[role] = 0.0
                if role == "君":
                    issues.append(CoordinationIssue(
                        type="missing_role", severity="error", dimension="structure",
                        message="缺少君药 — 君药为配方核心，不可缺失",
                        suggestion="指定功效最高的成分为君药",
                        severity_score=9.0,
                    ))
                elif role == "臣":
                    issues.append(CoordinationIssue(
                        type="missing_role", severity="warning", dimension="structure",
                        message="缺少臣药 — 臣药辅助君药增强功效",
                        suggestion="添加1-2味辅助成分作为臣药",
                        severity_score=6.0,
                    ))
                elif role == "佐":
                    issues.append(CoordinationIssue(
                        type="missing_role", severity="info", dimension="structure",
                        message="缺少佐药 — 佐药可调和或制约君臣药性",
                        suggestion="考虑添加调和性成分作为佐药",
                        severity_score=4.0,
                    ))
                elif role == "使":
                    issues.append(CoordinationIssue(
                        type="missing_role", severity="info", dimension="structure",
                        message="缺少使药 — 使药引经报使，引导药力直达病所",
                        suggestion="添加引经药（如甘草、陈皮）作为使药",
                        severity_score=3.0,
                    ))

        # 角色完整性得分
        if n >= 3:
            role_completeness = sum(role_scores.values()) / 4.0
        else:
            role_completeness = 0.5  # 成分太少无法评估结构
        score_parts.append(role_completeness * 0.4)

        # ── 1b. 数量合理性 ────────────────────────────────────
        role_counts = {}
        for role in ["君", "臣", "佐", "使"]:
            role_counts[role] = sum(1 for r in role_assignment.values() if r == role)

        ideal_counts = {"君": (1, 2), "臣": (1, 3), "佐": (1, 3), "使": (0, 2)}
        quantity_score = 0.0
        for role, (lo, hi) in ideal_counts.items():
            count = role_counts.get(role, 0)
            if lo <= count <= hi:
                quantity_score += 0.075  # 4 roles × 0.075 = 0.3
            elif count < lo:
                issues.append(CoordinationIssue(
                    type="structure_count", severity="warning", dimension="structure",
                    message=f"{role}药数量不足（当前{count}味，建议{lo}-{hi}味）",
                    suggestion=f"增加{role}药至{lo}-{hi}味",
                    severity_score=5.0,
                ))
            else:
                issues.append(CoordinationIssue(
                    type="structure_count", severity="info", dimension="structure",
                    message=f"{role}药数量偏多（当前{count}味，建议{lo}-{hi}味）",
                    suggestion=f"考虑精简{role}药至{lo}-{hi}味",
                    severity_score=2.0,
                ))
        score_parts.append(quantity_score)

        # ── 1c. 剂量递减检查 ────────────────────────────────────
        dose_score = self._check_dose_decreasing(herbs, role_assignment)
        score_parts.append(dose_score * 0.3)

        final_score = sum(score_parts)
        return DimensionScore(
            score=round(final_score, 4),
            weight=self.DIMENSION_WEIGHTS["structure"],
            issues=issues,
            details={"role_counts": role_counts, "role_assignment": role_assignment},
        )

    def _infer_role(self, index: int, total: int) -> str:
        """根据位置推断角色"""
        if total <= 2:
            return "君" if index == 0 else "臣"
        elif total <= 4:
            roles = ["君", "臣", "臣", "佐"]
            return roles[index] if index < len(roles) else "佐"
        elif total <= 6:
            roles = ["君", "臣", "臣", "佐", "佐", "使"]
            return roles[index] if index < len(roles) else "使"
        else:
            roles = ["君", "臣", "臣", "佐", "佐", "使"]
            return roles[min(index, 5)]

    def _check_dose_decreasing(
        self, herbs: List[Dict], role_assignment: Dict[str, str]
    ) -> float:
        """检查剂量是否按君>臣>佐>使递减"""
        groups: Dict[str, List[float]] = {"君": [], "臣": [], "佐": [], "使": []}
        for herb in herbs:
            name = herb.get("name", "")
            ratio = herb.get("ratio", 0)
            role = role_assignment.get(name, "臣")
            if role not in groups:
                role = "臣"
            groups[role].append(ratio)

        ordered_roles = ["君", "臣", "佐", "使"]
        medians = []
        for role in ordered_roles:
            if groups[role]:
                vals = sorted(groups[role])
                medians.append(vals[len(vals) // 2])

        if len(medians) < 2:
            return 0.5

        decreasing_count = 0
        for i in range(len(medians) - 1):
            if medians[i] >= medians[i + 1]:
                decreasing_count += 1

        return decreasing_count / (len(medians) - 1) if len(medians) > 1 else 0.5

    # ═══════════════════════════════════════════════════════════
    # 维度2: 比例协调
    # ═══════════════════════════════════════════════════════════

    def _analyze_ratio(
        self,
        herbs: List[Dict],
        product_form: str,
        problems: List[CoordinationIssue],
        suggestions: List[OptimizationSuggestion],
    ) -> DimensionScore:
        """
        比例协调分析 — 各成分比例是否在法定区间

        基于 ProductFormRules 中各产品形态的君/臣/佐/使比例范围
        """
        issues: List[CoordinationIssue] = []
        rules = COORDINATION_RULES.get(product_form, DEFAULT_RULES)
        constraints = FORM_CONSTRAINTS.get(product_form, {})

        # ── 成分数约束检查 ──────────────────────────────────────
        n = len(herbs)
        min_herbs = constraints.get("min_herbs", 3)
        max_herbs = constraints.get("max_herbs", 8)
        if n < min_herbs:
            issues.append(CoordinationIssue(
                type="ratio_count", severity="warning", dimension="ratio",
                message=f"成分数量不足（{n}味 < 最低{min_herbs}味）",
                suggestion=f"添加{min_herbs - n}味以上成分以满足配伍要求",
                severity_score=5.0,
            ))
        elif n > max_herbs:
            issues.append(CoordinationIssue(
                type="ratio_count", severity="warning", dimension="ratio",
                message=f"成分数量过多（{n}味 > 最高{max_herbs}味）",
                suggestion=f"精简至{max_herbs}味以内以提高协调性",
                severity_score=4.0,
            ))

        # ── 各成分比例检查 ──────────────────────────────────────
        role_ratios: Dict[str, List[float]] = {"君": [], "臣": [], "佐": [], "使": []}
        for herb in herbs:
            name = herb.get("name", "")
            ratio = herb.get("ratio", 0)
            role = herb.get("role", "") or ""
            if not role:
                # 根据位置推断
                idx = next((i for i, h in enumerate(herbs) if h.get("name") == name), 0)
                role = self._infer_role(idx, n)

            role_ratios.setdefault(role, []).append(ratio)

            # 检查是否在对应角色的合理比例区间
            rule_key = {"君": "jun", "臣": "chen", "佐": "zuo", "使": "shi"}.get(role, "chen")
            if rule_key in rules and ratio > 0:
                lo, hi = rules[rule_key]
                if ratio < lo:
                    issues.append(CoordinationIssue(
                        type="ratio_low", severity="warning", dimension="ratio",
                        ingredient=name,
                        message=f"{name}（{role}药）比例{ratio:.1%}低于{role}药下限{lo:.0%}",
                        suggestion=f"将{name}比例提升至{lo:.0%}-{hi:.0%}区间",
                        severity_score=6.0,
                    ))
                elif ratio > hi:
                    issues.append(CoordinationIssue(
                        type="ratio_high", severity="error" if ratio > hi * 1.5 else "warning",
                        dimension="ratio", ingredient=name,
                        message=f"{name}（{role}药）比例{ratio:.1%}超出{role}药上限{hi:.0%}",
                        suggestion=f"将{name}比例降至{hi:.0%}以内",
                        severity_score=7.0 if ratio > hi * 1.5 else 5.0,
                    ))

        # ── 总量归一化检查 ──────────────────────────────────────
        total_ratio = sum(h.get("ratio", 0) for h in herbs)
        if abs(total_ratio - 1.0) > 0.05:
            issues.append(CoordinationIssue(
                type="ratio_normalize", severity="error", dimension="ratio",
                message=f"比例总和为{total_ratio:.1%}，应归一化为100%",
                suggestion="调整各成分比例使其总和为100%",
                severity_score=8.0,
            ))

        # ── 计算比例得分 ────────────────────────────────────────
        if not issues:
            ratio_score = 1.0
        else:
            error_count = sum(1 for i in issues if i.severity == "error")
            warning_count = sum(1 for i in issues if i.severity == "warning")
            ratio_score = max(0, 1.0 - error_count * 0.2 - warning_count * 0.08)

        return DimensionScore(
            score=round(ratio_score, 4),
            weight=self.DIMENSION_WEIGHTS["ratio"],
            issues=issues,
            details={"product_form": product_form, "rules": {k: list(v) for k, v in rules.items()}},
        )

    # ═══════════════════════════════════════════════════════════
    # 维度3: 功效协调
    # ═══════════════════════════════════════════════════════════

    def _analyze_functional(
        self,
        herbs: List[Dict],
        target_effects: List[str],
        problems: List[CoordinationIssue],
        suggestions: List[OptimizationSuggestion],
    ) -> DimensionScore:
        """
        功效协调分析

        1. 目标功效覆盖度：配方中各成分的功效是否覆盖目标功效
        2. 功效冗余度：是否有多个成分功效高度重叠
        3. 功效冲突度：是否有成分功效相互冲突
        """
        issues: List[CoordinationIssue] = []

        # ── 提取配方所有功效 ────────────────────────────────────
        formula_effects: Dict[str, List[str]] = {}
        for herb in herbs:
            name = herb.get("name", "")
            known_effects = HERB_EFFICACY_MAP.get(name, [])
            if known_effects:
                formula_effects[name] = known_effects

        all_formula_effects = []
        for effects in formula_effects.values():
            all_formula_effects.extend(effects)

        # ── 1a. 目标功效覆盖度 ──────────────────────────────────
        if target_effects:
            covered = 0
            uncovered = []
            for effect in target_effects:
                matched = any(effect in fe for fe in all_formula_effects)
                if matched:
                    covered += 1
                else:
                    uncovered.append(effect)

            coverage = covered / len(target_effects)
            for effect in uncovered:
                # 推荐能覆盖该功效的药材
                candidates = self._find_effect_candidates(effect)
                issues.append(CoordinationIssue(
                    type="effect_gap", severity="warning", dimension="functional",
                    message=f"目标功效「{effect}」未被配方覆盖",
                    suggestion=f"建议添加{', '.join(candidates[:3])}等具有该功效的成分",
                    severity_score=6.0,
                ))
        else:
            coverage = 0.7  # 未指定目标功效时给基础分

        # ── 1b. 功效冗余度 ──────────────────────────────────────
        effect_counts: Dict[str, int] = {}
        for effects in formula_effects.values():
            for eff in effects:
                effect_counts[eff] = effect_counts.get(eff, 0) + 1

        redundant = [eff for eff, cnt in effect_counts.items() if cnt >= 3]
        if redundant:
            issues.append(CoordinationIssue(
                type="redundant_effect", severity="info", dimension="functional",
                message=f"功效冗余：{len(redundant)}个功效被3种以上成分重复覆盖（{', '.join(redundant[:3])}）",
                suggestion="功效冗余不严重影响协调性，但可考虑精简成分以提高配伍精炼度",
                severity_score=2.0,
            ))

        # ── 1c. 功效冲突检测 ────────────────────────────────────
        conflicts = self._check_effect_conflicts(formula_effects)
        for h1, h2, conflict in conflicts:
            issues.append(CoordinationIssue(
                type="effect_conflict", severity="warning", dimension="functional",
                message=f"功效潜在冲突：{h1}与{h2}存在{conflict}功效倾向差异",
                suggestion=f"注意{h1}与{h2}的配合比例，避免功效相互抵消",
                severity_score=5.0,
            ))

        # 计算功效协调得分
        error_penalty = sum(1 for i in issues if i.severity == "error") * 0.15
        warning_penalty = sum(1 for i in issues if i.severity == "warning") * 0.08
        functional_score = max(0, coverage * 0.6 + (1 - len(redundant) * 0.05) * 0.2 + (1 - len(conflicts) * 0.1) * 0.2 - error_penalty - warning_penalty)
        functional_score = round(max(0, min(1, functional_score)), 4)

        return DimensionScore(
            score=functional_score,
            weight=self.DIMENSION_WEIGHTS["functional"],
            issues=issues,
            details={"coverage": coverage, "redundant_effects": redundant, "coverage_rate": f"{coverage:.0%}"},
        )

    def _find_effect_candidates(self, effect: str) -> List[str]:
        """查找具有指定功效的候选药材"""
        candidates = []
        for herb, effects in HERB_EFFICACY_MAP.items():
            if effect in effects or any(effect[:2] in e for e in effects) or any(e[:2] in effect for e in effects):
                candidates.append(herb)
        return candidates[:5] if candidates else ["黄芪", "人参", "枸杞"]

    def _check_effect_conflicts(
        self, formula_effects: Dict[str, List[str]]
    ) -> List[Tuple[str, str, str]]:
        """检查功效冲突（寒热温凉对立）"""
        # 简化版：检测温补 vs 寒凉的冲突
        warming = {"补气", "补血", "滋补肝肾", "温阳"}
        cooling = {"清热解毒", "清热燥湿", "泻火解毒", "疏散风热"}

        conflicts = []
        herb_names = list(formula_effects.keys())
        for i in range(len(herb_names)):
            for j in range(i + 1, len(herb_names)):
                h1, h2 = herb_names[i], herb_names[j]
                h1_effects = set(formula_effects.get(h1, []))
                h2_effects = set(formula_effects.get(h2, []))
                if h1_effects & cooling and h2_effects & warming:
                    conflicts.append((h1, h2, "寒热对立"))
                elif h1_effects & warming and h2_effects & cooling:
                    conflicts.append((h2, h1, "寒热对立"))
        return conflicts[:5]  # 最多返回5对

    # ═══════════════════════════════════════════════════════════
    # 维度4: 时序协调
    # ═══════════════════════════════════════════════════════════

    def _analyze_temporal(
        self,
        herbs: List[Dict],
        problems: List[CoordinationIssue],
        suggestions: List[OptimizationSuggestion],
    ) -> DimensionScore:
        """
        时序协调分析 — 各成分PK参数是否匹配

        核心指标：
        1. 吸收速率一致性 (ka匹配度)
        2. 达峰时间窗口 (Tmax重叠度)
        3. 半衰期协调 (t1/2匹配度)
        """
        issues: List[CoordinationIssue] = []

        if not self.pk_db:
            # PK数据库不可用时，基于成分类型推断
            return DimensionScore(
                score=0.5,
                weight=self.DIMENSION_WEIGHTS["temporal"],
                issues=[CoordinationIssue(
                    type="temporal_db_missing", severity="info", dimension="temporal",
                    message="PK参数数据库不可用，时序协调评分为基础估算",
                    suggestion="添加更多成分的PK参数数据以提升时序分析准确性",
                    severity_score=1.0,
                )],
                details={"note": "PK database unavailable"},
            )

        # ── 提取各成分PK参数 ────────────────────────────────────
        pk_data: Dict[str, Dict[str, float]] = {}
        for herb in herbs:
            name = herb.get("name", "")
            if name in self.pk_db:
                pk_data[name] = self.pk_db[name]

        if len(pk_data) < 2:
            # 不足以进行时序分析
            issues.append(CoordinationIssue(
                type="temporal_insufficient", severity="info", dimension="temporal",
                message=f"仅{len(pk_data)}味成分有PK参数，需要至少2味才能进行时序协调分析",
                suggestion="添加更多成分的PK数据或降低时序协调权重",
                severity_score=2.0,
            ))
            return DimensionScore(
                score=0.5, weight=self.DIMENSION_WEIGHTS["temporal"],
                issues=issues, details={"available_pk": list(pk_data.keys())},
            )

        # ── 2a. 吸收速率一致性 ──────────────────────────────────
        kas = [v.get("ka", 1.0) for v in pk_data.values()]
        ka_range = max(kas) - min(kas) if kas else 0
        ka_score = max(0, 1.0 - ka_range / 3.0)  # ka差异越大，得分越低

        if ka_range > 2.0:
            fast = max(pk_data.items(), key=lambda x: x[1].get("ka", 0))
            slow = min(pk_data.items(), key=lambda x: x[1].get("ka", 0))
            issues.append(CoordinationIssue(
                type="temporal_ka_mismatch", severity="warning", dimension="temporal",
                message=f"吸收速率差异较大：{fast[0]}(ka={fast[1].get('ka',0):.1f}) vs {slow[0]}(ka={slow[1].get('ka',0):.1f})",
                suggestion="速效成分与缓释成分搭配需调整剂量或服用方式",
                severity_score=5.0,
            ))

        # ── 2b. 达峰时间重叠度 ──────────────────────────────────
        # Tmax ≈ t_lag + 1.44 * t1/2 (近似)
        tmax_values = []
        for name, params in pk_data.items():
            t_lag = params.get("t_lag", 0.25)
            cl = params.get("CL", 0.15)
            vd = params.get("Vd", 0.3)
            if cl > 0 and vd > 0:
                t_half = math.log(2) * vd / cl
                tmax = t_lag + 1.44 * t_half
                tmax_values.append((name, tmax))

        if len(tmax_values) >= 2:
            tmaxes = [t[1] for t in tmax_values]
            tmax_range = max(tmaxes) - min(tmaxes)
            tmax_score = max(0, 1.0 - tmax_range / 4.0)  # 4小时窗口内重叠

            if tmax_range > 3.0:
                slowest = max(tmax_values, key=lambda x: x[1])
                fastest = min(tmax_values, key=lambda x: x[1])
                issues.append(CoordinationIssue(
                    type="temporal_tmax_mismatch", severity="warning", dimension="temporal",
                    message=f"达峰时间差异较大：{fastest[0]}({fastest[1]:.1f}h) → {slowest[0]}({slowest[1]:.1f}h)",
                    suggestion="建议分时段服用或选用缓释剂型以匹配吸收时序",
                    severity_score=6.0,
                ))
        else:
            tmax_score = 0.5

        # ── 2c. 生物利用度匹配 ──────────────────────────────────
        f_values = [v.get("F", 0.5) for v in pk_data.values()]
        f_std = self._std(f_values) if len(f_values) > 1 else 0
        f_score = max(0, 1.0 - f_std * 2)  # 标准差越大，得分越低

        # ── 综合时序得分 ────────────────────────────────────────
        temporal_score = ka_score * 0.35 + tmax_score * 0.40 + f_score * 0.25
        temporal_score = round(max(0, min(1, temporal_score)), 4)

        return DimensionScore(
            score=temporal_score,
            weight=self.DIMENSION_WEIGHTS["temporal"],
            issues=issues,
            details={
                "ka_range": round(ka_range, 3),
                "tmax_values": {n: round(t, 2) for n, t in tmax_values},
                "f_values": {self.pk_db.get(n, {}).get("source", n): round(v, 2) for n, v in zip(pk_data.keys(), f_values)},
                "available_components": list(pk_data.keys()),
            },
        )

    def _std(self, values: List[float]) -> float:
        """计算标准差"""
        if len(values) < 2:
            return 0.0
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        return math.sqrt(variance)

    # ═══════════════════════════════════════════════════════════
    # 协同数据联动
    # ═══════════════════════════════════════════════════════════

    def _integrate_synergy(
        self, herbs: List[Dict], synergy_data: Optional[Dict[str, Any]]
    ) -> List[Dict]:
        """
        将协同分析数据集成到协调分析中
        高协同配对在协调分析中高亮展示
        """
        if not synergy_data:
            return []

        highlights = []
        pairs = synergy_data.get("synergy_pairs", [])
        for pair in pairs:
            if pair.get("score", 0) >= 0.7:
                highlights.append({
                    "a": pair.get("a", ""),
                    "b": pair.get("b", ""),
                    "score": pair.get("score", 0),
                    "type": "high_synergy",
                })

        antagonism = synergy_data.get("antagonism_warnings", [])
        for warn in antagonism:
            highlights.append({
                "a": warn.get("a", ""),
                "b": warn.get("b", ""),
                "level": warn.get("level", "high"),
                "type": "antagonism",
            })

        return highlights

    # ═══════════════════════════════════════════════════════════
    # 综合评分
    # ═══════════════════════════════════════════════════════════

    def _calculate_overall(
        self,
        structure: DimensionScore,
        ratio: DimensionScore,
        functional: DimensionScore,
        temporal: DimensionScore,
    ) -> float:
        """加权计算综合协调分"""
        total_weight = (
            self.DIMENSION_WEIGHTS["structure"] +
            self.DIMENSION_WEIGHTS["ratio"] +
            self.DIMENSION_WEIGHTS["functional"] +
            self.DIMENSION_WEIGHTS["temporal"]
        )
        weighted = (
            structure.score * structure.weight +
            ratio.score * ratio.weight +
            functional.score * functional.weight +
            temporal.score * temporal.weight
        )
        return round(weighted / total_weight * 100, 1) if total_weight > 0 else 0.0


# 单例
_coordination_engine: Optional[CoordinationEngine] = None


def get_coordination_engine() -> CoordinationEngine:
    global _coordination_engine
    if _coordination_engine is None:
        _coordination_engine = CoordinationEngine()
    return _coordination_engine
