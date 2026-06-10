"""中药材重复数据深度分析 — 对比每组的差异"""
import asyncio
import asyncpg
import json

async def main():
    conn = await asyncpg.connect('postgresql://postgres@localhost:5432/rmfood_platform')
    
    # 获取所有重复组
    dupes = await conn.fetch("""
        SELECT name_cn, COUNT(*) as cnt, array_agg(id ORDER BY id) as ids,
               array_agg(category ORDER BY id) as cats,
               array_agg(source_version ORDER BY id) as versions,
               array_agg(tcmsp_id ORDER BY id) as tcmsp_ids,
               array_agg(ob_percent ORDER BY id) as obs
        FROM tcm_herbs 
        GROUP BY name_cn 
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
    """)
    
    print(f"=== {len(dupes)} 组重复数据分析 ===\n")
    
    keep_ids = []
    remove_ids = []
    
    for d in dupes:
        ids = d['ids']
        cats = d['cats']
        versions = d['versions']
        tcmsp_ids = d['tcmsp_ids']
        obs = d['obs']
        
        print(f"【{d['name_cn']}】 ids={ids}")
        for i in range(len(ids)):
            print(f"  [{ids[i]}] cat={cats[i]} ver={versions[i]} tcmsp_id={tcmsp_ids[i]} ob={obs[i]}")
        
        # 决策逻辑：保留有 tcmsp_id 的，或 source_version 更新的，或 id 更小的
        best = 0
        if tcmsp_ids[1] and not tcmsp_ids[0]:
            best = 1
        elif tcmsp_ids[0] and not tcmsp_ids[1]:
            best = 0
        elif 'v2.3' in (versions[1] or ''):
            best = 1
        elif 'v2.3' in (versions[0] or ''):
            best = 0
        else:
            best = 0  # 默认保留 id 小的（先写入的）
        
        keep = ids[best]
        remove = ids[1-best]
        keep_ids.append(keep)
        remove_ids.append(remove)
        print(f"  → 保留 #{keep}, 删除 #{remove}\n")
    
    print(f"\n=== 汇总 ===")
    print(f"保留: {keep_ids}")
    print(f"删除: {remove_ids}")
    print(f"去重后总记录数: {317 - len(remove_ids)}")
    
    await conn.close()
    return keep_ids, remove_ids

if __name__ == '__main__':
    asyncio.run(main())
