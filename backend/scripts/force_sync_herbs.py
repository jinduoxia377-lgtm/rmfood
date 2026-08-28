"""
TCMSP 药材数据强制同步脚本 - 使用原始 SQL
直接插入缺失的药材数据
"""
import asyncio
import sys
sys.path.insert(0, 'D:/RMFOODFP/backend')

from app.core.database import async_engine
from sqlalchemy import text
from app.services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
from datetime import datetime, timezone

async def force_sync_herbs():
    """强制同步所有 TCMSP 药材数据"""
    async with async_engine.begin() as conn:
        # 获取现有药材名称
        result = await conn.execute(text('SELECT id, name_cn FROM tcm_herbs'))
        rows = result.fetchall()

        existing_names = {row[1] for row in rows}
        print(f"现有药材数: {len(existing_names)}")
        print(f"TCMSP 知识库数: {len(TCMSP_HERB_DATABASE)}")
        print(f"缺失药材数: {len(TCMSP_HERB_DATABASE) - len(existing_names)}")
        print()

        inserted = 0
        updated = 0
        errors = []

        for herb_data in TCMSP_HERB_DATABASE:
            name_cn = herb_data.get('name_cn')
            if not name_cn:
                continue

            try:
                if name_cn in existing_names:
                    # 更新现有记录
                    await conn.execute(text("""
                        UPDATE tcm_herbs
                        SET name_latin = :name_latin,
                            name_pinyin = :name_pinyin,
                            category = :category,
                            ob_percent = :ob_percent,
                            dl_value = :dl_value,
                            effects = :effects,
                            is_food_homology = :is_food_homology,
                            compounds = :compounds,
                            targets = :targets,
                            diseases = :diseases,
                            source_version = :source_version,
                            synced_at = :synced_at
                        WHERE name_cn = :name_cn
                    """), {
                        'name_latin': herb_data.get('name_latin', ''),
                        'name_pinyin': herb_data.get('name_pinyin', ''),
                        'category': herb_data.get('category', ''),
                        'ob_percent': herb_data.get('ob_percent'),
                        'dl_value': herb_data.get('dl_value'),
                        'effects': herb_data.get('effects', ''),
                        'is_food_homology': herb_data.get('is_food_homology', False),
                        'compounds': str(herb_data.get('compounds', [])).replace("'", '"'),
                        'targets': str(herb_data.get('targets', [])).replace("'", '"'),
                        'diseases': str(herb_data.get('diseases', [])).replace("'", '"'),
                        'source_version': '2024.1',
                        'synced_at': datetime.now(timezone.utc).isoformat(),
                        'name_cn': name_cn,
                    })
                    updated += 1
                else:
                    # 插入新记录
                    await conn.execute(text("""
                        INSERT INTO tcm_herbs
                        (name_cn, name_latin, name_pinyin, category, ob_percent, dl_value,
                         effects, is_food_homology, compounds, targets, diseases,
                         source, source_version, synced_at, created_at)
                        VALUES
                        (:name_cn, :name_latin, :name_pinyin, :category, :ob_percent, :dl_value,
                         :effects, :is_food_homology, :compounds, :targets, :diseases,
                         'tcsp', '2024.1', :synced_at, :created_at)
                    """), {
                        'name_cn': name_cn,
                        'name_latin': herb_data.get('name_latin', ''),
                        'name_pinyin': herb_data.get('name_pinyin', ''),
                        'category': herb_data.get('category', ''),
                        'ob_percent': herb_data.get('ob_percent'),
                        'dl_value': herb_data.get('dl_value'),
                        'effects': herb_data.get('effects', ''),
                        'is_food_homology': herb_data.get('is_food_homology', False),
                        'compounds': str(herb_data.get('compounds', [])).replace("'", '"'),
                        'targets': str(herb_data.get('targets', [])).replace("'", '"'),
                        'diseases': str(herb_data.get('diseases', [])).replace("'", '"'),
                        'synced_at': datetime.now(timezone.utc).isoformat(),
                        'created_at': datetime.now(timezone.utc),
                    })
                    inserted += 1
            except Exception as e:
                errors.append(f"{name_cn}: {e}")

        print(f"\n同步完成!")
        print(f"  新增: {inserted}")
        print(f"  更新: {updated}")
        print(f"  错误: {len(errors)}")

        if errors:
            print("\n错误详情:")
            for err in errors[:20]:
                print(f"  - {err}")

        # 验证结果
        result2 = await conn.execute(text('SELECT COUNT(*) FROM tcm_herbs'))
        total = result2.scalar()
        print(f"\n验证: 数据库中药材总数 = {total}")

        if total < len(TCMSP_HERB_DATABASE):
            print(f"警告: 仍有 {len(TCMSP_HERB_DATABASE) - total} 种药材未导入")

if __name__ == "__main__":
    asyncio.run(force_sync_herbs())
