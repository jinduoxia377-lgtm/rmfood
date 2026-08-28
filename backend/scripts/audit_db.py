"""Database audit - data only, no app import."""
import asyncio, asyncpg

async def main():
    conn = await asyncpg.connect(host='localhost', port=5432, database='rmfood', user='postgres', password='password')
    try:
        # ── 1. Key table counts ──
        print("=" * 60)
        print("【数据库关键表数据量】")
        print("=" * 60)
        tables = [
            'food_materials', 'bioactive_peptides', 'peptide_batch_coas', 'coa_test_items',
            'peptides', 'tcm_herbs', 'tcm_compounds', 'symmap_herbs',
            'formula_designs', 'retail_products', 'system_configs',
            'herb_food_herbs', 'synergy_records',
        ]
        for t in tables:
            try:
                cnt = await conn.fetchval(f'SELECT COUNT(*) FROM "{t}"')
                del_cnt = 0
                try: del_cnt = await conn.fetchval(f'SELECT COUNT(*) FROM "{t}" WHERE deleted_at IS NOT NULL')
                except: pass
                mark = f" (含{del_cnt}软删)" if del_cnt else ""
                print(f"  {t:35s} {cnt}{mark}")
            except Exception as e:
                print(f"  {t:35s} ERR: {str(e)[:50]}")

        # ── 2. food_materials schema ──
        print("\n" + "=" * 60)
        print("【food_materials 字段】")
        print("=" * 60)
        rows = await conn.fetch("""
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name='food_materials' ORDER BY ordinal_position
        """)
        for r in rows: print(f"  {r['column_name']:30s} {r['data_type']}")

        # food_materials data quality
        total_fm = await conn.fetchval('SELECT COUNT(*) FROM food_materials')
        print(f"\n总数: {total_fm}")
        checks_fm = [
            ('name_cn', '中文名'), ('name_en', '英文名'), ('category', '分类'),
            ('food_homology', '药食同源'), ('ob_percent', 'OB%'), ('dl_value', 'DL值'),
            ('toxicity_class', '毒性'), ('source_db', '数据源'),
        ]
        for col, label in checks_fm:
            try:
                nc = await conn.fetchval(f'SELECT COUNT(*) FROM food_materials WHERE "{col}" IS NULL')
                if nc > 0: print(f"  {label}({col}): {nc}/{total_fm} 空 ({100*nc/max(total_fm,1):.0f}%)")
            except: pass
        
        # food_materials sample
        rows = await conn.fetch('SELECT id, name_cn, name_en, category, food_homology, ob_percent, dl_value, toxicity_class, source_db FROM food_materials LIMIT 5')
        if rows:
            print("\n样例:")
            for r in rows:
                print(f"  [{r['id']}] {r['name_cn']} | {r['category']} | homology={r['food_homology']} | OB={r['ob_percent']} DL={r['dl_value']} | tox={r['toxicity_class']} | src={r['source_db']}")

        # ── 3. bioactive_peptides schema ──
        print("\n" + "=" * 60)
        print("【bioactive_peptides 字段】")
        print("=" * 60)
        rows = await conn.fetch("""
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name='bioactive_peptides' ORDER BY ordinal_position
        """)
        for r in rows: print(f"  {r['column_name']:30s} {r['data_type']}")

        total_bp = await conn.fetchval('SELECT COUNT(*) FROM bioactive_peptides')
        print(f"\n总数: {total_bp}")
        checks_bp = [
            ('sequence', '序列'), ('source_protein', '来源蛋白'), ('activity_type', '活性类型'),
            ('activity_value', '活性值'), ('molecular_weight', '分子量'), ('dfbp_id', 'DFBP ID'),
        ]
        for col, label in checks_bp:
            try:
                nc = await conn.fetchval(f'SELECT COUNT(*) FROM bioactive_peptides WHERE "{col}" IS NULL')
                if nc > 0: print(f"  {label}({col}): {nc}/{total_bp} 空 ({100*nc/max(total_bp,1):.0f}%)")
            except: pass

        rows = await conn.fetch('SELECT id, sequence, source_protein, activity_type, activity_value, molecular_weight, dfbp_id FROM bioactive_peptides LIMIT 5')
        if rows:
            print("\n样例:")
            for r in rows:
                seq = str(r['sequence'])[:35] if r['sequence'] else 'NULL'
                print(f"  [{r['id']}] seq={seq} | src={r['source_protein']} | act={r['activity_type']} | val={r['activity_value']} | mw={r['molecular_weight']}")

        # ── 4. peptides table ──
        print("\n" + "=" * 60)
        print("【peptides 表】")
        print("=" * 60)
        try:
            cnt = await conn.fetchval('SELECT COUNT(*) FROM peptides')
            print(f"总数: {cnt}")
            if cnt > 0:
                rows = await conn.fetch('SELECT * FROM peptides LIMIT 2')
                if rows:
                    for r in rows: print(f"  {dict(r)}")
        except Exception as e: print(f"  ERR: {e}")

        # ── 5. tcm_herbs ──
        print("\n" + "=" * 60)
        print("【tcm_herbs 表】")
        print("=" * 60)
        try:
            cnt = await conn.fetchval('SELECT COUNT(*) FROM tcm_herbs')
            print(f"总数: {cnt}")
            if cnt > 0:
                rows = await conn.fetch('SELECT id, name_cn, pinyin, category, toxicity FROM tcm_herbs LIMIT 3')
                if rows:
                    for r in rows: print(f"  [{r['id']}] {r['name_cn']} | {r.get('category','?')} | tox={r.get('toxicity','?')}")
        except Exception as e: print(f"  ERR: {e}")

        # ── 6. symmap_herbs ──
        print("\n" + "=" * 60)
        print("【symmap_herbs 表】")
        print("=" * 60)
        try:
            cnt = await conn.fetchval('SELECT COUNT(*) FROM symmap_herbs')
            print(f"总数: {cnt}")
        except Exception as e: print(f"  ERR: {e}")

        # ── 7. CoA data ──
        print("\n" + "=" * 60)
        print("【COA 数据】")
        print("=" * 60)
        try:
            coa_cnt = await conn.fetchval('SELECT COUNT(*) FROM peptide_batch_coas WHERE deleted_at IS NULL')
            item_cnt = await conn.fetchval('SELECT COUNT(*) FROM coa_test_items')
            print(f"COA记录: {coa_cnt}, 检验单项: {item_cnt}")
        except Exception as e: print(f"  ERR: {e}")

    finally:
        await conn.close()

asyncio.run(main())
