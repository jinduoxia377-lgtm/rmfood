"""
配方知识图谱推理引擎 (数据库驱动版)

数据架构:
  AI Chat Layer  →  GraphQueryService (DB)  →  PostgreSQL (KGNode/KGEdge)
                                      ↘  Built-in Herb KB (fallback)

当数据库中有图谱数据时，优先使用DB数据；
当DB为空或不可用时，自动降级到内置20种药材知识库。

@version 2.0.0
"""
import logging
import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ═══════════════════════════════
# 内置降级知识库
# ═══════════════════════════════

_BUILTIN_HERB_DB = {
    "hq": {"id":"hq","name":"黄芪","type":"herb","dosage":"3-30g",
           "effects":{"免疫调节":0.92,"抗氧化":0.78,"抗疲劳":0.85,"降血糖":0.65,"心血管保护":0.72},
           "synergies":["ds","gz","hqg"],"antagonists":["fz"],"safety":0.95,"cost":0.08},
    "ds": {"id":"ds","name":"党参","type":"herb","dosage":"3-15g",
           "effects":{"免疫调节":0.85,"抗疲劳":0.80,"消化系统":0.75,"补气":0.90},
           "synergies":["hq","gz","bq"],"antagonists":[],"safety":0.95,"cost":0.12},
    "gz": {"id":"gz","name":"枸杞子","type":"herb","dosage":"3-15g",
           "effects":{"抗氧化":0.90,"免疫调节":0.82,"护肝":0.78,"明目":0.75,"抗衰老":0.85},
           "synergies":["hq","ds","jgh"],"antagonists":[],"safety":0.98,"cost":0.15},
    "rs": {"id":"rs","name":"人参","type":"herb","dosage":"1-9g",
           "effects":{"抗疲劳":0.95,"免疫调节":0.90,"认知功能":0.82,"心血管保护":0.78},
           "synergies":["hq","dg"],"antagonists":["lk","mld"],"safety":0.85,"cost":0.50},
    "dg": {"id":"dg","name":"当归","type":"herb","dosage":"3-12g",
           "effects":{"养血":0.92,"调经":0.88,"抗氧化":0.75,"免疫调节":0.70},
           "synergies":["hq","rs","cs"],"antagonists":[],"safety":0.92,"cost":0.18},
    "bq": {"id":"bq","name":"白术","type":"herb","dosage":"3-15g",
           "effects":{"消化系统":0.85,"免疫调节":0.72,"利尿":0.65,"补气":0.80},
           "synergies":["ds","hq","fp"],"antagonists":[],"safety":0.94,"cost":0.10},
    "fp": {"id":"fp","name":"茯苓","type":"herb","dosage":"6-20g",
           "effects":{"利尿":0.85,"免疫调节":0.70,"消化系统":0.68,"安神":0.60},
           "synergies":["bq","gq","yq"],"antagonists":[],"safety":0.97,"cost":0.06},
    "gq": {"id":"gq","name":"甘草","type":"herb","dosage":"1-6g",
           "effects":{"调和诸药":0.90,"抗炎":0.78,"止咳":0.72,"解毒":0.75},
           "synergies":["hq","fp","dg"],"antagonists":[],"safety":0.92,"cost":0.05},
    "jgh": {"id":"jgh","name":"菊花","type":"herb","dosage":"3-10g",
            "effects":{"明目":0.88,"清热解毒":0.82,"抗氧化":0.75,"降血压":0.70},
            "synergies":["gz","bq","cyh"],"antagonists":[],"safety":0.96,"cost":0.12},
    "dcx": {"id":"dcx","name":"大枣","type":"herb","dosage":"6-30g",
            "effects":{"补气":0.78,"养血":0.75,"消化系统":0.68,"免疫调节":0.72},
            "synergies":["hq","ds","gz"],"antagonists":[],"safety":0.98,"cost":0.05},
}

# 功效索引
_EFFECT_INDEX: Dict[str, List[str]] = defaultdict(list)
for hid, herb in _BUILTIN_HERB_DB.items():
    for eff in herb["effects"]:
        _EFFECT_INDEX[eff].append(hid)


# ═══════════════════════════════
# 数据库驱动的知识图谱服务
# ═══════════════════════════════

