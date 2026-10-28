"""
TCM 数据驱动的协同作用分析服务

2026-10-13 由 Mock 替换为真实实现（方案 B）：
- 共享化合物 Jaccard 相似度（tcm_herb_compounds 关联表，33460 条真实关联）
- 靶点重叠（tcm_herbs.targets JSON 中的靶点名称集合）
- 功效文本重叠（effects + extra_knowledge.effects_detailed）
- 内置协同伙伴（extra_knowledge.synergy_partners，herb_id 短码匹配）
- 拮抗预警（十八反/十九畏内置规则表 + extra_knowledge.antagonistic_pairs）

数据来源：tcm_herbs（612 种药材）、tcm_herb_compounds（33460 条关联）。
未收录药材会诚实标记（不伪造分数）。
"""
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 十八反/十九畏 常见禁忌（依据《中国药典》2020，作为规则补充）
ANTAGONISM_PAIRS = {
    ("人参", "藜芦"), ("甘草", "甘遂"), ("丁香", "郁金"),
    ("甘草", "海藻"), ("甘草", "大戟"), ("甘草", "芫花"),
    ("川乌", "半夏"), ("川乌", "贝母"), ("川乌", "瓜蒌"),
    ("草乌", "半夏"), ("草乌", "白及"), ("藜芦", "丹参"),
    ("藜芦", "细辛"), ("藜芦", "芍药"), ("硫黄", "朴硝"),
    ("水银", "砒霜"), ("狼毒", "密陀僧"), ("牙硝", "三棱"),
    ("官桂", "石脂"), ("牵牛", "大黄"), ("巴豆", "牵牛"),
}

# 功效关键词分组（用于 effects_detailed / efficacy_scores 重叠）
EFFICACY_GROUPS = {
    "补气": ["补气", "益气", "健脾益气", "固表"],
    "补血": ["补血", "养血", "活血"],
    "滋阴": ["滋阴", "养阴", "生津"],
    "温阳": ["温阳", "助阳", "补肾阳", "散寒"],
    "清热": ["清热", "解毒", "泻火", "凉血"],
    "祛湿": ["祛湿", "利湿", "化湿", "健脾"],
    "安神": ["安神", "养心", "镇静", "助眠"],
    "理气": ["理气", "行气", "疏肝", "解郁"],
    "活血化瘀": ["活血", "化瘀", "祛瘀", "通络", "止痛"],
    "化痰": ["化痰", "祛痰", "止咳", "平喘"],
    "消食": ["消食", "健胃", "开胃", "导滞"],
    "解表": ["解表", "发散", "疏风"],
    "明目": ["明目", "清肝", "退翳"],
    "固涩": ["固涩", "敛汗", "止带", "缩尿"],
}


