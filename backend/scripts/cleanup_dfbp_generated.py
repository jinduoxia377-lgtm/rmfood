"""DFBP 清理程序化生成数据
删除所有 dfbp_id > 300 的记录（7,123 条程序化生成数据）
保留 dfbp_id <= 300 的记录（扩展数据 + 官网原始数据）
"""
import asyncio
import asyncpg
import hashlib
import json
from datetime import datetime

async def cleanup():
    print("=" * 70)
    print("  DFBP 清理程序化生成数据")
    print("=" * 70)

    conn = await asyncpg.connect(
        host='localhost', port=5432,
        user='rmfood', password='rmfood_secure_password_123',
        database='rmfood_db'
    )

    # 1. 统计
    total = await conn.fetchval('SELECT COUNT(*) FROM bioactive_peptides')
    gen_count = await conn.fetchval('SELECT COUNT(*) FROM bioactive_peptides WHERE CAST(SUBSTRING(dfbp_id FROM 5) AS INTEGER) > 300')
    keep_count = total - gen_count
    print(f"\n[1] 当前状态:")
    print(f"  总记录: {total}")
    print(f"  待删除 (dfbp_id > 300): {gen_count}")
    print(f"  保留 (dfbp_id <= 300): {keep_count}")

    # 2. 删除
    print(f"\n[2] 删除程序化生成数据...")
    await conn.execute('''
        DELETE FROM bioactive_peptides
        WHERE CAST(SUBSTRING(dfbp_id FROM 5) AS INTEGER) > 300
    ''')
    print(f"  已删除: {gen_count} 条")

    # 3. 验证
    new_total = await conn.fetchval('SELECT COUNT(*) FROM bioactive_peptides')
    print(f"\n[3] 验证结果:")
    print(f"  当前总数: {new_total}")
    print(f"  期望范围: 7,058 (官网) + 300 (扩展) = ~7,358")
    print(f"  {'OK' if new_total == keep_count else 'ERROR'}")

    # 4. 检查剩余数据的 dfbp_id 分布
    result = await conn.fetchrow('''
        SELECT
            MIN(CAST(SUBSTRING(dfbp_id FROM 5) AS INTEGER)) as min_id,
            MAX(CAST(SUBSTRING(dfbp_id FROM 5) AS INTEGER)) as max_id,
            COUNT(*) as total
        FROM bioactive_peptides
    ''')
    print(f"\n[4] 剩余数据 dfbp_id 范围: DFBP{result['min_id']:05d} ~ DFBP{result['max_id']:05d}")

    # 5. 活动类型分布
    acts = await conn.fetch('SELECT activity_type, COUNT(*) FROM bioactive_peptides GROUP BY activity_type ORDER BY COUNT(*) DESC')
    print(f"\n[5] 活动类型分布:")
    for a in acts:
        print(f"  {a[0]}: {a[1]}")

    # 6. 创建快照
    now = datetime.utcnow()
    snapshot_id = f"dfbp_cleanup_{now.strftime('%Y%m%d_%H%M%S')}"
    await conn.execute('UPDATE data_snapshots SET is_active = FALSE WHERE source_db = \'dfbp_cleanup\'')
    await conn.execute('''
        INSERT INTO data_snapshots
            (snapshot_id, source_db, total_records, checksum, metadata, is_active, created_at)
        VALUES ($1, 'dfbp_cleanup', $2, $3, $4::jsonb, TRUE, NOW())
    ''', snapshot_id, new_total,
        hashlib.sha256(str(new_total).encode()).hexdigest(),
        json.dumps({
            'deleted': gen_count,
            'remaining': new_total,
            'version': 'v1.2-cleaned',
            'timestamp': now.isoformat(),
        }))

    await conn.close()
    print(f"\n{'=' * 70}")
    print(f"  清理完成!")
    print(f"  删除: {gen_count} 条")
    print(f"  剩余: {new_total} 条")
    print(f"{'=' * 70}")

if __name__ == "__main__":
    asyncio.run(cleanup())
