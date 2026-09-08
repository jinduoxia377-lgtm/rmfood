from scripts.db_utils import get_asyncpg_dsn
"""中药材数据去重 + UNIQUE 约束"""
import asyncio
import asyncpg

REMOVE_IDS = [245, 314, 244, 292, 298, 293, 311, 300, 317, 305, 294, 308, 307, 302, 315, 306, 243, 316, 297, 303, 250, 248, 249, 299, 304]

async def main():
    conn = await asyncpg.connect(get_asyncpg_dsn())
    
    before = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
    dupes_before = await conn.fetchval("SELECT COUNT(*) FROM (SELECT name_cn FROM tcm_herbs GROUP BY name_cn HAVING COUNT(*) > 1) t")
    print(f"去重前: 总={before}, 重复组={dupes_before}")
    
    # 删除重复记录（保留 id 小的原始记录）
    await conn.execute("DELETE FROM tcm_herbs WHERE id = ANY($1::int[])", REMOVE_IDS)
    
    after = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
    dupes_after = await conn.fetchval("SELECT COUNT(*) FROM (SELECT name_cn FROM tcm_herbs GROUP BY name_cn HAVING COUNT(*) > 1) t")
    print(f"去重后: 总={after} (删除{before-after}条), 剩余重复组={dupes_after}")
    
    # 添加唯一约束
    try:
        await conn.execute("ALTER TABLE tcm_herbs ADD CONSTRAINT uq_tcm_herbs_name_cn UNIQUE (name_cn)")
        print(f"✅ 已添加 UNIQUE(name_cn) 约束")
    except Exception as e:
        err = str(e).lower()
        if 'already exists' in err or 'duplicate' in err:
            print(f"⚠️ 约束已存在")
        else:
            print(f"⚠️ 添加约束失败: {e}")
    
    # 最终验证
    final = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
    unique_names = await conn.fetchval("SELECT COUNT(DISTINCT name_cn) FROM tcm_herbs")
    print(f"\n最终: 总记录={final}, 唯一名称={unique_names} → {'✅ 无重复' if final == unique_names else '❌'}")
    
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
