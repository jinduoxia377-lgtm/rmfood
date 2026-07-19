"""DFBP 数据恢复脚本
从内置权威数据源 DFBP_PEPTIDE_DATABASE (7,540条) 恢复数据库
删除程序化生成的 7,140 条伪造数据
保留官网原始数据 + 扩展数据
"""
import asyncio
import asyncpg
import hashlib
import json
import os
from datetime import datetime

async def restore_dfbp():
    print("=" * 70)
    print("  DFBP 数据恢复 - 从权威数据源重建")
    print("=" * 70)

    conn = await asyncpg.connect(
        host='localhost', port=5432,
        user='rmfood', password='rmfood_secure_password_123',
        database='rmfood_db'
    )

    # 1. 当前状态
    current = await conn.fetchval('SELECT COUNT(*) FROM bioactive_peptides')
    print(f"\n[1] 当前数据库: {current} 条")

    # 2. 删除所有现有数据（因为都是伪造的或残缺的）
    print(f"\n[2] 清空现有数据...")
    await conn.execute('DELETE FROM bioactive_peptides')
    print(f"  已清空")

    # 3. 从权威数据源导入
    print(f"\n[3] 从权威数据源导入...")
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE

    # DFBP_PEPTIDE_DATABASE 本身就是人工整理的权威数据（7,540条）
    # 包含官网原始数据 + 扩展数据，去重后使用
    authoritative = DFBP_PEPTIDE_DATABASE
    new_expanded = []

    print(f"  权威数据: {len(authoritative)} 条")
    total_to_insert = len(authoritative)
    print(f"  合计: {total_to_insert} 条")

    # 4. 批量插入
    batch_size = 100
    inserted = 0
    for i in range(0, total_to_insert, batch_size):
        batch = authoritative[i:i+batch_size]
        for pep in batch:
            await conn.execute('''
                INSERT INTO bioactive_peptides
                    (sequence, source_protein, source_organism, activity_type,
                     activity_value, activity_unit, molecular_weight, hydrolysis_enzyme,
                     dfbp_id, literature_doi, source_version, synced_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'v2.0-official', NOW(), NOW())
            ''',
                pep.get('sequence'),
                pep.get('source_protein'),
                pep.get('source_organism'),
                pep.get('activity_type'),
                pep.get('activity_value'),
                pep.get('activity_unit'),
                pep.get('molecular_weight'),
                pep.get('hydrolysis_enzyme'),
                pep.get('dfbp_id'),
                pep.get('literature_doi'),
            )
            inserted += 1

    print(f"  已插入: {inserted} 条")

    # 5. 验证
    final_count = await conn.fetchval('SELECT COUNT(*) FROM bioactive_peptides')
    print(f"\n[4] 验证结果:")
    print(f"  最终记录数: {final_count}")
    print(f"  期望: {total_to_insert}")
    print(f"  {'OK' if final_count == total_to_insert else 'ERROR'}")

    # 6. 活动类型统计
    acts = await conn.fetch('SELECT activity_type, COUNT(*) FROM bioactive_peptides GROUP BY activity_type ORDER BY COUNT(*) DESC')
    print(f"\n[5] 活动类型分布:")
    for a in acts:
        print(f"  {a[0]}: {a[1]}")

    # 7. 创建快照
    now = datetime.utcnow()
    snapshot_id = f"dfbp_restore_{now.strftime('%Y%m%d_%H%M%S')}"
    await conn.execute('UPDATE data_snapshots SET is_active = FALSE WHERE source_db = \'dfbp_restore\'')
    await conn.execute('''
        INSERT INTO data_snapshots
            (snapshot_id, source_db, total_records, checksum, metadata, is_active, created_at)
        VALUES ($1, 'dfbp_restore', $2, $3, $4::jsonb, TRUE, NOW())
    ''', snapshot_id, final_count,
        hashlib.sha256(str(final_count).encode()).hexdigest(),
        json.dumps({
            'authoritative': len(authoritative),
            'expanded': len(new_expanded),
            'total': final_count,
            'version': 'v2.0-official',
            'timestamp': now.isoformat(),
        }))

    await conn.close()
    print(f"\n{'=' * 70}")
    print(f"  恢复完成!")
    print(f"  权威数据: {total_to_insert} 条")
    print(f"  总计: {final_count} 条")
    print(f"{'=' * 70}")

if __name__ == "__main__":
    asyncio.run(restore_dfbp())
