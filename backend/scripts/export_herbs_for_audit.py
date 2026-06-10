"""本地中药材数据库完整导出 — 用于与 TCMSP 官方数据对比"""
import asyncio
import asyncpg
import json

async def main():
    conn = await asyncpg.connect('postgresql://postgres@localhost:5432/rmfood_platform')
    
    # 1. 基础统计
    total = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
    
    # 2. 全量数据导出
    rows = await conn.fetch("""
        SELECT 
            id, name_cn, name_latin, name_pinyin, category,
            ob_percent, is_food_homology,
            tcmsp_id, source_version,
            effects
        FROM tcm_herbs ORDER BY id
    """)
    
    # 3. 分类统计
    categories = await conn.fetch("""
        SELECT category, COUNT(*) as cnt, ROUND(AVG(ob_percent)::numeric, 2) as avg_ob,
               MIN(ob_percent) as min_ob, MAX(ob_percent) as max_ob
        FROM tcm_herbs GROUP BY category ORDER BY cnt DESC
    """)
    
    # 4. OB 分布
    ob_ranges = await conn.fetch("""
        SELECT CASE WHEN ob_percent >= 30 THEN '>=30%'
                    WHEN ob_percent >= 20 THEN '20-30%'
                    WHEN ob_percent >= 10 THEN '10-20%'
                    WHEN ob_percent >= 5 THEN '5-10%'
                    WHEN ob_percent >= 1 THEN '1-5%' ELSE '<1%' END as r,
               COUNT(*) as cnt FROM tcm_herbs GROUP BY 1 ORDER BY 1
    """)
    
    # 5. 药食同源统计
    food_homology = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs WHERE is_food_homology = true")
    with_id = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs WHERE tcmsp_id IS NOT NULL AND tcmsp_id != ''")
    
    all_names = sorted([r['name_cn'] for r in rows])
    samples = []
    for r in rows[:25]:
        d = dict(r)
        d['ob_percent'] = float(d['ob_percent']) if d['ob_percent'] else None
        d['is_food_homology'] = bool(d['is_food_homology'])
        samples.append(d)
    
    result = {
        "meta": {
            "total_records": total,
            "unique_names": len(set(r['name_cn'] for r in rows)),
            "with_tcmsp_id": with_id,
            "without_tcmsp_id": total - with_id,
            "food_homology_count": food_homology,
            "source_versions": sorted(list(set(str(r['source_version']) if r['source_version'] else '' for r in rows))),
        },
        "categories": [(c['category'], c['cnt'], str(c['avg_ob']), c['min_ob'], c['max_ob']) for c in categories],
        "ob_distribution": [(r['r'], r['cnt']) for r in ob_ranges],
        "sample_data": samples,
        "all_names_sorted": all_names,
    }
    
    with open('herb_audit_data.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"OK: {total} records exported to herb_audit_data.json")
    print(f"Categories: {len(categories)}")
    print(f"With TCMSP ID: {with_id}/{total}")
    print(f"Food homology: {food_homology}")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
