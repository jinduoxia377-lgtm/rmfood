"""
合规数据提供者 — 为前端查询端点提供静态法规数据
数据源：formula_compliance.py、china_food_regulations.py、compliance_engine_v2.py
"""
import logging
from typing import Any, Dict, List, Optional

from app.services.compliance.formula_compliance import (
    FOOD_HERB_MAX_DOSAGE,
    PROHIBITED_COMBINATIONS,
)
from app.services.data_sources.china_food_regulations import (
    FOOD_ADDITIVES,
    FOOD_SAFETY_STANDARDS,
)
from app.services.search.compliance_engine_v2 import RegulationDatabase

logger = logging.getLogger(__name__)

_db = None


def get_db() -> RegulationDatabase:
    global _db
    if _db is None:
        _db = RegulationDatabase()
    return _db


def parse_max_dosage_mg(dosage_str: str) -> float:
    """将 '≤15克/天' 或 '无限制' 转换为 mg 数值。"""
    if not dosage_str or dosage_str in ('无限制', '', '—'):
        return 0.0
    s = str(dosage_str).replace('≤', '').replace('>=', '').replace('＞', '').strip()
    if '毫克' in s:
        try:
            return float(s.replace('毫克', '').strip())
        except Exception:
            return 0.0
    if '克' in s:
        try:
            val = float(s.replace('克', '').strip())
            return val * 1000.0
        except Exception:
            return 0.0
    try:
        return float(s)
    except Exception:
        return 0.0


def get_limits_data() -> Dict[str, Any]:
    """返回药食同源目录限量数据（前端 limits tab 所需）"""
    limits: Dict[str, float] = {}
    for name, mg in FOOD_HERB_MAX_DOSAGE.items():
        limits[name] = float(mg)
    return {
        "source": "国家卫健委药食同源目录限量表（2025版）",
        "limits": limits,
        "count": len(limits),
    }


def get_prohibited_data() -> Dict[str, Any]:
    """返回十八反十九畏禁忌搭配数据"""
    db = get_db()
    combinations: List[Dict[str, Any]] = []

    # 从 formula_compliance.py 的硬编码列表
    for pair in PROHIBITED_COMBINATIONS:
        if len(pair) >= 2:
            combinations.append({
                "pair": list(pair[:2]),
                "rule": "十八反",
            })

    # 从 RegulationDatabase 补充十八反/十九畏
    for herb, conflicts in db.eighteen_incompatibilities.items():
        for conflict in conflicts:
            # 避免重复
            if not any(c["pair"] == [herb, conflict] or c["pair"] == [conflict, herb]
                       for c in combinations):
                combinations.append({
                    "pair": [herb, conflict],
                    "rule": "十八反",
                })

    for herb, aversions in db.nineteen_aversions.items():
        for aversion in aversions:
            if not any(c["pair"] == [herb, aversion] or c["pair"] == [aversion, herb]
                       for c in combinations):
                combinations.append({
                    "pair": [herb, aversion],
                    "rule": "十九畏",
                })

    return {
        "source": "《神农本草经》配伍禁忌（十八反十九畏）",
        "combinations": combinations,
        "count": len(combinations),
    }


def get_gb2760_data() -> Dict[str, Any]:
    """返回 GB 2760 食品添加剂使用标准数据"""
    db = get_db()
    additives: List[Dict[str, Any]] = []

    # 从 FOOD_ADDITIVES 映射
    for add in FOOD_ADDITIVES:
        additives.append({
            "name": add.get("name", ""),
            "function": add.get("function", ""),
            "cas": add.get("code", ""),
            "e_number": add.get("code", ""),
            "max_usage": add.get("max_level", ""),
            "categories": add.get("allowed_foods", []),
            "notes": add.get("remarks", ""),
        })

    # 从 RegulationDatabase 补充
    for name, info in db.gb2760_allowed_additives.items():
        if not any(a["name"] == name for a in additives):
            additives.append({
                "name": name,
                "function": info.get("function", ""),
                "cas": "",
                "e_number": "",
                "max_usage": info.get("max_usage", ""),
                "categories": info.get("categories", []),
                "notes": "",
            })

    return {
        "source": "GB 2760-2024 食品安全国家标准 食品添加剂使用标准",
        "additives": additives,
        "count": len(additives),
    }


def get_gb14880_data() -> Dict[str, Any]:
    """返回 GB 14880 营养强化剂使用标准数据"""
    db = get_db()
    enrichers: List[Dict[str, Any]] = []

    for name, info in db.gb14880_enrichers.items():
        enrichers.append({
            "name": name,
            "function": info.get("function", "营养强化剂"),
            "cas": info.get("cas", ""),
            "min": info.get("min", ""),
            "max": info.get("max", ""),
            "categories": info.get("categories", []),
            "notes": info.get("notes", ""),
        })

    return {
        "source": "GB 14880-2012 食品安全国家标准 食品营养强化剂使用标准",
        "enrichers": enrichers,
        "count": len(enrichers),
    }


def get_gb_prohibited_data() -> Dict[str, Any]:
    """返回中国食品安全法规禁用品清单"""
    db = get_db()
    items: List[Dict[str, Any]] = []

    for name in db.prohibited_tcm:
        items.append({
            "name": name,
            "category": "禁止用于食品的中药材",
            "source_law": "《食品安全法》第三十八条",
            "reason": "毒性较强，不允许作为食品原料或添加剂使用",
            "hazard": "可能引起急性或慢性中毒，严重损害肝肾功能及神经系统",
        })

    return {
        "source": "《食品安全法》第三十八条及国家卫健委公告",
        "items": items,
        "count": len(items),
    }


def get_standards_data(category: Optional[str] = None) -> Dict[str, Any]:
    """返回食品安全国家标准目录"""
    standards = FOOD_SAFETY_STANDARDS

    if category and category != "全部":
        standards = [
            s for s in standards
            if category.lower() in s.get("category", "").lower()
        ]

    # 补充 priority 字段（用于前端展示）
    enriched = []
    for s in standards:
        code = s.get("standard_code", "")
        if "2760" in code or "2762" in code or "2763" in code:
            priority = "P0-核心必备"
        elif "14880" in code or "7718" in code or "28050" in code:
            priority = "P1-重要"
        else:
            priority = "P2-参考"
        enriched.append({**s, "priority": priority})

    return {
        "source": "国家卫生健康委员会食品安全国家标准",
        "count": len(enriched),
        "standards": enriched,
    }
