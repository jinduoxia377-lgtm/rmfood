"""
TCMHerb 药材数据增强种子脚本

将 knowledge_base.py 中的药效评分、剂量、安全性等结构化数据
写入 TCMHerb 表的 extra_knowledge JSON 字段，
使 TCMSPHerbKnowledgeAdapter 能正确解析为 HerbProfile。

用法:
    python -m app.services.enrich_herb_knowledge
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Dict

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import async_session_factory
from app.models.external_data import TCMHerb

logger = logging.getLogger(__name__)

# ── 药效评分映射（基于 knowledge_base.py effects → _EFFICACY_TO_HERBS 后端键）──
# 采用双层策略：优先从 _BUILTIN_HERBS 直接读取已知评分，其次用效果文本映射兜底
_EFFICACY_TEXT_TO_KEYS: Dict[str, Dict[str, float]] = {
    "补气": {"补气": 0.90, "免疫调节": 0.75},
    "补气升阳": {"补气": 0.92, "免疫调节": 0.80},
    "补中益气": {"补气": 0.85, "消化系统": 0.70},
    "大补元气": {"抗疲劳": 0.95, "免疫调节": 0.90, "补气": 0.92},
    "益气健脾": {"健脾": 0.85, "补气": 0.80},
    "益气养阴": {"补气": 0.75, "养阴": 0.70},
    "补脾益气": {"健脾": 0.82, "补气": 0.78},
    "健脾益气": {"健脾": 0.85, "补气": 0.80},
    "健脾": {"健脾": 0.85, "消化系统": 0.75},
    "健脾和胃": {"健脾": 0.82, "消化系统": 0.78},
    "健脾止泻": {"消化系统": 0.85},
    "健脾渗湿": {"健脾": 0.75, "利尿": 0.70},
    "健脾燥湿": {"健脾": 0.80, "消化系统": 0.70},
    "健脾养胃": {"健脾": 0.80, "消化系统": 0.75},
    "滋补肝肾": {"免疫调节": 0.75, "抗氧化": 0.80, "补肾": 0.70},
    "益精明目": {"明目": 0.85, "抗氧化": 0.70},
    "补肾益精": {"补肾": 0.85, "抗衰老": 0.70},
    "补肾壮阳": {"补肾": 0.90},
    "补肾温肺": {"补肾": 0.85, "润肺": 0.70},
    "补肾": {"补肾": 0.85},
    "益肾固精": {"补肾": 0.82},
    "补肝肾": {"补肾": 0.80, "养血": 0.70},
    "补脾益肺": {"补气": 0.85, "免疫调节": 0.75},
    "补脾止泻": {"消化系统": 0.82},
    "补脾肺肾": {"健脾": 0.75, "补气": 0.70, "补肾": 0.65},
    "补益心脾": {"安神": 0.75, "补气": 0.70},
    "补血": {"补血": 0.85},
    "补血活血": {"补血": 0.88, "活血": 0.75},
    "补血滋阴": {"补血": 0.82, "养阴": 0.75},
    "滋阴补血": {"补血": 0.85, "养阴": 0.78},
    "养血安神": {"安神": 0.75, "补血": 0.80},
    "养血": {"补血": 0.82},
    "活血": {"活血": 0.88},
    "活血化瘀": {"活血": 0.88, "止痛": 0.75},
    "活血调经": {"活血": 0.88, "补血": 0.82},
    "行气散瘀": {"活血": 0.82, "降脂": 0.68},
    "活血行气": {"活血": 0.85},
    "通经止痛": {"活血": 0.80, "止痛": 0.72},
    "散瘀止血": {"活血": 0.80, "止血": 0.75},
    "凉血止血": {"清热": 0.75, "止血": 0.70},
    "疏散风热": {"清热解毒": 0.80, "抗炎": 0.70},
    "清热解毒": {"清热解毒": 0.92, "抗炎": 0.85},
    "清热利尿": {"利尿": 0.80, "清热解毒": 0.70},
    "清热平肝": {"降血压": 0.82},
    "清热明目": {"明目": 0.75},
    "清热排脓": {"清热解毒": 0.75},
    "清热": {"清热": 0.80},
    "解肌退热": {"清热解毒": 0.70},
    "解表散寒": {"温中": 0.75},
    "平肝息风": {"降血压": 0.85},
    "平肝潜阳": {"降血压": 0.82},
    "息风定惊": {"降血压": 0.80},
    "降血糖": {"降血糖": 0.85},
    "降糖": {"降血糖": 0.80},
    "降脂减肥": {"降脂": 0.85},
    "降脂": {"降脂": 0.88},
    "降脂降压": {"降脂": 0.82, "降血压": 0.75},
    "降脂降血压": {"降脂": 0.82, "降血压": 0.75},
    "降血压": {"降血压": 0.82, "心血管保护": 0.70},
    "降压": {"降血压": 0.80},
    "利水消肿": {"利尿": 0.85, "免疫调节": 0.60},
    "利尿": {"利尿": 0.85},
    "燥湿利水": {"利尿": 0.75, "祛湿": 0.70},
    "祛湿": {"祛湿": 0.75},
    "安神": {"安神": 0.80},
    "养心安神": {"安神": 0.80},
    "宁心安神": {"安神": 0.75},
    "清心除烦": {"安神": 0.72},
    "止咳化痰": {"止咳化痰": 0.82},
    "祛痰止咳": {"止咳化痰": 0.82},
    "宣肺祛痰": {"止咳化痰": 0.80},
    "镇咳祛痰": {"止咳化痰": 0.82},
    "润肺止咳": {"止咳化痰": 0.80, "润肺": 0.75},
    "润肺": {"润肺": 0.82},
    "润肺养阴": {"润肺": 0.82, "养阴": 0.78},
    "清肺润燥": {"润肺": 0.80},
    "养阴润燥": {"养阴": 0.80},
    "生津止渴": {"补气": 0.65},
    "生津润燥": {"养阴": 0.75},
    "益胃生津": {"养阴": 0.78},
    "生津": {"养阴": 0.70},
    "理气": {"理气": 0.80},
    "理气宽中": {"理气": 0.80, "健脾": 0.70},
    "理气和中": {"理气": 0.75, "健脾": 0.65},
    "疏肝解郁": {"理气": 0.80, "安神": 0.65},
    "破气消积": {"理气": 0.80},
    "下气除满": {"理气": 0.75},
    "消食化积": {"消化系统": 0.85, "降脂": 0.70},
    "消食导滞": {"消化系统": 0.85},
    "温中止呕": {"止呕": 0.82, "温中": 0.75},
    "降逆止呕": {"止呕": 0.80},
    "温阳散寒": {"温阳": 0.80},
    "散寒温经": {"温中": 0.80},
    "温肺": {"润肺": 0.70},
    "止痛": {"止痛": 0.80},
    "通络止痛": {"活血": 0.75, "止痛": 0.70},
    "调经止痛": {"活血": 0.78, "止痛": 0.72},
    "缓中止痛": {"止痛": 0.75},
    "祛风止痛": {"止痛": 0.70, "祛风": 0.65},
    "抗肿瘤": {"抗肿瘤": 0.75},
    "延缓衰老": {"抗衰老": 0.85, "抗氧化": 0.80},
    "抗衰老": {"抗衰老": 0.85},
    "美容养颜": {"美容养颜": 0.80},
    "美容": {"美容养颜": 0.75},
    "明目": {"明目": 0.85},
    "清肝明目": {"明目": 0.80, "清热": 0.70},
    "乌发明目": {"明目": 0.75, "补肾": 0.70},
    "安神益智": {"安神": 0.80, "认知功能": 0.75},
    "益智": {"认知功能": 0.75},
    "调和诸药": {"调和诸药": 0.85},
    "缓和药性": {"调和诸药": 0.85},
    "收敛固涩": {"固涩": 0.70},
    "杀虫止痒": {"杀虫": 0.75},
    "抗炎": {"抗炎": 0.85},
    "通络": {"活血": 0.70},
    "通经": {"活血": 0.70},
    "祛风通络": {"活血": 0.70},
    "清暑利湿": {"利尿": 0.70, "祛湿": 0.65},
    "养阴生津": {"养阴": 0.80, "润肺": 0.70},
    "润肺清热": {"润肺": 0.75, "清热解毒": 0.70},
    "理气健脾": {"理气": 0.80, "健脾": 0.75},
    "理气燥湿": {"理气": 0.82, "化痰": 0.75},
    "燥湿化痰": {"化痰": 0.85, "理气": 0.70},
    "温中散寒": {"温中": 0.80},
    "清热凉血": {"清热": 0.82, "活血": 0.70},
    "清热燥湿": {"清热": 0.80, "消化": 0.65},
}

# ── 功效→药材安全指数基准（基于毒性数据）──
_SAFETY_BASE: Dict[str, float] = {
    "附子": 0.40, "藜芦": 0.30, "马利兰": 0.25,  # 毒性药材
    "半夏": 0.75, "厚朴": 0.80, "枳实": 0.80,     # 中等毒性
    "人参": 0.85, "三七": 0.82, "川芎": 0.88,     # 较常用
    "当归": 0.92, "黄芪": 0.95, "枸杞子": 0.98,   # 药食同源
    "茯苓": 0.97, "甘草": 0.92, "大枣": 0.98,
    "生姜": 0.96, "山楂": 0.94, "菊花": 0.96,
}


def _parse_dosage(dosage_str: str) -> tuple[float, float]:
    """解析 '6-15g' → (6.0, 15.0)"""
    if not dosage_str:
        return (3.0, 15.0)
    m = re.search(r"(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)", dosage_str)
    if m:
        return float(m.group(1)), float(m.group(2))
    m2 = re.search(r"(\d+\.?\d*)", dosage_str)
    if m2:
        v = float(m2.group(1))
        return v, v * 2
    return (3.0, 15.0)


def _build_extra_knowledge(info: dict, name_cn: str) -> dict:
    """从 knowledge_base 条目构建 extra_knowledge JSON"""
    herb_id_map = {
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
    herb_id = herb_id_map.get(name_cn, name_cn[:3])
    min_d, max_d = _parse_dosage(info.get("dosage", ""))
    safety = _SAFETY_BASE.get(name_cn, 0.90)

    # 构建功效评分：先查 _BUILTIN_HERBS 获取精确评分，再叠加文本映射兜底
    effects = info.get("effects", [])
    from app.services.ai.algorithms.genetic_formula_optimizer import _BUILTIN_HERBS
    efficacy_scores: Dict[str, float] = {}
    # 直接从 _BUILTIN_HERBS 获取已知评分（最高优先级）
    builtin_herb = next((h for h in _BUILTIN_HERBS.values() if h.name_cn == name_cn), None)
    if builtin_herb and builtin_herb.efficacy_scores:
        efficacy_scores.update(builtin_herb.efficacy_scores)
    # 文本映射兜底
    for eff in effects:
        mapped = _EFFICACY_TEXT_TO_KEYS.get(eff, {})
        efficacy_scores.update(mapped)
    # 若无匹配，给予通用评分
    if not efficacy_scores:
        efficacy_scores = {"免疫调节": 0.50}

    # 配对关系
    pairing_raw = info.get("pairing", [])
    pairing_ids = []
    for partner_name, _ in pairing_raw:
        pid = herb_id_map.get(partner_name)
        if pid:
            pairing_ids.append(pid)

    # 禁忌
    contraindication = info.get("contraindication", "")
    taboos = []
    if "孕妇" in contraindication or "妊娠" in contraindication:
        taboos = ["cs", "dg", "fz", "mld", "lk"]
    elif "儿童" in contraindication or "小儿" in contraindication:
        taboos = ["fz", "lk", "mld"]
    elif "年老" in contraindication or "体虚" in contraindication:
        taboos = ["rs"]

    return {
        "herb_id": herb_id,
        "dosage_min": min_d,
        "dosage_max": max_d,
        "dosage_step": 1.0 if max_d - min_d >= 5 else 0.5,
        "safety_index": safety,
        "cost_per_gram": round(safety * 0.15 + 0.02, 3),
        "synergy_partners": pairing_ids,
        "antagonistic_pairs": taboos,
        "efficacy_scores": efficacy_scores,
        "effects_detailed": effects,
        "chemicals_detailed": info.get("chemicals", []),
    }


async def enrich_herb_knowledge(db: AsyncSession) -> dict:
    """为 TCMHerb 表写入结构化 extra_knowledge"""
    from app.services.knowledge_base import HERB_KNOWLEDGE_BASE

    stats = {"updated": 0, "skipped": 0, "total": len(HERB_KNOWLEDGE_BASE)}

    stmt = select(TCMHerb)
    result = await db.execute(stmt)
    herbs = result.scalars().all()

    for herb in herbs:
        info = HERB_KNOWLEDGE_BASE.get(herb.name_cn)
        if not info:
            stats["skipped"] += 1
            continue

        extra = _build_extra_knowledge(info, herb.name_cn)

        # 合并已有数据
        existing_extra: dict = {}
        if herb.extra_knowledge:
            try:
                existing_extra = json.loads(herb.extra_knowledge)
            except (json.JSONDecodeError, TypeError):
                pass
        existing_extra.update(extra)

        await db.execute(
            update(TCMHerb)
            .where(TCMHerb.id == herb.id)
            .values(extra_knowledge=json.dumps(existing_extra, ensure_ascii=False))
        )
        stats["updated"] += 1
        logger.info(f"[Enrich] {herb.name_cn} → herb_id={extra['herb_id']}, "
                     f"dosage=[{extra['dosage_min']},{extra['dosage_max']}], "
                     f"safety={extra['safety_index']}, synergies={extra['synergy_partners']}")

    await db.commit()
    return stats


async def main():
    logging.basicConfig(level=logging.INFO)
    async with async_session_factory() as db:
        stats = await enrich_herb_knowledge(db)
    logger.info(f"\n{'='*50}")
    logger.info(f"药材知识增强完成: {stats}")
    logger.info(f"{'='*50}")


if __name__ == "__main__":
    asyncio.run(main())
