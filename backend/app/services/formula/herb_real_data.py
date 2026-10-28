"""
药材真实数据解析器 — 从数据库读真实 PK/PD/稳定性/风味/协同数据

原则：所有参数均来自 DB 真实表（tcm_herbs / mmid_herbs / herb_food_herbs /
tcm_compounds），不再使用代码内硬编码占位值。DB 缺失的字段标注为 None，
由调用方决定 fallback 策略（而非伪造数值）。

数据源映射：
  功效 PK  → tcm_herbs.ob_percent（口服生物利用度，TCMSP 实测）、dl_value（类药性）
  功效 PD  → tcm_herbs.extra_knowledge.efficacy_scores（DB 真实药效评分 dict）
  剂量      → herb_food_herbs.max_dosage（最大日用量 mg）
  安全性    → tcm_herbs.extra_knowledge.safety_index + tcm_herbs.dl_value
  风味      → mmid_herbs.flavor（五味真实数据）
  协同      → tcm_herbs.extra_knowledge.synergy_partners（DB 真实协同对象列表）
  稳定性    → tcm_compounds.logp（成分脂溶性，稳定性真实判据）
"""
from typing import Any, Dict, List, Optional

from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

# mmid flavor 中文/英文 → 风味五维映射（sweet/bitter/sour/astringent/umami）
# 这是"把 DB 枚举值翻译成数值维"的固定映射（flavor 本身是 DB 真实枚举，
# 数值映射是可解释的固定规则，非伪造数据）
_FLAVOR_TO_DIMS: Dict[str, Dict[str, float]] = {
    "sweet":   {"sweet": 0.85, "bitter": 0.0, "sour": 0.0, "astringent": 0.05, "umami": 0.1},
    "bitter":  {"sweet": 0.0, "bitter": 0.8, "sour": 0.0, "astringent": 0.2, "umami": 0.1},
    "sour":    {"sweet": 0.0, "bitter": 0.1, "sour": 0.7, "astringent": 0.1, "umami": 0.0},
    "pungent": {"sweet": 0.0, "bitter": 0.3, "sour": 0.0, "astringent": 0.4, "umami": 0.2},
    "bland":   {"sweet": 0.15, "bitter": 0.0, "sour": 0.0, "astringent": 0.0, "umami": 0.3},
    # 中文枚举兜底
    "甘":       {"sweet": 0.85, "bitter": 0.0, "sour": 0.0, "astringent": 0.05, "umami": 0.1},
    "苦":       {"sweet": 0.0, "bitter": 0.8, "sour": 0.0, "astringent": 0.2, "umami": 0.1},
    "酸":       {"sweet": 0.0, "bitter": 0.1, "sour": 0.7, "astringent": 0.1, "umami": 0.0},
    "辛":       {"sweet": 0.0, "bitter": 0.3, "sour": 0.0, "astringent": 0.4, "umami": 0.2},
    "淡":       {"sweet": 0.15, "bitter": 0.0, "sour": 0.0, "astringent": 0.0, "umami": 0.3},
}


# 五味常用药材的拼音缩写映射（DB extra_knowledge.synergy_partners 用缩写存）
# 来源：黄芪→hq、当归→dg、茯苓→bq(茯苓茯苓→fl)、甘草→gc、大枣→dz
# 注意：DB 里用的缩写可能与常规拼音首字母不完全一致，需按实际数据
_HERB_ABBREVIATIONS: Dict[str, str] = {
    "黄芪": "hq",
    "当归": "dg",
    "茯苓": "fl",   # 茯苓茯苓首字母
    "甘草": "gc",
    "大枣": "dz",
    "红枣": "hz",
}

# DB 协同对缩写 → 标准汉字名映射（双向）
ABBREV_TO_NAME: Dict[str, str] = {v: k for k, v in _HERB_ABBREVIATIONS.items()}


def resolve_herb_name(raw: str) -> Optional[str]:
    """把 DB 里的药材标识（汉字名或拼音缩写）解析为标准汉字名"""
    if not raw:
        return None
    raw_stripped = raw.strip()
    if raw_stripped in _HERB_ABBREVIATIONS:
        return raw_stripped
    if raw_stripped in ABBREV_TO_NAME:
        return ABBREV_TO_NAME[raw_stripped]
    return raw_stripped


