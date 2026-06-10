"""中药材数据重复排查 v2 — 先查列名"""
import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres@localhost:5432/rmfood_platform')
    
    # 1. 列名
    cols = await conn.fetch("""
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'tcm_herbs' 
        ORDER BY ordinal_position
    """)
    print(f"=== tcm_herbs 表结构 ({len(cols)} 列) ===")
    for c in cols:
        print(f"  {c['column_name']}: {c['data_type']}")
    
    # 2. 总数 + 按所有文本字段查重
    total = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
    print(f"\n总记录: {total}")
    
    # 用 name_cn 做主键检查
    dupes = await conn.fetch("""
        SELECT name_cn, COUNT(*) as cnt, array_agg(id ORDER BY id) as ids
        FROM tcm_herbs 
        GROUP BY name_cn 
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 20
    """)
    print(f"\n按 name_cn 分组重复: {len(dupes)} 组")
    for d in dupes:
        print(f"  '{d['name_cn']}' x{d['cnt']} ids={d['ids']}")
    
    # 示例数据
    samples = await conn.fetch("SELECT * FROM tcm_herbs ORDER BY id LIMIT 8")
    print(f"\n=== 前8条示例 ===")
    for s in samples:
        d = dict(s)
        print(f"  [{d.get('id')}] cn={d.get('name_cn')} | {', '.join(f'{k}={v}' for k,v in list(d.items())[2:6])}")
    
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
