import psycopg2

conn = psycopg2.connect(dbname='rmfood', user='postgres', host='localhost')
cur = conn.cursor()

official = ['阿胶','八角茴香','白扁豆','白扁豆花','白果','白芷','百合','薄荷','荜茇','草果',
    '赤小豆','代代花','淡豆豉','淡竹叶','当归','党参','刀豆','地黄','丁香','杜仲叶',
    '茯苓','覆盆子','甘草','高良姜','葛根','枸杞子','荷叶','黑胡椒','黑芝麻','花椒',
    '化橘红','槐花','槐米','黄芥子','黄精','黄芪','火麻仁','藿香','鸡内金','姜',
    '姜黄','金银花','桔梗','桔红','菊花','菊苣','橘皮','决明子','昆布','莱菔子',
    '莲子','灵芝','龙眼肉','罗汉果','马齿苋','麦冬','麦芽','牡蛎','木瓜','胖大海',
    '蒲公英','芡实','青果','人参','肉苁蓉','肉豆蔻','肉桂','桑椹','桑叶','沙棘',
    '砂仁','山柰','山药','山楂','山茱萸','蛇蜕','酸枣仁','桃仁','天冬','天麻',
    '铁皮石斛','乌梅','乌梢蛇','西红花','西洋参','鲜白茅根','鲜芦根','香薷','香橼',
    '小茴香','小蓟','薤白','杏仁','益智仁','薏苡仁','余甘子','鱼腥草','玉竹',
    '郁李仁','枣','栀子','枳椇子','紫苏','紫苏籽']

cur.execute('SELECT COUNT(*) FROM hf_enriched_herbs')
total = cur.fetchone()[0]

cur.execute('SELECT name_cn FROM hf_enriched_herbs ORDER BY name_cn')
current = [r[0] for r in cur.fetchall()]

missing = [h for h in official if h not in current]
extra = [h for h in current if h not in official]

print(f'Official: {len(official)}')
print(f'Database: {total}')
print(f'Missing: {missing}')
print(f'Extra: {extra}')
print(f'Status: {"ALIGNED" if len(missing) == 0 and len(extra) == 0 else "NOT ALIGNED"}')

# Quality stats
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN nature_cn IS NOT NULL THEN 1 END) as with_nature,
        COUNT(CASE WHEN meridians_cn IS NOT NULL THEN 1 END) as with_meridians,
        COUNT(CASE WHEN ob_percent IS NOT NULL THEN 1 END) as with_ob,
        COUNT(CASE WHEN compound_count > 0 THEN 1 END) as with_compounds,
        COUNT(CASE WHEN image_path IS NOT NULL AND image_path != '' THEN 1 END) as with_image,
        ROUND(AVG(data_quality_score)::numeric, 2) as avg_quality
    FROM hf_enriched_herbs
""")
row = cur.fetchone()
print(f'Quality: total={row[0]}, nature={row[1]}, meridians={row[2]}, ob={row[3]}, compounds={row[4]}, image={row[5]}, avg={row[6]}')

cur.close()
conn.close()