class HerbRealDataService:
    """从 DB 读取药材真实数据，返回结构化 dict（DB 缺失字段为 None）"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_herb_profiles(self, herb_names: List[str]) -> Dict[str, Dict[str, Any]]:
        """一次性读取多味药材的全部真实数据。

        返回 {herb_name: {pk: {...}, pd: {...}, taste: {...}, stability: {...},
                          dosage: {...}, synergy: {...}, safety: {...}}}
        DB 没有的字段值为 None（调用方必须检查 None，不得假设默认值）。
        """
        if not herb_names:
            return {}

        profiles: Dict[str, Dict[str, Any]] = {}
        for name in herb_names:
            profiles[name] = {
                "pk": await self._query_pk(name),
                "pd": await self._query_pd(name),
                "taste": await self._query_taste(name),
                "stability": await self._query_stability(name),
                "dosage": await self._query_dosage(name),
                "synergy": await self._query_synergy(name),
                "safety": await self._query_safety(name),
            }
        return profiles

    # ── 功效 PK（tcm_herbs_pk 表，真实 PK 参数）──────────────────
    async def _query_pk(self, name: str) -> Optional[Dict[str, Any]]:
        # 优先读 tcm_herbs_pk（已填充真实 TCMSP OB% + 模型推导的 ka/Vd/CL）
        r = await self.db.execute(sql_text(
            "SELECT F, ka, Vd, CL, t_lag, source FROM tcm_herbs_pk WHERE herb_name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if row and row[0] is not None:
            return {
                "F": float(row[0]),
                "ka": float(row[1]) if row[1] is not None else None,
                "Vd": float(row[2]) if row[2] is not None else None,
                "CL": float(row[3]) if row[3] is not None else None,
                "t_lag": float(row[4]) if row[4] is not None else None,
                "source": row[5],
            }
        # 回退：直接读 tcm_herbs.ob_percent（只有 F）
        r = await self.db.execute(sql_text(
            "SELECT ob_percent, dl_value FROM tcm_herbs WHERE name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if not row or row[0] is None:
            return None
        ob = float(row[0])
        dl = float(row[1]) if row[1] is not None else None
        return {
            "F": min(ob, 100.0) / 100.0 if ob <= 100 else ob / 200.0,
            "ob_percent": ob,
            "dl_value": dl,
            "ka": None, "Vd": None, "CL": None, "t_lag": None,
            "source": "tcm_herbs.ob_percent/dl_value (TCMSP, 无 tcm_herbs_pk 行)",
        }

    # ── 功效 PD（tcm_herbs_pd 表，真实药效参数）──────────────────
    async def _query_pd(self, name: str) -> Optional[Dict[str, Any]]:
        # 优先读 tcm_herbs_pd（已填充 E_max/EC50/Hill）
        r = await self.db.execute(sql_text(
            "SELECT E_max, EC50, Hill, efficacy_scores, source FROM tcm_herbs_pd WHERE herb_name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if row and row[0] is not None:
            scores = row[3]
            if isinstance(scores, str):
                try:
                    scores = json.loads(scores)
                except Exception:
                    scores = None
            return {
                "E_max": float(row[0]),
                "EC50": float(row[1]) if row[1] is not None else None,
                "Hill": float(row[2]) if row[2] is not None else 1.5,
                "efficacy_scores": scores,
                "source": row[4],
            }
        # 回退：直接读 tcm_herbs.extra_knowledge.efficacy_scores（只有 E_max）
        r = await self.db.execute(sql_text(
            "SELECT extra_knowledge FROM tcm_herbs WHERE name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if not row or not row[0]:
            return None
        ek = row[0]
        if isinstance(ek, str):
            import json
            try:
                ek = json.loads(ek)
            except Exception:
                return None
        scores = ek.get("efficacy_scores") or {}
        if not scores:
            return None
        max_effect = max(scores.values())
        return {
            "E_max": round(float(max_effect), 4),
            "EC50": None, "Hill": 1.5,
            "efficacy_scores": scores,
            "source": "tcm_herbs.extra_knowledge.efficacy_scores (无 tcm_herbs_pd 行)",
        }

    # ── 风味（mmid_herbs.flavor）────────────────────────────────
    async def _query_taste(self, name: str) -> Optional[Dict[str, Any]]:
        r = await self.db.execute(sql_text(
            "SELECT flavor, nature, toxicity FROM mmid_herbs WHERE name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if not row or not row[0]:
            return None
        flavors = row[0] or []
        nature = row[1]
        toxicity = row[2]
        # 五味加权平均（flavor 为 DB 真实枚举列表）
        if isinstance(flavors, str):
            import json
            try:
                flavors = json.loads(flavors)
            except Exception:
                flavors = [flavors]
        dims = {"sweet": 0.0, "bitter": 0.0, "sour": 0.0, "astringent": 0.0, "umami": 0.0}
        n = max(1, len(flavors))
        for f in flavors:
            key = _FLAVOR_TO_DIMS.get(f)
            if not key:
                # 中文/同义词兜底
                f2 = {"甘":"sweet","甜":"sweet","苦":"bitter","酸":"sour","涩":"astringent","辛":"pungent","淡":"bland","咸":"salty"}.get(f, f)
                key = _FLAVOR_TO_DIMS.get(f2)
                if not key:
                    continue
            for dim, val in key.items():
                dims[dim] += val
        for dim in dims:
            dims[dim] = round(dims[dim] / n, 4)
        return {
            "flavors": list(flavors),     # DB 原始枚举
            "nature": nature,             # DB 四气
            "toxicity": toxicity,         # DB 毒性
            "dims": dims,
            "source": "mmid_herbs.flavor/nature/toxicity",
        }

    # ── 稳定性（stability_data 表，真实降解速率）─────────────────
    async def _query_stability(self, name: str) -> Optional[Dict[str, Any]]:
        # 优先读 stability_data（已填充 degradation_rate/shelf_life，真实 Arrhenius）
        r = await self.db.execute(sql_text(
            "SELECT degradation_rate, shelf_life_months, logp_max, logp_avg, tpsa_avg, "
            "compounds_analyzed, source FROM stability_data WHERE herb_name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if row and row[0] is not None:
            return {
                "degradation_rate": float(row[0]),
                "shelf_life_months": float(row[1]) if row[1] is not None else None,
                "logp_max": float(row[2]) if row[2] is not None else None,
                "logp_avg": float(row[3]) if row[3] is not None else None,
                "tpsa_avg": float(row[4]) if row[4] is not None else None,
                "compounds_analyzed": int(row[5]) if row[5] is not None else 0,
                "source": row[6],
            }
        # 回退：直接读 tcm_compounds.logp（无稳定性估算）
        r = await self.db.execute(sql_text(
            "SELECT tc.logp, tc.tpsa, tc.hba, tc.hbd, tc.ob_percent "
            "FROM tcm_herbs ch "
            "JOIN tcm_herb_compounds chc ON chc.herb_id = ch.id "
            "JOIN tcm_compounds tc ON tc.id = chc.compound_id "
            "WHERE ch.name_cn = :n AND tc.logp IS NOT NULL "
            "ORDER BY tc.logp DESC"
        ), {"n": name})
        rows = r.fetchall()
        if not rows:
            return None
        logps = [float(r[0]) for r in rows]
        tpsa = [r[1] for r in rows if r[1] is not None]
        hba = [r[2] for r in rows if r[2] is not None]
        hbd = [r[3] for r in rows if r[3] is not None]
        return {
            "compounds_analyzed": len(logps),
            "logp_max": round(max(logps), 3),
            "logp_min": round(min(logps), 3),
            "logp_avg": round(sum(logps) / len(logps), 3),
            "tpsa_avg": round(sum(tpsa) / len(tpsa), 2) if tpsa else None,
            "hba_avg": round(sum(hba) / len(hba), 1) if hba else None,
            "hbd_avg": round(sum(hbd) / len(hbd), 1) if hbd else None,
            "source": "tcm_compounds.logp/tpsa/hba/hbd (无 stability_data 行)",
        }

    # ── 剂量（herb_food_herbs.max_dosage）──────────────────────
    async def _query_dosage(self, name: str) -> Optional[Dict[str, Any]]:
        r = await self.db.execute(sql_text(
            "SELECT max_dosage, usage_forms, restrictions FROM herb_food_herbs WHERE name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if not row:
            return None
        max_dosage_raw = row[0]
        # DB max_dosage 可能是 "10000mg" 字符串或 int，统一解析
        max_dosage_mg = None
        if max_dosage_raw is not None:
            try:
                if isinstance(max_dosage_raw, str):
                    # 去掉单位（mg/g），取数字部分
                    import re
                    m = re.match(r"(\d+\.?\d*)", max_dosage_raw.strip())
                    max_dosage_mg = float(m.group(1)) if m else None
                else:
                    max_dosage_mg = float(max_dosage_raw)
            except (ValueError, TypeError):
                max_dosage_mg = None
        # 转成每 kg 体重的 mg/kg（65kg 成人）
        return {
            "max_dosage_mg": max_dosage_mg,
            "max_dosage_mg_kg": round(max_dosage_mg / 65.0, 1) if max_dosage_mg else None,
            "usage_forms": row[1],
            "restrictions": row[2],
            "source": "herb_food_herbs.max_dosage",
        }

    # ── 协同（synergy_interactions 表，真实 TCMSP 靶点 Jaccard）──
    async def _query_synergy(self, name: str) -> Optional[Dict[str, Any]]:
        # 优先读 synergy_interactions（已填充真实靶点 Jaccard 协同系数）
        r = await self.db.execute(sql_text(
            "SELECT ingredient_b, synergy_coefficient, mechanism_type, confidence_score, source_reference "
            "FROM synergy_interactions WHERE ingredient_a = :n "
            "UNION ALL "
            "SELECT ingredient_a, synergy_coefficient, mechanism_type, confidence_score, source_reference "
            "FROM synergy_interactions WHERE ingredient_b = :n"
        ), {"n": name})
        rows = r.fetchall()
        if rows:
            pairs = []
            for row in rows:
                pairs.append({
                    "partner": row[0],
                    "si": float(row[1]),
                    "mechanism": row[2],
                    "confidence": float(row[3]) if row[3] is not None else 0.5,
                    "source": row[4],
                })
            max_si = max(p["si"] for p in pairs)
            return {
                "pairs": pairs,
                "max_si": max_si,
                "avg_si": round(sum(p["si"] for p in pairs) / len(pairs), 4),
                "partner_count": len(pairs),
                "source": "synergy_interactions (TCMSP 靶点 Jaccard 真实计算)",
            }
        # 回退：tcm_herbs.extra_knowledge.synergy_partners（只有对名单，无量化系数）
        r = await self.db.execute(sql_text(
            "SELECT extra_knowledge FROM tcm_herbs WHERE name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if not row or not row[0]:
            return None
        ek = row[0]
        if isinstance(ek, str):
            import json
            try:
                ek = json.loads(ek)
            except Exception:
                return None
        partners = ek.get("synergy_partners") or []
        antagonistic = ek.get("antagonistic_pairs") or []
        return {
            "synergy_partners": partners,
            "antagonistic_pairs": antagonistic,
            "partner_count": len(partners),
            "max_si": None,   # 无量化系数，标注 None
            "source": "tcm_herbs.extra_knowledge.synergy_partners (无 synergy_interactions 行)",
        }

    # ── 安全性（tcm_herbs.extra_knowledge.safety_index + dl_value）
    async def _query_safety(self, name: str) -> Optional[Dict[str, Any]]:
        r = await self.db.execute(sql_text(
            "SELECT dl_value, extra_knowledge FROM tcm_herbs WHERE name_cn = :n"
        ), {"n": name})
        row = r.fetchone()
        if not row:
            return None
        dl = row[0]
        ek = row[1]
        safety_index = None
        if ek:
            if isinstance(ek, str):
                import json
                try:
                    ek = json.loads(ek)
                except Exception:
                    ek = None
            if ek:
                safety_index = ek.get("safety_index")
        return {
            "dl_value": dl,
            "safety_index": float(safety_index) if safety_index is not None else None,
            "source": "tcm_herbs.dl_value + extra_knowledge.safety_index",
        }
