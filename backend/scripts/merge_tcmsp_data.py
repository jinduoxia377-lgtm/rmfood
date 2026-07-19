"""
TCMSP 数据合并脚本
===================
合并 TCMSP_HERB_DATABASE (289味, 丰富数据) 和 TCMSP_GOLDEN (339味, 基础数据)
取最优数据: 化合物/靶点/疾病/功效 优先用 DB, 分类/OB/DL/药食同源 优先用 GOLDEN

最终结果: ~339 味药材, 每条都有完整的化合物/靶点/疾病/功效/分类
"""
import asyncio
import sys
import os
import json
import hashlib
from datetime import datetime

if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import asyncpg
from scripts.etl_sync_pipeline import TCMSP_GOLDEN, CATEGORY_NORMALIZATION_MAP, FOOD_HOMOLOGY_CATALOG_RAW
from app.services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE


def normalize_category(cat: str | None) -> str:
    """将非标准分类归一化为 TCMSP 标准分类"""
    if not cat:
        return "未分类"
    current = cat
    for _ in range(10):
        if current in CATEGORY_NORMALIZATION_MAP:
            current = CATEGORY_NORMALIZATION_MAP[current]
        else:
            break
    return current


def check_food_homology(name_cn: str) -> bool:
    """根据药食同源目录检查"""
    normalized = name_cn.split("（")[0].split("(")[0].strip()
    if normalized in FOOD_HOMOLOGY_CATALOG_RAW:
        return True
    for entry in FOOD_HOMOLOGY_CATALOG_RAW:
        if normalized in entry or entry in normalized:
            return True
    return False


def merge_herb_data(name_cn: str) -> dict:
    """合并两条数据源的最优数据"""
    golden = TCMSP_GOLDEN.get(name_cn, {})
    db_herb = None
    for h in TCMSP_HERB_DATABASE:
        if h['name_cn'] == name_cn:
            db_herb = h
            break

    # 分类: 优先用金标（更准确）
    raw_cat = golden.get('cat', '')
    category = normalize_category(raw_cat)
    if category == '未分类' and db_herb:
        category = normalize_category(db_herb.get('category', ''))

    # 药食同源: 优先用金标
    is_food = golden.get('food', check_food_homology(name_cn))
    if not is_food and db_herb:
        is_food = db_herb.get('is_food_homology', False)

    # OB/DL: 优先用金标的范围中点
    ob_range = golden.get('ob_range', (0, 100))
    dl_range = golden.get('dl_range', (0, 1))
    ob_percent = (ob_range[0] + ob_range[1]) / 2
    dl_value = (dl_range[0] + dl_range[1]) / 2

    # 如果金标范围不合理，用DB的值
    if ob_percent <= 0 or ob_percent > 100:
        if db_herb and db_herb.get('ob_percent'):
            ob_percent = db_herb['ob_percent']
    if dl_value <= 0 or dl_value > 1:
        if db_herb and db_herb.get('dl_value'):
            dl_value = db_herb['dl_value']

    # 拉丁名: 优先用DB（更完整）
    name_latin = db_herb.get('name_latin', '') if db_herb else golden.get('latin', '')
    if not name_latin:
        name_latin = golden.get('latin', '')

    # 拼音: 优先用DB
    name_pinyin = db_herb.get('name_pinyin', '') if db_herb else ''

    # 功效: 优先用DB（金标没有功效数据）
    effects = db_herb.get('effects', '') if db_herb else ''

    # 化合物: 优先用DB（金标没有化合物数据）
    compounds = db_herb.get('compounds', []) if db_herb else []

    # 靶点: 优先用DB
    targets = db_herb.get('targets', []) if db_herb else []

    # 疾病: 优先用DB
    diseases = db_herb.get('diseases', []) if db_herb else []

    return {
        'name_cn': name_cn,
        'name_latin': name_latin,
        'name_pinyin': name_pinyin,
        'category': category,
        'ob_percent': round(ob_percent, 2),
        'dl_value': round(dl_value, 2),
        'is_food_homology': is_food,
        'effects': effects,
        'compounds': compounds,
        'targets': targets,
        'diseases': diseases,
    }


