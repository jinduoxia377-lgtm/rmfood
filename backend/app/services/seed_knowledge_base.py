"""
知识库种子脚本 — 将 knowledge_base.py 中的药材数据导入数据库

用法:
    python -m app.services.seed_knowledge_base

注意:
    - 此脚本仅用于开发/初始化环境
    - 生产环境应通过 TCMSP/MMID 数据同步管道导入
    - 种子数据会被标记为 source='seed'，以便区分
"""
from __future__ import annotations

import asyncio
import json
import logging

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import async_session_factory
from app.models.external_data import TCMHerb

logger = logging.getLogger(__name__)


# 药材 herb_id → 中文名映射
_NAME_TO_ID = {
    "枸杞子": "gz", "人参": "rs", "黄芪": "hq", "红枣": "dcx",
    "山楂": "sz", "茯苓": "fp", "菊花": "jgh", "当归": "dg",
    "甘草": "gq", "决明子": "jq", "丹参": "dsz", "山药": "sx",
    "金银花": "cyh", "连翘": "lq", "薄荷": "bo", "生姜": "sj",
    "桂圆": "gy", "莲子": "ls", "薏苡仁": "yq", "红豆": "hd",
    "黑芝麻": "hhz", "核桃": "ht", "桑椹": "ss", "百合": "bh",
    "麦冬": "md", "沙参": "ssn", "玉竹": "yz", "阿胶": "aj",
    "三七": "sq", "天麻": "tm", "钩藤": "gt", "葛根": "gh",
    "川芎": "cs", "白芍": "bsh", "白术": "bq", "枳实": "zs",
    "厚朴": "hp", "半夏": "bx", "桔梗": "jgf", "鱼腥草": "ypc",
    "蒲公英": "pyg", "马齿苋": "mcx", "荷叶": "hy", "桑叶": "sy",
    "罗布麻": "lbm", "绞股蓝": "jgl",
}


async def seed_herb_knowledge(db: AsyncSession) -> dict:
    """
    将 knowledge_base.py 中的药材数据导入 TCMHerb 表。

    额外字段（dosage/contraindication/pairing/meridian）存储在 JSON 扩展字段中。

    Returns:
        统计信息: {seeded, updated, skipped, total}
    """
    from app.services.knowledge_base import HERB_KNOWLEDGE_BASE

    stats = {"seeded": 0, "updated": 0, "skipped": 0, "total": len(HERB_KNOWLEDGE_BASE)}

    for name_cn, info in HERB_KNOWLEDGE_BASE.items():
        herb_id = _NAME_TO_ID.get(name_cn)
        if not herb_id:
            logger.warning(f"[Seed] 未找到药材 '{name_cn}' 的 herb_id，跳过")
            stats["skipped"] += 1
            continue

        # 检查是否已存在
        existing = await db.execute(
            select(TCMHerb).where(TCMHerb.name_cn == name_cn)
        )
        tcm_herb = existing.scalar_one_or_none()

        if tcm_herb is None:
            # 构建扩展数据 JSON
            extra_data = {
                "herb_id": herb_id,
                "dosage": info.get("dosage"),
                "contraindication": info.get("contraindication"),
                "pairing": info.get("pairing", []),
                "meridian": info.get("meridian", []),
                "effects_detailed": info.get("effects", []),
                "chemicals_detailed": info.get("chemicals", []),
            }

            tcm_herb = TCMHerb(
                name_cn=name_cn,
                name_pinyin=info.get("pinyin"),
                category=info.get("category"),
                effects=json.dumps(info.get("effects", []), ensure_ascii=False),
                compounds=json.dumps(info.get("chemicals", []), ensure_ascii=False),
                is_food_homology=info.get("is_food_homology", False),
                extra_knowledge=json.dumps(extra_data, ensure_ascii=False),
                source="seed",
                source_version="knowledge_base.py",
            )
            db.add(tcm_herb)
            stats["seeded"] += 1
            logger.info(f"[Seed] 新增药材: {name_cn}")
        else:
            # 更新已有记录
            extra_data = {}
            if tcm_herb.extra_knowledge:
                try:
                    extra_data = json.loads(tcm_herb.extra_knowledge)
                except (json.JSONDecodeError, TypeError):
                    extra_data = {}

            extra_data.update({
                "herb_id": herb_id,
                "dosage": info.get("dosage"),
                "contraindication": info.get("contraindication"),
                "pairing": info.get("pairing", []),
                "meridian": info.get("meridian", []),
                "effects_detailed": info.get("effects", []),
                "chemicals_detailed": info.get("chemicals", []),
            })

            await db.execute(
                update(TCMHerb)
                .where(TCMHerb.name_cn == name_cn)
                .values(
                    name_pinyin=info.get("pinyin"),
                    category=info.get("category"),
                    effects=json.dumps(info.get("effects", []), ensure_ascii=False),
                    compounds=json.dumps(info.get("chemicals", []), ensure_ascii=False),
                    is_food_homology=info.get("is_food_homology", False),
                    extra_knowledge=json.dumps(extra_data, ensure_ascii=False),
                    source="seed",
                    source_version="knowledge_base.py",
                )
            )
            stats["updated"] += 1
            logger.info(f"[Seed] 更新药材: {name_cn}")

    await db.commit()
    logger.info(f"[Seed] 完成: {stats}")
    return stats


async def main():
    """种子脚本入口"""
    logging.basicConfig(level=logging.INFO)

    async with async_session_factory() as db:
        stats = await seed_herb_knowledge(db)

    print(f"\n{'=' * 50}")
    print(f"知识库种子导入完成")
    print(f"  总计: {stats['total']} 种药材")
    print(f"  新增: {stats['seeded']}")
    print(f"  更新: {stats['updated']}")
    print(f"  跳过: {stats['skipped']}")
    print(f"{'=' * 50}\n")


if __name__ == "__main__":
    asyncio.run(main())
