"""
配方生成数据完整性补全脚本

功能:
1. 确保 TCMHerb 表有完整数据（从知识库和 TCMSP 数据源）
2. 填充 extra_knowledge 字段以支持 HerbKnowledgeService
3. 验证数据完整性并输出统计报告

用法:
    python -m app.services.recipe_generation_data_completer
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

# 添加项目根目录到路径
sys.path.insert(0, ".")

from app.core.database.session import async_session_factory
from app.models.external_data import TCMHerb

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════
# 药效评分映射（基于 knowledge_base.py）
# ═══════════════════════════════════════════
_EFFICACY_SCORES = {
    # 补气药
    "黄芪": {"免疫调节": 0.92, "抗氧化": 0.78, "抗疲劳": 0.85, "补气": 0.95},
    "人参": {"抗疲劳": 0.95, "免疫调节": 0.90, "补气": 0.92, "心血管保护": 0.78},
    "党参": {"免疫调节": 0.85, "抗疲劳": 0.80, "补气": 0.88, "消化系统": 0.75},
    "山药": {"健脾": 0.85, "补气": 0.75, "补肾": 0.70, "消化系统": 0.80},
    "白术": {"健脾": 0.85, "免疫调节": 0.72, "补气": 0.80, "利尿": 0.65},
    "甘草": {"抗炎": 0.78, "止咳": 0.72, "解毒": 0.75, "调和": 0.90},
    "大枣": {"补气": 0.78, "养血": 0.75, "免疫调节": 0.72, "安神": 0.65},

    # 补血药
    "当归": {"补血": 0.92, "活血": 0.88, "调经": 0.85, "抗氧化": 0.75},
    "龙眼肉": {"补血": 0.80, "安神": 0.82, "补气": 0.70, "养心": 0.78},

    # 清热药
    "金银花": {"清热解毒": 0.92, "抗炎": 0.85, "抗氧化": 0.78, "免疫调节": 0.72},
    "菊花": {"清热解毒": 0.85, "明目": 0.82, "平肝": 0.78, "抗氧化": 0.70},
    "蒲公英": {"清热解毒": 0.85, "消肿散结": 0.80, "利尿": 0.72, "抗炎": 0.75},
    "连翘": {"清热解毒": 0.82, "消肿散结": 0.78, "抗炎": 0.75, "抗菌": 0.70},
    "鱼腥草": {"清热解毒": 0.88, "消炎": 0.82, "利尿": 0.70, "抗菌": 0.78},

    # 利水渗湿药
    "茯苓": {"利尿": 0.85, "健脾": 0.75, "免疫调节": 0.70, "安神": 0.65},
    "薏苡仁": {"利尿": 0.82, "健脾": 0.75, "祛湿": 0.78, "免疫调节": 0.68},

    # 活血化瘀药
    "丹参": {"活血": 0.90, "心血管保护": 0.85, "抗炎": 0.78, "抗氧化": 0.82},
    "三七": {"活血": 0.92, "止血": 0.88, "消肿止痛": 0.85, "心血管保护": 0.80},
    "川芎": {"活血行气": 0.88, "止痛": 0.85, "祛风": 0.75, "降压": 0.70},

    # 理气药
    "陈皮": {"理气": 0.85, "健脾": 0.78, "燥湿化痰": 0.82, "消化系统": 0.80},
    "砂仁": {"化湿开胃": 0.82, "温脾止泻": 0.78, "理气安胎": 0.75},

    # 解表药
    "薄荷": {"疏散风热": 0.85, "清利头目": 0.80, "利咽透疹": 0.75, "疏肝": 0.70},
    "生姜": {"解表散寒": 0.82, "温中止呕": 0.85, "化痰止咳": 0.75, "抗炎": 0.70},
    "紫苏": {"解表散寒": 0.80, "行气和胃": 0.78, "解鱼蟹毒": 0.75},

    # 补阴药
    "枸杞子": {"滋补肝肾": 0.90, "明目": 0.88, "抗氧化": 0.85, "免疫调节": 0.82},
    "麦冬": {"养阴生津": 0.85, "润肺清心": 0.82, "滋阴": 0.80},
    "玉竹": {"养阴润燥": 0.82, "生津止渴": 0.80, "美容": 0.75},
    "百合": {"养阴润肺": 0.82, "清心安神": 0.78, "滋阴": 0.75},
    "黄精": {"补气养阴": 0.85, "健脾": 0.80, "润肺": 0.78, "补肾": 0.75},

    # 安神药
    "酸枣仁": {"安神": 0.90, "养心": 0.85, "敛汗": 0.75, "生津": 0.70},
    "柏子仁": {"养心安神": 0.85, "润肠通便": 0.75, "止汗": 0.70},
    "莲子": {"补脾止泻": 0.80, "益肾固精": 0.78, "养心安神": 0.75},

    # 收涩药
    "五味子": {"收敛固涩": 0.85, "益气生津": 0.80, "补肾宁心": 0.78},
    "山茱萸": {"补益肝肾": 0.88, "收敛固涩": 0.82, "强筋骨": 0.75},

    # 其他常用药材
    "山楂": {"消食化积": 0.90, "行气散瘀": 0.82, "降脂": 0.78, "心血管保护": 0.75},
    "荷叶": {"降脂": 0.85, "清暑利湿": 0.80, "升发清阳": 0.75, "减肥": 0.72},
    "决明子": {"清热明目": 0.88, "润肠通便": 0.82, "降脂降压": 0.75},
    "黑芝麻": {"补肝肾": 0.85, "益精血": 0.82, "润肠燥": 0.78, "乌发": 0.75},
    "桑葚": {"滋阴补血": 0.85, "生津润燥": 0.80, "明目": 0.75, "抗衰老": 0.72},
}

# 剂量范围映射 (g)
_DOSAGE_RANGES = {
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

# 安全性指数 (0-1)
_SAFETY_INDEX = {
    "黄芪": 0.95, "人参": 0.85, "党参": 0.95, "山药": 0.98,
    "白术": 0.94, "甘草": 0.92, "大枣": 0.98,
    "当归": 0.92, "龙眼肉": 0.95,
    "金银花": 0.94, "菊花": 0.93, "蒲公英": 0.93, "连翘": 0.92,
    "鱼腥草": 0.90,
    "茯苓": 0.97, "薏苡仁": 0.95,
    "丹参": 0.88, "三七": 0.82, "川芎": 0.90,
    "陈皮": 0.93, "砂仁": 0.92,
    "薄荷": 0.92, "生姜": 0.96, "紫苏": 0.94,
    "枸杞子": 0.98, "麦冬": 0.93, "玉竹": 0.95,
    "百合": 0.94, "黄精": 0.92,
    "酸枣仁": 0.93, "柏子仁": 0.91, "莲子": 0.96,
    "五味子": 0.90, "山茱萸": 0.92,
    "山楂": 0.93, "荷叶": 0.94, "决明子": 0.92,
    "黑芝麻": 0.96, "桑葚": 0.95,
}

# 成本系数 (元/克)
_COST_PER_GRAM = {
    "黄芪": 0.08, "人参": 0.50, "党参": 0.12, "山药": 0.05,
    "白术": 0.10, "甘草": 0.05, "大枣": 0.03,
    "当归": 0.18, "龙眼肉": 0.15,
    "金银花": 0.15, "菊花": 0.10, "蒲公英": 0.08, "连翘": 0.12,
    "鱼腥草": 0.06,
    "茯苓": 0.06, "薏苡仁": 0.04,
    "丹参": 0.12, "三七": 0.25, "川芎": 0.10,
    "陈皮": 0.08, "砂仁": 0.20,
    "薄荷": 0.06, "生姜": 0.02, "紫苏": 0.05,
    "枸杞子": 0.15, "麦冬": 0.12, "玉竹": 0.10,
    "百合": 0.15, "黄精": 0.18,
    "酸枣仁": 0.25, "柏子仁": 0.12, "莲子": 0.06,
    "五味子": 0.20, "山茱萸": 0.08,
    "山楂": 0.04, "荷叶": 0.05, "决明子": 0.03,
    "黑芝麻": 0.06, "桑葚": 0.08,
}


async def enrich_herb_knowledge(db: AsyncSession) -> dict[str, int]:
    """
    为 TCMHerb 表填充结构化知识数据

    Returns:
        统计信息 {inserted: int, updated: int, skipped: int}
    """
    stats = {"inserted": 0, "updated": 0, "skipped": 0}

    # 获取所有药材
    result = await db.execute(select(TCMHerb))
    herbs = result.scalars().all()

    logger.info(f"找到 {len(herbs)} 条药材记录，开始填充知识数据...")

    for herb in herbs:
        if not herb.name_cn:
            continue

        # 检查是否已有 extra_knowledge
        has_knowledge = False
        if herb.extra_knowledge:
            try:
                existing = json.loads(herb.extra_knowledge)
                if existing.get("efficacy_scores"):
                    has_knowledge = True
            except (json.JSONDecodeError, TypeError):
                pass

        if has_knowledge:
            stats["skipped"] += 1
            continue

        # 构建知识数据
        herb_id = _get_herb_id(herb.name_cn)
        efficacy_scores = _EFFICACY_SCORES.get(herb.name_cn, {})
        dosage_min, dosage_max = _DOSAGE_RANGES.get(herb.name_cn, (3, 15))
        safety_index = _SAFETY_INDEX.get(herb.name_cn, 0.90)
        cost_per_gram = _COST_PER_GRAM.get(herb.name_cn, 0.10)

        # 确定协同配伍
        synergy_partners = _get_synergy_partners(herb.name_cn, efficacy_scores)

        # 确定禁忌配伍
        antagonistic_pairs = _get_antagonistic_pairs(herb.name_cn)

        # 构建 extra_knowledge JSON
        extra_knowledge = {
            "herb_id": herb_id,
            "efficacy_scores": efficacy_scores,
            "dosage_min": dosage_min,
            "dosage_max": dosage_max,
            "dosage_step": 1.0,
            "safety_index": safety_index,
            "cost_per_gram": cost_per_gram,
            "synergy_partners": synergy_partners,
            "antagonistic_pairs": antagonistic_pairs,
            "source": "recipe_generation_data_completer",
            "enriched_at": asyncio.get_event_loop().time() if 'asyncio' in globals() else None,
        }

        # 更新记录
        await db.execute(
            update(TCMHerb)
            .where(TCMHerb.id == herb.id)
            .values(extra_knowledge=json.dumps(extra_knowledge, ensure_ascii=False))
        )

        if efficacy_scores:
            stats["updated"] += 1
            logger.debug(f"✓ {herb.name_cn}: 功效评分 {len(efficacy_scores)} 项, herb_id={herb_id}")
        else:
            stats["skipped"] += 1
            logger.warning(f"⚠ {herb.name_cn}: 无功效评分数据")

    await db.commit()
    logger.info(f"填充完成: 新增 {stats['inserted']}, 更新 {stats['updated']}, 跳过 {stats['skipped']}")
    return stats


def _get_herb_id(name_cn: str) -> str:
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
        "酸枣仁": "szr", "柏子仁": "bzr",
    }
    return name_to_id.get(name_cn, name_cn[:2].lower())


def _get_synergy_partners(name_cn: str, efficacy_scores: dict) -> list[str]:
    """根据功效获取协同配伍药材"""
    synergies = {
        "黄芪": ["党参", "白术", "茯苓"],
        "人参": ["黄芪", "山药", "甘草"],
        "党参": ["黄芪", "白术", "茯苓"],
        "当归": ["黄芪", "熟地", "川芎"],
        "枸杞子": ["菊花", "红枣", "山药"],
        "丹参": ["三七", "山楂", "红花"],
        "金银花": ["连翘", "菊花", "薄荷"],
        "茯苓": ["白术", "薏苡仁", "甘草"],
        "甘草": ["黄芪", "人参", "白术"],
    }
    return synergies.get(name_cn, [])


def _get_antagonistic_pairs(name_cn: str) -> list[str]:
    """获取禁忌配伍药材"""
    antagonisms = {
        "人参": ["藜芦", "五灵脂"],
        "甘草": ["海藻", "甘遂", "大戟", "芫花"],
        "半夏": ["乌头"],
        "白芍": ["藜芦"],
    }
    return antagonisms.get(name_cn, [])


async def verify_data_completeness(db: AsyncSession) -> dict[str, Any]:
    """验证数据完整性"""

    # 统计总数
    total = (await db.execute(select(func.count()).select_from(TCMHerb))).scalar() or 0

    # 统计有 extra_knowledge 的数量
    with_knowledge = (await db.execute(
        select(func.count())
        .select_from(TCMHerb)
        .where(TCMHerb.extra_knowledge.is_not(None))
        .where(TCMHerb.extra_knowledge != '')
    )).scalar() or 0

    # 统计药食同源数量
    food_homology = (await db.execute(
        select(func.count())
        .select_from(TCMHerb)
        .where(TCMHerb.is_food_homology.is_(True))
    )).scalar() or 0

    # 验证 extra_knowledge 格式
    result = await db.execute(select(TCMHerb).limit(10))
    herbs = result.scalars().all()

    valid_knowledge = 0
    invalid_knowledge = 0

    for herb in herbs:
        if herb.extra_knowledge:
            try:
                data = json.loads(herb.extra_knowledge)
                if data.get("efficacy_scores"):
                    valid_knowledge += 1
                else:
                    invalid_knowledge += 1
            except json.JSONDecodeError:
                invalid_knowledge += 1
        else:
            invalid_knowledge += 1

    return {
        "total_herbs": total,
        "with_extra_knowledge": with_knowledge,
        "food_homology_count": food_homology,
        "knowledge_coverage_rate": f"{with_knowledge/total*100:.1f}%" if total > 0 else "0%",
        "valid_knowledge_samples": valid_knowledge,
        "invalid_knowledge_samples": invalid_knowledge,
    }


async def main():
    """主入口"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    logger.info("=" * 60)
    logger.info("配方生成数据完整性补全")
    logger.info("=" * 60)

    async with async_session_factory() as db:
        # 1. 验证当前状态
        logger.info("\n[1] 验证当前数据状态...")
        initial_stats = await verify_data_completeness(db)
        logger.info(f"  总药材数: {initial_stats['total_herbs']}")
        logger.info(f"  有知识数据: {initial_stats['with_extra_knowledge']}")
        logger.info(f"  覆盖率: {initial_stats['knowledge_coverage_rate']}")

        # 2. 填充缺失的数据
        logger.info("\n[2] 开始填充知识数据...")
        enrich_stats = await enrich_herb_knowledge(db)
        logger.info(f"  更新: {enrich_stats['updated']}")
        logger.info(f"  跳过: {enrich_stats['skipped']}")

        # 3. 验证最终状态
        logger.info("\n[3] 验证最终数据状态...")
        final_stats = await verify_data_completeness(db)
        logger.info(f"  总药材数: {final_stats['total_herbs']}")
        logger.info(f"  有知识数据: {final_stats['with_extra_knowledge']}")
        logger.info(f"  覆盖率: {final_stats['knowledge_coverage_rate']}")

        # 4. 抽样验证
        logger.info("\n[4] 抽样验证数据质量...")
        result = await db.execute(
            select(TCMHerb)
            .where(TCMHerb.extra_knowledge.is_not(None))
            .limit(5)
        )
        sample_herbs = result.scalars().all()

        for herb in sample_herbs:
            try:
                data = json.loads(herb.extra_knowledge)
                logger.info(f"  ✓ {herb.name_cn}:")
                logger.info(f"    herb_id: {data.get('herb_id')}")
                logger.info(f"    功效数: {len(data.get('efficacy_scores', {}))}")
                logger.info(f"    剂量: {data.get('dosage_min')}-{data.get('dosage_max')}g")
                logger.info(f"    安全性: {data.get('safety_index')}")
                logger.info(f"    协同: {data.get('synergy_partners')}")
            except Exception as e:
                logger.error(f"  ✗ {herb.name_cn}: 解析失败 - {e}")

    logger.info("\n" + "=" * 60)
    logger.info("数据补全完成!")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
