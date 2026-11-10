"""
安全合规闸门（Safety Compliance Gate）— 阶段0 止血版

★ 背景（2026-11-09 审计 P0 合规红线）★
兜底路径 `_fallback_rule_engine` 曾完全绕过平台已建成的安全合规设施，
药材池来自标注 MOCK 的硬编码字典（含受保护物种冬虫夏草），剂量超药典上限，
`safety_score` 硬编码 0.85 造假，零合规校验。

★ 本模块的定位 ★
阶段0 的最小可信闸门：为**所有**生成路径（GA 与兜底）提供统一的、
强制的安全合规校验，确保：
  1. 药材准入：只放行 106 种药食同源目录内的药材（L0 准入）。
  2. 禁用级硬黑名单：受保护物种/贵重药材（如冬虫夏草）任何路径不可生成。
  3. 剂量上限：每味药材剂量 ≤ 目录日限量 / 药典上限。
  4. 配伍禁忌：十八反十九畏命中即淘汰。
  5. 真实安全裁定：`safety_passed` 由 `check_compliance` 得出，杜绝硬编码。

★ 与目标架构的关系 ★
本模块是 ADR-046「L3 安全合规闸门」的阶段0 简化实现。
阶段1 将演进为完整的 `services/formula/compliance_gate/`（Port + Adapter），
组合 SafetyAlertSystem 三级预警 + 人群禁忌等。本模块接口设计已对齐目标
`SafetyCompliancePort`，便于平滑迁移。

★ 铁律 ★
任何配方候选，无论来自 GA、规则引擎还是 LLM，出口前必须穿过本闸门。
不存在绕行路径。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# L3 禁用级硬黑名单（任何生成路径不可生成）
# ════════════════════════════════════════════
# 依据：受保护野生物种 / 贵重药材 / 非药食同源目录物质。
# 冬虫夏草：国家保护物种，**不在国家「按照传统既是食品又是中药材的物质目录」
# （106种，2024版）内**，既非食品也非新食品原料，不得作为普通食疗原料。
# 注意区分："蛹虫草""广东虫草子实体"为卫健委批准的新食品原料（L2级），
# 与受保护的野生冬虫夏草监管地位完全不同，但阶段0 一并纳入黑名单从严处理，
# 待 L0 准入网关建立 L2 新食品原料分级后再放开（须带公告号 + 不适宜人群）。
PROHIBITED_HERBS: frozenset[str] = frozenset({
    "虫草",
    "冬虫夏草",
    "蛹虫草",          # 阶段0 从严，阶段1 降级为 L2 需显式人群适配
    "广东虫草",
    "广东虫草子实体",
    # 可扩展：其他受保护物种 / 保健食品专用原料
})

# 黑名单命中的合规红线说明（供 violations / 前端展示）
_PROHIBITED_REASON = (
    "属受保护野生物种或非药食同源目录物质，不得作为普通食疗配方原料"
)


@dataclass
class HerbVerdict:
    """单味药材的准入 + 剂量裁定"""
    name: str
    admitted: bool                     # 是否通过 L0 准入（在 106 目录内且非黑名单）
    dosage_ok: bool = True             # 剂量是否在目录限量内
    reason: str = ""
    max_dosage_mg: Optional[float] = None


@dataclass
class FormulaSafetyVerdict:
    """
    配方级安全裁定（三态）— 对齐目标架构 SafetyVerdict 值对象

    status:
      - "PASS"            所有药材准入 + 剂量合规 + 无配伍禁忌
      - "NEEDS_ATTENTION" 有可自动修复的越界（如剂量超限已截断）或 WARNING
      - "REJECTED"        有 CRITICAL 违规（黑名单/非目录/配伍禁忌且无法修复）
      - "UNVERIFIED"      未校验（不应到达展示层为"安全"）
    """
    status: str = "UNVERIFIED"
    is_compliant: bool = False          # 由 check_compliance 得出，非硬编码
    score: float = 0.0                  # 由 check_compliance 得出
    herb_verdicts: List[HerbVerdict] = field(default_factory=list)
    violations: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    checked_by: str = "SafetyComplianceGate(stage0)"

    @property
    def is_verified(self) -> bool:
        return self.status != "UNVERIFIED"

    @property
    def is_rejected(self) -> bool:
        return self.status == "REJECTED"

    @property
    def is_safe_for_display(self) -> bool:
        """前端唯一可信的「安全合规」展示依据 — 三态之一，非布尔反推"""
        return self.status == "PASS"


def _get_compliance_service():
    """延迟导入合规服务，避免循环依赖"""
    from app.services.compliance.formula_compliance import get_compliance_service
    return get_compliance_service()


def _find_incompatibilities(names: List[str]) -> List[Dict[str, Any]]:
    """延迟导入十八反十九畏检测"""
    try:
        from app.services.ai.formula_intelligence import _find_tcm_incompatibilities
        return _find_tcm_incompatibilities(names)
    except Exception as e:  # pragma: no cover - 防御性
        logger.warning(f"[SafetyGate] 配伍禁忌检测不可用（忽略，按无禁忌处理）: {e}")
        return []


def check_herb_admission(name: str) -> HerbVerdict:
    """
    L0 药材准入判定（单味）

    顺序：
      0. 命名规范化（canonical：生姜→姜 / 大枣→枣 / 虫草→冬虫夏草等）
      1. 禁用级硬黑名单（受保护物种等）→ 拒绝
      2. 106 种药食同源目录（FOOD_HERB_MAX_DOSAGE）→ 不在则拒绝

    ★ canonical 归一 ★：GA/兜底产出的药材名可能是俗名/异名（生姜/大枣/桑葚），
    而目录键是药典正名（姜/枣/桑椹）。不归一会误拒食物药材（生姜→误判非目录）。
    与 GA L0 池过滤使用同一 canonical 映射，保证两处判定一致。
    """
    from app.services.compliance.formula_compliance import FOOD_HERB_MAX_DOSAGE
    from app.services.ai.safety.canonical_names import canonicalize_herb_name

    # 0. 命名规范化（俗名/异名 → 药典正名；虫草→冬虫夏草）
    canonical = canonicalize_herb_name(name)

    # 1. 禁用级硬黑名单（原始名与 canonical 名都查，双保险）
    if name in PROHIBITED_HERBS or canonical in PROHIBITED_HERBS:
        return HerbVerdict(
            name=name, admitted=False, reason=_PROHIBITED_REASON
        )

    # 2. 106 目录准入（用 canonical 正名查目录）
    if canonical not in FOOD_HERB_MAX_DOSAGE:
        return HerbVerdict(
            name=name,
            admitted=False,
            reason="不在国家药食同源目录（2024版106种）内，需确认是否可用",
        )

    return HerbVerdict(
        name=name,
        admitted=True,
        max_dosage_mg=float(FOOD_HERB_MAX_DOSAGE[canonical]),
    )


def clamp_dosage_to_catalog(name: str, dosage_g: float) -> tuple[float, bool, Optional[float]]:
    """
    将单味剂量截断到目录日限量内。

    Returns:
        (clamped_grams, was_clamped, max_grams)
        max_grams 为 None 表示该药材不在目录内（准入失败，应由调用方剔除）。
    """
    from app.services.compliance.formula_compliance import FOOD_HERB_MAX_DOSAGE

    max_mg = FOOD_HERB_MAX_DOSAGE.get(name)
    if max_mg is None:
        return dosage_g, False, None
    max_g = float(max_mg) / 1000.0  # 目录限量单位为 mg/天 → 克
    if dosage_g > max_g:
        return max_g, True, max_g
    return dosage_g, False, max_g


def check_formula_safety(
    herb_combination: List[Dict[str, Any]],
    population: str = "adults",
    auto_clamp: bool = True,
) -> FormulaSafetyVerdict:
    """
    配方级安全合规闸门（L3）— 阶段0 强制实现

    Args:
        herb_combination: 候选配方的药材列表，每项 {name, dosage}。
            dosage 形如 "16.7g"（兜底引擎产出）或数值（克）。
        population: 目标人群 "adults" | "children" | "elderly"
        auto_clamp: 是否将超限剂量自动截断到目录限量（截断后 status 至少 NEEDS_ATTENTION）

    Returns:
        FormulaSafetyVerdict 三态裁定。
        ★ is_compliant / score 由 check_compliance 真实计算，绝不硬编码。★
    """
    verdict = FormulaSafetyVerdict()
    if not herb_combination:
        verdict.status = "REJECTED"
        verdict.violations.append({
            "type": "empty_formula",
            "message": "配方为空",
        })
        return verdict

    # ── 第 1 关：L0 准入 + 禁用级黑名单 ──
    admissible: List[Dict[str, Any]] = []
    for herb in herb_combination:
        name = str(herb.get("name", "")).strip()
        adm = check_herb_admission(name)
        verdict.herb_verdicts.append(adm)
        if not adm.admitted:
            verdict.violations.append({
                "type": "admission_denied",
                "ingredient": name,
                "message": f"'{name}' {adm.reason}",
                "severity": "CRITICAL",
            })
        else:
            admissible.append(herb)

    # ── 第 2 关：剂量上限（自动截断）──
    clamped_any = False
    for herb in admissible:
        name = str(herb.get("name", "")).strip()
        raw = herb.get("dosage", 0)
        grams = _parse_grams(raw)
        clamped_g, was_clamped, max_g = clamp_dosage_to_catalog(name, grams)
        if was_clamped and auto_clamp:
            herb["dosage"] = f"{round(clamped_g, 1)}g"
            verdict.warnings.append(
                f"'{name}' 用量 {grams}g 超目录限量 {max_g}g，已自动截断至 {round(clamped_g, 1)}g"
            )
            clamped_any = True
        elif was_clamped:
            verdict.violations.append({
                "type": "exceeds_limit",
                "ingredient": name,
                "message": f"'{name}' 用量 {grams}g 超过目录限量 {max_g}g",
                "severity": "CRITICAL",
            })

    # ── 第 3 关：配伍禁忌（十八反十九畏）──
    names = [str(h.get("name", "")).strip() for h in admissible]
    incompat = _find_incompatibilities(names)
    for issue in incompat:
        verdict.violations.append({
            "type": "incompatibility",
            "message": issue.get("message") or str(issue),
            "severity": "CRITICAL",
        })

    # ── 第 4 关：真实合规校验（check_compliance）──
    # 将 admissible 转为 check_compliance 期望的 {name, dosage_mg} 结构
    # ★ canonical 归一 ★：check_compliance 内部用 `name in FOOD_HERB_MAX_DOSAGE` 查目录，
    #   而目录键是药典正名（姜/枣/桑椹/橘皮）。GA/兜底产出俗名（生姜/大枣/桑葚）时，
    #   不归一会误判"不在目录"→ 整方 REJECTED（真实线上回归）。此处统一 canonical 后再校验。
    from app.services.ai.safety.canonical_names import canonicalize_herb_name
    compliance_ingredients = []
    for herb in admissible:
        raw_name = str(herb.get("name", "")).strip()
        canonical_name = canonicalize_herb_name(raw_name)  # 俗名/异名 → 药典正名
        grams = _parse_grams(herb.get("dosage", 0))
        compliance_ingredients.append({
            "name": canonical_name,
            "dosage_mg": grams * 1000.0,
        })

    has_critical = any(v.get("severity") == "CRITICAL" for v in verdict.violations)
    if compliance_ingredients and not has_critical:
        try:
            svc = _get_compliance_service()
            result = svc.check_compliance(compliance_ingredients, population=population)
            verdict.is_compliant = result.is_compliant
            verdict.score = float(result.score)
            # 透传 check_compliance 的违规/警告
            for v in result.violations:
                verdict.violations.append({
                    "type": v.violation_type,
                    "ingredient": v.ingredient,
                    "message": v.message,
                    "severity": "CRITICAL",
                })
            verdict.warnings.extend(result.warnings)
        except Exception as e:  # pragma: no cover - 防御性
            logger.error(f"[SafetyGate] check_compliance 调用失败: {e}")
            # 校验失败不能默认安全 → 标记未校验
            verdict.status = "UNVERIFIED"
            verdict.warnings.append(f"合规校验服务异常：{e}")
            return verdict
    elif has_critical:
        verdict.is_compliant = False
        verdict.score = 0.0

    # ── 裁决 ──
    has_critical = any(v.get("severity") == "CRITICAL" for v in verdict.violations)
    if has_critical:
        verdict.status = "REJECTED"
    elif clamped_any or verdict.warnings:
        verdict.status = "NEEDS_ATTENTION"
    else:
        verdict.status = "PASS"

    return verdict


def filter_admissible_herbs(names: List[str]) -> tuple[List[str], List[str]]:
    """
    从候选药材名列表中过滤出可通过 L0 准入的子集（阶段0 兜底引擎用）。

    Returns:
        (admissible_names, rejected_names)
    """
    admissible: List[str] = []
    rejected: List[str] = []
    for name in names:
        if check_herb_admission(name).admitted:
            admissible.append(name)
        else:
            rejected.append(name)
    return admissible, rejected


def _parse_grams(raw: Any) -> float:
    """解析剂量为克。支持 "16.7g" / "16.7" / 16.7 / 16700(mg 视单位)。"""
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip().lower().replace("克", "g").replace("毫克", "mg")
    if s.endswith("mg"):
        try:
            return float(s[:-2].strip()) / 1000.0
        except ValueError:
            return 0.0
    if s.endswith("g"):
        s = s[:-1]
    try:
        return float(s.strip())
    except ValueError:
        return 0.0