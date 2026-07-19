"""验证 TCMSP 数据迁移结果"""
import asyncio
import sys
import os

# 设置 UTF-8 编码
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import select, text
from sqlalchemy.orm import sessionmaker

async def verify_migration():
    print("=" * 70)
    print("  TCMSP 数据迁移验证报告")
    print("=" * 70)

    # 连接数据库
    from app.core.config import get_settings
    settings = get_settings()
    db_url = settings.database.url

    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
    async with engine.begin() as conn:
        # 1. 总记录数
        result = await conn.execute(text("SELECT COUNT(*) FROM tcm_herbs"))
        total = result.scalar()
        print(f"\n[1] 总记录数: {total}")

        # 2. 分类统计
        result = await conn.execute(text("""
            SELECT category, COUNT(*) as cnt
            FROM tcm_herbs
            GROUP BY category
            ORDER BY cnt DESC
        """))
        categories = result.fetchall()
        print(f"\n[2] 分类统计 (共 {len(categories)} 类):")
        for cat, cnt in categories:
            print(f"  {cat:<20} {cnt:>4} 味")

        # 3. 药食同源统计
        result = await conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE is_food_homology = TRUE) as food_true,
                COUNT(*) FILTER (WHERE is_food_homology = FALSE) as food_false
            FROM tcm_herbs
        """))
        food_true, food_false = result.fetchone()
        print(f"\n[3] 药食同源统计:")
        print(f"  是: {food_true} 味 ({food_true/total*100:.1f}%)")
        print(f"  否: {food_false} 味 ({food_false/total*100:.1f}%)")

        # 4. TCMSP ID 分配情况
        result = await conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE tcmsp_id LIKE 'TMSP_%') as tcmsp_count,
                COUNT(*) FILTER (WHERE tcmsp_id IS NULL OR tcmsp_id = '') as null_count,
                MIN(tcmsp_id) as min_id,
                MAX(tcmsp_id) as max_id
            FROM tcm_herbs
        """))
        tcmsp_count, null_count, min_id, max_id = result.fetchone()
        print(f"\n[4] TCMSP ID 分配:")
        print(f"  已分配: {tcmsp_count} 味")
        print(f"  未分配: {null_count} 味")
        if min_id and max_id:
            print(f"  ID 范围: {min_id} ~ {max_id}")

        # 5. 来源版本统计
        result = await conn.execute(text("""
            SELECT source_version, COUNT(*) as cnt
            FROM tcm_herbs
            GROUP BY source_version
            ORDER BY cnt DESC
        """))
        versions = result.fetchall()
        print(f"\n[5] 数据版本:")
        for ver, cnt in versions:
            print(f"  {ver}: {cnt} 味")

        # 6. 示例数据
        result = await conn.execute(text("""
            SELECT name_cn, name_latin, category, ob_percent, dl_value,
                   is_food_homology, tcmsp_id
            FROM tcm_herbs
            ORDER BY id
            LIMIT 10
        """))
        sample = result.fetchall()
        print(f"\n[6] 示例数据 (前10条):")
        print(f"  {'中文名':<10} {'拉丁名':<30} {'分类':<15} {'OB':<6} {'DL':<6} {'药食同源':<8} {'TCMSP ID'}")
        print("  " + "-" * 100)
        for row in sample:
            name_cn, name_latin, category, ob, dl, food, tcmsp_id = row
            food_str = "是" if food else "否"
            print(f"  {name_cn:<10} {name_latin[:28]:<30} {category:<15} {str(ob):<6} {str(dl):<6} {food_str:<8} {tcmsp_id}")

        # 7. 知识图谱节点验证
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM kg_nodes WHERE node_type = 'herb'
        """))
        kg_herb_count = result.scalar()
        print(f"\n[7] 知识图谱验证:")
        print(f"  药材节点: {kg_herb_count} 个")

        # 8. 数据快照
        result = await conn.execute(text("""
            SELECT snapshot_id, total_records, metadata, created_at
            FROM data_snapshots
            WHERE source_db = 'tcmsp_restore'
            ORDER BY created_at DESC
            LIMIT 1
        """))
        snapshot = result.fetchone()
        if snapshot:
            snap_id, total_records, metadata, created_at = snapshot
            print(f"\n[8] 最新数据快照:")
            print(f"  快照ID: {snap_id}")
            print(f"  记录数: {total_records}")
            print(f"  元数据: {metadata}")
            print(f"  创建时间: {created_at}")

    await engine.dispose()
    print(f"\n{'=' * 70}")
    print("  验证完成!")
    print(f"{'=' * 70}")

if __name__ == "__main__":
    asyncio.run(verify_migration())