class DBKnowledgeGraphService:
    """
    数据库驱动知识图谱服务

    通过 GraphQueryService 查询 PostgreSQL 中的知识图谱数据。
    无数据时降级到内置知识库。

    使用方式:
        service = DBKnowledgeGraphService(db)
        result = await service.query_herb_info("黄芪")
    """

    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db
        self._db_service = None
        if db is not None:
            from ..kg.graph_query import GraphQueryService as GQS
            self._db_service = GQS(db)

    # ── 核心查询 ──

    async def query_herb_info(self, herb_name: str) -> Optional[Dict[str, Any]]:
        """查询药材完整信息（优先数据库，降级内置知识库）"""
        if self._db_service:
            try:
                nodes = await self._db_service.search_nodes(herb_name, node_type="herb", limit=1)
                if nodes:
                    node = nodes[0]
                    relations = await self._db_service.get_node_relations(
                        node.get("node_label", herb_name), depth=1
                    )
                    return {
                        "id": node.get("id", herb_name),
                        "name": node.get("node_label", herb_name),
                        "type": "herb",
                        "source": "database",
                        "effects": self._extract_effects_from_node(node, relations),
                        "relations": relations,
                    }
            except Exception as e:
                logger.warning(f"[KG] DB query failed, fallback to built-in: {e}")

        # 降级: 内置知识库
        for hid, herb in _BUILTIN_HERB_DB.items():
            if herb_name in herb["name"]:
                return {
                    "id": hid,
                    "name": herb["name"],
                    "type": "herb",
                    "source": "built-in",
                    "effects": [{"name": k, "score": v}
                               for k, v in sorted(herb["effects"].items(), key=lambda x: -x[1])],
                    "synergies": [{"name": _BUILTIN_HERB_DB[s].get("name", s) if s in _BUILTIN_HERB_DB else s, "weight": 0.8}
                                 for s in herb["synergies"]],
                    "antagonists": [{"name": _BUILTIN_HERB_DB[a].get("name", a) if a in _BUILTIN_HERB_DB else a}
                                   for a in herb["antagonists"]],
                    "dosage": herb["dosage"],
                    "safety": herb["safety"],
                }
        return None

    async def find_herbs_for_effect(self, effect_name: str, top_n: int = 10) -> List[Dict]:
        """查找具有某功效的药材"""
        if self._db_service:
            try:
                nodes = await self._db_service.search_nodes(effect_name, node_type="herb", limit=top_n)
                if nodes:
                    return [{"id": n.get("id", ""), "name": n.get("node_label", ""), "score": 0.5} for n in nodes]
            except Exception:
                pass

        # 降级: 内置知识库
        herb_ids = _EFFECT_INDEX.get(effect_name, [])
        return [{"id": hid, "name": _BUILTIN_HERB_DB[hid]["name"],
                 "score": _BUILTIN_HERB_DB[hid]["effects"].get(effect_name, 0.5)}
                for hid in herb_ids[:top_n]]

    async def find_herbs_in_question(self, question: str) -> List[Dict[str, Any]]:
        """从问题文本中提取药材"""
        herbs = []
        # 先查数据库
        if self._db_service:
            try:
                for name in _BUILTIN_HERB_DB.values():
                    if name["name"] in question:
                        info = await self.query_herb_info(name["name"])
                        if info:
                            herbs.append(info)
                            break
            except Exception:
                pass

        # 补充内置匹配
        if not herbs:
            for hid, herb in _BUILTIN_HERB_DB.items():
                if herb["name"] in question:
                    herbs.append({
                        "id": hid,
                        "name": herb["name"],
                        "source": "built-in",
                        "effects": [{"name": k, "score": v}
                                   for k, v in sorted(herb["effects"].items(), key=lambda x: -x[1])[:5]],
                    })
        return herbs

    async def compute_synergy_score(self, herb_ids: List[str]) -> float:
        """计算多药材组合的协同评分"""
        if len(herb_ids) < 2:
            return 0.5

        total = 0.0
        count = 0
        for i in range(len(herb_ids)):
            for j in range(i + 1, len(herb_ids)):
                h1 = _BUILTIN_HERB_DB.get(herb_ids[i])
                h2 = _BUILTIN_HERB_DB.get(herb_ids[j])
                if h1 and h2:
                    syn = 1.0 if h2["id"] in h1.get("synergies", []) else 0.3
                    ant = 0.0 if h2["id"] not in h1.get("antagonists", []) else 0.8
                    total += syn * (1 - ant)
                    count += 1

        return total / max(1, count)

    async def find_similar_herbs(self, herb_id: str, top_n: int = 5) -> List[Dict]:
        """基于功效相似度的替代药材推荐"""
        herb = _BUILTIN_HERB_DB.get(herb_id)
        if not herb:
            return []

        my_effects = set(herb["effects"].keys())
        scores = []
        for hid, candidate in _BUILTIN_HERB_DB.items():
            if hid == herb_id:
                continue
            their_effects = set(candidate["effects"].keys())
            intersection = my_effects & their_effects
            union = my_effects | their_effects
            if union:
                jaccard = len(intersection) / len(union)
                if jaccard > 0.2:
                    scores.append({"id": hid, "name": candidate["name"], "similarity": round(jaccard, 3)})

        return sorted(scores, key=lambda x: -x["similarity"])[:top_n]

    async def get_graph_stats(self) -> Dict[str, Any]:
        """获取图谱统计"""
        if self._db_service:
            try:
                return await self._db_service.get_graph_stats()
            except Exception:
                pass
        return {
            "total_nodes": len(_BUILTIN_HERB_DB),
            "total_edges": 0,
            "source": "built-in",
            "note": "使用内置知识库（共{}种药材）".format(len(_BUILTIN_HERB_DB)),
        }

    def _extract_effects_from_node(self, node: Dict, relations: Dict) -> List[Dict]:
        """从数据库节点和关系中提取功效信息"""
        effects = []
        for edge in relations.get("edges", []):
            if edge.get("type") in ("treats", "targets", "has_effect"):
                target_name = edge.get("target", edge.get("source", ""))
                effects.append({
                    "name": target_name,
                    "score": edge.get("strength", 0.5),
                })
        return effects[:8]


