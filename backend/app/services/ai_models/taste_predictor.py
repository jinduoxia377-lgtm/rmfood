"""
TCM 数据驱动的口感预测服务

2026-10-13 由 Mock 替换为真实实现：
- 主要数据源：mmid_herbs（88 种药材的 flavor 五味 / nature 四气）
- 补充数据源：tcm_herbs.effects 功效文本关键词推断（未收录于 mmid_herbs 的药材）
- 未收录且无法推断的药材不贡献口感信号（诚实中性），不伪造风味
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

# 五味英文 → 口感维度（MMIDHerb flavor 取值）
FLAVOR_MAP = {
    "sweet": "sweetness",
    "bitter": "bitterness",
    "pungent": "pungency",
    "sour": "sourness",
    "salty": "saltiness",
}

# tcm_herbs.effects 关键词 → 口感维度（中文功效文本推断）
EFFECT_FLAVOR_KEYWORDS: dict[str, list[str]] = {
    "sweetness": ["甘", "甜"],
    "bitterness": ["苦"],
    "pungency": ["辛"],
    "sourness": ["酸"],
    "saltiness": ["咸"],
    "astringency": ["涩"],
}


class TCMTastePredictorService:
    """口感预测服务（真实数据驱动）"""

    async def predict(
        self,
        ingredients: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        预测配方的口感特征（基于真实五味/四气数据）。

        Returns:
            {
                "sweetness": 0-1, "bitterness": 0-1, "astringency": 0-1,
                "pungency": 0-1, "sourness": 0-1, "saltiness": 0-1,
                "overall_score": 0-1, "flavor_notes": [...],
            }
        """
        names = [i.get("name", "").strip() for i in ingredients if (i.get("name") or "").strip()]
        if not names:
            return self._empty_result()

        herb_data = await self._load_taste_data(names)

        dims = ["sweetness", "bitterness", "pungency", "sourness", "saltiness", "astringency"]
        scores = {d: 0.0 for d in dims}
        covered = 0  # 有真实口感数据的药材数

        for name in names:
            data = herb_data.get(name)
            dims_hit: set[str] = set()
            if data and data.get("flavor"):
                # MMIDHerb 五味（英文）
                for f in data["flavor"]:
                    dim = FLAVOR_MAP.get(str(f).lower())
                    if dim:
                        scores[dim] += 1.0
                        dims_hit.add(dim)
                covered += 1
            elif data and data.get("effects"):
                # tcm_herbs 功效文本关键词推断
                eff_text = data["effects"]
                for dim, kws in EFFECT_FLAVOR_KEYWORDS.items():
                    if any(kw in eff_text for kw in kws):
                        scores[dim] += 1.0
                        dims_hit.add(dim)
                if dims_hit:
                    covered += 1
            # 未收录药材不贡献（诚实中性）

        n = max(len(names), 1)
        normalized = {d: round(min(1.0, scores[d] / n), 2) for d in dims}

        # 综合口感评分：甜/咸适度加分，苦/涩过多扣分
        overall = 0.75
        overall += normalized["sweetness"] * 0.15
        overall -= max(0.0, normalized["bitterness"] - 0.3) * 0.3
        overall -= max(0.0, normalized["astringency"] - 0.3) * 0.2
        overall -= max(0.0, normalized["pungency"] - 0.5) * 0.1
        overall = round(min(1.0, max(0.0, overall)), 2)

        flavor_notes = self._build_flavor_notes(normalized, covered, len(names))

        return {
            "sweetness": normalized["sweetness"],
            "bitterness": normalized["bitterness"],
            "astringency": normalized["astringency"],
            "pungency": normalized["pungency"],
            "sourness": normalized["sourness"],
            "saltiness": normalized["saltiness"],
            "overall_score": overall,
            "flavor_notes": flavor_notes,
        }

    def _empty_result(self) -> dict[str, Any]:
        return {
            "sweetness": 0.0,
            "bitterness": 0.0,
            "astringency": 0.0,
            "pungency": 0.0,
            "sourness": 0.0,
            "saltiness": 0.0,
            "overall_score": 0.5,
            "flavor_notes": ["平淡"],
        }

    async def _load_taste_data(self, names: list[str]) -> dict[str, dict[str, Any]]:
        """加载 mmid_herbs 五味四气 + tcm_herbs effects"""
        from sqlalchemy import select

        from ...core.database.session import async_session_factory
        from ...models.external_data import MMIDHerb, TCMHerb

        result: dict[str, dict[str, Any]] = {}
        try:
            async with async_session_factory() as db:
                mmid_rows = (await db.execute(select(MMIDHerb).where(MMIDHerb.name_cn.in_(names)))).scalars().all()
                for m in mmid_rows:
                    result[m.name_cn] = {
                        "flavor": m.flavor or [],
                        "nature": m.nature or "",
                        "effects": "",
                    }
                missing = [n for n in names if n not in result]
                if missing:
                    tcm_rows = (await db.execute(select(TCMHerb).where(TCMHerb.name_cn.in_(missing)))).scalars().all()
                    for t in tcm_rows:
                        existing = result.get(t.name_cn)
                        if existing is None:
                            result[t.name_cn] = {"flavor": [], "nature": "", "effects": t.effects or ""}
                        else:
                            existing["effects"] = t.effects or ""
        except Exception as e:
            logger.error(f"[TCMTaste] 加载口感数据失败: {e}", exc_info=True)
        return result

    def _build_flavor_notes(self, normalized: dict[str, float], covered: int, total: int) -> list[str]:
        notes: list[str] = []
        if normalized["sweetness"] >= 0.3:
            notes.append("甘甜")
        if normalized["bitterness"] >= 0.3:
            notes.append("微苦")
        if normalized["astringency"] >= 0.3:
            notes.append("微涩")
        if normalized["pungency"] >= 0.3:
            notes.append("辛香")
        if normalized["sourness"] >= 0.3:
            notes.append("酸")
        if normalized["saltiness"] >= 0.3:
            notes.append("咸")
        if not notes:
            if covered == 0:
                notes.append("平淡（未收录药材，无口感数据）")
            else:
                notes.append("清淡")
        return notes


# 兼容旧别名
MockTastePredictorService = TCMTastePredictorService
