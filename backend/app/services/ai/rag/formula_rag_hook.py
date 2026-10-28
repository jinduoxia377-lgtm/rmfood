"""
RAG × 配方生成 钩子模块

将 RAG 知识库检索能力以轻量钩子形式暴露给配方生成主链路
（formula_generation_service.run_ga_generation / FormulaDesigner），
避免在共享的公式生成服务文件中堆叠检索细节，也方便前端/集成复用。

设计原则：
- 任何异常都返回 None / 空信号，绝不阻断主配方生成流程。
- 命中知识条目（296味药材 / 106种药食同源 / 国标法规）的药材进入白名单（正证据）；
  命中禁忌/毒性/用量限制关键词的药材进入黑名单（负证据）。
- 白名单/黑名单以中文药名返回，由调用方（拥有 optimizer._herbs 上下文）映射为 herb_id。
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

# 命中即视为"负证据"的关键词（强禁忌/毒性/绝对禁用）。
# 注意：不要包含"不宜/慎用/忌服/限制/孕妇/儿童"等群体性警示词——
# 药食同源法规条目几乎每条都带"限制：XX者忌服/慎用"，若把这些当黑名单，
# 会把绝大多数候选药材硬排除，导致 GA 候选池为空而回退规则引擎（线上故障）。
# 只保留绝对禁忌（十八反/十九畏/相反/相恶）、毒性、明确禁用、剂量过量/超量。
_RAG_CONTRAINDICATION_KEYWORDS: tuple[str, ...] = (
    "十八反", "十九畏", "相反", "相恶", "毒性", "有毒",
    "孕妇禁用", "儿童禁用", "哺乳期禁用", "过敏", "忌用",
    "过量", "超量", "不得超过", "禁止使用", "禁用",
)

# 负证据关键词与药材名共现的窗口大小（字符），避免整块命中导致的误黑名单
_CONTRAINDICATION_WINDOW = 120


def _is_negative_evidence(content: str, herb_name: str) -> bool:
    """判断某药材在检索块中是否命中禁忌/毒性/用量限制。

    只在药材名前后 _CONTRAINDICATION_WINDOW 字符范围内匹配关键词，
    避免法规/百科大段落中其它药材的禁忌信息误伤当前药材。
    """
    idx = content.find(herb_name)
    if idx < 0:
        return False
    start = max(0, idx - _CONTRAINDICATION_WINDOW)
    end = min(len(content), idx + len(herb_name) + _CONTRAINDICATION_WINDOW)
    window = content[start:end]
    return any(kw in window for kw in _RAG_CONTRAINDICATION_KEYWORDS)


def _load_known_herb_names() -> Set[str]:
    """收集已知药材中文名集合（用于从 RAG 检索块中匹配药材名）。

    优先使用全局 HerbKnowledgeService 的数据库药材名，不足时叠加内置目录兜底。
    """
    names: Set[str] = set()
    try:
        from ..algorithms.herb_knowledge_service import get_global_herb_knowledge
        hk = get_global_herb_knowledge()
        if hk is not None:
            for hp in hk.get_herbs().values():
                cn = getattr(hp, "name_cn", "") or ""
                if cn:
                    names.add(cn)
    except Exception as e:
        logger.debug("[FormulaRagHook] 加载全局药材名失败: %s", e)
    if len(names) < 20:
        try:
            from app.services.ai_models.safety_checker import _FOOD_HOMOLOGY_CATALOG_FALLBACK
            names.update(_FOOD_HOMOLOGY_CATALOG_FALLBACK)
        except Exception:
            pass
    return names


def _build_rag_summary(chunks: List[Dict[str, Any]]) -> str:
    """将 RAG 检索块压缩为可读摘要（供 FormulaDesigner / 日志使用）"""
    parts: List[str] = []
    for c in chunks[:3]:
        src = (c.get("source") or "rag").replace(".md", "").replace("_", " ")
        parts.append(f"[{src}] {c.get('content', '')[:120]}")
    return "\n".join(parts)


async def rag_enhance_formula_generation(
    target_effects: List[str],
    tcm_keywords: Optional[List[str]] = None,
    constraints: Optional[Dict[str, Any]] = None,
    top_k: int = 6,
    user_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """RAG 检索钩子：用知识库增强配方候选筛选。

    Args:
        target_effects: 前端功效标签列表（如 ['增强免疫', '抗氧化']）
        tcm_keywords: TCM 关键词（build_tcm_keywords 的输出，用于拼接检索查询）
        constraints: 配方约束（当前保留，未来可扩展按约束过滤知识块）
        top_k: 检索 TOP K 知识块
        user_id: 租户过滤（P0-4）。调用方（formula_generation_service）从请求取
            当前认证用户 id 传入；拿不到时传 None（保持全局检索的兼容行为），
            但绝不能传他租户的 id。

    Returns:
        dict | None：成功返回信号字典，任何异常返回 None（不阻断主流程）。

        信号字典结构：
        {
            "enabled": bool,          # RAG 检索是否真正返回了知识块
            "query": str,             # 实际检索查询
            "chunks": [...],          # 检索到的知识块（source/score/content）
            "whitelist": [...],      # 命中正向知识条目的药材中文名
            "blacklist": [...],      # 命中禁忌/毒性/用量限制的药材中文名
            "summary": str,          # 知识摘要
            "error": Optional[str],
        }
    """
    try:
        from .rag_service import rag_service

        effects = target_effects or []
        keywords = tcm_keywords or []
        query_parts = list(effects) + list(keywords)
        query = " ".join(query_parts) + " 药食同源 功效 配伍禁忌 用量"
        result = await rag_service.augment_query(query, top_k=top_k, user_id=user_id)
        chunks = getattr(result, "chunks", None) or []
        if not chunks:
            logger.info("[FormulaRagHook] RAG 检索无命中，跳过知识增强")
            return {
                "enabled": False,
                "query": query,
                "chunks": [],
                "whitelist": [],
                "blacklist": [],
                "summary": "",
                "error": None,
            }

        signals: Dict[str, Any] = {
            "enabled": True,
            "query": query,
            "chunks": [],
            "whitelist": [],
            "blacklist": [],
            "summary": "",
            "error": None,
        }
        known_names = _load_known_herb_names()
        for cr in chunks:
            chunk = getattr(cr, "chunk", None)
            if chunk is None:
                continue
            content = getattr(chunk, "content", "") or ""
            source = (getattr(chunk, "metadata", {}) or {}).get("source", "unknown")
            score = float(getattr(cr, "score", 0) or 0)
            signals["chunks"].append({
                "source": source,
                "score": round(score, 4),
                "content": content[:500],
            })
            matched = [n for n in known_names if n and n in content]
            if not matched:
                continue
            # 命中禁忌/毒性/用量限制关键词（同窗口共现）的药材进入黑名单
            for n in matched:
                if _is_negative_evidence(content, n):
                    signals["blacklist"].append(n)
                else:
                    signals["whitelist"].append(n)

        signals["whitelist"] = list(dict.fromkeys(signals["whitelist"]))
        signals["blacklist"] = list(dict.fromkeys(signals["blacklist"]))
        signals["summary"] = _build_rag_summary(signals["chunks"])
        logger.info(
            "[FormulaRagHook] RAG 钩子生效: 知识块=%d, 白名单=%s, 黑名单=%s",
            len(signals["chunks"]), signals["whitelist"], signals["blacklist"],
        )
        return signals
    except Exception as e:
        logger.warning("[FormulaRagHook] RAG 检索钩子失败（降级为无 RAG 增强）: %s", e)
        return None


def herb_names_to_ids(names: List[str], optimizer: Any) -> List[str]:
    """将中文药名映射为优化器 herb_id（基于优化器实际加载的药材字典）。"""
    if not names:
        return []
    herbs: Dict[str, Any] = getattr(optimizer, "_herbs", None) or {}
    name_to_id: Dict[str, str] = {}
    for hid, h in herbs.items():
        cn = getattr(h, "name_cn", "") or ""
        if cn:
            name_to_id.setdefault(cn, hid)
    ids: List[str] = []
    for n in names:
        hid = name_to_id.get(n)
        if hid and hid not in ids:
            ids.append(hid)
    return ids


def normalize_exclude_herbs(exclude_set: Set[str], optimizer: Any) -> Set[str]:
    """将排除集合中的中文药名映射为 herb_id，保留已为 ID 的项。

    GA 优化器的 exclude_herbs 比较的是 herb_id（如 'hq'），用户/RAG 传入的
    中文名（如 '黄芪'）需要映射为 ID 才能真正生效。
    """
    if not exclude_set:
        return set()
    herbs: Dict[str, Any] = getattr(optimizer, "_herbs", None) or {}
    name_to_id: Dict[str, str] = {}
    for hid, h in herbs.items():
        cn = getattr(h, "name_cn", "") or ""
        if cn:
            name_to_id.setdefault(cn, hid)
    normalized: Set[str] = set()
    for item in exclude_set:
        if item in name_to_id:
            normalized.add(name_to_id[item])
        else:
            normalized.add(item)
    return normalized


def build_formula_designer_knowledge_base() -> Dict[str, Any]:
    """构建 FormulaDesigner 使用的 knowledge_base（真实 DB 药材数据）。

    替代早期硬编码空字典 {}，使 _manual_formula_design 兜底路径能产出真实配方。
    返回 {name_cn: {"effects": [...], "dosage": str, "is_food_homology": bool, ...}}
    """
    kb: Dict[str, Any] = {}
    try:
        from ..algorithms.herb_knowledge_service import get_global_herb_knowledge
        try:
            from app.services.ai_models.safety_checker import _FOOD_HOMOLOGY_CATALOG_FALLBACK
        except Exception:
            _FOOD_HOMOLOGY_CATALOG_FALLBACK = set()

        hk = get_global_herb_knowledge()
        if hk is not None:
            for hp in hk.get_herbs().values():
                name = getattr(hp, "name_cn", "") or ""
                if not name or name in kb:
                    continue
                effects = list((getattr(hp, "efficacy_scores", None) or {}).keys())
                kb[name] = {
                    "effects": effects or ["综合调理"],
                    "dosage": f"{getattr(hp, 'dosage_min', 3) or 3}-{getattr(hp, 'dosage_max', 15) or 15}g",
                    "is_food_homology": name in _FOOD_HOMOLOGY_CATALOG_FALLBACK,
                    "safety_index": getattr(hp, "safety_index", 0.9) or 0.9,
                }
        if kb:
            logger.info(f"[FormulaRagHook] FormulaDesigner 知识库已构建: {len(kb)} 味 DB 药材")
    except Exception as e:
        logger.warning(f"[FormulaRagHook] 构建 FormulaDesigner 知识库失败: {e}")
    return kb