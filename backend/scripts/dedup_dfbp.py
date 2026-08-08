"""DFBP 活性肽去重脚本
问题: 数据库中有 40 组重复序列（共 482 条重复记录），导致总数 7540 而非官网的 7058
修复: 保留每组重复中 dfbp_id 最小的那条，删除其余重复
"""
import asyncio
import asyncpg

async def deduplicate():
    print("=" * 70)
    print("  DFBP 活性肽去重修复")
    print("=" * 70)

    conn = await asyncpg.connect(
        host='localhost', port=5432,
        user='rmfood', password='rmfood_secure_password_123',
        database='rmfood_db'
    )

    # 1. 获取重复序列
    dupes = await conn.fetch('''
        SELECT sequence, MIN(id) as keep_id, ARRAY_AGG(id) as all_ids
        FROM bioactive_peptides
        GROUP BY sequence
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
    ''')

    print(f"\n[1] 发现 {len(dupes)} 组重复序列")

    # 2. 删除重复记录
    deleted = 0
    for row in dupes:
        sequence = row['sequence']
        keep_id = row['keep_id']
        all_ids = row['all_ids']

        # 删除除最小 id 外的所有重复
        ids_to_delete = [int(i) for i in all_ids if i != keep_id]
        if ids_to_delete:
            for del_id in ids_to_delete:
                await conn.execute(
                    'DELETE FROM bioactive_peptides WHERE id = $1 AND sequence = $2',
                    del_id, sequence
                )
                deleted += 1

    print(f"\n[2] 删除重复记录: {deleted} 条")

    # 3. 验证
    total = await conn.fetchval('SELECT COUNT(*) FROM bioactive_peptides')
    print(f"\n[3] 验证结果:")
    print(f"  去重后总记录数: {total}")
    print(f"  期望值 (DFBP官网): 7058")
    print(f"  {'✅ 一致' if total == 7058 else '❌ 不一致'}")

    # 4. 创建数据快照
    import hashlib, json
    from datetime import datetime
    now = datetime.utcnow()
    snapshot_id = f"dfbp_dedup_{now.strftime('%Y%m%d_%H%M%S')}"

    await conn.execute('''
        UPDATE data_snapshots SET is_active = FALSE WHERE source_db = 'dfbp_dedup'
    ''')

    await conn.execute('''
        INSERT INTO data_snapshots
            (snapshot_id, source_db, total_records, checksum, metadata, is_active, created_at)
        VALUES ($1, 'dfbp_dedup', $2, $3, $4::jsonb, TRUE, NOW())
    ''', snapshot_id, total,
        hashlib.sha256(str(total).encode()).hexdigest(),
        json.dumps({
            'deleted_duplicates': deleted,
            'duplicate_groups': len(dupes),
            'final_total': total,
            'version': 'v1.1-deduped',
            'timestamp': now.isoformat(),
        }))

    await conn.close()

    print(f"\n{'=' * 70}")
    print("  去重完成!")
    print(f"  删除重复: {deleted} 条")
    print(f"  最终记录: {total} 条")
    print(f"{'=' * 70}")

if __name__ == "__main__":
    asyncio.run(deduplicate())