# ═══════════════════════════════
# 前端 ChatSidebarV4 兼容层
# ═══════════════════════════════

class FormulaKnowledgeGraph:
    """
    兼容层 — 保持与 SuperEnsembler 的接口一致

    内部使用 DBKnowledgeGraphService 或内置数据。
    """

    def __init__(self):
        self._herbs = {k: type("Herb", (), {"name_cn": v["name"], "dosage_min": 1,
                        "dosage_max": 15, "efficacy_scores": v["effects"],
                        "safety_index": v["safety"], "cost_per_gram": v["cost"]})()
                       for k, v in _BUILTIN_HERB_DB.items()}
        self._db_service: Optional[DBKnowledgeGraphService] = None

    def set_db(self, db: AsyncSession):
        self._db_service = DBKnowledgeGraphService(db)

    async def get_herb_info_async(self, herb_name: str) -> Optional[Dict[str, Any]]:
        if self._db_service:
            return await self._db_service.query_herb_info(herb_name)
        return None

    def get_herb_info(self, herb_id: str) -> Optional[Dict[str, Any]]:
        herb = _BUILTIN_HERB_DB.get(herb_id)
        if not herb:
            return None
        return {
            "id": herb_id, "name": herb["name"],
            "effects": [{"name": k, "score": v} for k, v in herb["effects"].items()],
            "synergies": [{"name": _BUILTIN_HERB_DB.get(s, {}).get("name", s), "score": 0.8}
                         for s in herb["synergies"]],
        }

    async def find_herbs_for_effect_async(self, effect_name: str, top_n: int = 10) -> List[Dict]:
        if self._db_service:
            return await self._db_service.find_herbs_for_effect(effect_name, top_n)
        return []

    def find_herbs_for_effect(self, effect_name: str, top_n: int = 10) -> List[Dict]:
        herb_ids = _EFFECT_INDEX.get(effect_name, [])
        return [{"id": hid, "name": _BUILTIN_HERB_DB[hid]["name"],
                 "score": _BUILTIN_HERB_DB[hid]["effects"].get(effect_name, 0.5)}
                for hid in herb_ids[:top_n]]

    def compute_synergy_score(self, herb_ids: List[str]) -> float:
        return 0.5  # simplified fallback


_kg: Optional[FormulaKnowledgeGraph] = None

def get_knowledge_graph() -> FormulaKnowledgeGraph:
    global _kg
    if _kg is None:
        _kg = FormulaKnowledgeGraph()
    return _kg
