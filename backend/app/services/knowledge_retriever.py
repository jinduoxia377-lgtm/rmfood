"""
知识检索器 — 从真实数据库检索药食同源知识

支持：
- 按名称查询药材详细信息
- 按功效匹配药材列表
- 药食同源目录过滤
- 配伍禁忌查询
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _parse_extra_knowledge(extra: str | None) -> dict:
    """解析 extra_knowledge JSON 字段"""
    if not extra:
        return {}
    try:
        import json
        return json.loads(extra)
    except (json.JSONDecodeError, TypeError):
        return {}


async def _async_load_herb_cache() -> Dict[str, Dict[str, Any]]:
    """从数据库异步加载药食同源药材缓存"""
    try:
        from sqlalchemy import select

        from app.core.database.session import get_session_factory
        from app.models.models import TCMHerb

        cache: Dict[str, Dict[str, Any]] = {}
        factory = get_session_factory()

        async with factory() as session:
            # 加载所有药材
            result = await session.execute(select(TCMHerb))
            for herb in result.scalars().all():
                extra = _parse_extra_knowledge(herb.extra_knowledge)
                effects_list = []
                if herb.effects:
                    effects_list = [e.strip() for e in herb.effects.split("、") if e.strip()]

                cache[herb.name_cn] = {
                    "id": herb.id,
                    "name": herb.name_cn,
                    "pinyin": herb.name_pinyin or "",
                    "property": "",  # TCMHerb doesn't have property field
                    "meridian": [],  # TCMHerb doesn't have meridian field
                    "effects": [e.strip() for e in (herb.effects or "").split("、") if e.strip()],
                    "chemicals": herb.compounds or [],
                    "dosage": "",  # TCMHerb doesn't have dosage field
                    "toxicity": "",
                    "contraindication": "",
                    "pairing_taboos": _parse_extra_knowledge(herb.extra_knowledge).get("pairing_taboos", []),
                    "is_food_homology": herb.is_food_homology,
                    "source": herb.source or "TCMSP",
                }

        logger.info("知识缓存加载完成: %d 种药材", len(cache))
        return cache
    except Exception as e:
        logger.warning("知识缓存加载失败: %s", e)
        return {}


class KnowledgeRetriever:
    """从真实数据库检索知识"""

    def __init__(self, knowledge_base: Optional[Dict[str, Any]] = None):
        self._kb = knowledge_base or {}
        self._db_herbs: Dict[str, Dict[str, Any]] = {}
        self._loaded = False

    async def _ensure_loaded(self) -> None:
        """懒加载数据库缓存"""
        if self._loaded:
            return
        self._loaded = True
        if not self._kb:
            self._db_herbs = await _async_load_herb_cache()
            if self._db_herbs:
                self._kb = self._db_herbs

    def retrieve(self, intent: dict) -> dict:
        """根据意图检索知识（同步调用，使用已有缓存）"""
        return self._do_retrieve(intent)

    async def retrieve_async(self, intent: dict) -> dict:
        """异步版本，确保缓存已加载"""
        await self._ensure_loaded()
        return self._do_retrieve(intent)

    def _do_retrieve(self, intent: dict) -> dict:
        """实际检索逻辑"""
        herbs = intent.get("mentioned_herbs", [])
        effects = intent.get("target_effects", [])

        details = []

        # 检索具体药材
        for herb_name in herbs:
            info = self._kb.get(herb_name)
            if info:
                meridian_str = "/".join(info.get("meridian", [])) if info.get("meridian") else "未知"
                chemicals = "、".join(info.get("chemicals", [])[:3]) if info.get("chemicals") else "未知"
                details.append(
                    f"**{herb_name}**（{info.get('pinyin', '')}）\n"
                    f"  性味：{info.get('property', '未知')} | 归经：{meridian_str}\n"
                    f"  功效：{'、'.join(info.get('effects', [])[:3])}\n"
                    f"  主要成分：{chemicals}\n"
                    f"  用量范围：{info.get('dosage', '未知')}"
                )

        # 按功效检索
        if effects:
            for effect in effects:
                matched = []
                for name, info in self._kb.items():
                    herb_effects = info.get("effects", [])
                    if any(effect in e or e in effect for e in herb_effects):
                        matched.append(f"{name}（{'、'.join(info.get('effects', [])[:2])}）")
                if matched:
                    details.append(
                        f"与「{effect}」相关的药材：\n  "
                        + "\n  ".join(matched[:5])
                    )

        # 汇总概览
        food_herbs = [n for n, i in self._kb.items() if i.get("is_food_homology")]
        total_herbs = len(self._kb)
        details.append(
            f"药食同源知识库已加载 {total_herbs} 种药材\n"
            f"  药食同源食材：{'、'.join(food_herbs[:8])}等"
        )

        return {
            "summary": (
                f"已检索到 {len(herbs)} 种药材信息、{len(effects)} 项功效关联"
            ),
            "details": "\n\n".join(details[:5]),
            "total_herbs": total_herbs,
            "food_herbs_count": len(food_herbs),
        }

    async def get_herb_info(self, herb_name: str) -> Optional[Dict[str, Any]]:
        """获取单个药材详细信息"""
        await self._ensure_loaded()
        info = self._kb.get(herb_name)
        if info:
            return info

        # 模糊匹配
        matches = [
            name for name in self._kb
            if herb_name in name or name in herb_name
        ]
        if matches:
            return {"suggestions": matches, "message": f"未找到'{herb_name}'，您是否指：{matches}"}
        return None

    @property
    def herb_count(self) -> int:
        return len(self._kb)

    @property
    def food_herb_count(self) -> int:
        return sum(1 for h in self._kb.values() if h.get("is_food_homology"))
