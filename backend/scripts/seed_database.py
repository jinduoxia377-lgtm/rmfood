"""Seed database - auto-generated."""
import asyncio, asyncpg, datetime

async def main():
    conn = await asyncpg.connect(host="localhost", port=5432, database="rmfood", user="postgres", password="password")
    try:
        now = datetime.datetime(2024, 6, 1, 10, 0, 0)
        created = datetime.datetime(2024, 1, 15, 10, 0, 0)

        print("[1] food_materials")
        existing_fm = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        print(f"  existing: {existing_fm}")

        if existing_fm == 0:
            safe_cols = ["external_id","gb_code","name_cn","name_latin","name_en","category","food_homology","toxicity_class","ob_percent","dl_value","source_db","data_quality","review_status","description"]
            ph = ",".join(["$" + str(i+1) for i in range(len(safe_cols))])
            sql = "INSERT INTO food_materials (" + ", ".join(safe_cols) + ") VALUES (" + ph + ")"

            samples = [
                ('YX001', 'GB/T 18672', '狐梱子', 'Lycium barbarum', 'Goji Berry', '补益类', True, '低毒', 40.0, 70.0, 'plant_cnm', 0.95, 'approved', '药食同源补益药材'),
                ('YX002', 'GB/T 13408', '红枣', 'Ziziphus jujuba', 'Jujube', '补益类', True, '低毒', 37.0, 60.0, 'plant_cnm', 0.92, 'approved', '常用药食同源补益食材'),
                ('YX003', 'GB 2762', '山药', 'Dioscorea opposita', 'Chinese Yam', '补益类', True, '低毒', 65.0, 80.0, 'plant_cnm', 0.93, 'approved', '药食两用健脾食材'),
                ('YX004', 'ChP 2020', '黄芫', 'Astragalus membranaceus', 'Astragalus Root', '补益类', True, '低毒', 60.0, 80.0, 'plant_cnm', 0.9, 'approved', '补气要药'),
                ('YX005', 'ChP 2020', '人参', 'Panax ginseng', 'Ginseng Root', '补益类', False, '小毒', 80.0, 100.0, 'plant_cnm', 0.97, 'approved', '草木之王'),
                ('YX006', 'GB/T 18627', '桂花', 'Chrysanthemum morifolium', 'Chrysanthemum', '清热类', True, '低毒', 70.0, 85.0, 'plant_cnm', 0.88, 'approved', '清热明目佳品'),
                ('YX007', 'ChP 2020', '金银花', 'Lonicera japonica', 'Honeysuckle', '清热类', True, '低毒', 55.0, 70.0, 'plant_cnm', 0.91, 'approved', '解毒清热要药'),
                ('YX008', 'ChP 2020', '陈皮', 'Citrus reticulata', 'Tangerine Peel', '理气类', True, '低毒', 65.0, 80.0, 'plant_cnm', 0.89, 'approved', '理气健脾经典药材'),
                ('YX009', 'GB 2760', '山椰', 'Crataegus pinnatifida', 'Hawthorn', '消食类', True, '低毒', 55.0, 70.0, 'plant_cnm', 0.87, 'approved', '消食化积首选'),
                ('YX010', 'GB/T 11765', '薰舒仐', 'Coix lacryma-jobi', 'Coix Seed', '利水湿类', True, '低毒', 60.0, 75.0, 'plant_cnm', 0.85, 'approved', '利水湿药要药'),
                ('YS001', 'GB 2762', '大豆', 'Glycine max', 'Soybean', '豆类', False, '低毒', 35.0, 50.0, 'global_foods', 0.96, 'approved', '植物蛋白之王'),
                ('YS002', 'GB 2762', '黑芝麻', 'Sesamum indicum', 'Black Sesame', '油料种孞', False, '低毒', 45.0, 60.0, 'global_foods', 0.88, 'approved', '补益肝肾坚果'),
                ('YS003', 'GB 2762', '核桃仁', 'Juglans regia', 'Walnut Kernel', '坚果类', False, '低毒', 50.0, 65.0, 'global_foods', 0.9, 'approved', '智瓦补脑坚果'),
            ]
            inserted_fm = 0
            for row in samples:
                try:
                    await conn.execute(sql, row)
                    inserted_fm += 1
                except Exception as e:
                    msg = str(e)
                    if "duplicate" not in msg.lower() and "unique" not in msg.lower():
                        print(f"  ERR {row[2]}: {msg[:60]}")
            print(f"  inserted: {inserted_fm}")

        print("\n[2] tcm_herbs")
        existing_th = await conn.fetchval("SELECT COUNT(*) FROM tcm_herbs")
        print(f"  existing: {existing_th}")

        if existing_th < 20:
            th_cols = ["name_cn","name","name_latin","pinyin","category","properties","meridian_tropism","functions","indications","dosage","toxicity","contraindications","chemical_composition","modern_research","quality_score","last_updated","created_at","updated_at","name_pinyin","ob_percent","dl_value","effects","is_food_homology","tcmsp_id","source","source_version"]
            th_ph = ",".join(["$" + str(i+1) for i in range(len(th_cols))])
            th_sql = "INSERT INTO tcm_herbs (" + ", ".join(th_cols) + ") VALUES (" + th_ph + ")"

            th_samples = [
                ('党参', '党参', 'Codonopsis pilosula', '党参', '补益类', '甘', '脾肺经', '补中益气', '脾虚食漸', '9-30g', '无毒', '实证者慎用', '含荷荷', '0.85', 55.0, 0.7, '健脾补气', False, 'TCMS001', '核', 'v2024'),
                ('白术', '白术', 'Atractylodes macrocephala', '白术', '补益类', '苦甘温', '脾胃经', '健脾益气', '脾虚水肿', '6-12g', '无毒', '阴虚内热者慎用', '含挥发油', '0.82', 50.0, 0.65, '健脾摩湿', False, 'TCMS002', '核蔹', 'v2024'),
                ('茱苓', '茱苓', 'Poria cocos', '茱苓', '利水湿类', '甘淡平', '心脾肾经', '利水湿', '水肿江少', '9-15g', '无毒', '肾虚滚精者慎用', '含茱苓', '0.80', 45.0, 0.6, '利水健脾', False, 'TCMS003', '菌莎', 'v2024'),
                ('甘草', '甘草', 'Glycyrrhiza uralensis', '甘草', '补益类', '甘平', '心肺脾胃经', '补脾益气', '心气虚', '2-10g', '无毒', '湿盛胃满者慎用', '含甘草酸', '0.90', 60.0, 0.75, '调和诸药', False, 'TCMS004', '核', 'v2024'),
                ('当归', '当归', 'Angelica sinensis', '当归', '补血类', '甘辛温', '肝心脾经', '补血活血', '血虚蒼黄', '6-12g', '无毒', '阴虚内热者慎用', '含挥发油', '0.88', 48.0, 0.68, '补血活血', False, 'TCMS005', '核', 'v2024'),
                ('黄芯', '黄芯', 'Scutellaria baicalensis', '黄芯', '清热类', '苦寒', '心肺胆大肠经', '清热摩湿', '湿热热病', '3-9g', '寒', '脾胃虚寒者慎用', '含黄芯荷', '0.89', 52.0, 0.7, '清热摩湿', False, 'TCMS014', '核', 'v2024'),
                ('黄连', '黄连', 'Coptis chinensis', '黄连', '清热类', '苦寒', '心脾胃肝胆大肠经', '清热摩湿', '湿热痘满', '2-5g', '大苦大寒', '脾胃虚寒者慎用', '含小樔碱', '0.91', 48.0, 0.68, '清热摩湿', False, 'TCMS015', '核蔹', 'v2024'),
                ('金银花', '金银花', 'Lonicera japonica', '金银花', '清热类', '甘寒', '肺心胃经', '解毒清热', '疤痘痙积', '6-15g', '甘寒', '脾胃虚寒者慎用', '含绿原酸', '0.90', 55.0, 0.72, '解毒清热', True, 'TCMS016', '花', 'v2024'),
                ('生姜', '生姜', 'Zingiber officinale', '生姜', '解表类', '辛微温', '脾胃经', '解表散寒', '风寒感冒', '3-10g', '辛温', '阴虚内热者慎用', '含姜辛素', '0.92', 62.0, 0.78, '解表散寒', True, 'TCMS020', '核蔹', 'v2024'),
                ('柴胡', '柴胡', 'Bupleurum chinense', '柴胡', '解表类', '苦辛微寒', '肝胆肺经', '散热退热', '感冒发热', '3-9g', '无毒', '阴虚阳旺者慎用', '含柴胡荷荷', '0.87', 48.0, 0.65, '疏肝解郁', False, 'TCMS013', '核', 'v2024'),
                ('薶薄', '薶薄', 'Mentha haplocalyx', '薶薄', '解表类', '辛凉', '肺肝经', '散疏风热', '风热感冒', '3-6g', '辛凉', '体虚多汗者慎用', '含薶薄醇', '0.88', 58.0, 0.75, '散疏风热', False, 'TCMS019', '地上部分', 'v2024'),
                ('白苍', '白苍', 'Paeonia lactiflora', '白苍', '补血类', '苦酸微寒', '肝脾经', '养血调经', '血虚蒼黄', '6-15g', '无毒', '虚寒证者慎用', '含苍药荷', '0.83', 42.0, 0.58, '养血柔肝', False, 'TCMS007', '核', 'v2024'),
                ('熟地黄', '熟地黄', 'Rehmannia glutinosa', '熟地黄', '补血类', '甘微温', '肝肾经', '补血养阴', '血虚蒼黄', '9-15g', '无毒', '脾虚湿滞者慎用', '含环烷荷', '0.86', 46.0, 0.64, '补血填精', False, 'TCMS008', '核', 'v2024'),
                ('迪子', '迪子', 'Evodia rutaecarpa', '迪子', '湿热类', '辛热有毒', '脾胃肺经', '解湿止汗', '闻尿', '1.5-5g', '有毒', '阴虚火旺者慎用', '含迪子素', '0.78', 40.0, 0.55, '解湿止汗', False, 'TCMS025', '果实', 'v2024'),
                ('蒲公英', '蒲公英', 'Taraxacum mongolicum', '蒲公英', '清热类', '苦甘寒', '肝胃经', '清热解毒', '疤痘痙积', '9-15g', '寒', '脾胃虚寒者慎用', '含蒲公酸', '0.83', 42.0, 0.58, '清热解毒', False, 'TCMS026', '全草', 'v2024'),
            ]
            inserted_th = 0
            for row in th_samples:
                try:
                    await conn.execute(th_sql, row)
                    inserted_th += 1
                except Exception as e:
                    msg = str(e)
                    if "duplicate" not in msg.lower() and "unique" not in msg.lower():
                        print(f"  TCM ERR {row[0]}: {msg[:60]}")
            print(f"  inserted: {inserted_th}")

        print("\n[3] peptides migration")
        pcols = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name='peptides' ORDER BY ordinal_position")
        pcol_names = [r["column_name"] for r in pcols]
        src_map = {"sequence":"sequence","name":"name","source_protein":"source","source_organism":"source_organism","molecular_weight":"molecular_weight","activity_type":"activity_type","activity_value":"activity_value","activity_unit":"activity_unit","dfbp_id":"dfbp_id"}
        valid = [(s,t) for s,t in src_map.items() if t in pcol_names]
        if valid:
            src_l, tgt_l = zip(*valid)
            cast_src = list(src_l)
            for i, s in enumerate(cast_src):
                if s == "activity_value":
                    cast_src[i] = f"{s}::double precision"
            try:
                sql = "INSERT INTO peptides (" + ", ".join(tgt_l) + ", created_at) SELECT " + ", ".join(cast_src) + ", NOW() FROM bioactive_peptides WHERE sequence IS NOT NULL AND activity_type IS NOT NULL LIMIT 50"
                await conn.execute(sql)
                new_cnt = await conn.fetchval("SELECT COUNT(*) FROM peptides")
                print(f"  peptides: {new_cnt}")
            except Exception as e:
                print(f"  migrate ERR: {e}")

        print("\n[FINAL COUNTS]")
        for t in ["food_materials","bioactive_peptides","peptides","tcm_herbs","symmap_herbs","peptide_batch_coas","coa_test_items"]:
            cnt = await conn.fetchval(f'SELECT COUNT(*) FROM "{t}"')
            print(f"  {t:35s} {cnt}")

    finally:
        await conn.close()

asyncio.run(main())