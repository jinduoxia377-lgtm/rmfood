"""
统一配方生成服务 — AI 配方生成唯一权威入口

本服务收敛了历史上分散在多处 API 模块中的配方生成逻辑：
- generation_v2.py 的 /generate（真实 GA）
- generation.py 的 /generate/advanced（曾为 /generate/neural，已更名并接入统一服务）

设计：
1. 前端功效标签 → TCM 关键词映射
2. 调用真实遗传算法引擎（GeneticFormulaOptimizer），自动加载数据库药材
3. herb_id → 中文名 + 剂量(g) 转换（使用优化器实际加载的药材字典，修复
   早期版本硬编码 _BUILTIN_HERBS 导致数据库药材名显示为 ID 的问题）
4. 分配君臣佐使角色、计算多维度评分
5. GA 不可用时回退规则引擎（基于药食同源功效字典）

任何新配方生成端点都应调用本服务，而不是复制逻辑。
"""
from __future__ import annotations

import asyncio
import datetime
import logging
import time
from typing import Any, Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 功效标签 → TCM 关键词映射（前端 label → 后端关键词）
# ════════════════════════════════════════════
EFFECT_LABEL_TO_TCM_KEYWORD: dict[str, list[str]] = {
    # 免疫类
    "增强免疫": ["免疫调节", "补气", "抗炎", "抗氧化"],
    "免疫调节": ["免疫调节", "补气", "抗炎"],
    # 抗衰老
    "抗氧化": ["抗氧化", "抗衰老", "美容养颜", "生津润燥"],
    "抗衰老": ["抗衰老", "抗氧化", "美容养颜"],
    "明目护肝": ["明目", "护肝", "养阴", "抗氧化"],
    # 体力
    "抗疲劳": ["抗疲劳", "益气健脾", "补气", "免疫调节"],
    "体力恢复": ["抗疲劳", "补气", "养血"],
    # 滋补
    "补气养阴": ["补气", "养阴生津", "免疫调节", "消化系统"],
    "健脾养胃": ["健脾", "消化系统", "补气", "利湿"],
    # 心血管
    "降血压": ["降压", "降血压", "心血管保护", "平肝息风"],
    "护心降脂": ["降脂", "活血化瘀", "心血管保护", "抗氧化"],
    "心血管保护": ["心血管保护", "降脂", "活血", "抗氧化"],
    # 代谢
    "降血糖": ["降血糖", "清热生津", "养阴生津", "利湿"],
    "降脂减肥": ["降脂", "利湿", "化痰", "消食"],
    # 神经
    "改善睡眠": ["安神", "清心安神", "养阴", "润肺"],
    "安神助眠": ["安神", "清心安神", "养阴"],
    "缓解焦虑": ["安神", "疏肝理气", "清热"],
    # 清热
    "清热解毒": ["清热解毒", "抗炎", "凉血止血"],
    "清热祛湿": ["清热", "祛湿", "利湿", "利尿"],
    # 补血
    "补血养血": ["补血", "养血", "调经", "补气"],
    "补气养血": ["补气", "补血", "养血", "调经"],   # P1: 复合功效展开为真实索引键
    "补气补血": ["补气", "补血", "养血", "免疫调节"],
    # 代谢
    "辅助降血脂": ["降脂", "降血脂"],              # P1: 映射到数据库真实"降脂"键
    "降血脂": ["降脂"],
    # 呼吸系统
    "润肺止咳": ["润肺", "止咳", "祛痰", "清热解毒"],
    "疏风清热": ["疏散风热", "清热解毒", "明目"],
    # ── P2：补齐前端 CATEGORY_EFFECTS 其余 19 个 label（generateTabConfig.ts:134-144）
    #    映射到古籍/药典常用功效词（与既有 26 键风格一致）；无对应者回退 [label]（build_tcm_keywords L78）。
    # 免疫 / 体力
    "提高抵抗力": ["补气", "益气固表", "免疫调节", "扶正"],
    "缓解疲劳": ["抗疲劳", "益气健脾", "补气", "补肾"],
    "提升精力": ["补气", "补肾", "益精", "抗疲劳"],
    # 消化
    "促进消化": ["消食", "健脾", "理气", "助消化"],
    "调理脾胃": ["健脾", "和胃", "理气", "消化系统"],
    # 神经 / 睡眠
    "安神定志": ["安神", "养心安神", "宁心", "定志"],
    # 美容 / 抗衰
    "美容养颜": ["美容养颜", "养血", "活血", "润肤"],
    "护肤保湿": ["养阴生津", "滋阴润燥", "润肤", "美容养颜"],
    "延缓衰老": ["抗衰老", "抗氧化", "补肾", "益精"],
    # 心血管 / 循环
    "保护血管": ["心血管保护", "活血", "化瘀", "降脂"],
    "促进循环": ["活血", "通络", "温通经脉", "改善微循环"],
    # 骨关节 / 视力
    "强健筋骨": ["强筋骨", "补肝肾", "壮骨", "益精"],
    "补钙健骨": ["补肝肾", "强筋骨", "壮骨", "益精"],
    "明目护眼": ["明目", "养肝", "清肝", "益精"],
    "缓解眼疲劳": ["明目", "养肝", "清肝", "滋养肝血"],
    # 呼吸
    "清咽利喉": ["利咽", "润喉", "清热解毒", "润肺"],
    # 代谢
    "辅助降尿酸": ["利尿", "祛湿", "清热利湿", "降尿酸"],
    "调节代谢": ["健脾", "利湿", "化痰", "降脂"],
    "控制体重": ["利湿", "化痰", "消食", "降脂"],
}


def build_tcm_keywords(frontend_labels: list[str]) -> list[str]:
    """将前端功效标签集合转换为 TCM 关键词列表"""
    keywords: list[str] = []
    for label in frontend_labels:
        keywords.extend(EFFECT_LABEL_TO_TCM_KEYWORD.get(label, [label]))
    # 去重并保持顺序
    seen: set[str] = set()
    result: list[str] = []
    for kw in keywords:
        if kw not in seen:
            seen.add(kw)
            result.append(kw)
    return result


