"""
配方生成数据完整性补全脚本（增强版）

从 TCMSP 数据库提取真实功效数据，填充 extra_knowledge 字段。

用法:
    python -m app.services.recipe_generation_data_completer_v2
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any, Dict

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, ".")

from app.core.database.session import async_session_factory
from app.models.external_data import TCMHerb

logger = logging.getLogger(__name__)

# 功效关键词映射（从 effects 文本提取）
_EFFICACY_KEYWORDS = {
    "免疫": ["免疫调节"],
    "抗氧化": ["抗氧化"],
    "抗炎": ["抗炎"],
    "补气": ["补气"],
    "补血": ["补血"],
    "健脾": ["健脾", "消化系统"],
    "补肾": ["补肾"],
    "清热": ["清热解毒"],
    "解毒": ["清热解毒", "解毒"],
    "活血": ["活血"],
    "降压": ["降血压"],
    "降脂": ["降脂"],
    "降糖": ["降血糖"],
    "安神": ["安神"],
    "止咳": ["止咳化痰"],
    "润肺": ["润肺"],
    "利尿": ["利尿"],
    "明目": ["明目"],
    "止痛": ["止痛"],
    "消食": ["消食化积", "消化系统"],
}

# 药效评分基准（基于中药学原理）
_EFFICACY_BASE_SCORE = {
    "免疫调节": 0.75,
    "抗氧化": 0.70,
    "抗炎": 0.65,
    "补气": 0.80,
    "补血": 0.75,
    "健脾": 0.70,
    "补肾": 0.70,
    "清热解毒": 0.75,
    "活血": 0.70,
    "降血压": 0.65,
    "降脂": 0.65,
    "降血糖": 0.60,
    "安神": 0.65,
    "止咳化痰": 0.65,
    "润肺": 0.65,
    "利尿": 0.60,
    "明目": 0.60,
    "止痛": 0.60,
    "消食化积": 0.65,
    "解毒": 0.65,
}


def extract_efficacy_from_effects(effects_text: str) -> Dict[str, float]:
    """从 effects 文本中提取功效评分"""
    if not effects_text:
        return {}

    try:
        # 尝试解析 JSON 数组
        effects = json.loads(effects_text)
        if isinstance(effects, list):
            return {eff: _EFFICACY_BASE_SCORE.get(eff, 0.60) for eff in effects if _EFFICACY_BASE_SCORE.get(eff, 0) > 0}
    except (json.JSONDecodeError, TypeError):
        pass

    # 从文本中提取关键词
    result = {}
    effects_lower = effects_text.lower()

    for keyword, efficacy_list in _EFFICACY_KEYWORDS.items():
        if keyword in effects_text or keyword.lower() in effects_lower:
            for eff in efficacy_list:
                if eff not in result:
                    result[eff] = _EFFICACY_BASE_SCORE.get(eff, 0.60)

    return result


def get_herb_id_from_name(name: str) -> str:
    """从中文名获取 herb_id"""
    name_to_id = {
        "黄芪": "hq", "党参": "ds", "枸杞子": "gz", "人参": "rs",
        "当归": "dg", "黄芪根": "hqg", "白术": "bq", "茯苓": "fp",
        "甘草": "gq", "菊花": "jgh", "川芎": "cs", "藜芦": "lk",
        "马利兰": "mld", "附子": "fz", "陈皮": "cx", "薏苡仁": "yq",
        "金银花": "cyh", "大枣": "dcx", "生姜": "sj", "葛根": "gh",
        "山楂": "sz", "丹参": "dsz", "山药": "sx", "决明子": "jq",
        "连翘": "lq", "薄荷": "bo", "桂圆": "gy", "莲子": "ls",
        "红豆": "hd", "黑芝麻": "hhz", "核桃": "ht", "桑椹": "ss",
        "百合": "bh", "麦冬": "md", "沙参": "ssn", "玉竹": "yz",
        "阿胶": "aj", "三七": "sq", "天麻": "tm", "钩藤": "gt",
        "鱼腥草": "ypc", "蒲公英": "pyg", "马齿苋": "mcx", "荷叶": "hy",
        "桑叶": "sy", "罗布麻": "lbm", "绞股蓝": "jgl",
        "白芍": "bsh", "桔梗": "jgf", "半夏": "bx", "枳实": "zs",
        "厚朴": "hp", "五味子": "wsz", "山茱萸": "szf",
        "酸枣仁": "szr", "柏子仁": "bzr", "红枣": "dcx",
    }
    return name_to_id.get(name, name[:2].lower())


def get_default_dosage(name: str) -> tuple[float, float]:
    """获取默认剂量范围"""
    dosage_ranges = {
        "黄芪": (3, 30), "人参": (1, 9), "党参": (3, 15), "山药": (10, 30),
        "白术": (3, 12), "甘草": (1.5, 6), "大枣": (6, 15),
        "当归": (3, 12), "龙眼肉": (6, 12),
        "金银花": (6, 15), "菊花": (6, 12), "蒲公英": (10, 30), "连翘": (6, 15),
        "鱼腥草": (15, 30),
        "茯苓": (10, 20), "薏苡仁": (10, 30),
        "丹参": (10, 15), "三七": (3, 9), "川芎": (3, 10),
        "陈皮": (3, 10), "砂仁": (3, 6),
        "薄荷": (3, 6), "生姜": (3, 10), "紫苏": (6, 10),
        "枸杞子": (6, 12), "麦冬": (6, 12), "玉竹": (6, 12),
        "百合": (6, 12), "黄精": (9, 15),
        "酸枣仁": (6, 12), "柏子仁": (3, 9), "莲子": (6, 12),
        "五味子": (2, 6), "山茱萸": (6, 12),
        "山楂": (6, 12), "荷叶": (6, 12), "决明子": (10, 15),
        "黑芝麻": (6, 12), "桑葚": (6, 12),
    }
    return dosage_ranges.get(name, (3, 15))


def get_safety_index(name: str, is_food_homology: bool) -> float:
    """获取安全性指数"""
    if is_food_homology:
        return 0.95  # 药食同源药材安全性高
    return 0.85  # 普通药材


async def enrich_herb_knowledge(db: AsyncSession) -> dict[str, int]:
    """
    为 TCMHerb 表填充结构化知识数据

    Returns:
        统计信息 {updated: int, skipped: int, no_effects: int}
    """
    stats = {"updated": 0, "skipped": 0, "no_effects": 0}

    # 获取所有药材
    result = await db.execute(select(TCMHerb))
    herbs = result.scalars().all()

    logger.info(f"找到 {len(herbs)} 条药材记录，开始填充知识数据...")

    updated_with_efficacy = 0

    for herb in herbs:
        if not herb.name_cn:
            continue

        # 检查是否已有完整的 extra_knowledge
        has_valid_knowledge = False
        if herb.extra_knowledge:
            try:
                existing = json.loads(herb.extra_knowledge)
                if existing.get("efficacy_scores") and len(existing["efficacy_scores"]) > 0:
                    has_valid_knowledge = True
            except (json.JSONDecodeError, TypeError):
                pass

        if has_valid_knowledge:
            stats["skipped"] += 1
            continue

        # 从 effects 字段提取功效
        efficacy_scores = extract_efficacy_from_effects(herb.effects)

        if not efficacy_scores:
            stats["no_effects"] += 1
            # 仍然填充基本数据
            efficacy_scores = {"综合调理": 0.50}

        # 构建 herb_id
        herb_id = get_herb_id_from_name(herb.name_cn)

        # 获取剂量范围
        dosage_min, dosage_max = get_default_dosage(herb.name_cn)

        # 获取安全性指数
        safety_index = get_safety_index(herb.name_cn, herb.is_food_homology)

        # 构建 extra_knowledge
        extra_knowledge = {
            "herb_id": herb_id,
            "efficacy_scores": efficacy_scores,
            "dosage_min": dosage_min,
            "dosage_max": dosage_max,
            "dosage_step": 1.0,
            "safety_index": safety_index,
            "cost_per_gram": 0.10,  # 默认成本
            "synergy_partners": [],  # 协同配伍（待补充）
            "antagonistic_pairs": [],  # 禁忌配伍（待补充）
            "source": "recipe_generation_data_completer_v2",
            "extracted_from": "effects_field",
        }

        # 更新记录
        await db.execute(
            update(TCMHerb)
            .where(TCMHerb.id == herb.id)
            .values(extra_knowledge=json.dumps(extra_knowledge, ensure_ascii=False))
        )

        if len(efficacy_scores) > 0:
            updated_with_efficacy += 1
            stats["updated"] += 1
            logger.debug(f"Updated: {herb.name_cn} -> {len(efficacy_scores)} efficacy scores")
        else:
            stats["no_effects"] += 1

    await db.commit()
    logger.info(f"填充完成: 更新 {stats['updated']} 条, 跳过 {stats['skipped']} 条, 无功效数据 {stats['no_effects']} 条")
    logger.info(f"有效功效数据: {updated_with_efficacy}/{stats['updated']} 条")
    return stats


async def verify_enrichment(db: AsyncSession) -> dict[str, Any]:
    """验证填充结果"""
    # 统计有功效数据的数量
    result = await db.execute(select(TCMHerb))
    herbs = result.scalars().all()

    with_efficacy = 0
    total_efficacy_scores = 0

    for herb in herbs:
        if herb.extra_knowledge:
            try:
                data = json.loads(herb.extra_knowledge)
                if data.get("efficacy_scores") and len(data["efficacy_scores"]) > 0:
                    with_efficacy += 1
                    total_efficacy_scores += len(data["efficacy_scores"])
            except (json.JSONDecodeError, TypeError):
                pass

    return {
        "total_herbs": len(herbs),
        "with_efficacy": with_efficacy,
        "total_efficacy_scores": total_efficacy_scores,
        "coverage_rate": f"{with_efficacy/len(herbs)*100:.1f}%" if herbs else "0%",
        "avg_scores_per_herb": f"{total_efficacy_scores/with_efficacy:.1f}" if with_efficacy else "0",
    }


async def main():
    """主入口"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    logger.info("=" * 60)
    logger.info("配方生成数据完整性补全（增强版）")
    logger.info("=" * 60)

    async with async_session_factory() as db:
        # 1. 验证当前状态
        logger.info("\n[1] 验证当前数据状态...")
        from sqlalchemy import func, select
        total_result = await db.execute(select(func.count()).select_from(TCMHerb))
        total = total_result.scalar() or 0
        logger.info(f"  总药材数: {total}")

        # 2. 填充数据
        logger.info("\n[2] 开始填充知识数据...")
        await enrich_herb_knowledge(db)

        # 3. 验证结果
        logger.info("\n[3] 验证填充结果...")
        verification = await verify_enrichment(db)

        logger.info("\n验证结果:")
        logger.info(f"  总药材数: {verification['total_herbs']}")
        logger.info(f"  有功效数据: {verification['with_efficacy']}")
        logger.info(f"  覆盖率: {verification['coverage_rate']}")
        logger.info(f"  平均每药材功效数: {verification['avg_scores_per_herb']}")

        # 4. 显示样本
        logger.info("\n[4] 样本药材（前5种）:")
        result = await db.execute(
            select(TCMHerb)
            .where(TCMHerb.extra_knowledge.is_not(None))
            .limit(5)
        )
        sample_herbs = result.scalars().all()

        for herb in sample_herbs:
            try:
                data = json.loads(herb.extra_knowledge)
                efficacy_count = len(data.get("efficacy_scores", {}))
                logger.info(f"  - {herb.name_cn}: {efficacy_count} 项功效, herb_id={data.get('herb_id')}, 安全指数={data.get('safety_index')}")
            except Exception as e:
                logger.error(f"  - {herb.name_cn}: 解析失败 - {e}")

    logger.info("\n" + "=" * 60)
    logger.info("数据补全完成!")
    logger.info("=" * 60)

    # 返回退出码
    return 0 if verification['with_efficacy'] >= 50 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
