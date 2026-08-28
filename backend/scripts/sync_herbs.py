"""TCMSP 药材数据完整同步脚本 - 批量插入缺失数据"""
import asyncio
import sys
sys.path.insert(0, 'D:/RMFOODFP/backend')

from app.core.database import async_engine
from sqlalchemy import text
from app.services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE

async def main():
    """批量插入缺失的药材数据"""
    inserted = 0
    errors = []

    # 分批处理，每批 50 条
    batch_size = 50
    total = len(TCMSP_HERB_DATABASE)

    print(f"TCMSP 知识库总数: {total}")
    print(f"开始同步...\n")

    for i, herb in enumerate(TCMSP_HERB_DATABASE):
        name_cn = herb.get('name_cn')
        if not name_cn:
            continue

        # 每次开启新事务，避免事务失败影响后续
        async with async_engine.begin() as conn:
            # 检查是否已存在
            result = await conn.execute(
                text('SELECT id FROM tcm_herbs WHERE name_cn = :name_cn'),
                {'name_cn': name_cn}
            )
            if result.fetchone():
                # 更新现有记录
                try:
                    await conn.execute(text("""
                        UPDATE tcm_herbs
                        SET name_latin = :name_latin,
                            name_pinyin = :name_pinyin,
                            category = :category,
                            ob_percent = :ob_percent,
                            dl_value = :dl_value,
                            effects = :effects,
                            is_food_homology = :is_food_homology,
                            source_version = '2024.1',
                            synced_at = NOW()
                        WHERE name_cn = :name_cn
                    """), {
                        'name_cn': name_cn,
                        'name_latin': herb.get('name_latin', ''),
                        'name_pinyin': herb.get('name_pinyin', ''),
                        'category': herb.get('category', ''),
                        'ob_percent': herb.get('ob_percent'),
                        'dl_value': herb.get('dl_value'),
                        'effects': herb.get('effects', ''),
                        'is_food_homology': herb.get('is_food_homology', False),
                    })
                except Exception as e:
                    errors.append(f"更新失败 {name_cn}: {e}")
            else:
                # 插入新记录
                try:
                    await conn.execute(text("""
                        INSERT INTO tcm_herbs
                        (name, name_cn, name_latin, name_pinyin, category, ob_percent, dl_value,
                         effects, is_food_homology, source, source_version, synced_at, created_at)
                        VALUES
                        (:name, :name_cn, :name_latin, :name_pinyin, :category, :ob_percent, :dl_value,
                         :effects, :is_food_homology, 'tcsp', '2024.1', NOW(), NOW())
                    """), {
                        'name': name_cn,
                        'name_cn': name_cn,
                        'name_latin': herb.get('name_latin', ''),
                        'name_pinyin': herb.get('name_pinyin', ''),
                        'category': herb.get('category', ''),
                        'ob_percent': herb.get('ob_percent'),
                        'dl_value': herb.get('dl_value'),
                        'effects': herb.get('effects', ''),
                        'is_food_homology': herb.get('is_food_homology', False),
                    })
                    inserted += 1
                except Exception as e:
                    errors.append(f"插入失败 {name_cn}: {e}")

        # 进度报告
        if (i + 1) % batch_size == 0:
            print(f"  进度: {i+1}/{total} ({(i+1)*100//total}%) - 已插入: {inserted}")

    # 最终统计
    async with async_engine.begin() as conn:
        result = await conn.execute(text('SELECT COUNT(*) FROM tcm_herbs'))
        total_in_db = result.scalar()

    print(f"\n同步完成!")
    print(f"  数据库中药材总数: {total_in_db}")
    print(f"  本次新增: {inserted}")
    print(f"  错误数: {len(errors)}")

    if errors:
        print(f"\n错误详情 (前 10 条):")
        for err in errors[:10]:
            print(f"  - {err}")

if __name__ == "__main__":
    asyncio.run(main())