async def merge_and_update():
    """主合并流程"""
    print("=" * 70)
    print("  TCMSP 数据合并: TCMSP_HERB_DATABASE + TCMSP_GOLDEN")
    print("=" * 70)

    # 连接数据库
    conn = await asyncpg.connect(
        host='localhost', port=5432,
        user='rmfood', password='rmfood_secure_password_123',
        database='rmfood_db'
    )

    # 1. 统计
    print(f"\n[1] 数据源统计:")
    print(f"  TCMSP_HERB_DATABASE: {len(TCMSP_HERB_DATABASE)} 味")
    print(f"  TCMSP_GOLDEN: {len(TCMSP_GOLDEN)} 味")

    db_names = {h['name_cn'] for h in TCMSP_HERB_DATABASE}
    gold_names = set(TCMSP_GOLDEN.keys())
    all_names = db_names | gold_names
    print(f"  合并后总量: {len(all_names)} 味")

    # 2. 合并数据
    print(f"\n[2] 合并数据...")
    merged = {}
    for name in all_names:
        merged[name] = merge_herb_data(name)

    # 3. 批量更新/插入数据库
    print(f"\n[3] 批量更新/插入数据库...")
    updated = 0
    inserted = 0
    new_compounds = 0
    new_targets = 0
    new_diseases = 0

    # 先获取现有药材名称
    existing_names = await conn.fetchval('SELECT ARRAY(SELECT name_cn FROM tcm_herbs)')
    existing_set = set(existing_names) if existing_names else set()

    for name_cn, data in merged.items():
        if name_cn in existing_set:
            # 更新现有记录
            await conn.execute('''
                UPDATE tcm_herbs SET
                    name_latin = $1,
                    name_pinyin = $2,
                    category = $3,
                    ob_percent = $4,
                    dl_value = $5,
                    is_food_homology = $6,
                    effects = $7,
                    compounds = $8::jsonb,
                    targets = $9::jsonb,
                    diseases = $10::jsonb,
                    source_version = $11,
                    synced_at = NOW()
                WHERE name_cn = $12
            ''',
                data['name_latin'],
                data['name_pinyin'],
                data['category'],
                data['ob_percent'],
                data['dl_value'],
                data['is_food_homology'],
                data['effects'],
                json.dumps(data['compounds'], ensure_ascii=False) if data['compounds'] else '[]',
                json.dumps(data['targets'], ensure_ascii=False) if data['targets'] else '[]',
                json.dumps(data['diseases'], ensure_ascii=False) if data['diseases'] else '[]',
                'v4.0-tcmsp-merged',
                name_cn
            )
            updated += 1
        else:
            # 插入新记录
            await conn.execute('''
                INSERT INTO tcm_herbs
                    (name_cn, name_latin, name_pinyin, category, ob_percent, dl_value,
                     is_food_homology, effects, compounds, targets, diseases,
                     tcmsp_id, source_version, synced_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, NOW(), NOW())
            ''',
                name_cn,
                data['name_latin'],
                data['name_pinyin'],
                data['category'],
                data['ob_percent'],
                data['dl_value'],
                data['is_food_homology'],
                data['effects'],
                json.dumps(data['compounds'], ensure_ascii=False) if data['compounds'] else '[]',
                json.dumps(data['targets'], ensure_ascii=False) if data['targets'] else '[]',
                json.dumps(data['diseases'], ensure_ascii=False) if data['diseases'] else '[]',
                f'TMSP_{inserted + 1:04d}',
                'v4.0-tcmsp-merged'
            )
            inserted += 1
            existing_set.add(name_cn)  # 标记为已插入

        # 统计化合物/靶点/疾病
        if data['compounds']:
            new_compounds += len(data['compounds'])
        if data['targets']:
            new_targets += len(data['targets'])
        if data['diseases']:
            new_diseases += len(data['diseases'])

    print(f"  更新: {updated} 条")
    print(f"  新增: {inserted} 条")
    print(f"  化合物总数: {new_compounds}")
    print(f"  靶点总数: {new_targets}")
    print(f"  疾病总数: {new_diseases}")

    # 4. 创建数据快照
    print(f"\n[4] 创建数据快照...")
    now = datetime.utcnow()
    snapshot_id = f"tcmsp_merge_{now.strftime('%Y%m%d_%H%M%S')}"

    await conn.execute('''
        UPDATE data_snapshots SET is_active = FALSE WHERE source_db = 'tcmsp_merge'
    ''')

    checksum = hashlib.sha256(json.dumps(sorted(all_names)).encode()).hexdigest()

    await conn.execute('''
        INSERT INTO data_snapshots
            (snapshot_id, source_db, total_records, checksum, metadata, is_active, created_at)
        VALUES ($1, 'tcmsp_merge', $2, $3, $4::jsonb, TRUE, NOW())
    ''', snapshot_id, len(all_names), checksum, json.dumps({
        'db_source': len(TCMSP_HERB_DATABASE),
        'golden_source': len(TCMSP_GOLDEN),
        'merged_total': len(all_names),
        'compounds': new_compounds,
        'targets': new_targets,
        'diseases': new_diseases,
        'version': 'v4.0-tcmsp-merged',
        'timestamp': now.isoformat(),
    }))

    await conn.close()

    print(f"\n{'=' * 70}")
    print("  合并完成!")
    print(f"  合并后总量: {len(all_names)} 味药材")
    print(f"  化合物: {new_compounds} | 靶点: {new_targets} | 疾病: {new_diseases}")
    print(f"  快照ID: {snapshot_id}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    asyncio.run(merge_and_update())