# 阶段1 治本（S1-1）：兜底药材池**动态派生自 L1 食品级白名单**（app/services/ai/safety/
#   herb_whitelist.py），不再硬编码列表。权威源 = 国家卫健委药食同源目录 106 种
#   （tcmsp_client.FOOD_HOMOLOGY_CATALOG，与 temp/herb_food_herbs_2024.json 106 种 100% 一致）。
# ★ 治本要点 ★：
#   1) 每味候选项**强制过滤 through L1_FOOD_GRADE**——非 106 目录内的药材（如白术/玫瑰花/
#      受保护物种虫草）即使误写进下面的偏好映射，也会被剔除，杜绝目录外/受保护物种入池。
#   2) 每味均带目录日限量（formula_compliance.FOOD_HERB_MAX_DOSAGE），可被 clamp 约束。
#   3) 某功效若过滤后 <3 味（极端情况），运行时由 _fallback_rule_engine 用 l1_default_pool()
#      （全部 106 种 L1）补足，永不硬凑目录外药材。
# 偏好映射仅为"该功效常用哪些 L1 药材"的软排序；真正准入由 L1 白名单 + check_herb_admission 双保险。
def _build_fallback_pool() -> dict[str, list[str]]:
    from .safety.herb_whitelist import L1_FOOD_GRADE

    preferred: dict[str, list[str]] = {
        "免疫调节": ["黄芪", "党参", "山药", "枣", "枸杞子", "茯苓", "甘草", "黄精"],
        "补气": ["黄芪", "党参", "山药", "枣", "茯苓", "甘草", "黄精"],
        "抗氧化": ["枸杞子", "桑椹", "菊花", "山楂", "山药", "枣", "决明子"],
        "抗衰老": ["枸杞子", "山药", "枣", "桑椹", "茯苓", "黄精"],
        "安神": ["酸枣仁", "百合", "茯苓", "枣", "龙眼肉", "莲子"],
        "健脾": ["山药", "茯苓", "枣", "党参", "橘皮", "薏苡仁"],
        "补气养阴": ["黄芪", "党参", "山药", "玉竹", "枸杞子", "枣", "麦冬"],
        "清热": ["菊花", "金银花", "薄荷", "淡竹叶", "栀子", "决明子"],
    }
    pool: dict[str, list[str]] = {}
    for effect, names in preferred.items():
        # ★ 强制过滤：仅保留 L1 食品级（106 目录内）药材，剔除目录外/受保护物种
        pool[effect] = [n for n in names if n in L1_FOOD_GRADE]
    return pool


_FALLBACK_HERB_POOL: dict[str, list[str]] = _build_fallback_pool()


