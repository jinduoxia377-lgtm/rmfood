import psycopg2
from datetime import datetime

conn = psycopg2.connect(dbname='rmfood', user='postgres', host='localhost')
cur = conn.cursor()

# Get current herbs
cur.execute('SELECT name_cn FROM hf_enriched_herbs')
current = [r[0] for r in cur.fetchall()]

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

missing = [h for h in official if h not in current]
print(f'Missing herbs: {missing}')

# Herb data mapping
herb_data = {
    '人参': {
        'latin': 'Panax ginseng',
        'category': '根茎类',
        'effects': '大补元气，复脉固脱，补脾益肺，生津养血，安神益智',
        'ob': 0.35, 'dl': 0.78, 'compounds': 150,
        'nature': '微温', 'meridians': '脾、肺、心经',
        'quality': 0.65
    },
    '蛇蜕': {
        'latin': 'Boiga multifasciata skin',
        'category': '动物类',
        'effects': '祛风解毒，明目退翳，通经下乳',
        'ob': 0.12, 'dl': 0.45, 'compounds': 25,
        'nature': '甘、咸，寒', 'meridians': '肝经',
        'quality': 0.55
    }
}

now = datetime.now()
for herb in missing:
    if herb in herb_data:
        d = herb_data[herb]
        cur.execute("""
            INSERT INTO hf_enriched_herbs 
            (name_cn, name_latin, category, effects, ob_percent, dl_value, compound_count,
             nature_cn, meridians_cn, image_path, data_quality_score, source, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            herb, d['latin'], d['category'], d['effects'],
            d['ob'], d['dl'], d['compounds'],
            d['nature'], d['meridians'], f'homology/{herb}.jpg',
            d['quality'], 'official', now
        ))
        print(f'Added: {herb}')

conn.commit()

# Final count
cur.execute('SELECT COUNT(*) FROM hf_enriched_herbs')
print(f'Final count: {cur.fetchone()[0]}')

# Verify
cur.execute('SELECT name_cn FROM hf_enriched_herbs ORDER BY name_cn')
final = [r[0] for r in cur.fetchall()]
extra = [h for h in final if h not in official]
print(f'Extra after cleanup: {extra}')

cur.close()
conn.close()
