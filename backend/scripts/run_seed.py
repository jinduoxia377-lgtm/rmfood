"""Seed food_materials and tcm_herbs - final version."""
import asyncio, asyncpg, datetime

async def main():
    conn = await asyncpg.connect(host='localhost', port=5432, database='rmfood', user='postgres', password='password')
    try:
        now = datetime.datetime(2024, 6, 1, 10, 0, 0)
        created = datetime.datetime(2024, 1, 15, 10, 0, 0)

        def cn(*codes):
            return ''.join(chr(c) for c in codes)

        # ── food_materials ──
        print("[1] food_materials")
        existing_fm = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        print(f"  existing: {existing_fm}")

        if existing_fm == 0:
            # 35 columns (excluding auto id)
            safe_cols = [
                "external_id","gb_code","name_cn","name_latin","name_en",
                "category","sub_category","food_homology","toxicity_class",
                "active_ingredients","compound_refs","effects","indications",
                "ob_percent","dl_value","bioavailability_score","safe_dose_min",
                "safe_dose_max","contraindications","interactions",
                "regulatory_status","approved_regions","max_daily_intake",
                "suppliers","origin_countries","description","image_url",
                "msds_url","coa_url","embedding","source_db","data_quality",
                "review_status","created_at","updated_at"
            ]
            n = len(safe_cols)
            placeholders = ",".join(["$"+str(i+1) for i in range(n)])
            sql = "INSERT INTO food_materials (" + ",".join(safe_cols) + ") VALUES (" + placeholders + ")"
            print(f"  cols={n}")

            def fm(eid, gb, name_cn, latin, en, cat, hom, tox, ob, dl, sdb, dq, st, desc, sub=""):
                return [eid, gb, name_cn, latin, en, cat, sub, hom, tox,
                        None, None, None, None, ob, dl, 0.0, 0.0, 0.0,
                        None, None, None, None, None, None,
                        None, None, desc, None, None, None,
                        sdb, dq, st, created, now]

            samples = [
                fm("YX001","GB/T 18672",cn(0x6784,0x675e,0x5b50),"Lycium barbarum","Goji Berry",cn(0x8865,0x76ca,0x7c7b),True,cn(0x4f4e,0x6bd2),40.0,70.0,"plant_cnm",0.95,"approved",cn(0x836f,0x98df,0x540c,0x6e90)),
                fm("YX002","GB/T 13408",cn(0x7ea2,0x67a3),"Ziziphus jujuba","Jujube",cn(0x8865,0x76ca,0x7c7b),True,cn(0x4f4e,0x6bd2),37.0,60.0,"plant_cnm",0.92,"approved",cn(0x5e38,0x7528,0x836f,0x98df,0x540c,0x6e90)),
                fm("YX003","GB 2762",cn(0x5c71,0x836f),"Dioscorea opposita","Chinese Yam",cn(0x8865,0x76ca,0x7c7b),True,cn(0x4f4e,0x6bd2),65.0,80.0,"plant_cnm",0.93,"approved",cn(0x836f,0x98df,0x4e24,0x7528)),
                fm("YX004","ChP 2020",cn(0x9ec4,0x82aa),"Astragalus membranaceus","Astragalus Root",cn(0x8865,0x76ca,0x7c7b),True,cn(0x4f4e,0x6bd2),60.0,80.0,"plant_cnm",0.90,"approved",cn(0x8865,0x6c14,0x8981,0x836f)),
                fm("YX005","ChP 2020",cn(0x4eba,0x53c2),"Panax ginseng","Ginseng Root",cn(0x8865,0x76ca,0x7c7b),False,cn(0x5c0f,0x6bd2),80.0,100.0,"plant_cnm",0.97,"approved",cn(0x8349,0x6728,0x4e4b,0x738b)),
                fm("YX006","GB/T 18627",cn(0x6842,0x82b1),"Chrysanthemum morifolium","Chrysanthemum",cn(0x6e05,0x70ed,0x7c7b),True,cn(0x4f4e,0x6bd2),70.0,85.0,"plant_cnm",0.88,"approved",cn(0x6e05,0x70ed,0x660e,0x76ee)),
                fm("YX007","ChP 2020",cn(0x91d1,0x94f6,0x82b1),"Lonicera japonica","Honeysuckle",cn(0x6e05,0x70ed,0x7c7b),True,cn(0x4f4e,0x6bd2),55.0,70.0,"plant_cnm",0.91,"approved",cn(0x89e3,0x6bd2,0x6e05,0x70ed)),
                fm("YX008","ChP 2020",cn(0x9648,0x76ae),"Citrus reticulata","Tangerine Peel",cn(0x7406,0x6c14,0x7c7b),True,cn(0x4f4e,0x6bd2),65.0,80.0,"plant_cnm",0.89,"approved",cn(0x7406,0x6c14,0x5065,0x813e)),
                fm("YX009","GB 2760",cn(0x5c71,0x6813),"Crataegus pinnatifida","Hawthorn",cn(0x6d88,0x98df,0x7c7b),True,cn(0x4f4e,0x6bd2),55.0,70.0,"plant_cnm",0.87,"approved",cn(0x6d88,0x98df,0x5316,0x79ef)),
                fm("YX010","GB/T 11765",cn(0x85cf,0x82e1,0x4ec1),"Coix lacryma-jobi","Coix Seed",cn(0x5229,0x6c34,0x6e7f,0x7c7b),True,cn(0x4f4e,0x6bd2),60.0,75.0,"plant_cnm",0.85,"approved",cn(0x5229,0x6c34,0x6e7f,0x836f)),
                fm("YS001","GB 2762",cn(0x5927,0x8c46),"Glycine max","Soybean",cn(0x8c46,0x7c7b),False,cn(0x4f4e,0x6bd2),35.0,50.0,"global_foods",0.96,"approved",cn(0x690d,0x7269,0x86cb,0x767d)),
                fm("YS002","GB 2762",cn(0x9ed1,0x829d,0x9ebb),"Sesamum indicum","Black Sesame",cn(0x6cb9,0x6599,0x79cd,0x5b5e),False,cn(0x4f4e,0x6bd2),45.0,60.0,"global_foods",0.88,"approved",cn(0x8865,0x76ca,0x809d,0x80be)),
                fm("YS003","GB 2762",cn(0x6838,0x6843,0x4ec1),"Juglans regia","Walnut Kernel",cn(0x575a,0x679c,0x7c7b),False,cn(0x4f4e,0x6bd2),50.0,65.0,"global_foods",0.90,"approved",cn(0x667a,0x74e6,0x8865,0x8111)),
            ]
            inserted = 0
            for row in samples:
                assert len(row) == n, f"Row has {len(row)} vals, need {n}: {row[2]}"
                try:
                    await conn.execute(sql, *row)
                    inserted += 1
                except Exception as e:
                    msg = str(e)
                    if 'duplicate' not in msg.lower() and 'unique' not in msg.lower() and 'null' not in msg.lower():
                        print(f"  ERR {row[2]}: {msg[:80]}")
            print(f"  inserted: {inserted}")

        # ── tcm_herbs ──
        print("\n[2] tcm_herbs")
        existing_th = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
        print(f"  existing: {existing_th}")

        if existing_th < 20:
            # 34 columns (excluding auto id)
            th_cols = [
                "name","name_latin","pinyin","category","properties",
                "meridian_tropism","functions","indications","dosage","toxicity",
                "contraindications","chemical_composition","modern_research",
                '"references"',"source_url","quality_score","last_updated",
                "created_at","updated_at","name_cn","name_pinyin",
                "ob_percent","dl_value","effects","is_food_homology",
                "tcmsp_id","source","source_version","extra_knowledge",
                "synced_at","compounds","targets","diseases"
            ]
            n = len(th_cols)
            th_sql = "INSERT INTO tcm_herbs (" + ",".join(th_cols) + ") VALUES (" + ",".join(["$"+str(i+1) for i in range(n)]) + ")"
            print(f"  cols={n}")

            def th(name, latin, pinyin, cat, props, merid, func, ind, dose, tox, contra, chem, research, qual, ob, dl, eff, food_homo, tcmsp, src, ver):
                return [name, latin, pinyin, cat, props, merid, func, ind, dose, tox,
                        contra, chem, research, None, None, qual, None,
                        created, now, name, None, ob, dl, eff, food_homo,
                        tcmsp, src, ver, None, None, None, None, None]

            th_samples = [
                th(cn(0x515a,0x53c2), "Codonopsis pilosula", cn(0x515a,0x53c2), cn(0x8865,0x76ca,0x7c7b), None, cn(0x813e,0x80ba,0x7ecf), cn(0x8865,0x4e2d,0x76ca,0x6c14), cn(0x813e,0x865a,0x98df,0x6f38), "9-30g", cn(0x65e0,0x6bd2), cn(0x5b9e,0x8bc1,0x8005,0x614e,0x7528), None, None, 0.85, 55.0, 0.70, cn(0x5065,0x813e,0x8865,0x6c14), False, "TCMS001", cn(0x6838), "v2024"),
                th(cn(0x767d,0x672f), "Atractylodes macrocephala", cn(0x767d,0x672f), cn(0x8865,0x76ca,0x7c7b), None, cn(0x813e,0x80c3,0x7ecf), cn(0x5065,0x813e,0x76ca,0x6c14), cn(0x813e,0x865a,0x6c34,0x80bf), "6-12g", cn(0x65e0,0x6bd2), cn(0x9634,0x865a,0x5185,0x70ed,0x8005,0x614e,0x7528), None, None, 0.82, 50.0, 0.65, cn(0x5065,0x813e,0x6469,0x6e7f), False, "TCMS002", cn(0x6838,0x8539), "v2024"),
                th(cn(0x8331,0x82d3), "Poria cocos", cn(0x8331,0x82d3), cn(0x5229,0x6c34,0x6e7f,0x7c7b), None, cn(0x5fc3,0x813e,0x80be,0x7ecf), cn(0x5229,0x6c34,0x6e7f), cn(0x6c34,0x80bf,0x6c5f,0x5c11), "9-15g", cn(0x65e0,0x6bd2), cn(0x80be,0x865a,0x6eda,0x7cbe,0x8005,0x614e,0x7528), None, None, 0.80, 45.0, 0.60, cn(0x5229,0x6c34,0x5065,0x813e), False, "TCMS003", cn(0x83cc,0x838e), "v2024"),
                th(cn(0x7518,0x8349), "Glycyrrhiza uralensis", cn(0x7518,0x8349), cn(0x8865,0x76ca,0x7c7b), None, cn(0x5fc3,0x80ba,0x813e,0x80c3,0x7ecf), cn(0x8865,0x813e,0x76ca,0x6c14), cn(0x5fc3,0x6c14,0x865a), "2-10g", cn(0x65e0,0x6bd2), cn(0x6e7f,0x76db,0x80c3,0x6ee1,0x8005,0x614e,0x7528), None, None, 0.90, 60.0, 0.75, cn(0x8c03,0x548c,0x8bf8,0x836f), False, "TCMS004", cn(0x6838), "v2024"),
                th(cn(0x5f53,0x5f52), "Angelica sinensis", cn(0x5f53,0x5f52), cn(0x8865,0x8840,0x7c7b), None, cn(0x809d,0x5fc3,0x813e,0x7ecf), cn(0x8865,0x8840,0x6d3b,0x8840), cn(0x8840,0x865a,0x84bc,0x9ec4), "6-12g", cn(0x65e0,0x6bd2), cn(0x9634,0x865a,0x5185,0x70ed,0x8005,0x614e,0x7528), None, None, 0.88, 48.0, 0.68, cn(0x8865,0x8840,0x6d3b,0x8840), False, "TCMS005", cn(0x6838), "v2024"),
                th(cn(0x9ec4,0x82af), "Scutellaria baicalensis", cn(0x9ec4,0x82af), cn(0x6e05,0x70ed,0x7c7b), None, cn(0x5fc3,0x80ba,0x80c6,0x5927,0x80a0,0x7ecf), cn(0x6e05,0x70ed,0x6469,0x6e7f), cn(0x6e7f,0x70ed,0x70ed,0x75c5), "3-9g", cn(0x5bd2), cn(0x813e,0x80c3,0x865a,0x5bd2,0x8005,0x614e,0x7528), None, None, 0.89, 52.0, 0.70, cn(0x6e05,0x70ed,0x6469,0x6e7f), False, "TCMS014", cn(0x6838), "v2024"),
                th(cn(0x9ec4,0x8fde), "Coptis chinensis", cn(0x9ec4,0x8fde), cn(0x6e05,0x70ed,0x7c7b), None, cn(0x5fc3,0x813e,0x80c3,0x809d,0x80c6,0x5927,0x80a0,0x7ecf), cn(0x6e05,0x70ed,0x6469,0x6e7f), cn(0x6e7f,0x70ed,0x75d8,0x6ee1), "2-5g", cn(0x5927,0x82e6,0x5927,0x5bd2), cn(0x813e,0x80c3,0x865a,0x5bd2,0x8005,0x614e,0x7528), None, None, 0.91, 48.0, 0.68, cn(0x6e05,0x70ed,0x6469,0x6e7f), False, "TCMS015", cn(0x6838,0x8539), "v2024"),
                th(cn(0x91d1,0x94f6,0x82b1), "Lonicera japonica", cn(0x91d1,0x94f6,0x82b1), cn(0x6e05,0x70ed,0x7c7b), None, cn(0x80ba,0x5fc3,0x80c3,0x7ecf), cn(0x89e3,0x6bd2,0x6e05,0x70ed), cn(0x75a4,0x75d8,0x75d9,0x79ef), "6-15g", cn(0x7518,0x5bd2), cn(0x813e,0x80c3,0x865a,0x5bd2,0x8005,0x614e,0x7528), None, None, 0.90, 55.0, 0.72, cn(0x89e3,0x6bd2,0x6e05,0x70ed), True, "TCMS016", cn(0x82b1), "v2024"),
                th(cn(0x751f,0x59dc), "Zingiber officinale", cn(0x751f,0x59dc), cn(0x89e3,0x8868,0x7c7b), None, cn(0x813e,0x80c3,0x7ecf), cn(0x89e3,0x8868,0x6563,0x5bd2), cn(0x98ce,0x5bd2,0x611f,0x5192), "3-10g", cn(0x8f9b,0x6e29), cn(0x9634,0x865a,0x5185,0x70ed,0x8005,0x614e,0x7528), None, None, 0.92, 62.0, 0.78, cn(0x89e3,0x8868,0x6563,0x5bd2), True, "TCMS020", cn(0x6838,0x8539), "v2024"),
                th(cn(0x67f4,0x80e1), "Bupleurum chinense", cn(0x67f4,0x80e1), cn(0x89e3,0x8868,0x7c7b), None, cn(0x809d,0x80c6,0x80ba,0x7ecf), cn(0x6563,0x70ed,0x9000,0x70ed), cn(0x611f,0x5192,0x53d1,0x70ed), "3-9g", cn(0x65e0,0x6bd2), cn(0x9634,0x865a,0x9633,0x65fa,0x8005,0x614e,0x7528), None, None, 0.87, 48.0, 0.65, cn(0x758f,0x809d,0x89e3,0x90c1), False, "TCMS013", cn(0x6838), "v2024"),
                th(cn(0x85b6,0x8584), "Mentha haplocalyx", cn(0x85b6,0x8584), cn(0x89e3,0x8868,0x7c7b), None, cn(0x80ba,0x809d,0x7ecf), cn(0x6563,0x758f,0x98ce,0x70ed), cn(0x98ce,0x70ed,0x611f,0x5192), "3-6g", cn(0x8f9b,0x51c9), cn(0x4f53,0x865a,0x591a,0x6c57,0x8005,0x614e,0x7528), None, None, 0.88, 58.0, 0.75, cn(0x6563,0x758f,0x98ce,0x70ed), False, "TCMS019", cn(0x5730,0x4e0a,0x90e8,0x5206), "v2024"),
                th(cn(0x767d,0x82cd), "Paeonia lactiflora", cn(0x767d,0x82cd), cn(0x8865,0x8840,0x7c7b), None, cn(0x809d,0x813e,0x7ecf), cn(0x517b,0x8840,0x8c03,0x7ecf), cn(0x8840,0x865a,0x84bc,0x9ec4), "6-15g", cn(0x65e0,0x6bd2), cn(0x865a,0x5bd2,0x8bc1,0x8005,0x614e,0x7528), None, None, 0.83, 42.0, 0.58, cn(0x517b,0x8840,0x67d4,0x809d), False, "TCMS007", cn(0x6838), "v2024"),
                th(cn(0x719f,0x5730,0x9ec4), "Rehmannia glutinosa", cn(0x719f,0x5730,0x9ec4), cn(0x8865,0x8840,0x7c7b), None, cn(0x809d,0x80be,0x7ecf), cn(0x8865,0x8840,0x517b,0x9634), cn(0x8840,0x865a,0x84bc,0x9ec4), "9-15g", cn(0x65e0,0x6bd2), cn(0x813e,0x865a,0x6e7f,0x6ede,0x8005,0x614e,0x7528), None, None, 0.86, 46.0, 0.64, cn(0x8865,0x8840,0x586b,0x7cbe), False, "TCMS008", cn(0x6838), "v2024"),
                th(cn(0x8fea,0x5b50), "Evodia rutaecarpa", cn(0x8fea,0x5b50), cn(0x6e7f,0x70ed,0x7c7b), None, cn(0x813e,0x80c3,0x80ba,0x7ecf), cn(0x89e3,0x6e7f,0x6b62,0x6c57), cn(0x95fb,0x5c3f), "1.5-5g", cn(0x6709,0x6bd2), cn(0x9634,0x865a,0x706b,0x65fa,0x8005,0x614e,0x7528), None, None, 0.78, 40.0, 0.55, cn(0x89e3,0x6e7f,0x6b62,0x6c57), False, "TCMS025", cn(0x679c,0x5b9e), "v2024"),
                th(cn(0x84b2,0x516c,0x82f1), "Taraxacum mongolicum", cn(0x84b2,0x516c,0x82f1), cn(0x6e05,0x70ed,0x7c7b), None, cn(0x809d,0x80c3,0x7ecf), cn(0x6e05,0x70ed,0x89e3,0x6bd2), cn(0x75a4,0x75d8,0x75d9,0x79ef), "9-15g", cn(0x5bd2), cn(0x813e,0x80c3,0x865a,0x5bd2,0x8005,0x614e,0x7528), None, None, 0.83, 42.0, 0.58, cn(0x6e05,0x70ed,0x89e3,0x6bd2), False, "TCMS026", cn(0x5168,0x8349), "v2024"),
            ]
            inserted = 0
            for row in th_samples:
                assert len(row) == n, f"TH row has {len(row)} vals, need {n}: {row[0]}"
                try:
                    await conn.execute(th_sql, *row)
                    inserted += 1
                except Exception as e:
                    msg = str(e)
                    if 'duplicate' not in msg.lower() and 'unique' not in msg.lower() and 'null' not in msg.lower():
                        print(f"  TCM ERR {row[0]}: {msg[:80]}")
                    elif 'null' in msg.lower():
                        print(f"  TCM NULL {row[0]}: {msg[:80]}")
            print(f"  inserted: {inserted}")

        # ── peptides ──
        print("\n[3] peptides")
        p_cnt = await conn.fetchval("SELECT COUNT(*) FROM peptides")
        print(f"  peptides: {p_cnt}")

        # ── Final ──
        print("\n[FINAL COUNTS]")
        for t in ["food_materials","bioactive_peptides","peptides","tcm_herbs","symmap_herbs","peptide_batch_coas","coa_test_items"]:
            cnt = await conn.fetchval(f'SELECT COUNT(*) FROM "{t}"')
            print(f"  {t:35s} {cnt}")

        # Verify
        fm_cnt = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        if fm_cnt > 0:
            print(f"\n[food_materials sample {fm_cnt} rows]")
            rows = await conn.fetch("SELECT external_id, name_cn, category, source_db FROM food_materials LIMIT 5")
            for r in rows:
                print(f"  {r['external_id']} | {r['name_cn']} | {r['category']} | {r['source_db']}")

        th_cnt = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
        if th_cnt > 10:
            print(f"\n[tcm_herbs sample {th_cnt} total, last 5]")
            rows = await conn.fetch("SELECT name, name_cn, category, source FROM tcm_herbs ORDER BY id DESC LIMIT 5")
            for r in rows:
                print(f"  {r['name']} | {r['name_cn']} | {r['category']} | {r['source']}")

    finally:
        await conn.close()

asyncio.run(main())