def _fallback_rule_engine(
    target_effects: list[str],
    max_candidates: int,
    total_dosage_g: float,
    tcm_keywords: list[str],
    constraints: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    回退规则引擎（阶段0 合规加固版）

    ★ 阶段0 三道闸（结构性修复 P0 合规红线）★
    本引擎不再是"跳过合规的兜底"，其输出与 GA 路径走同一套安全合规闸门：
      闸1 药材准入：仅使用 106 种药食同源目录内、且非禁用级黑名单的药材
                   （经 safety_gate.check_herb_admission 二次准入，虫草在此现形淘汰）
      闸2 剂量上限：每味剂量 ≤ 目录日限量（food_herb_max_dosage）
      闸3 真实安全裁定：safety_passed 由 check_compliance 得出，杜绝硬编码 0.85

    多样性修复：原实现固定切片 herb_list[:6] 导致 5 套候选完全相同；
    现按候选序号轮转 + 无放回抽样，保证候选间药材组合不同。
    若合格药材不足 3 味，返回显式降级响应（不硬凑）。
    """
    from .safety.canonical_names import canonicalize_herb_name
    from .safety.safety_gate import (
        check_formula_safety,
        check_herb_admission,
        clamp_dosage_to_catalog,
    )

    # ── 闸1：药材准入 —— 按功效关键词收集候选，仅保留通过 L0 准入者 ──
    herb_pool: list[str] = []
    seen: set[str] = set()
    for effect in tcm_keywords:
        for name in _FALLBACK_HERB_POOL.get(effect, []):
            if name in seen:
                continue
            seen.add(name)
            # 二次准入（黑名单 + 106 目录双保险）
            if check_herb_admission(name).admitted:
                herb_pool.append(name)
            else:
                logger.warning(f"[FallbackGate] 药材 '{name}' 未通过准入，已剔除")

    # 兜底：若关键词全无命中，用一个安全的默认池（全部为 106 目录内药材）
    if len(herb_pool) < 3:
        for name in ["山药", "枣", "枸杞子", "茯苓", "党参", "菊花"]:
            if name not in seen and check_herb_admission(name).admitted:
                seen.add(name)
                herb_pool.append(name)

    # ── S0-6：个人约束过滤（过敏原/禁忌/硬排除）—— 兜底路径也要尊重用户 constraints ──
    # GA 路径在 generate() L634-643 已处理 exclude_herbs+allergies；兜底路径此前忽略，
    # 会对过敏用户产出含过敏原的配方。此处对齐：把 allergies/exclude_herbs 归一后从候选池剔除。
    constraints = constraints or {}
    exclude_raw: set[str] = set(constraints.get("exclude_herbs") or [])
    allergies = constraints.get("allergies") or []
    if isinstance(allergies, list):
        exclude_raw.update(str(a) for a in allergies if a)
    elif isinstance(allergies, str):
        exclude_raw.update(a.strip() for a in allergies.split(",") if a.strip())
    # 归一到药典正名（过敏原可能写俗名/别名，如"大枣"→"枣"），再与候选池比对
    exclude_canonical: set[str] = set()
    for raw in exclude_raw:
        try:
            exclude_canonical.add(canonicalize_herb_name(str(raw).strip()))
        except Exception:
            exclude_canonical.add(str(raw).strip())
    if exclude_canonical:
        before = len(herb_pool)
        herb_pool = [n for n in herb_pool if n not in exclude_canonical]
        removed = before - len(herb_pool)
        if removed:
            logger.info(
                f"[FallbackGate] 个人约束剔除 {removed} 味（过敏原/禁忌/硬排除）: "
                f"{sorted(exclude_canonical)}"
            )

    # ── 合格药材不足 3 味 → 返回显式降级（不硬凑）──
    if len(herb_pool) < 3:
        logger.error(
            f"[FallbackGate] 关键词 {tcm_keywords} 经准入后合格药材仅 {len(herb_pool)} 味（<3），返回无匹配"
        )
        return {
            "candidates": [],
            "total": 0,
            "generator": "rule_engine_fallback",
            "execution_time_ms": 0.0,
            "strategy": "rule_fallback",
            "best_score": 0.0,
            "degraded": True,
            "fallback_reason": f"目标功效 {target_effects} 经药材准入后合格药材不足，无法生成配方",
        }

    roles = ["君", "臣", "臣", "佐", "佐", "使"]
    formatted: list[dict[str, Any]] = []

    # 每个候选使用不同的起始偏移 + 味数，保证候选间药材组合不同（修复零多样性）
    pool_size = len(herb_pool)
    for i in range(min(max_candidates, 5)):
        # 味数在 4~6 间随候选变化，起始位置轮转，实现无放回的多样化抽样
        num_herbs = min(6, max(4, min(pool_size, 4 + (i % 3))))
        selected: list[str] = []
        for k in range(num_herbs):
            selected.append(herb_pool[(i * 2 + k) % pool_size])
        # 去重保序（轮转可能重复）
        selected = list(dict.fromkeys(selected))
        if len(selected) < 3:
            continue

        # ── 闸2：剂量上限 —— 按君臣佐使梯度分配后截断到目录限量 ──
        # 梯度权重：君 0.30 / 臣 0.20 / 佐 0.12 / 使 0.06（对齐中医方剂学剂量学）
        role_weights = {"君": 0.30, "臣": 0.20, "佐": 0.12, "使": 0.06}
        herb_combo: list[dict[str, Any]] = []
        for j, name in enumerate(selected):
            role = roles[j] if j < len(roles) else "佐"
            raw_g = total_dosage_g * role_weights.get(role, 0.10)
            clamped_g, _was_clamped, _max_g = clamp_dosage_to_catalog(name, raw_g)
            herb_combo.append({
                "name": name,
                "dosage": f"{round(clamped_g, 1)}g",
                "role": role,
            })

        # ── 闸3：真实安全裁定 —— 由 check_compliance 得出，杜绝硬编码 ──
        verdict = check_formula_safety(herb_combo, population="adults", auto_clamp=False)
        safety_passed = verdict.is_safe_for_display  # 仅 status == "PASS" 为 True
        safety_score = round(verdict.score / 100.0, 4) if verdict.is_verified else None

        candidate: dict[str, Any] = {
            "id": f"rule_candidate_{int(time.time())}_{i}",
            "formula_name": f"规则配方-{i + 1}",
            "name": f"配方方案{i + 1}",
            "herb_combination": herb_combo,
            "peptide_candidates": [],
            "synergy_score": round(0.5 + 0.15 * (i % 3), 4),
            "taste_score": 0.65,
            "stability_score": 0.70,
            # ★ 真实安全分：来自 check_compliance，未校验时为 None（前端显示"未校验"）★
            "safety_score": safety_score,
            "cost_score": 0.70,
            "efficacy_score": 0.60,
            "overall_score": round(0.6 + 0.08 * (i % 3), 4),
            "effects": target_effects,
            "generated_by": "rule_engine_fallback",
            "generated_at": datetime.datetime.now().isoformat(),
            # ★ 新增：三态安全裁定 + 降级标记（前端必须透传展示）★
            "safety_passed": safety_passed,
            "safety_verdict": {
                "status": verdict.status.lower(),  # pass / needs_attention / rejected / unverified
                "is_compliant": verdict.is_compliant,
                "violations": verdict.violations,
                "warnings": verdict.warnings,
            },
            "degraded": True,  # 兜底引擎产物，始终标记为降级
        }
        # 被闸门淘汰（REJECTED）的候选不返回前端
        if verdict.is_rejected:
            logger.warning(
                f"[FallbackGate] 候选 {i + 1} 被安全闸门淘汰: "
                f"{[v.get('message') for v in verdict.violations]}"
            )
            continue
        formatted.append(candidate)

    return {
        "candidates": formatted,
        "total": len(formatted),
        "generator": "rule_engine_fallback",
        "execution_time_ms": 0.0,
        "strategy": "rule_fallback",
        "best_score": max((c["overall_score"] for c in formatted), default=0),
        # ★ 降级标记：前端必须展示「本次由规则引擎兜底，未经 GA 优化」★
        "degraded": True,
        "fallback_reason": "GA 引擎不可用，本次由规则引擎兜底生成，结果未经多目标优化，仅供参考",
    }


def _parse_dosage_g(dosage: Any) -> float:
    """从候选剂量字段解析出克数（兼容 "10.0g" / "5-10g/天" / "500mg" / 数值 / None）。

    鲁棒解析（配方生成剂量带单位崩溃修复）：
    - 数值直接返回；None/空 → 0.0
    - 字符串用正则提取首个数字（"5-10g/天" 取下限 5.0），支持 g/克/mg 单位
    - mg → g 换算（/1000）；无法解析时异常安全返回 0.0（不崩）
    注意：本函数只做单位换算，不涉及剂量上限/安全闸（合规在 safety_gate 另行执行）。
    """
    import re as _re

    if dosage is None:
        return 0.0
    if isinstance(dosage, (int, float)):
        return max(0.0, float(dosage))
    text = str(dosage).strip()
    if not text:
        return 0.0
    # mg 显式优先（避免 "500mg" 被 g 替换误判）
    is_mg = "mg" in text.lower()
    match = _re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return 0.0
    value = float(match.group())
    if is_mg:
        value = value / 1000.0
    return max(0.0, value)


def _milp_refine_combo(
    herb_combo: list[dict[str, Any]],
    total_dosage_g: float,
) -> list[dict[str, Any]]:
    """对单个 GA 候选的药材组合做 MILP 剂量精算（仅更新剂量，不改 name/role）。

    ★ 防御式 ★：MILP 仅在 status=="optimal" 且无「严重违规」（超目录限量/
    负剂量/梯度倒挂）时覆盖 GA 剂量；fallback 或异常一律回退 GA 原剂量，
    绝不阻断/破坏候选生成。
    """
    try:
        from .algorithms.milp_dose_refiner import refine_dosages

        herbs = [
            {
                "name": h.get("name"),
                "role": h.get("role"),
                "dosage_g": _parse_dosage_g(h.get("dosage")),
            }
            for h in herb_combo
        ]
        if not herbs:
            return herb_combo

        result = refine_dosages(herbs, total_dosage_g=total_dosage_g)
        status = result.get("status")
        refined = result.get("refined") or []

        # 仅可信结果才覆盖：optimal + 长度一致 + 无严重违规
        if status != "optimal" or len(refined) != len(herb_combo):
            logger.info(
                "[MILP] 候选精算不可信（status=%s, refined=%d/%d），保留 GA 剂量",
                status, len(refined), len(herb_combo),
            )
            return herb_combo

        severe = [
            v for v in (result.get("violations") or [])
            if ("超目录限量" in v or "负剂量" in v or "梯度违反" in v)
        ]
        if severe:
            logger.info(
                "[MILP] 候选精算存在严重违规 %s，保留 GA 剂量", severe
            )
            return herb_combo

        # 用 refined 剂量替换（保持 name/role 不变，只更新剂量；仍以 "x.xg" 字符串呈现）
        refined_map = {r.get("name"): r.get("dosage_g") for r in refined}
        new_combo: list[dict[str, Any]] = []
        for h in herb_combo:
            new_h = dict(h)
            g = refined_map.get(h.get("name"))
            if g is not None:
                new_h["dosage"] = f"{round(float(g), 1)}g"
            new_combo.append(new_h)

        # ★ 过滤近零剂量项 ★：MILP 在容量受限（可达上限 << 目标总剂量）时会把部分
        # 药材压到 ~0g，输出"某某 0.0g"会让用户困惑、像 bug。此处剔除 <0.5g 的药材项，
        # 保留有实质剂量的君臣佐使。保护：过滤后至少保留 2 味（配方需君臣），否则保留原组合。
        MEANINGFUL_G = 0.5
        filtered = [h for h in new_combo if _parse_dosage_g(h.get("dosage")) >= MEANINGFUL_G]
        if len(filtered) >= 2:
            if len(filtered) < len(new_combo):
                logger.info(
                    "[MILP] 过滤近零剂量项：%d -> %d 味（剔除 %s）",
                    len(new_combo), len(filtered),
                    [h["name"] for h in new_combo if h not in filtered],
                )
            new_combo = filtered
        else:
            logger.info("[MILP] 过滤后不足 2 味，保留原组合（%d 味）", len(new_combo))

        logger.info(
            "[MILP] 候选精算生效（solver=%s）：before=%s after=%s",
            result.get("solver"),
            [(h["name"], h["dosage"]) for h in herb_combo],
            [(h["name"], h["dosage"]) for h in new_combo],
        )
        return new_combo
    except Exception as e:  # 绝不阻断候选生成
        logger.warning("[MILP] 剂量精算异常，回退 GA 原剂量: %s", e)
        return herb_combo


def _format_ga_candidates(
    candidates: list,
    optimizer: Any,
    target_effects: list[str],
    max_candidates: int,
    start_ts: float,
    total_dosage_g: float = 100.0,
    tcm_keywords: Optional[list[str]] = None,
    include_debug: bool = False,
) -> dict[str, Any]:
    """将 GA 输出的 Individual 列表格式化为前端 AICandidate 结构

    ★ 阶段0 合规加固 ★：GA 候选出口经统一安全闸门（safety_gate）校验，
    与兜底路径走同一套 L0准入+剂量上限+配伍禁忌+真实check_compliance。
    替换旧的 `safety_passed = safety >= 0.7` 伪判定——GA 内部 safety 维度
    仅反映优化目标，不代表真实合规；现由闸门得出三态裁定。
    被闸门淘汰（REJECTED，如含虫草/超剂量/十八反）的候选不返回前端。
    """
    from .safety.safety_gate import check_formula_safety

    elapsed_ms = (time.perf_counter() - start_ts) * 1000

    # 使用优化器实际加载的药材字典做 herb_id → 中文名映射。
    # 早期版本硬编码 _BUILTIN_HERBS，导致数据库药材被映射成原始 ID。
    loaded_herbs: dict = getattr(optimizer, "_herbs", None) or {}

    # ★ 诊断字段开关：默认关闭，保持生产响应契约干净。
    # 仅当调用方经 run_ga_generation 传 include_debug=True（constraints={"debug": true}）
    # 时才注入 _efficacy_debug / _herb_load_debug。曾用于定位"efficacy 恒地板"假警报，
    # 现已确认那是测试客户端 GBK 编码所致、后端一直正常，故默认不再对外暴露内部结构。
    herb_id_to_name: dict[str, str] = {}
    if loaded_herbs:
        for hid, h in loaded_herbs.items():
            herb_id_to_name[hid] = getattr(h, "name_cn", "") or hid
    if not herb_id_to_name:
        # 极端兜底：优化器未加载任何药材时使用内置库
        from .algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS
        herb_id_to_name = {hid: h.name_cn for hid, h in _BUILTIN_HERBS.items()}

    role_labels = ["君", "臣", "臣", "佐", "佐", "使"]

    formatted_candidates: list[dict[str, Any]] = []
    for i, ind in enumerate(candidates[:max_candidates]):
        # 按剂量降序排列药材（前6味作为君臣佐使）
        sorted_genes = sorted(ind.genes.items(), key=lambda x: -x[1])[:6]

        herb_combo: list[dict[str, Any]] = []
        for j, (hid, dosage_g) in enumerate(sorted_genes):
            name_cn = herb_id_to_name.get(hid, hid)
            role = role_labels[j] if j < len(role_labels) else "佐"
            herb_combo.append({
                "name": name_cn,
                "dosage": f"{round(dosage_g, 1)}g",
                "role": role,
            })

        # ★ MILP 剂量精算（阶段2）：GA 初值 → 安全约束下精算剂量后处理 ★
        # 仅在可信时覆盖 GA 剂量（optimal + 无严重违规），否则保留 GA 原值；
        # 防御式包裹，任何异常回退，绝不阻断候选生成。
        herb_combo = _milp_refine_combo(herb_combo, total_dosage_g)

        # 多维度评分（直接从 Individual 对象读取）
        efficacy = getattr(ind, "efficacy", 0.7)
        safety = getattr(ind, "safety", 0.8)
        taste = getattr(ind, "taste", 0.6)
        cost = getattr(ind, "cost", 0.7)
        synergy = getattr(ind, "synergy", 0.5)
        stability = getattr(ind, "stability", 0.65)

        # ★ P0 诊断字段（仅 debug=True 时注入；默认不输出，避免泄露内部结构到生产 API）★
        # 逐关键词统计：优化器评分字典(optimizer._herbs)里该候选各药材对此功效的贡献者。
        # 注意：GA evaluate() 实际用 _translate_effect_ids 归一化后的 DB 键（免疫调节/补气/…），
        # 而非前端 label（增强免疫）。故调试同时覆盖 tcm_keywords（真实评分键）与 target_effects（label）。
        efficacy_debug: Optional[dict[str, Any]] = None
        if include_debug:
            _debug_kws = list(dict.fromkeys(list(tcm_keywords or []) + list(target_effects or [])))
            _eff_debug_kws: dict[str, Any] = {}
            for _kw in _debug_kws:
                _contributors: list[str] = []
                _kw_scores: list[float] = []
                for _hid, _dos in ind.genes.items():
                    _h = loaded_herbs.get(_hid)
                    _s = (getattr(_h, "efficacy_scores", {}) or {}).get(_kw, 0) if _h else 0
                    if _s > 0:
                        _contributors.append(getattr(_h, "name_cn", _hid))
                        _kw_scores.append(_s)
                _eff_debug_kws[_kw] = {
                    "contributors": _contributors,
                    "scores": [round(x, 3) for x in _kw_scores],
                    "n_contributors": len(_contributors),
                }
            _first_hid = next(iter(ind.genes.keys()), None)
            _first_h = loaded_herbs.get(_first_hid) if _first_hid else None
            efficacy_debug = {
                "efficacy_raw": round(efficacy, 4),
                "per_keyword": _eff_debug_kws,
                "sample_herb_id": _first_hid,
                "sample_herb_name": (getattr(_first_h, "name_cn", _first_hid) if _first_h else "NOT_IN_OPTIMIZER_DICT"),
                "sample_herb_efficacy_keys": (list((getattr(_first_h, "efficacy_scores", {}) or {}).keys())[:8] if _first_h else []),
                "optimizer_herbs_total": len(loaded_herbs),
                "optimizer_herbs_with_efficacy": sum(
                    1 for _h in loaded_herbs.values() if getattr(_h, "efficacy_scores", None)
                ),
            }

        overall = (
            efficacy * 0.30 + safety * 0.25 + taste * 0.10
            + cost * 0.15 + synergy * 0.10 + stability * 0.10
        )

        formula_name_base = "+".join(target_effects[:2]) if target_effects else "配方"

        # ★ 统一安全闸门：GA 候选出口强制校验（与兜底路径同一套）★
        # auto_clamp=True：GA 按 herb.dosage_max 优化剂量可能超目录限量，
        # 此处自动截断到目录限量（NEEDS_ATTENTION）而非整体拒绝——GA 是善意
        # 优化器，闸门自动降量修复；仅虫草/配伍禁忌等硬违规才 REJECTED。
        verdict = check_formula_safety(herb_combo, population="adults", auto_clamp=True)
        if verdict.is_rejected:
            logger.warning(
                f"[GAGate] GA 候选 {i + 1} 被安全闸门淘汰: "
                f"{[v.get('message') for v in verdict.violations]}"
            )
            continue
        safety_passed = verdict.is_safe_for_display  # 仅 status == "PASS" 为 True
        compliance_score = round(verdict.score / 100.0, 4) if verdict.is_verified else None

        formatted_candidates.append({
            "id": f"ga_candidate_{int(time.time())}_{i}",
            "formula_name": f"优化配方-{i+1}（{formula_name_base}）",
            "name": f"配方方案{i + 1}",
            "herb_combination": herb_combo,
            "peptide_candidates": [],
            "synergy_score": round(synergy, 4),
            "taste_score": round(taste, 4),
            "stability_score": round(stability, 4),
            # ★ 真实合规安全分：来自 check_compliance，未校验为 None（前端显"未校验"）★
            # GA 内部 safety 维度仍计入 overall_score，但对外安全分以合规闸门为准。
            "safety_score": compliance_score,
            "cost_score": round(cost, 4),
            "efficacy_score": round(efficacy, 4),
            "overall_score": round(overall, 4),
            "score": round(overall, 4),
            # ★ 三态安全裁定（替换旧 safety >= 0.7 伪判定）★
            "safety_passed": safety_passed,
            "safety_verdict": {
                "status": verdict.status.lower(),  # pass / needs_attention / rejected / unverified
                "is_compliant": verdict.is_compliant,
                "violations": verdict.violations,
                "warnings": verdict.warnings,
            },
            "effects": target_effects,
            "generated_by": "ga_optimizer",
            "generated_at": datetime.datetime.now().isoformat(),
        })
        # ★ P0 诊断字段：仅 debug=True 时注入（默认不输出，保持生产响应契约干净）★
        if include_debug and efficacy_debug is not None:
            formatted_candidates[-1]["_efficacy_debug"] = efficacy_debug

    # ★ 响应级药材装载诊断：仅 debug=True 时构建并返回 ★
    herb_load_debug: Optional[dict[str, Any]] = None
    if include_debug:
        from .algorithms.herb_knowledge_service import get_global_herb_knowledge as _gg
        _hk = _gg()
        _svc_herbs = (_hk.get_herbs() if _hk else {}) or {}
        _svc_with_eff = sum(1 for _h in _svc_herbs.values() if getattr(_h, "efficacy_scores", None))
        _opt_with_eff = sum(1 for _h in loaded_herbs.values() if getattr(_h, "efficacy_scores", None))
        _svc_sample = next(iter(_svc_herbs.values()), None)
        _opt_sample = next(iter(loaded_herbs.values()), None)
        herb_load_debug = {
            "service_singleton": {
                "total": len(_svc_herbs),
                "with_efficacy": _svc_with_eff,
                "sample_name": (getattr(_svc_sample, "name_cn", "") if _svc_sample else None),
                "sample_efficacy_keys": (list((getattr(_svc_sample, "efficacy_scores", {}) or {}).keys())[:8] if _svc_sample else []),
            },
            "optimizer_dict": {
                "total": len(loaded_herbs),
                "with_efficacy": _opt_with_eff,
                "sample_name": (getattr(_opt_sample, "name_cn", "") if _opt_sample else None),
                "sample_efficacy_keys": (list((getattr(_opt_sample, "efficacy_scores", {}) or {}).keys())[:8] if _opt_sample else []),
            },
            "target_tcm_keywords": target_effects,
            # GA evaluate 实际评分用的归一化 DB 键（关键：增强免疫→免疫调节/补气/抗炎/抗氧化）
            "ga_evaluated_keywords": tcm_keywords or [],
        }

    result: dict[str, Any] = {
        "candidates": formatted_candidates,
        "total": len(formatted_candidates),
        "generator": "ga_optimizer",
        "execution_time_ms": round(elapsed_ms, 2),
        "strategy": "ga",
        "best_score": round(max((c["overall_score"] for c in formatted_candidates), default=0), 4),
    }
    if include_debug and herb_load_debug is not None:
        result["_herb_load_debug"] = herb_load_debug
    return result


def _clamp_int(value: Any, default: int, lo: int, hi: int) -> int:
    """将约束值安全转换为 [lo, hi] 范围内的整数，非法/缺失时返回 default。"""
    try:
        v = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def _clamp_float(value: Any, default: float, lo: float, hi: float) -> float:
    """将约束值安全转换为 [lo, hi] 范围内的浮点数，非法/缺失时返回 default。"""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


# RAG 检索钩子已抽取为独立模块 app/services/ai/rag/formula_rag_hook.py
# 提供：rag_enhance_formula_generation() / herb_names_to_ids() / normalize_exclude_herbs()


async def run_ga_generation(
    target_effects: list[str],
    constraints: Optional[dict[str, Any]] = None,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    执行真实 GA 配方生成管线（唯一权威实现）。

    Args:
        target_effects: 前端功效标签列表（如 ['增强免疫', '抗氧化']）
        constraints: 约束条件，支持以下键：
            - max_candidates: 返回候选数上限（默认 5，最少 3）
            - total_dosage_g: 配方总剂量（克）
            - objective_weights: GA 多目标权重 dict
            - population_size / generations / mutation_rate / crossover_rate /
              elite_ratio / tournament_size: GA 算法参数（均有默认值兜底）
            - exclude_herbs: 排除药材 ID/名称列表
            - allergies: 过敏原列表（与 exclude_herbs 合并硬排除）
            - age_group / target_group: 特殊人群（adult/pregnant/children/elderly）
            - max_cost: 成本上限（元），超出成本的候选被过滤
        user_id: 租户过滤（P0-4）。从请求取当前认证用户 id 传入，透传给 RAG 检索钩子；
            拿不到时传 None（保持全局检索的兼容行为），但绝不能传他租户的 id。

    Returns:
        dict: 与 generation_v2 /generate 完全兼容的响应结构。
        当 GA 引擎不可用且 HerbKnowledgeService 未初始化时抛出 503；
        其它 GA 失败显式返回 degraded:true + fallback_reason，不再静默伪造硬编码配方。
    """
    constraints = constraints or {}
    max_candidates = max(int(constraints.get("max_candidates", 5) or 5), 3)
    total_dosage_g = max(float(constraints.get("total_dosage_g", 100.0) or 100.0), 30.0)

    tcm_keywords = build_tcm_keywords(target_effects)
    logger.info(f"[FormulaGenerationService] 目标功效={target_effects}, TCM关键词={tcm_keywords}")

    # P0-3：HerbKnowledgeService 未初始化时禁止静默回退硬编码随机配方 → 直接 503
    from .algorithms.herb_knowledge_service import get_global_herb_knowledge
    if get_global_herb_knowledge() is None:
        logger.error("[FormulaGenerationService] HerbKnowledgeService 未初始化，拒绝生成（禁止回退硬编码配方）")
        raise HTTPException(status_code=503, detail="AI 服务未初始化，请稍后重试")

    # P0 自愈：HerbKnowledgeService 可能因启动时序载入不完整（服务已有药材但功效索引为空 →
    # GA 的 _efficacy_index 为空 → _select_herbs 候选<3 → 静默回退规则引擎）。
    # 检测到「已有药材但功效索引为空」时强制重载一次，确保 GA 基于真实功效数据产出候选。
    _hk = get_global_herb_knowledge()
    if _hk is not None:
        try:
            # ── P0 自愈闸（收紧版）───────────────────────────────────────────
            # 旧条件 `not _hk.get_efficacy_to_herbs()` 只查「功效→药材索引空」，
            # 漏掉「索引非空但单味药材 efficacy_scores 为空」的场景 —— 此时 GA 逐味
            # 打分 herb.efficacy_scores.get(effect,0) 全返 0，4 关键词全压地板 → 恒 0.01。
            # 新条件：直接校验「本次 tcm_keywords 能否真正命中带功效分的药材」。
            herbs_now = _hk.get_herbs() or {}
            herbs_with_efficacy = sum(
                1 for h in herbs_now.values() if getattr(h, "efficacy_scores", None)
            )
            if herbs_with_efficacy == 0:
                logger.error(
                    "[FormulaGenerationService] 启动自检失败：带功效分药材数=0/%d，"
                    "强制重载 HerbKnowledge（GA 将无真实功效数据可评）",
                    len(herbs_now),
                )
            per_kw_hits = {
                kw: sum(
                    1
                    for h in herbs_now.values()
                    if (getattr(h, "efficacy_scores", {}) or {}).get(kw, 0) > 0
                )
                for kw in tcm_keywords
            }
            any_kw_zero_hit = any(v == 0 for v in per_kw_hits.values())
            if any_kw_zero_hit:
                logger.warning(
                    "[FormulaGenerationService] 部分目标关键词全库零命中（候选池将偏窄），"
                    "尝试强制重载: %s",
                    {k: v for k, v in per_kw_hits.items() if v == 0},
                )
            if herbs_with_efficacy == 0 or any_kw_zero_hit:
                logger.warning(
                    "[FormulaGenerationService] 功效数据未送达 GA（带功效分=%d/%d，关键词命中=%s），"
                    "强制 reload_herbs 复检",
                    herbs_with_efficacy, len(herbs_now), per_kw_hits,
                )
                await _hk.load_herbs(force_reload=True)
                herbs_now = _hk.get_herbs() or {}
                herbs_with_efficacy = sum(
                    1 for h in herbs_now.values() if getattr(h, "efficacy_scores", None)
                )
                per_kw_hits = {
                    kw: sum(
                        1
                        for h in herbs_now.values()
                        if (getattr(h, "efficacy_scores", {}) or {}).get(kw, 0) > 0
                    )
                    for kw in tcm_keywords
                }
                logger.info(
                    "[FormulaGenerationService] 自愈重载完成: 带功效分=%d/%d, 关键词命中=%s",
                    herbs_with_efficacy, len(herbs_now), per_kw_hits,
                )
                if herbs_with_efficacy == 0:
                    logger.error(
                        "[FormulaGenerationService] ⚠️ 重载后仍无任何药材带功效分 —— "
                        "功效数据管线（DB/adapter）在进程内失效，GA 功效评分将退化为地板值，"
                        "根因需后续在 herb_knowledge 适配器/预热链路排查"
                    )
        except Exception as e:
            logger.warning(f"[FormulaGenerationService] HerbKnowledge 自愈重载失败（忽略，GA 按当前数据执行）: {e}")

    start_ts = time.perf_counter()
    try:
        from .algorithms.genetic_formula_optimizer import GAConfig, GeneticFormulaOptimizer

        objective_weights = constraints.get("objective_weights")
        config = GAConfig(
            population_size=_clamp_int(constraints.get("population_size"), 80, 10, 500),
            generations=_clamp_int(constraints.get("generations"), 30, 5, 200),
            mutation_rate=_clamp_float(constraints.get("mutation_rate"), 0.25, 0.01, 0.5),
            crossover_rate=_clamp_float(constraints.get("crossover_rate"), 0.85, 0.1, 1.0),
            elite_ratio=_clamp_float(constraints.get("elite_ratio"), 0.1, 0.01, 0.5),
            tournament_size=_clamp_int(constraints.get("tournament_size"), 5, 2, 20),
            target_effects=tcm_keywords,
            early_stop_patience=0,  # 禁用早停，确保充分进化
            early_stop_threshold=0.0,
            objective_weights=dict(objective_weights) if isinstance(objective_weights, dict) else None,
        )
        optimizer = GeneticFormulaOptimizer(config=config)

        # ── RAG 检索钩子：用知识库（296味药材/106种药食同源/国标）增强候选筛选 ──
        # 命中知识条目的药材进入白名单（include_herbs），禁忌/毒性/超量条目进入黑名单。
        # 逻辑位于独立模块 app/services/ai/rag/formula_rag_hook.py，任何异常返回 None 不阻断主流程。
        from app.services.ai.rag.formula_rag_hook import (
            herb_names_to_ids,
            normalize_exclude_herbs,
            rag_enhance_formula_generation,
        )
        # P2-1：RAG 钩子超时保护——超过 8s 返回 None 信号，绝不阻断 GA 主流程。
        try:
            rag_signals = await asyncio.wait_for(
                rag_enhance_formula_generation(
                    target_effects=target_effects,
                    tcm_keywords=tcm_keywords,
                    constraints=constraints,
                    top_k=6,
                    user_id=user_id,
                ),
                timeout=8.0,
            )
        except asyncio.TimeoutError:
            logger.warning("[FormulaGenerationService] RAG 钩子超时（>8s），跳过 RAG 增强继续 GA")
            rag_signals = None
        rag_signals = rag_signals or {}

        whitelist_ids: list[str] = []
        if rag_signals.get("enabled"):
            whitelist_ids = herb_names_to_ids(rag_signals.get("whitelist", []), optimizer)

        # P1-4：读取个人约束并透传优化器
        exclude_set: set[str] = set(constraints.get("exclude_herbs") or [])
        allergies = constraints.get("allergies") or []
        if allergies:
            if isinstance(allergies, list):
                exclude_set.update(str(a) for a in allergies)
            elif isinstance(allergies, str):
                exclude_set.update(a.strip() for a in allergies.split(",") if a.strip())

        # 用户硬排除（中文名统一映射为 herb_id）
        user_exclude_herbs = normalize_exclude_herbs(exclude_set, optimizer) or None

        # RAG 黑名单（herb_id）单独保留——仅作为附加排除，若导致候选池为空则放弃 RAG 硬排除
        rag_blacklist_ids: list[str] = []
        if rag_signals.get("enabled"):
            rag_blacklist_ids = herb_names_to_ids(rag_signals.get("blacklist", []), optimizer)
            if rag_blacklist_ids:
                logger.info(f"[FormulaGenerationService] RAG 禁忌药材加入黑名单: {rag_blacklist_ids}")
        combined_exclude = set(user_exclude_herbs or []) | set(rag_blacklist_ids) or None

        age_group = str(constraints.get("age_group") or constraints.get("target_group") or "adult").lower()
        if age_group not in {"adult", "pregnant", "children", "elderly"}:
            age_group = "adult"

        # ── 阶段1 L1→L2 治法驱动集成（方案B：骨架偏置）──
        # L1 辨证归纳（syndrome_induction.SyndromeInductionEngine.induce）产出 TreatmentIntent：
        # 主证型 → 治法 → 经典骨架（君臣佐使 RoleSlot）。
        # 本块只做软偏置：把骨架药材（含目录内替代品）经 canonical 归一 + L0 准入后
        # 通过 herb_names_to_ids 映射为 herb_id，合并进 include_herbs 白名单。
        # ★ 绝不修改 tcm_keywords —— 治法级术语不在 GA 功效索引内，会致空池。
        # ★ 防御式：任何异常降级为原有关键词继续，绝不阻断生成。
        l1_bias_ids: list[str] = []
        try:
            from .safety.canonical_names import canonicalize_herb_name
            from .safety.safety_gate import check_herb_admission
            from .syndrome.syndrome_induction import SyndromeInductionEngine

            intent = SyndromeInductionEngine().induce(
                efficacy_labels=target_effects,
                symptoms=constraints.get("symptoms"),
                constitution=constraints.get("constitution"),
                objective_markers=constraints.get("objective_markers"),
            )

            # 收集骨架各角色药材 + 替代品（保序去重）
            bias_names: list[str] = []
            skeleton = getattr(intent, "skeleton", None)
            if skeleton is not None:
                for slot in getattr(skeleton, "roles", {}).values():
                    for name in (list(getattr(slot, "herbs", ()) or [])
                                 + list(getattr(slot, "substitutes", ()) or [])):
                        if name and name not in bias_names:
                            bias_names.append(name)

            # canonical 归一 → L0 准入过滤（仅保留 106 目录内药材）
            admissible: list[str] = []
            for name in bias_names:
                try:
                    if check_herb_admission(canonicalize_herb_name(name)).admitted:
                        if name not in admissible:
                            admissible.append(name)
                except Exception:
                    continue

            # 优化器 herb_db 惰性注入：ensure _herbs 非空，herb_names_to_ids 才能映射
            try:
                optimizer._try_load_herb_knowledge()
            except Exception:
                pass
            l1_bias_ids = herb_names_to_ids(admissible, optimizer)
            whitelist_ids = list(dict.fromkeys((whitelist_ids or []) + l1_bias_ids))

            logger.info(
                "[L1→L2] 证型=%s 治法=%s 骨架=%s 偏置药材=%s",
                getattr(getattr(intent, "primary_syndrome", None), "name", None),
                [getattr(m, "name", None) for m in getattr(intent, "treatment_methods", ())],
                getattr(skeleton, "name", None),
                admissible,
            )
        except Exception as e:
            logger.warning(
                "[L1→L2] 辨证归纳/骨架偏置失败（降级为原有关键词继续）: %s", e
            )

        candidates, history = optimizer.optimize(
            target_effects=tcm_keywords,
            exclude_herbs=combined_exclude,
            include_herbs=whitelist_ids or None,
            special_population=age_group,
            count=max_candidates,
        )

        # 保护：若 RAG 黑名单导致候选池为空，去掉 RAG 黑名单重试一次，
        # 确保 RAG 增强不会把配方生成打成规则引擎回退（线上故障防护）。
        if not candidates and rag_blacklist_ids:
            logger.warning(
                f"[FormulaGenerationService] RAG 黑名单导致无候选（{len(rag_blacklist_ids)} 味被排除），"
                "去掉 RAG 黑名单重试 GA"
            )
            candidates, history = optimizer.optimize(
                target_effects=tcm_keywords,
                exclude_herbs=user_exclude_herbs,
                include_herbs=whitelist_ids or None,
                special_population=age_group,
                count=max_candidates,
            )
            if candidates:
                rag_signals = dict(rag_signals or {})
                rag_signals["blacklist_relaxed"] = True

        # 成本上限过滤（保留至少 1 个候选，避免空结果）
        max_cost = constraints.get("max_cost")
        if max_cost is not None and candidates:
            try:
                max_c = float(max_cost)
                filtered = []
                for ind in candidates:
                    total_cost = sum(
                        dosage * (optimizer._herbs[hid].cost_per_gram if hid in optimizer._herbs else 0.1)
                        for hid, dosage in ind.genes.items()
                    )
                    if total_cost <= max_c:
                        filtered.append(ind)
                if filtered:
                    candidates = filtered
                else:
                    logger.warning(
                        f"[FormulaGenerationService] max_cost={max_c} 过滤后无候选，保留成本最低的 1 个"
                    )
                    candidates = sorted(
                        candidates,
                        key=lambda ind: sum(
                            dosage * (optimizer._herbs[hid].cost_per_gram if hid in optimizer._herbs else 0.1)
                            for hid, dosage in ind.genes.items()
                        ),
                    )[:1]
            except (TypeError, ValueError):
                logger.warning(f"[FormulaGenerationService] 非法 max_cost: {max_cost}，忽略成本过滤")

        if not candidates:
            logger.error("[FormulaGenerationService] GA 引擎未返回候选，返回显式降级响应")
            fallback = _fallback_rule_engine(target_effects, max_candidates, total_dosage_g, tcm_keywords, constraints)
            fallback["degraded"] = True
            fallback["fallback_reason"] = "GA 引擎未返回候选"
            fallback["rag_evidence"] = rag_signals
            return fallback

        result = _format_ga_candidates(
            candidates, optimizer, target_effects, max_candidates, start_ts,
            total_dosage_g, tcm_keywords=tcm_keywords,
            include_debug=bool((constraints or {}).get("debug")),
        )

        # ★ 健壮性兜底（阶段2）：GA 产出了候选但全部被 L3 安全闸门拒绝（result.total==0）
        # 时，绝不能静默返回空配方（用户看不到任何东西，比降级更糟）。
        # 此时诚实降级到规则引擎（RULE_DEGRADED，仍穿越 L3），保证用户至少拿到一个
        # 可用且安全的配方，并通过 degraded + fallback_reason 透传原因供前端展示。
        if int(result.get("total", 0) or 0) <= 0:
            logger.warning(
                "[FormulaGenerationService] GA 候选全部被安全闸门拒绝（格式化后 0 个），"
                "诚实降级到规则引擎兜底"
            )
            fallback = _fallback_rule_engine(target_effects, max_candidates, total_dosage_g, tcm_keywords, constraints)
            fallback["degraded"] = True
            fallback["fallback_reason"] = "GA 候选未通过安全合规闸门，已降级为规则引擎配方"
            fallback["rag_evidence"] = rag_signals
            return fallback

        result["rag_evidence"] = rag_signals
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FormulaGenerationService] GA 引擎失败: {e}", exc_info=True)
        # 不再静默返回硬编码随机配方：显式标记 degraded + fallback_reason，供前端展示
        try:
            fallback = _fallback_rule_engine(target_effects, max_candidates, total_dosage_g, tcm_keywords, constraints)
            fallback["degraded"] = True
            fallback["fallback_reason"] = f"GA 引擎失败: {str(e)[:200]}"
            fallback["rag_evidence"] = {
                "enabled": False,
                "query": "",
                "chunks": [],
                "whitelist": [],
                "blacklist": [],
                "summary": "",
                "error": str(e)[:200],
            }
            return fallback
        except Exception as e2:
            logger.error(f"[FormulaGenerationService] 规则引擎回退失败: {e2}", exc_info=True)
            raise HTTPException(status_code=503, detail="AI 配方生成服务暂不可用，请稍后重试")
