"""验证数据库数据是否与金标数据一致"""
import sys
sys.path.insert(0, '.')

import asyncio
import asyncpg

async def verify():
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='rmfood',
        password='rmfood_secure_password_123',
        database='rmfood_db'
    )

    print("=" * 70)
    print("  数据库 vs 金标数据 一致性验证")
    print("=" * 70)

    # 1. 总记录数
    total = await conn.fetchval('SELECT COUNT(*) FROM tcm_herbs')
    print(f'\n[1] 总记录数: {total}')

    # 2. 分类统计
    rows = await conn.fetch('''
        SELECT category, COUNT(*) as cnt
        FROM tcm_herbs
        GROUP BY category
        ORDER BY cnt DESC
    ''')
    print(f'\n[2] 分类统计 ({len(rows)} 类):')
    for row in rows:
        print(f'  {row["category"]}: {row["cnt"]}')

    # 3. 药食同源
    food = await conn.fetchrow('''
        SELECT
            COUNT(*) FILTER (WHERE is_food_homology = TRUE) as food_true,
            COUNT(*) FILTER (WHERE is_food_homology = FALSE) as food_false
        FROM tcm_herbs
    ''')
    print(f'\n[3] 药食同源: 是={food["food_true"]}, 否={food["food_false"]}')

    # 4. TCMSP ID
    tcmsp = await conn.fetchrow('''
        SELECT
            COUNT(*) FILTER (WHERE tcmsp_id IS NOT NULL AND tcmsp_id != '') as tcmsp_count,
            MIN(tcmsp_id) as min_id,
            MAX(tcmsp_id) as max_id
        FROM tcm_herbs
    ''')
    print(f'\n[4] TCMSP ID: 已分配={tcmsp["tcmsp_count"]}, 范围={tcmsp["min_id"]} ~ {tcmsp["max_id"]}')

    # 5. 拉丁名
    latin = await conn.fetchrow('''
        SELECT
            COUNT(*) FILTER (WHERE name_latin IS NOT NULL AND name_latin != '') as latin_count,
            COUNT(*) FILTER (WHERE name_latin IS NULL OR name_latin = '') as null_latin
        FROM tcm_herbs
    ''')
    print(f'\n[5] 拉丁名: 有={latin["latin_count"]}, 无={latin["null_latin"]}')

    # 6. 来源版本
    versions = await conn.fetch('SELECT source_version, COUNT(*) as cnt FROM tcm_herbs GROUP BY source_version')
    print(f'\n[6] 数据版本:')
    for row in versions:
        print(f'  {row["source_version"]}: {row["cnt"]}')

    # 7. 示例数据
    rows = await conn.fetch('''
        SELECT name_cn, name_latin, category, ob_percent, dl_value, is_food_homology, tcmsp_id
        FROM tcm_herbs
        WHERE name_cn IN ('人参', '黄芪', '党参', '山药', '甘草')
        ORDER BY name_cn
    ''')
    print(f'\n[7] 示例数据:')
    print(f'  {"中文名":<6} {"拉丁名":<40} {"分类":<10} {"OB":<6} {"DL":<6} {"药食同源":<6} {"TCMSP ID"}')
    print(f'  {"-"*100}')
    for row in rows:
        food_str = '是' if row['is_food_homology'] else '否'
        print(f'  {row["name_cn"]:<6} {row["name_latin"][:38]:<40} {row["category"]:<10} {str(row["ob_percent"]):<6} {str(row["dl_value"]):<6} {food_str:<6} {row["tcmsp_id"]}')

    # 8. 与金标数据对比
    from scripts.etl_sync_pipeline import TCMSP_GOLDEN, CATEGORY_NORMALIZATION_MAP, FOOD_HOMOLOGY_CATALOG_RAW

    def normalize_category(cat):
        if not cat:
            return "未分类"
        current = cat
        for _ in range(10):
            if current in CATEGORY_NORMALIZATION_MAP:
                current = CATEGORY_NORMALIZATION_MAP[current]
            else:
                break
        return current

    def check_food(name_cn):
        normalized = name_cn.split("（")[0].split("(")[0].strip()
        if normalized in FOOD_HOMOLOGY_CATALOG_RAW:
            return True
        for entry in FOOD_HOMOLOGY_CATALOG_RAW:
            if normalized in entry or entry in normalized:
                return True
        return False

    print(f'\n[8] 金标 vs 数据库 一致性检查:')
    mismatch_count = 0
    for name_cn, gold_data in TCMSP_GOLDEN.items():
        row = await conn.fetchrow('SELECT category, is_food_homology, ob_percent, dl_value, name_latin FROM tcm_herbs WHERE name_cn = $1', name_cn)
        if not row:
            print(f'  ❌ 缺失: {name_cn}')
            mismatch_count += 1
            continue

        # 检查分类
        expected_cat = normalize_category(gold_data.get('cat', ''))
        if row['category'] != expected_cat:
            print(f'  [FAIL] 分类不匹配: {name_cn} 数据库={row["category"]}, 金标={expected_cat}')
            mismatch_count += 1

        # 检查药食同源
        expected_food = gold_data.get('food', check_food(name_cn))
        if row['is_food_homology'] != expected_food:
            print(f'  [FAIL] 药食同源不匹配: {name_cn} 数据库={row["is_food_homology"]}, 金标={expected_food}')
            mismatch_count += 1

        # 检查拉丁名
        expected_latin = gold_data.get('latin', '')
        if row['name_latin'] != expected_latin:
            print(f'  [FAIL] 拉丁名不匹配: {name_cn} 数据库={row["name_latin"]}, 金标={expected_latin}')
            mismatch_count += 1

    if mismatch_count == 0:
        print(f'  [PASS] 所有 {len(TCMSP_GOLDEN)} 味药材数据完全一致!')
    else:
        print(f'  [FAIL] 发现 {mismatch_count} 处不匹配')

    await conn.close()
    print(f'\n{"=" * 70}')

asyncio.run(verify())
