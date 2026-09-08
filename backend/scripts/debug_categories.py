from scripts.db_utils import get_asyncpg_dsn
"""Debug: 查询非标准分类记录"""
import asyncio
import asyncpg

CATEGORY_NORMALIZATION_MAP = {
    "清热平肝药": "解表药",
    "补肾/润肠": "补阳药",
    "补虚/润下": "补气药",
    "温经止血药": "止血药",
    "清热生津": "清热泻火药",
    "清热化痰": "化痰止咳平喘药",
    "清肺化痰": "化痰止咳平喘药",
    "消痰软坚": "化痰止咳平喘药",
    "坠痰下气": "化痰止咳平喘药",
    "化痰止呕": "化痰止咳平喘药",
    "止咳平喘药": "化痰止咳平喘药",
    "泻肺平喘": "化痰止咳平喘药",
    "泻肺行水": "利水渗湿药",
    "利尿通淋": "利水渗湿药",
    "利湿去浊": "利水渗湿药",
    "利湿退黄": "利水渗湿药",
    "利水消肿": "利水渗湿药",
    "利水消肿/解酒": "利水渗湿药",
    "攻下药": "泻下药",
    "润下药": "泻下药",
    "峻下逐水药": "泻下药",
    "清热燥湿药": "清热解毒药",
    "清热泻火药": "清热解毒药",
    "清热凉血药": "清热解毒药",
    "清虚热药": "清热解毒药",
    "清热明目药": "清热解毒药",
    "活血调经": "活血化瘀药",
    "活血疗伤": "活血化瘀药",
    "消肿排脓": "清热解毒药",
    "活血通经/下乳": "活血化瘀药",
    "祛风药": "祛风湿药",
    "攻毒杀虫": "驱虫药",
    "驱虫药/外用": "驱虫药",
    "收涩药/清热": "收涩药",
}

def normalize_category(cat):
    if not cat:
        return "未分类"
    current = cat
    visited = set()
    for _ in range(10):
        if current in visited:
            break
        visited.add(current)
        if current in CATEGORY_NORMALIZATION_MAP:
            current = CATEGORY_NORMALIZATION_MAP[current]
        else:
            break
    return current

async def main():
    conn = await asyncpg.connect(get_asyncpg_dsn())

    rows = await conn.fetch("""
        SELECT id, name_cn, category FROM tcm_herbs ORDER BY id
    """)

    non_standard = []
    for r in rows:
        cat = r["category"]
        norm = normalize_category(cat)
        if cat != norm:
            non_standard.append({
                "id": r["id"], "name": r["name_cn"],
                "original": cat, "normalized": norm
            })

    print(f"需要归一化的记录: {len(non_standard)}")
    for ns in non_standard:
        print(f'  [{ns["id"]}] {ns["name"]}: "{ns["original"]}" -> "{ns["normalized"]}"')

    # Also check what categories are actually in DB
    cat_counts = await conn.fetch("""
        SELECT category, COUNT(*) as cnt FROM tcm_herbs 
        GROUP BY category ORDER BY cnt DESC
    """)
    print(f"\n实际分类数: {len(cat_counts)}")
    for c in cat_counts:
        marker = " ⚠️非标" if c["category"] in CATEGORY_NORMALIZATION_MAP else ""
        print(f'  {c["category"]:20s} ({c["cnt"]:3d}){marker}')

    await conn.close()

asyncio.run(main())
