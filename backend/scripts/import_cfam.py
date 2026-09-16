"""Import CFAM data into hf_enriched_herbs table."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import asyncpg

CFAM_JSON = Path(__file__).parent.parent.parent / "data" / "CFAM" / "cfam_merged.json"

# NATURE_FLAVOR_DB - from build_cfam_data.py
NATURE_FLAVOR_DB = {
    "丁香": {"nature": "温", "flavor": "辛"},
    "八角茴香": {"nature": "温", "flavor": "辛"},
    "刀豆": {"nature": "平", "flavor": "甘"},
    "小茴香": {"nature": "温", "flavor": "辛"},
    "小蓟": {"nature": "凉", "flavor": "甘"},
    "山药": {"nature": "平", "flavor": "甘"},
    "山楂": {"nature": "微温", "flavor": "酸、甘"},
    "马齿苋": {"nature": "寒", "flavor": "酸"},
    "乌梢蛇": {"nature": "平", "flavor": "甘"},
    "乌梅": {"nature": "平", "flavor": "酸、涩"},
    "木瓜": {"nature": "温", "flavor": "酸"},
    "火麻仁": {"nature": "平", "flavor": "甘"},
    "代代花": {"nature": "平", "flavor": "甘"},
    "玉竹": {"nature": "微寒", "flavor": "甘"},
    "甘草": {"nature": "平", "flavor": "甘"},
    "白芷": {"nature": "温", "flavor": "辛"},
    "白果": {"nature": "平", "flavor": "甘、苦"},
    "白扁豆": {"nature": "微温", "flavor": "甘"},
    "白扁豆花": {"nature": "平", "flavor": "甘"},
    "龙眼肉（桂圆）": {"nature": "温", "flavor": "甘"},
    "决明子": {"nature": "微寒", "flavor": "甘、苦"},
    "百合": {"nature": "微寒", "flavor": "甘"},
    "肉豆蔻": {"nature": "温", "flavor": "辛"},
    "肉桂": {"nature": "热", "flavor": "辛、甘"},
    "余甘子": {"nature": "甘、涩", "flavor": "凉"},
    "佛手": {"nature": "辛、苦、酸", "flavor": "温"},
    "杏仁（甜、苦）": {"nature": "微温", "flavor": "苦"},
    "沙棘": {"nature": "温", "flavor": "酸、涩"},
    "牡蛎": {"nature": "微寒", "flavor": "咸"},
    "芡实": {"nature": "平", "flavor": "甘、涩"},
    "花椒": {"nature": "热", "flavor": "辛"},
    "赤小豆": {"nature": "平", "flavor": "甘、酸"},
    "阿胶": {"nature": "平", "flavor": "甘"},
    "鸡内金": {"nature": "平", "flavor": "甘"},
    "麦芽": {"nature": "平", "flavor": "甘"},
    "昆布": {"nature": "寒", "flavor": "咸"},
    "枣（大枣、酸枣、黑枣）": {"nature": "温", "flavor": "甘"},
    "罗汉果": {"nature": "凉", "flavor": "甘"},
    "郁李仁": {"nature": "平", "flavor": "辛、苦"},
    "金银花": {"nature": "寒", "flavor": "甘"},
    "青果": {"nature": "平", "flavor": "酸、甘"},
    "鱼腥草": {"nature": "微寒", "flavor": "辛"},
    "姜（生姜、干姜）": {"nature": "温", "flavor": "辛"},
    "枳椇子": {"nature": "平", "flavor": "甘"},
    "枸杞子": {"nature": "平", "flavor": "甘"},
    "栀子": {"nature": "寒", "flavor": "苦"},
    "砂仁": {"nature": "温", "flavor": "辛"},
    "胖大海": {"nature": "凉", "flavor": "甘"},
    "茯苓": {"nature": "平", "flavor": "甘、淡"},
    "香橼": {"nature": "辛、苦、酸", "flavor": "温"},
    "香薷": {"nature": "微温", "flavor": "辛"},
    "桃仁": {"nature": "平", "flavor": "苦"},
    "桑叶": {"nature": "寒", "flavor": "甘、苦"},
    "桑椹": {"nature": "寒", "flavor": "甘、酸"},
    "桔红": {"nature": "温", "flavor": "辛、苦"},
    "桔梗": {"nature": "平", "flavor": "苦"},
    "益智仁": {"nature": "温", "flavor": "辛"},
    "荷叶": {"nature": "平", "flavor": "苦"},
    "莱菔子": {"nature": "平", "flavor": "辛、甘"},
    "莲子": {"nature": "平", "flavor": "甘、涩"},
    "高良姜": {"nature": "热", "flavor": "辛"},
    "淡竹叶": {"nature": "寒", "flavor": "甘、淡"},
    "淡豆豉": {"nature": "寒", "flavor": "辛、甘"},
    "菊花": {"nature": "微寒", "flavor": "甘、苦"},
    "菊苣": {"nature": "寒", "flavor": "苦"},
    "黄芥子": {"nature": "温", "flavor": "辛"},
    "黄精": {"nature": "平", "flavor": "甘"},
    "紫苏": {"nature": "温", "flavor": "辛"},
    "紫苏籽": {"nature": "温", "flavor": "辛"},
    "葛根": {"nature": "凉", "flavor": "甘、辛"},
    "黑芝麻": {"nature": "平", "flavor": "甘"},
    "黑胡椒": {"nature": "热", "flavor": "辛"},
    "槐米": {"nature": "微寒", "flavor": "苦"},
    "槐花": {"nature": "微寒", "flavor": "苦"},
    "蒲公英": {"nature": "寒", "flavor": "苦、甘"},
    "蜂蜜": {"nature": "平", "flavor": "甘"},
    "榧子": {"nature": "平", "flavor": "甘"},
    "酸枣仁": {"nature": "平", "flavor": "甘、酸"},
    "鲜白茅根": {"nature": "寒", "flavor": "甘"},
    "鲜芦根": {"nature": "寒", "flavor": "甘"},
    "蝮蛇": {"nature": "温", "flavor": "甘"},
    "橘皮": {"nature": "温", "flavor": "辛、苦"},
    "薄荷": {"nature": "凉", "flavor": "辛"},
    "薏苡仁": {"nature": "凉", "flavor": "甘、淡"},
    "薤白": {"nature": "温", "flavor": "辛、苦"},
    "覆盆子": {"nature": "温", "flavor": "甘、酸"},
    "藿香": {"nature": "微温", "flavor": "辛"},
    # 2019年第8号（仅香辛料）
    "当归": {"nature": "温", "flavor": "辛、甘"},
    "山柰": {"nature": "温", "flavor": "辛"},
    "西红花": {"nature": "平", "flavor": "甘"},
    "草果": {"nature": "温", "flavor": "辛"},
    "姜黄": {"nature": "温", "flavor": "辛"},
    "荜茇": {"nature": "热", "flavor": "辛"},
    # 2023年第9号
    "党参": {"nature": "平", "flavor": "甘"},
    "肉苁蓉（荒漠）": {"nature": "温", "flavor": "甘、咸"},
    "铁皮石斛": {"nature": "微寒", "flavor": "甘"},
    "西洋参": {"nature": "凉", "flavor": "甘、微苦"},
    "黄芪": {"nature": "微温", "flavor": "甘"},
    "灵芝": {"nature": "平", "flavor": "甘"},
    "山茱萸": {"nature": "微温", "flavor": "酸、涩"},
    "天麻": {"nature": "平", "flavor": "甘"},
    "杜仲叶": {"nature": "温", "flavor": "甘"},
    # 2024年第4号
    "地黄": {"nature": "寒", "flavor": "甘"},
    "麦冬": {"nature": "微寒", "flavor": "甘、微苦"},
    "天冬": {"nature": "寒", "flavor": "甘、苦"},
    "化橘红": {"nature": "温", "flavor": "辛、苦"},
}

ANNOUNCEMENT_MAP = {
    "ann_2002_51": "卫法监发[2002]51号",
    "ann_2019_8": "卫健委公告2019年第8号",
    "ann_2023_9": "卫健委公告2023年第9号",
    "ann_2024_4": "卫健委公告2024年第4号",
}

SPECIAL_NOTICE = "建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用"
USAGE_RESTRICTION = "仅作为香辛料和调味品使用"


async def main():
    conn = await asyncpg.connect("postgresql://postgres:password@localhost:5432/rmfood")

    with open(CFAM_JSON, "r", encoding="utf-8") as f:
        cfam = json.load(f)

    updated = 0
    inserted = 0

    for herb in cfam.get("all_herbs", []):
        name = herb["name"].strip()
        ann_id = herb["announcement_id"]
        source = ANNOUNCEMENT_MAP.get(ann_id, "")
        nf = NATURE_FLAVOR_DB.get(name, {})

        # Check if exists
        existing = await conn.fetchval(
            "SELECT id FROM hf_enriched_herbs WHERE name_cn = $1", name
        )

        if existing:
            usage_restriction = herb.get("usage_restriction")
            special_notice = herb.get("special_notice")
            restrictions_arr = [usage_restriction] if usage_restriction else []
            await conn.execute(
                """
                UPDATE hf_enriched_herbs SET
                    source_version = $1::TEXT,
                    nature_cn = COALESCE(NULLIF($2::TEXT, ''), nature_cn),
                    flavor_cn = COALESCE(NULLIF($3::TEXT, ''), flavor_cn),
                    restrictions = $4::TEXT[],
                    notes = CASE WHEN $5::TEXT IS NOT NULL THEN COALESCE(notes, '') || E'\n\n' || $5::TEXT ELSE notes END,
                    updated_at = NOW()
                WHERE id = $6
                """,
                source,
                nf.get("nature", ""),
                nf.get("flavor", ""),
                restrictions_arr,
                special_notice or "",
                existing,
            )
            updated += 1
        else:
            await conn.execute(
                """
                INSERT INTO hf_enriched_herbs
                    (name_cn, source_version, nature_cn, flavor_cn, is_food_homology, data_quality_score, synced_at, created_at, updated_at)
                VALUES ($1, $2, $3, $4, true, 1.0, NOW(), NOW(), NOW())
                """,
                name,
                source,
                nf.get("nature", ""),
                nf.get("flavor", ""),
            )
            inserted += 1

    await conn.close()
    print(f"Done: {inserted} inserted, {updated} updated")


if __name__ == "__main__":
    asyncio.run(main())
