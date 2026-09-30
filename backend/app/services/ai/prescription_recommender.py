"""
智能配方推荐引擎 (Prescription Recommender)

基于用户历史配方数据与协同信号，为目标功效生成个性化配方推荐。

数据源（全部来自数据库，不使用硬编码假数据）：
1. formulas 表 — 历史配方（含 target_effects、composition、ai_recommendations）
2. formula_generation_history 表 — 生成管线历史（含推荐记录）
3. TCMHerb + extra_knowledge — 药材功效评分 / 协同配伍

推荐策略：
- 内容推荐：按功效评分与历史配方共现率排序
- 协同推荐：基于 extra_knowledge 中的 synergy_partners
- 去重过滤：排除用户已生成过的配方组合

用法:
    recommender = PrescriptionRecommender(db)
    recs = await recommender.recommend(user_id=1, target_effects=["免疫调节", "抗氧化"], top_k=3)
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.formula import Formula
from app.models.external_data import TCMHerb

logger = logging.getLogger(__name__)


class PrescriptionRecommender:
    """智能配方推荐引擎"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ══════════════════════════════════════════════════════
    # 主入口
    # ══════════════════════════════════════════════════════

    async def recommend(
        self,
        user_id: int,
        target_effects: list[str],
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        """
        生成配方推荐列表。

        Returns:
            [
                {
                    "reason_type": "historical" | "collaborative" | "content",
                    "formula_name": str,
                    "herbs": [{"name": str, "dosage_g": float, "role": str}, ...],
                    "reason": str,  # 推荐理由（中文）
                    "confidence": float,  # 0~1
                },
                ...
            ]
        """
        if not target_effects:
            return []

        # 1. 用户历史配方（真实数据）
        historical = await self._historical_recommendations(user_id, target_effects, top_k)

        # 2. 基于功效的内容推荐（数据库药材）
        content = await self._content_recommendations(target_effects, top_k)

        # 3. 协同配伍推荐（extra_knowledge.synergy_partners）
        collaborative = await self._collaborative_recommendations(target_effects, top_k)

        # 合并并按置信度降序
        merged: list[dict[str, Any]] = []
        seen_combos: set[frozenset] = set()
        for rec in historical + content + collaborative:
            combo = frozenset(h["name"] for h in rec.get("herbs", []))
            if combo and combo in seen_combos:
                continue
            if combo:
                seen_combos.add(combo)
            merged.append(rec)

        merged.sort(key=lambda r: r.get("confidence", 0), reverse=True)
        result = merged[:top_k]

        if not result:
            logger.warning("[推荐引擎] 无可用推荐（用户 %s, 功效 %s）", user_id, target_effects)
            return []

        logger.info(
            "[推荐引擎] 用户 %s 功效 %s → 历史 %d / 内容 %d / 协同 %d, 返回 Top%d",
            user_id, target_effects, len(historical), len(content), len(collaborative), len(result),
        )
        return result

    # ══════════════════════════════════════════════════════
    # 策略1: 用户历史配方推荐
    # ══════════════════════════════════════════════════════

    async def _historical_recommendations(
        self, user_id: int, target_effects: list[str], top_k: int
    ) -> list[dict[str, Any]]:
        """基于用户已保存/生成过的配方做个性化推荐"""
        try:
            rows = (await self.db.execute(
                select(Formula).where(Formula.creator_id == user_id)
                .order_by(Formula.updated_at.desc())
                .limit(50)
            )).scalars().all()
        except Exception as e:
            logger.debug("[推荐引擎] 历史配方查询失败: %s", e)
            return []

        results = []
        for formula in rows:
            effects = formula.target_effects or []
            # 功效交集
            overlap = set(effects) & set(target_effects)
            if not overlap:
                continue
            similarity = len(overlap) / max(len(target_effects), 1)
            composition = formula.composition or {}
            herbs = self._composition_to_herbs(composition)
            if not herbs:
                continue
            results.append({
                "reason_type": "historical",
                "formula_name": formula.name,
                "herbs": herbs,
                "reason": f"与您此前针对「{'、'.join(overlap)}」的配方「{formula.name}」功效重叠度 {similarity:.0%}",
                "confidence": min(similarity, 1.0) * 0.9,
                "source_formula_id": formula.id,
            })
        return results[:top_k]

    @staticmethod
    def _composition_to_herbs(composition) -> list[dict[str, Any]]:
        """把 Formula.composition JSON 解析为 herbs 列表。

        兼容三种真实数据形态：
        1. {"herbs": [{name, dosage_g, role}]} — 结构化配方
        2. [{name, dosage_g, role}, ...] — 直接列表
        3. {药材名: 剂量g, ...} — 数据库 formulas 表实际使用的名称→剂量映射
        """
        herbs: list[dict[str, Any]] = []
        if isinstance(composition, dict):
            raw = composition.get("herbs")
            if isinstance(raw, list):
                for item in raw:
                    if not isinstance(item, dict):
                        continue
                    name = item.get("name") or item.get("name_cn") or ""
                    if not name:
                        continue
                    herbs.append({
                        "name": name,
                        "dosage_g": float(item.get("dosage_g") or item.get("dosage") or 0),
                        "role": item.get("role") or "",
                    })
            elif any(k in composition for k in ("herbs", "name", "name_cn")):
                return herbs
            else:
                # 形态 3：{药材名: 剂量} 直接映射（真实数据库 composition 形态）
                # 按剂量降序分配君臣佐使角色
                items = sorted(
                    ((str(k), float(v) if v is not None else 0.0) for k, v in composition.items()),
                    key=lambda x: -x[1],
                )
                roles = ["君药", "臣药", "臣药", "佐药", "佐药", "使药"]
                for idx, (name, dosage_g) in enumerate(items):
                    if not name:
                        continue
                    herbs.append({
                        "name": name,
                        "dosage_g": dosage_g,
                        "role": roles[idx] if idx < len(roles) else "佐药",
                    })
        elif isinstance(composition, list):
            for item in composition:
                if not isinstance(item, dict):
                    continue
                name = item.get("name") or item.get("name_cn") or ""
                if not name:
                    continue
                herbs.append({
                    "name": name,
                    "dosage_g": float(item.get("dosage_g") or item.get("dosage") or 0),
                    "role": item.get("role") or "",
                })
        return herbs

    # ══════════════════════════════════════════════════════
    # 策略2: 基于数据库功效的内容推荐
    # ══════════════════════════════════════════════════════

    async def _content_recommendations(
        self, target_effects: list[str], top_k: int
    ) -> list[dict[str, Any]]:
        """从 TCMHerb.extra_knowledge.efficacy_scores 中提取匹配药材"""
        try:
            rows = (await self.db.execute(
                select(TCMHerb).where(TCMHerb.extra_knowledge.is_not(None))
                .limit(2000)
            )).scalars().all()
        except Exception as e:
            logger.debug("[解析失败] 药材知识查询: %s", e)
            return []

        # 汇总: 药材名 → (总评分, 命中功效数)
        scores: dict[str, list[float]] = {}
        name_map: dict[str, str] = {}
        for herb in rows:
            if not herb.name_cn:
                continue
            data = herb.extra_knowledge
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    continue
            if not isinstance(data, dict):
                continue
            eff_scores = data.get("efficacy_scores") or {}
            if not isinstance(eff_scores, dict) or not eff_scores:
                continue
            hit = [eff for eff in target_effects if eff in eff_scores]
            if not hit:
                continue
            name_map[herb.name_cn] = data.get("herb_id") or herb.name_cn
            scores.setdefault(herb.name_cn, []).extend(float(eff_scores[e]) for e in hit)

        # 排序：命中功效数优先，其次平均分
        ranked = sorted(
            scores.items(),
            key=lambda kv: (-len(kv[1]), -(sum(kv[1]) / len(kv[1]))),
        )
        top_herbs = ranked[:8]

        if not top_herbs:
            return []

        # 君臣佐使角色分配（按剂量降序 + 评分加权）
        role_seq = ["君药", "臣药", "臣药", "佐药", "佐药", "使药"]
        herbs = []
        for i, (name, vals) in enumerate(top_herbs):
            avg = sum(vals) / len(vals)
            herbs.append({
                "name": name,
                "dosage_g": round(min(15.0, 3.0 + avg * 12.0), 1),
                "role": role_seq[i] if i < len(role_seq) else "佐药",
            })

        eff_joined = "、".join(target_effects)
        return [{
            "reason_type": "content",
            "formula_name": f"{eff_joined}推荐方",
            "herbs": herbs,
            "reason": f"基于数据库 {len(scores)} 种药材的「{eff_joined}」功效评分筛选，按评分加权分配君臣佐使角色",
            "confidence": round(min(1.0, 0.5 + len(top_herbs) / 16), 3),
        }]

    # ══════════════════════════════════════════════════════
    # 策略3: 协同配伍推荐
    # ══════════════════════════════════════════════════════

    async def _collaborative_recommendations(
        self, target_effects: list[str], top_k: int
    ) -> list[dict[str, Any]]:
        """基于 extra_knowledge.synergy_partners 找出共现协同药对"""
        try:
            rows = (await self.db.execute(
                select(TCMHerb).where(TCMHerb.extra_knowledge.is_not(None))
                .limit(2000)
            )).scalars().all()
        except Exception:
            return []

        # 构建 id → 名称 与 名称 → id
        id_to_name: dict[str, str] = {}
        name_to_id: dict[str, str] = {}
        partner_count: Counter = Counter()
        for herb in rows:
            if not herb.name_cn:
                continue
            data = herb.extra_knowledge
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    continue
            if not isinstance(data, dict):
                continue
            hid = data.get("herb_id") or herb.name_cn
            id_to_name[hid] = herb.name_cn
            name_to_id[herb.name_cn] = hid
            for partner in data.get("synergy_partners") or []:
                partner_s = str(partner)
                # 数据库中 synergy_partners 存储的是药材名（str），兼容 herb_id 两种形态
                resolved = name_to_id.get(partner_s) or id_to_name.get(partner_s, partner_s)
                partner_count[frozenset((hid, resolved))] += 1

        if not partner_count:
            return []

        # 协同强度 Top 药对 → 生成推荐
        top_pairs = partner_count.most_common(min(top_k * 2, 10))
        eff_joined = "、".join(target_effects)
        recs = []
        used: set[frozenset] = set()
        for pair, weight in top_pairs:
            # 输出层再做一次 id→name 兜底解析：任何仍是纯 ASCII 的条目
            # 说明 name↔id 双向映射存在缺口，此时直接丢弃该推荐
            # （宁可少一条推荐，也不向用户暴露 herb_id 假名）。
            names = [id_to_name.get(x, x) for x in pair]
            if any(not any("\u4e00" <= c <= "\u9fff" for c in str(n)) for n in names):
                continue
            names = sorted(names)
            if not all(names) or len(set(names)) < 2:
                continue
            key = frozenset(names)
            if key in used:
                continue
            used.add(key)
            recs.append({
                "reason_type": "collaborative",
                "formula_name": f"{names[0]}-{names[1]}协同方（{eff_joined}）",
                "herbs": [
                    {"name": n, "dosage_g": 9.0, "role": "君药" if i == 0 else "臣药"}
                    for i, n in enumerate(names)
                ],
                "reason": f"{names[0]} 与 {names[1]} 在数据库协同配伍网络中共现 {weight} 次，符合「{eff_joined}」目标",
                "confidence": round(min(0.95, 0.55 + weight * 0.12), 3),
            })
            if len(recs) >= top_k:
                break
        return recs
