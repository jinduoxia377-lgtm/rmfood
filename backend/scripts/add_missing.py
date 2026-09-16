import psycopg2
from datetime import datetime

conn = psycopg2.connect(dbname="rmfood", user="postgres", host="localhost")
cur = conn.cursor()

# Check current count
cur.execute("SELECT COUNT(*) FROM hf_enriched_herbs")
print(f"Current count: {cur.fetchone()[0]}")

# Check if 人参 and 蛇蜕 exist
cur.execute("SELECT name_cn FROM hf_enriched_herbs WHERE name_cn IN (%s, %s)", ("人参", "蛇蜕"))
existing = [r[0] for r in cur.fetchall()]
print(f"Existing: {existing}")

now = datetime.now()

# Insert 人参 if missing
if "人参" not in existing:
    cur.execute("""
        INSERT INTO hf_enriched_herbs 
        (name_cn, latin_name, category, effects, ob_percent, dl_value, compound_count,
         nature_cn, meridians_cn, image_path, data_quality_score, source_version)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, ("人参", "Panax ginseng", "根茎类", 
          "大补元气，复脉固脱，补脾益肺，生津养血，安神益智",
          0.35, 0.78, 150, "微温", "脾、肺、心经", 
          "homology/人参.jpg", 0.65, "official"))
    print("Added: 人参")

# Insert 蛇蜕 if missing
if "蛇蜕" not in existing:
    cur.execute("""
        INSERT INTO hf_enriched_herbs 
        (name_cn, latin_name, category, effects, ob_percent, dl_value, compound_count,
         nature_cn, meridians_cn, image_path, data_quality_score, source_version)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, ("蛇蜕", "Boiga multifasciata skin", "动物类",
          "祛风解毒，明目退翳，通经下乳",
          0.12, 0.45, 25, "甘、咸，寒", "肝经",
          "homology/蛇蜕.jpg", 0.55, "official"))
    print("Added: 蛇蜕")

conn.commit()

# Final verification
cur.execute("SELECT COUNT(*) FROM hf_enriched_herbs")
final = cur.fetchone()[0]
print(f"Final count: {final}")

cur.execute("SELECT name_cn FROM hf_enriched_herbs ORDER BY name_cn")
all_herbs = [r[0] for r in cur.fetchall()]

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

missing = [h for h in official if h not in all_herbs]
extra = [h for h in all_herbs if h not in official]

print(f"Missing: {missing}")
print(f"Extra: {extra}")
print(f"Status: {'ALIGNED' if len(missing) == 0 and len(extra) == 0 else 'NEEDS ATTENTION'}")

cur.close()
conn.close()
