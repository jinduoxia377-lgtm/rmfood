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


def _fallback_rule_engine(
    target_effects: list[str],
    max_candidates: int,
    total_dosage_g: float,
    tcm_keywords: list[str],
) -> dict[str, Any]:
    """回退规则引擎：基于功效-药材字典随机组合"""
    from app.services.ai_models.formula_gpt import _FOOD_HOMOLOGY_HERBS

    # 收集候选药材池
    herb_pool: set[str] = set()
    for effect in tcm_keywords:
        herbs = _FOOD_HOMOLOGY_HERBS.get(effect, [])
        herb_pool.update(herbs)

    if not herb_pool:
        herb_pool = set(_FOOD_HOMOLOGY_HERBS.get("增强免疫", []) + _FOOD_HOMOLOGY_HERBS.get("抗氧化", []))

    herb_list = list(herb_pool)
    roles = ["君", "臣", "臣", "佐", "佐", "使"]
    formatted: list[dict[str, Any]] = []

    for i in range(min(max_candidates, 5)):
        num_herbs = min(6, max(3, len(herb_list) - 1))
        selected = herb_list[:num_herbs] if len(herb_list) >= num_herbs else herb_list
        dose_per_herb = round(total_dosage_g / len(selected), 1) if selected else 10.0

        herb_combo: list[dict[str, Any]] = []
        for j, name in enumerate(selected):
            herb_combo.append({
                "name": name,
                "dosage": f"{dose_per_herb}g",
                "role": roles[j] if j < len(roles) else "佐",
            })

        formatted.append({
            "id": f"rule_candidate_{int(time.time())}_{i}",
            "formula_name": f"规则配方-{i+1}",
            "name": f"配方方案{i + 1}",
            "herb_combination": herb_combo,
            "peptide_candidates": [],
            "synergy_score": round(0.5 + 0.15 * (i % 3), 4),
            "taste_score": 0.65,
            "stability_score": 0.70,
            "safety_score": 0.85,
            "cost_score": 0.70,
            "efficacy_score": 0.60,
            "overall_score": round(0.6 + 0.08 * (i % 3), 4),
            "effects": target_effects,
            "generated_by": "rule_engine_fallback",
            "generated_at": datetime.datetime.now().isoformat(),
        })

    return {
        "candidates": formatted,
        "total": len(formatted),
        "generator": "rule_engine_fallback",
        "execution_time_ms": 0.0,
        "strategy": "rule_fallback",
        "best_score": max((c["overall_score"] for c in formatted), default=0),
    }


def _format_ga_candidates(
    candidates: list,
    optimizer: Any,
    target_effects: list[str],
    max_candidates: int,
    start_ts: float,
) -> dict[str, Any]:
    """将 GA 输出的 Individual 列表格式化为前端 AICandidate 结构"""
    elapsed_ms = (time.perf_counter() - start_ts) * 1000

    # 使用优化器实际加载的药材字典做 herb_id → 中文名映射。
    # 早期版本硬编码 _BUILTIN_HERBS，导致数据库药材被映射成原始 ID。
    loaded_herbs: dict = getattr(optimizer, "_herbs", None) or {}
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

        # 多维度评分（直接从 Individual 对象读取）
        efficacy = getattr(ind, "efficacy", 0.7)
        safety = getattr(ind, "safety", 0.8)
        taste = getattr(ind, "taste", 0.6)
        cost = getattr(ind, "cost", 0.7)
        synergy = getattr(ind, "synergy", 0.5)
        stability = getattr(ind, "stability", 0.65)

        overall = (
            efficacy * 0.30 + safety * 0.25 + taste * 0.10
            + cost * 0.15 + synergy * 0.10 + stability * 0.10
        )

        formula_name_base = "+".join(target_effects[:2]) if target_effects else "配方"
        formatted_candidates.append({
            "id": f"ga_candidate_{int(time.time())}_{i}",
            "formula_name": f"优化配方-{i+1}（{formula_name_base}）",
            "name": f"配方方案{i + 1}",
            "herb_combination": herb_combo,
            "peptide_candidates": [],
            "synergy_score": round(synergy, 4),
            "taste_score": round(taste, 4),
            "stability_score": round(stability, 4),
            "safety_score": round(safety, 4),
            "cost_score": round(cost, 4),
            "efficacy_score": round(efficacy, 4),
            "overall_score": round(overall, 4),
            "score": round(overall, 4),
            "safety_passed": safety >= 0.7,
            "effects": target_effects,
            "generated_by": "ga_optimizer",
            "generated_at": datetime.datetime.now().isoformat(),
        })

    return {
        "candidates": formatted_candidates,
        "total": len(formatted_candidates),
        "generator": "ga_optimizer",
        "execution_time_ms": round(elapsed_ms, 2),
        "strategy": "ga",
        "best_score": round(max((c["overall_score"] for c in formatted_candidates), default=0), 4),
    }


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
            if _hk.get_herbs() and not _hk.get_efficacy_to_herbs():
                logger.warning(
                    "[FormulaGenerationService] HerbKnowledge 功效索引为空（启动时序不完整），强制重载"
                )
                await _hk.load_herbs(force_reload=True)
                logger.info(
                    "[FormulaGenerationService] HerbKnowledge 自愈重载完成: %d 味药材, %d 个功效",
                    len(_hk.get_herbs()), len(_hk.get_efficacy_to_herbs()),
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
            fallback = _fallback_rule_engine(target_effects, max_candidates, total_dosage_g, tcm_keywords)
            fallback["degraded"] = True
            fallback["fallback_reason"] = "GA 引擎未返回候选"
            fallback["rag_evidence"] = rag_signals
            return fallback

        result = _format_ga_candidates(candidates, optimizer, target_effects, max_candidates, start_ts)
        result["rag_evidence"] = rag_signals
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FormulaGenerationService] GA 引擎失败: {e}", exc_info=True)
        # 不再静默返回硬编码随机配方：显式标记 degraded + fallback_reason，供前端展示
        try:
            fallback = _fallback_rule_engine(target_effects, max_candidates, total_dosage_g, tcm_keywords)
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
