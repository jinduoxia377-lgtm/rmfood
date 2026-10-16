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

import datetime
import logging
import time
from typing import Any, Dict, List, Optional

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
    "补气补血": ["补气", "补血", "养血", "免疫调节"],
    # 呼吸系统
    "润肺止咳": ["润肺", "止咳", "祛痰", "清热解毒"],
    "疏风清热": ["疏散风热", "清热解毒", "明目"],
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


async def run_ga_generation(
    target_effects: list[str],
    constraints: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    执行真实 GA 配方生成管线（唯一权威实现）。

    Args:
        target_effects: 前端功效标签列表（如 ['增强免疫', '抗氧化']）
        constraints: 约束条件，支持 max_candidates / total_dosage_g /
                     objective_weights（GA 多目标权重）等键。

    Returns:
        dict: 与 generation_v2 /generate 完全兼容的响应结构。
    """
    constraints = constraints or {}
    max_candidates = max(int(constraints.get("max_candidates", 5) or 5), 3)
    total_dosage_g = max(float(constraints.get("total_dosage_g", 100.0) or 100.0), 30.0)

    tcm_keywords = build_tcm_keywords(target_effects)
    logger.info(f"[FormulaGenerationService] 目标功效={target_effects}, TCM关键词={tcm_keywords}")

    start_ts = time.perf_counter()
    try:
        from .algorithms.genetic_formula_optimizer import GAConfig, GeneticFormulaOptimizer

        objective_weights = constraints.get("objective_weights")
        config = GAConfig(
            population_size=80,
            generations=30,
            mutation_rate=0.25,  # 更高变异率保持多样性
            crossover_rate=0.85,
            elite_ratio=0.1,
            tournament_size=5,
            target_effects=tcm_keywords,
            early_stop_patience=0,  # 禁用早停，确保充分进化
            early_stop_threshold=0.0,
            objective_weights=dict(objective_weights) if isinstance(objective_weights, dict) else None,
        )
        optimizer = GeneticFormulaOptimizer(config=config)
        candidates, history = optimizer.optimize(
            target_effects=tcm_keywords,
            count=max_candidates,
        )

        if not candidates:
            logger.warning("[FormulaGenerationService] GA 引擎未返回候选，回退规则引擎")
            return _fallback_rule_engine(target_effects, max_candidates, total_dosage_g, tcm_keywords)

        return _format_ga_candidates(candidates, optimizer, target_effects, max_candidates, start_ts)

    except Exception as e:
        logger.error(f"[FormulaGenerationService] GA 引擎失败: {e}", exc_info=True)
        try:
            return _fallback_rule_engine(target_effects, max_candidates, total_dosage_g, tcm_keywords)
        except Exception as e2:
            logger.error(f"[FormulaGenerationService] 规则引擎回退失败: {e2}", exc_info=True)
            raise