class TCMSynergyService:
    """基于 TCM 数据库的真实协同作用分析服务"""

    async def analyze(
        self,
        herbs: list[dict[str, Any]],
        peptides: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        分析成分间的协同/拮抗关系（真实数据驱动）。

        Returns:
            {
                "score": float,             # 综合协同评分 (0-1)
                "synergy_pairs": [...],     # 协同配对（含真实相似度）
                "antagonism_warnings": [...],
                "shared_pathways": [...],   # 共享靶点名称（真实）
                "heat_map": {...},          # 两两药材协同分矩阵
                "summary": str,
            }
        """
        herb_names = [h.get("name", "").strip() for h in herbs if (h.get("name") or "").strip()]
        herb_info = await self._load_herbs(herb_names)
        ordered_names = list(dict.fromkeys(herb_names))  # 去重保序

        synergy_pairs: list[dict] = []
        antagonism_warnings: list[dict] = []
        pair_scores: dict[tuple, float] = {}

        for i, h1 in enumerate(ordered_names):
            for h2 in ordered_names[i + 1:]:
                info1 = herb_info.get(h1)
                info2 = herb_info.get(h2)
                # 拮抗检测（内置规则 + 数据库 antagonistic_pairs）
                ant = self._check_antagonism(h1, h2, info1, info2)
                if ant:
                    antagonism_warnings.append(ant)

                score = self._compute_pair_score(info1, info2)
                pair_scores[(h1, h2)] = score
                pair_scores[(h2, h1)] = score
                # 仅当两味药材都被收录且有真实协同证据（分层评分 >= 0.55）时输出协同对
                if (
                    info1 is not None and info2 is not None
                    and score >= 0.55
                ):
                    synergy_pairs.append({"a": h1, "b": h2, "score": round(score, 2)})

        # 共享靶点（真实 shared_pathways）
        shared_pathways: list[str] = []
        seen_targets: set[str] = set()
        for h1 in ordered_names:
            for h2 in ordered_names:
                if h1 >= h2:
                    continue
                t1 = herb_info.get(h1, {}).get("targets", set())
                t2 = herb_info.get(h2, {}).get("targets", set())
                for t in t1 & t2:
                    if t not in seen_targets:
                        seen_targets.add(t)
                        shared_pathways.append(t)
                if len(shared_pathways) >= 5:
                    break
            if len(shared_pathways) >= 5:
                break

        # 热力图（真实分数）
        heat_map: dict[str, dict[str, float]] = {}
        for h1 in ordered_names:
            heat_map[h1] = {}
            for h2 in ordered_names:
                if h1 == h2:
                    heat_map[h1][h2] = 1.0
                else:
                    heat_map[h1][h2] = pair_scores.get((h1, h2), 0.3)

        # 综合评分（所有配对的平均分，无配对则中性 0.5）
        if pair_scores:
            score = round(sum(pair_scores.values()) / len(pair_scores), 2)
        else:
            score = 0.5

        # 未收录药材
        missing = [n for n in ordered_names if n not in herb_info]
        if missing:
            summary = (
                f"以下药材未在 TCM 数据库中收录，已按中性分处理：{'、'.join(missing)}。"
                if synergy_pairs or antagonism_warnings
                else f"未找到已知协同或拮抗关系。未收录药材：{'、'.join(missing)}。"
            )
        elif synergy_pairs or antagonism_warnings:
            summary = (
                f"基于 TCM 数据库计算：发现 {len(synergy_pairs)} 对协同关系"
                + (f"，{len(antagonism_warnings)} 对拮抗预警" if antagonism_warnings else "")
                + f"，共享靶点 {len(shared_pathways)} 个。"
            )
        else:
            summary = "未发现已知协同或拮抗关系（两味药材无共享化合物/靶点）"

        return {
            "score": score,
            "synergy_pairs": synergy_pairs,
            "antagonism_warnings": antagonism_warnings,
            "shared_pathways": shared_pathways,
            "heat_map": heat_map,
            "summary": summary,
        }

    async def _load_herbs(self, names: list[str]) -> dict[str, dict[str, Any]]:
        """从 tcm_herbs + tcm_herb_compounds 加载真实药材数据"""
        from sqlalchemy import select

        from ...core.database.session import async_session_factory
        from ...models.external_data import TCMHerb
        from ...models.tcm_schema import tcm_herb_compounds

        info: dict[str, dict[str, Any]] = {}
        if not names:
            return info
        try:
            async with async_session_factory() as db:
                rows = (await db.execute(select(TCMHerb).where(TCMHerb.name_cn.in_(names)))).scalars().all()
                for herb in rows:
                    targets: set[str] = set()
                    for t in (herb.targets or []):
                        if isinstance(t, dict) and t.get("name"):
                            targets.add(str(t["name"]).strip())
                        elif isinstance(t, str) and t.strip():
                            targets.add(t.strip())
                    ek: dict = {}
                    if herb.extra_knowledge:
                        try:
                            ek = json.loads(herb.extra_knowledge) if isinstance(herb.extra_knowledge, str) else (herb.extra_knowledge or {})
                        except Exception:
                            ek = {}
                    info[herb.name_cn] = {
                        "id": herb.id,
                        "name": herb.name_cn,
                        "targets": targets,
                        "effects": herb.effects or "",
                        "ek": ek if isinstance(ek, dict) else {},
                        "compounds": set(),
                    }
                ids = [h["id"] for h in info.values()]
                if ids:
                    comp_rows = (await db.execute(
                        select(tcm_herb_compounds.c.herb_id, tcm_herb_compounds.c.compound_id)
                        .where(tcm_herb_compounds.c.herb_id.in_(ids))
                    )).all()
                    id_to_info = {h["id"]: h for h in info.values()}
                    for herb_id, compound_id in comp_rows:
                        h = id_to_info.get(herb_id)
                        if h is not None:
                            h["compounds"].add(int(compound_id))
        except Exception as e:
            logger.error(f"[TCMSynergy] 加载药材数据失败: {e}", exc_info=True)
        return info

    def _compute_pair_score(
        self,
        info1: Optional[dict[str, Any]],
        info2: Optional[dict[str, Any]],
    ) -> float:
        """计算一对药材的真实协同分数（0-1，基于真实数据证据分层）"""
        if info1 is None or info2 is None:
            return 0.5  # 未收录药材 → 中性分（诚实）

        # 共享化合物
        c1: set = info1.get("compounds", set())
        c2: set = info2.get("compounds", set())
        compound_inter = len(c1 & c2) if c1 and c2 else 0
        union = len(c1 | c2) if c1 or c2 else 0
        compound_sim = compound_inter / union if union else 0.0

        # 共享靶点
        t1: set = info1.get("targets", set())
        t2: set = info2.get("targets", set())
        target_inter = len(t1 & t2) if t1 and t2 else 0
        target_union = len(t1 | t2) if t1 or t2 else 0
        target_sim = target_inter / target_union if target_union else 0.0

        # 功效重叠
        eff_text1 = self._effect_text(info1)
        eff_text2 = self._effect_text(info2)
        eff_overlap = 0.0
        if eff_text1 and eff_text2:
            matched = sum(
                1
                for kws in EFFICACY_GROUPS.values()
                if any(kw in eff_text1 for kw in kws) and any(kw in eff_text2 for kw in kws)
            )
            eff_overlap = matched / len(EFFICACY_GROUPS) if EFFICACY_GROUPS else 0.0

        # 内置协同伙伴（extra_knowledge.synergy_partners）
        builtin = False
        ek1 = info1.get("ek", {})
        ek2 = info2.get("ek", {})
        partners1 = set(ek1.get("synergy_partners", []) or [])
        partners2 = set(ek2.get("synergy_partners", []) or [])
        herb_id1 = ek1.get("herb_id")
        herb_id2 = ek2.get("herb_id")
        if (herb_id1 and herb_id1 in partners2) or (herb_id2 and herb_id2 in partners1):
            builtin = True

        # 分层评分（真实证据 → 分数）
        if builtin:
            base = 0.75  # 数据库明确标记的协同药对
        elif compound_inter > 0 and target_inter > 0:
            base = 0.62  # 共享化合物 + 共享靶点（网络药理学协同证据）
        elif target_inter > 0:
            base = 0.50  # 仅共享靶点
        elif compound_inter > 0:
            base = 0.45  # 仅共享化合物
        else:
            base = 0.25  # 无共享证据

        # 微调（最多 ±0.12）
        score = base + 0.12 * compound_sim + 0.10 * target_sim + 0.06 * eff_overlap
        return round(min(1.0, max(0.0, score)), 2)

    def _effect_text(self, info: dict[str, Any]) -> str:
        """拼接药材功效文本（effects + effects_detailed + efficacy_scores 键）"""
        parts = [info.get("effects") or ""]
        ek = info.get("ek", {})
        ed = ek.get("effects_detailed")
        if isinstance(ed, list):
            parts.extend(str(x) for x in ed)
        elif isinstance(ed, str):
            parts.append(ed)
        es = ek.get("efficacy_scores")
        if isinstance(es, dict):
            parts.append(" ".join(es.keys()))
        return " ".join(parts)

    def _check_antagonism(
        self,
        h1: str,
        h2: str,
        info1: Optional[dict[str, Any]],
        info2: Optional[dict[str, Any]],
    ) -> Optional[dict[str, Any]]:
        """检测拮抗：内置十八反十九畏 + 数据库 antagonistic_pairs"""
        # 内置规则（双向）
        pair = (h1, h2)
        pair_rev = (h2, h1)
        if pair in ANTAGONISM_PAIRS or pair_rev in ANTAGONISM_PAIRS:
            return {"a": h1, "b": h2, "level": "high", "reason": "十九畏/十八反配伍禁忌"}

        # 数据库 antagonistic_pairs（herb_id 短码）
        if info1 is not None and info2 is not None:
            ek1 = info1.get("ek", {})
            ek2 = info2.get("ek", {})
            ant1 = set(ek1.get("antagonistic_pairs", []) or [])
            ant2 = set(ek2.get("antagonistic_pairs", []) or [])
            herb_id1 = ek1.get("herb_id")
            herb_id2 = ek2.get("herb_id")
            if (herb_id1 and herb_id1 in ant2) or (herb_id2 and herb_id2 in ant1):
                return {"a": h1, "b": h2, "level": "high", "reason": "数据库标记的拮抗配伍"}

        return None
